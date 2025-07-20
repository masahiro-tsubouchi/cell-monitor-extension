from typing import List
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """新しいWebSocket接続を受け入れ、リストに追加する"""
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        """WebSocket接続をリストから削除する"""
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        """接続中のすべてのクライアントにメッセージを一斉送信する"""
        for connection in self.active_connections:
            await connection.send_text(message)


# アプリケーション全体で共有するシングルトンインスタンスを作成
manager = ConnectionManager()
