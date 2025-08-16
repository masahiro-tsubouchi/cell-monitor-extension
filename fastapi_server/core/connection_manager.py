from typing import List, Dict, Any, Set
from datetime import datetime
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}  # client_id -> WebSocket
        self.connection_metadata: Dict[str, Dict[str, Any]] = {}  # client_id -> metadata
        self.rooms: Dict[str, Set[str]] = {}  # room -> set of client_ids

    async def connect(self, websocket: WebSocket, client_id: str = None, room: str = "default"):
        """新しいWebSocket接続を受け入れ、管理情報に追加する"""
        await websocket.accept()
        
        if client_id is None:
            client_id = f"client_{len(self.active_connections)}"
        
        # 既存接続があれば切断
        if client_id in self.active_connections:
            await self.disconnect(client_id)
        
        self.active_connections[client_id] = websocket
        self.connection_metadata[client_id] = {
            "connected_at": datetime.utcnow().isoformat(),
            "room": room,
            "last_activity": datetime.utcnow().isoformat()
        }
        
        # ルームに追加
        if room not in self.rooms:
            self.rooms[room] = set()
        self.rooms[room].add(client_id)
        
        print(f"Client {client_id} connected to room {room}")

    async def disconnect(self, client_id: str):
        """WebSocket接続を切断し、管理情報から削除する"""
        if client_id in self.active_connections:
            try:
                websocket = self.active_connections[client_id]
                await websocket.close()
            except Exception as e:
                print(f"Error closing websocket for {client_id}: {e}")
            
            # ルームから削除
            if client_id in self.connection_metadata:
                room = self.connection_metadata[client_id].get("room", "default")
                if room in self.rooms and client_id in self.rooms[room]:
                    self.rooms[room].remove(client_id)
                    if not self.rooms[room]:  # ルームが空になったら削除
                        del self.rooms[room]
            
            del self.active_connections[client_id]
            if client_id in self.connection_metadata:
                del self.connection_metadata[client_id]
            
            print(f"Client {client_id} disconnected")

    def disconnect_by_websocket(self, websocket: WebSocket):
        """WebSocketオブジェクトから接続を切断"""
        client_id = None
        for cid, ws in self.active_connections.items():
            if ws == websocket:
                client_id = cid
                break
        
        if client_id:
            # 同期的に削除（非同期メソッドは呼べない）
            if client_id in self.connection_metadata:
                room = self.connection_metadata[client_id].get("room", "default")
                if room in self.rooms and client_id in self.rooms[room]:
                    self.rooms[room].remove(client_id)
                    if not self.rooms[room]:
                        del self.rooms[room]
            
            del self.active_connections[client_id]
            if client_id in self.connection_metadata:
                del self.connection_metadata[client_id]

    async def send_personal_message(self, message: str, client_id: str):
        """特定のクライアントにメッセージを送信"""
        if client_id in self.active_connections:
            try:
                websocket = self.active_connections[client_id]
                await websocket.send_text(message)
                # アクティビティ更新
                if client_id in self.connection_metadata:
                    self.connection_metadata[client_id]["last_activity"] = datetime.utcnow().isoformat()
            except Exception as e:
                print(f"Failed to send message to {client_id}: {e}")
                await self.disconnect(client_id)

    async def broadcast(self, message: str, room: str = None):
        """接続中のクライアントにメッセージを一斉送信する"""
        if room:
            # 特定のルームにブロードキャスト
            if room in self.rooms:
                client_ids = list(self.rooms[room])
                for client_id in client_ids:
                    await self.send_personal_message(message, client_id)
        else:
            # 全体にブロードキャスト
            client_ids = list(self.active_connections.keys())
            for client_id in client_ids:
                await self.send_personal_message(message, client_id)

    async def broadcast_to_instructors(self, message: str):
        """講師用ルームにブロードキャスト"""
        await self.broadcast(message, room="instructors")

    async def broadcast_to_students(self, message: str):
        """学生用ルームにブロードキャスト"""
        await self.broadcast(message, room="students")

    def get_connection_stats(self) -> Dict[str, Any]:
        """接続統計情報を取得"""
        stats = {
            "total_connections": len(self.active_connections),
            "rooms": {},
            "connections": []
        }
        
        # ルーム統計
        for room, client_ids in self.rooms.items():
            stats["rooms"][room] = len(client_ids)
        
        # 接続詳細
        for client_id, metadata in self.connection_metadata.items():
            stats["connections"].append({
                "client_id": client_id,
                "connected_at": metadata["connected_at"],
                "room": metadata["room"],
                "last_activity": metadata["last_activity"]
            })
        
        return stats

    async def cleanup_stale_connections(self, timeout_minutes: int = 30):
        """非アクティブな接続をクリーンアップ"""
        from datetime import datetime, timedelta
        
        cutoff_time = datetime.utcnow() - timedelta(minutes=timeout_minutes)
        stale_clients = []
        
        for client_id, metadata in self.connection_metadata.items():
            last_activity = datetime.fromisoformat(metadata["last_activity"])
            if last_activity < cutoff_time:
                stale_clients.append(client_id)
        
        for client_id in stale_clients:
            await self.disconnect(client_id)
        
        return len(stale_clients)


# アプリケーション全体で共有するシングルトンインスタンスを作成
manager = ConnectionManager()
