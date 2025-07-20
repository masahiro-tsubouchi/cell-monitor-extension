from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core.connection_manager import manager

router = APIRouter()


@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """
    クライアントからのWebSocket接続を待ち受けるエンドポイント。
    """
    await manager.connect(websocket)
    print(f"Client #{client_id} connected.")
    try:
        while True:
            # クライアントからのメッセージを待つことも可能
            # data = await websocket.receive_text()
            # await manager.broadcast(f"Client #{client_id} says: {data}")

            # 今回はサーバーからのブロードキャストが主なので、
            # クライアントからのメッセージは待たずに接続を維持する
            await websocket.receive_text()  # この行は接続を維持するために必要
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print(f"Client #{client_id} disconnected.")
