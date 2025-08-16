import json
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core.connection_manager import manager

router = APIRouter()


@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str, room: str = "default"):
    """
    改善されたWebSocket接続エンドポイント
    クライアントIDとルームによる接続管理
    """
    await manager.connect(websocket, client_id, room)
    print(f"Client {client_id} connected to room {room}")
    
    try:
        # 接続成功メッセージを送信
        await manager.send_personal_message(
            json.dumps({
                "type": "connection_established",
                "client_id": client_id,
                "room": room,
                "timestamp": datetime.utcnow().isoformat()
            }),
            client_id
        )
        
        while True:
            # クライアントからのメッセージを受信
            try:
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                # メッセージタイプに応じて処理
                await handle_websocket_message(message_data, client_id, room)
                
            except json.JSONDecodeError:
                # JSON形式でない場合は単純なテキストメッセージとして処理
                await handle_simple_message(data, client_id, room)
                
    except WebSocketDisconnect:
        await manager.disconnect(client_id)
        print(f"Client {client_id} disconnected from room {room}")
    except Exception as e:
        print(f"WebSocket error for client {client_id}: {e}")
        await manager.disconnect(client_id)


async def handle_websocket_message(message_data: dict, client_id: str, room: str):
    """WebSocketメッセージを処理する"""
    message_type = message_data.get("type", "unknown")
    
    if message_type == "ping":
        # ヘルスチェック（pong応答）
        await manager.send_personal_message(
            json.dumps({
                "type": "pong",
                "timestamp": datetime.utcnow().isoformat()
            }),
            client_id
        )
    
    elif message_type == "join_room":
        # ルーム変更
        new_room = message_data.get("room", "default")
        await manager.disconnect(client_id)
        # 新しいルームで再接続（WebSocketオブジェクトは同じ）
        # Note: 実際の実装では、ConnectionManagerでルーム移動メソッドを追加する方が良い
        
    elif message_type == "progress_update":
        # 進捗更新メッセージをルーム内にブロードキャスト
        await manager.broadcast(
            json.dumps({
                "type": "progress_broadcast",
                "from_client": client_id,
                "data": message_data.get("data", {}),
                "timestamp": datetime.utcnow().isoformat()
            }),
            room
        )
    
    elif message_type == "status_request":
        # 接続統計を返す
        stats = manager.get_connection_stats()
        await manager.send_personal_message(
            json.dumps({
                "type": "status_response",
                "stats": stats,
                "timestamp": datetime.utcnow().isoformat()
            }),
            client_id
        )
    
    else:
        print(f"Unknown message type: {message_type} from client {client_id}")


async def handle_simple_message(data: str, client_id: str, room: str):
    """シンプルなテキストメッセージを処理する"""
    await manager.broadcast(
        json.dumps({
            "type": "text_message",
            "from_client": client_id,
            "message": data,
            "room": room,
            "timestamp": datetime.utcnow().isoformat()
        }),
        room
    )
