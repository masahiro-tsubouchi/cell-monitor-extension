import json
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core.connection_manager import manager
from core.unified_connection_manager import unified_manager, ClientType

router = APIRouter()


@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str, room: str = "default"):
    """
    統一管理システム対応WebSocket接続エンドポイント
    クライアントIDとルームによる接続管理
    """
    # 統一管理システムで接続（デフォルトは学生タイプ）
    actual_client_id = await unified_manager.connect(
        websocket=websocket,
        client_type=ClientType.STUDENT,
        client_id=client_id,
        room=room
    )
    print(f"Client {actual_client_id} connected to room {room} via unified manager")
    
    try:
        
        while True:
            # クライアントからのメッセージを受信
            try:
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                # メッセージタイプに応じて処理
                await handle_websocket_message(message_data, actual_client_id, room)
                
            except json.JSONDecodeError:
                # JSON形式でない場合は単純なテキストメッセージとして処理
                await handle_simple_message(data, actual_client_id, room)
                
    except WebSocketDisconnect:
        await unified_manager.disconnect(actual_client_id)
        print(f"Client {actual_client_id} disconnected from room {room}")
    except Exception as e:
        print(f"WebSocket error for client {actual_client_id}: {e}")
        await unified_manager.disconnect(actual_client_id)


async def handle_websocket_message(message_data: dict, client_id: str, room: str):
    """WebSocketメッセージを処理する（統一管理システム使用）"""
    message_type = message_data.get("type", "unknown")
    
    if message_type == "ping":
        # ヘルスチェック（pong応答）
        await unified_manager.send_to_client(client_id, {
            "type": "pong",
            "timestamp": datetime.utcnow().isoformat()
        })
    
    elif message_type == "join_room":
        # ルーム変更
        new_room = message_data.get("room", "default")
        await manager.disconnect(client_id)
        # 新しいルームで再接続（WebSocketオブジェクトは同じ）
        # Note: 実際の実装では、ConnectionManagerでルーム移動メソッドを追加する方が良い
        
    elif message_type == "progress_update":
        # 進捗更新メッセージをルーム内にブロードキャスト
        await unified_manager.broadcast_to_room(room, {
            "type": "progress_broadcast",
            "from_client": client_id,
            "data": message_data.get("data", {}),
            "timestamp": datetime.utcnow().isoformat()
        })
    
    elif message_type == "status_request":
        # 接続統計を返す
        stats = unified_manager.get_connection_stats()
        await unified_manager.send_to_client(client_id, {
            "type": "status_response",
            "stats": stats,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    else:
        print(f"Unknown message type: {message_type} from client {client_id}")


async def handle_simple_message(data: str, client_id: str, room: str):
    """シンプルなテキストメッセージを処理する（統一管理システム使用）"""
    await unified_manager.broadcast_to_room(room, {
        "type": "text_message",
        "from_client": client_id,
        "message": data,
        "room": room,
        "timestamp": datetime.utcnow().isoformat()
    })
