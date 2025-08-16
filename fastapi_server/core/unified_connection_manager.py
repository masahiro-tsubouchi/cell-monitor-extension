"""
統一WebSocket接続管理システム
Phase 2: 拡張性と効率性を重視した統合アーキテクチャ

既存の3つの管理システムを統合:
- ConnectionManager (汎用)
- InstructorConnectionManager (講師専用)  
- dashboard_manager (ダッシュボード専用)
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Set, Any, Optional, List, Callable
from enum import Enum
from dataclasses import dataclass
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ClientType(Enum):
    """クライアントタイプ定義"""
    STUDENT = "student"
    INSTRUCTOR = "instructor"
    DASHBOARD = "dashboard"
    ADMIN = "admin"


@dataclass
class ConnectionInfo:
    """接続情報"""
    client_id: str
    client_type: ClientType
    websocket: WebSocket
    user_id: Optional[str] = None
    email: Optional[str] = None
    room: str = "default"
    connected_at: datetime = None
    last_activity: datetime = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.connected_at is None:
            self.connected_at = datetime.now(timezone.utc)
        if self.last_activity is None:
            self.last_activity = self.connected_at
        if self.metadata is None:
            self.metadata = {}


class MessageFilter:
    """メッセージフィルタリングシステム"""
    
    @staticmethod
    def should_send_to_client(message: Dict[str, Any], connection: ConnectionInfo) -> bool:
        """クライアントにメッセージを送信すべきかを判定"""
        message_type = message.get("type", "")
        
        # 講師向けフィルタリング
        if connection.client_type == ClientType.INSTRUCTOR:
            # 講師は自分の担当クラスの情報のみ受信
            if "class_id" in message:
                instructor_classes = connection.metadata.get("assigned_classes", [])
                return str(message["class_id"]) in map(str, instructor_classes)
            
            # 進捗通知は常に送信
            if message_type in ["progress_update", "student_help_request"]:
                return True
                
        # 学生向けフィルタリング
        elif connection.client_type == ClientType.STUDENT:
            # 学生は自分関連の情報のみ
            if "user_id" in message:
                return str(message["user_id"]) == str(connection.user_id)
                
        # ダッシュボード向けフィルタリング
        elif connection.client_type == ClientType.DASHBOARD:
            # ダッシュボードは集計情報を受信
            return message_type in ["dashboard_update", "system_stats", "class_summary"]
            
        return True


class UnifiedConnectionManager:
    """
    統一WebSocket接続管理システム
    
    特徴:
    - タイプ別クライアント管理
    - インテリジェントメッセージルーティング
    - 自動接続ヘルスチェック
    - スケーラブルな設計
    """
    
    def __init__(self):
        # コア管理データ
        self.connections: Dict[str, ConnectionInfo] = {}
        self.rooms: Dict[str, Set[str]] = {}
        self.client_type_index: Dict[ClientType, Set[str]] = {
            client_type: set() for client_type in ClientType
        }
        
        # フィルタリングシステム
        self.message_filter = MessageFilter()
        
        # イベントハンドラー
        self.event_handlers: Dict[str, List[Callable]] = {}
        
        # 統計情報
        self.stats = {
            "total_connections": 0,
            "connections_by_type": {ct.value: 0 for ct in ClientType},
            "messages_sent": 0,
            "messages_filtered": 0,
            "last_cleanup": datetime.now(timezone.utc)
        }
        
    async def connect(
        self,
        websocket: WebSocket,
        client_type: ClientType,
        client_id: Optional[str] = None,
        user_id: Optional[str] = None,
        email: Optional[str] = None,
        room: str = "default",
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        WebSocket接続を確立
        
        Args:
            websocket: WebSocket接続
            client_type: クライアントタイプ
            client_id: クライアントID（自動生成可）
            user_id: ユーザーID
            email: ユーザーメール
            room: 所属ルーム
            metadata: 追加メタデータ
            
        Returns:
            確立された接続のclient_id
        """
        await websocket.accept()
        
        # クライアントID生成
        if client_id is None:
            client_id = f"{client_type.value}_{len(self.connections)}_{int(datetime.now().timestamp())}"
            
        # 既存接続の処理
        if client_id in self.connections:
            await self.disconnect(client_id)
            
        # 接続情報作成
        connection_info = ConnectionInfo(
            client_id=client_id,
            client_type=client_type,
            websocket=websocket,
            user_id=user_id,
            email=email,
            room=room,
            metadata=metadata or {}
        )
        
        # 接続登録
        self.connections[client_id] = connection_info
        
        # ルーム管理
        if room not in self.rooms:
            self.rooms[room] = set()
        self.rooms[room].add(client_id)
        
        # タイプ別インデックス
        self.client_type_index[client_type].add(client_id)
        
        # 統計更新
        self.stats["total_connections"] = len(self.connections)
        self.stats["connections_by_type"][client_type.value] += 1
        
        # 接続成功通知
        await self.send_to_client(client_id, {
            "type": "connection_established",
            "client_id": client_id,
            "client_type": client_type.value,
            "connected_at": connection_info.connected_at.isoformat(),
            "message": f"{client_type.value.title()} connection established successfully"
        })
        
        # イベント発火
        await self._trigger_event("client_connected", connection_info)
        
        logger.info(f"Client {client_id} ({client_type.value}) connected to room {room}")
        return client_id
        
    async def disconnect(self, client_id: str) -> bool:
        """
        WebSocket接続を切断
        
        Args:
            client_id: 切断するクライアントID
            
        Returns:
            切断成功フラグ
        """
        if client_id not in self.connections:
            return False
            
        connection_info = self.connections[client_id]
        
        try:
            # WebSocket切断
            await connection_info.websocket.close()
        except Exception as e:
            logger.warning(f"Error closing websocket for {client_id}: {e}")
            
        # ルームから削除
        room = connection_info.room
        if room in self.rooms and client_id in self.rooms[room]:
            self.rooms[room].remove(client_id)
            if not self.rooms[room]:
                del self.rooms[room]
                
        # タイプ別インデックスから削除
        client_type = connection_info.client_type
        self.client_type_index[client_type].discard(client_id)
        
        # 接続削除
        del self.connections[client_id]
        
        # 統計更新
        self.stats["total_connections"] = len(self.connections)
        self.stats["connections_by_type"][client_type.value] -= 1
        
        # イベント発火
        await self._trigger_event("client_disconnected", connection_info)
        
        logger.info(f"Client {client_id} ({client_type.value}) disconnected")
        return True
        
    async def send_to_client(self, client_id: str, message: Dict[str, Any]) -> bool:
        """
        特定クライアントにメッセージ送信
        
        Args:
            client_id: 送信先クライアントID
            message: 送信メッセージ
            
        Returns:
            送信成功フラグ
        """
        if client_id not in self.connections:
            return False
            
        connection_info = self.connections[client_id]
        
        # フィルタリング
        if not self.message_filter.should_send_to_client(message, connection_info):
            self.stats["messages_filtered"] += 1
            return False
            
        try:
            await connection_info.websocket.send_text(json.dumps(message))
            
            # アクティビティ更新
            connection_info.last_activity = datetime.now(timezone.utc)
            self.stats["messages_sent"] += 1
            
            return True
        except Exception as e:
            logger.error(f"Failed to send message to {client_id}: {e}")
            # 接続エラーの場合は自動切断
            await self.disconnect(client_id)
            return False
            
    async def broadcast_to_room(self, room: str, message: Dict[str, Any]) -> int:
        """
        ルーム内全クライアントにブロードキャスト
        
        Args:
            room: 対象ルーム
            message: ブロードキャストメッセージ
            
        Returns:
            送信成功数
        """
        if room not in self.rooms:
            return 0
            
        success_count = 0
        client_ids = list(self.rooms[room])  # コピーして安全に反復
        
        for client_id in client_ids:
            if await self.send_to_client(client_id, message):
                success_count += 1
                
        return success_count
        
    async def broadcast_to_type(self, client_type: ClientType, message: Dict[str, Any]) -> int:
        """
        特定タイプの全クライアントにブロードキャスト
        
        Args:
            client_type: 対象クライアントタイプ
            message: ブロードキャストメッセージ
            
        Returns:
            送信成功数
        """
        success_count = 0
        client_ids = list(self.client_type_index[client_type])
        
        for client_id in client_ids:
            if await self.send_to_client(client_id, message):
                success_count += 1
                
        return success_count
        
    async def broadcast_to_all(self, message: Dict[str, Any]) -> int:
        """
        全クライアントにブロードキャスト
        
        Args:
            message: ブロードキャストメッセージ
            
        Returns:
            送信成功数
        """
        success_count = 0
        client_ids = list(self.connections.keys())
        
        for client_id in client_ids:
            if await self.send_to_client(client_id, message):
                success_count += 1
                
        return success_count
        
    def get_connection_stats(self) -> Dict[str, Any]:
        """接続統計情報を取得"""
        return {
            **self.stats,
            "rooms": {room: len(clients) for room, clients in self.rooms.items()},
            "active_connections": len(self.connections),
            "connections_detail": [
                {
                    "client_id": conn.client_id,
                    "type": conn.client_type.value,
                    "room": conn.room,
                    "user_id": conn.user_id,
                    "connected_duration_seconds": (
                        datetime.now(timezone.utc) - conn.connected_at
                    ).total_seconds()
                }
                for conn in self.connections.values()
            ]
        }
        
    async def cleanup_stale_connections(self, timeout_minutes: int = 30) -> int:
        """
        非アクティブ接続のクリーンアップ
        
        Args:
            timeout_minutes: タイムアウト時間（分）
            
        Returns:
            クリーンアップ数
        """
        from datetime import timedelta
        
        cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=timeout_minutes)
        stale_clients = []
        
        for client_id, connection_info in self.connections.items():
            if connection_info.last_activity < cutoff_time:
                stale_clients.append(client_id)
                
        for client_id in stale_clients:
            await self.disconnect(client_id)
            
        self.stats["last_cleanup"] = datetime.now(timezone.utc)
        
        if stale_clients:
            logger.info(f"Cleaned up {len(stale_clients)} stale connections")
            
        return len(stale_clients)
        
    def add_event_handler(self, event_name: str, handler: Callable):
        """イベントハンドラー追加"""
        if event_name not in self.event_handlers:
            self.event_handlers[event_name] = []
        self.event_handlers[event_name].append(handler)
        
    async def _trigger_event(self, event_name: str, *args, **kwargs):
        """イベント発火"""
        if event_name in self.event_handlers:
            for handler in self.event_handlers[event_name]:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        await handler(*args, **kwargs)
                    else:
                        handler(*args, **kwargs)
                except Exception as e:
                    logger.error(f"Event handler error for {event_name}: {e}")


# グローバルインスタンス
unified_manager = UnifiedConnectionManager()


# 後方互換性のためのラッパー関数
async def connect_student(websocket: WebSocket, user_id: str, room: str = "students") -> str:
    """学生接続のラッパー"""
    return await unified_manager.connect(
        websocket=websocket,
        client_type=ClientType.STUDENT,
        user_id=user_id,
        room=room
    )


async def connect_instructor(websocket: WebSocket, instructor_id: str, email: str, assigned_classes: List[str] = None) -> str:
    """講師接続のラッパー"""
    return await unified_manager.connect(
        websocket=websocket,
        client_type=ClientType.INSTRUCTOR,
        user_id=instructor_id,
        email=email,
        room="instructors",
        metadata={"assigned_classes": assigned_classes or []}
    )


async def connect_dashboard(websocket: WebSocket, client_id: str = None) -> str:
    """ダッシュボード接続のラッパー"""
    return await unified_manager.connect(
        websocket=websocket,
        client_type=ClientType.DASHBOARD,
        client_id=client_id,
        room="dashboard"
    )