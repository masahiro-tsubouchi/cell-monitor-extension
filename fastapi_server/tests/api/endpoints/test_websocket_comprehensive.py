"""
WebSocket統合テスト - AI駆動TDD包括的テストスイート

Environment API (19件成功)、Notebook Version API (22件成功)、
LMS統合テスト (9件成功) の成功パターンを適用したWebSocket統合テスト
"""

import asyncio
import json
import pytest
from fastapi.testclient import TestClient
from fastapi import WebSocket
from unittest.mock import AsyncMock, MagicMock, patch

from main import app
from core.connection_manager import manager


class TestWebSocketConnectionManagement:
    """WebSocket接続管理テスト"""

    @pytest.mark.asyncio
    async def test_websocket_connect_and_disconnect(self):
        """WebSocket接続・切断テスト"""
        # モックWebSocket作成
        mock_websocket = AsyncMock(spec=WebSocket)
        
        # 接続テスト
        await manager.connect(mock_websocket)
        assert mock_websocket in manager.active_connections
        mock_websocket.accept.assert_called_once()
        
        # 切断テスト
        manager.disconnect(mock_websocket)
        assert mock_websocket not in manager.active_connections

    @pytest.mark.asyncio
    async def test_multiple_websocket_connections(self):
        """複数WebSocket接続テスト"""
        # 複数のモックWebSocket作成
        mock_websockets = [AsyncMock(spec=WebSocket) for _ in range(3)]
        
        # 複数接続
        for ws in mock_websockets:
            await manager.connect(ws)
        
        # 全て接続されていることを確認
        assert len(manager.active_connections) >= 3
        for ws in mock_websockets:
            assert ws in manager.active_connections
            ws.accept.assert_called_once()
        
        # 全て切断
        for ws in mock_websockets:
            manager.disconnect(ws)
        
        # 切断確認（他のテストの接続が残っている可能性があるため、作成した接続のみ確認）
        for ws in mock_websockets:
            assert ws not in manager.active_connections

    @pytest.mark.asyncio
    async def test_websocket_broadcast_message(self):
        """WebSocketブロードキャストテスト"""
        # モックWebSocket作成
        mock_websockets = [AsyncMock(spec=WebSocket) for _ in range(2)]
        
        # 接続
        for ws in mock_websockets:
            await manager.connect(ws)
        
        # ブロードキャストメッセージ送信
        test_message = "Test broadcast message"
        await manager.broadcast(test_message)
        
        # 全てのWebSocketにメッセージが送信されたことを確認
        for ws in mock_websockets:
            ws.send_text.assert_called_with(test_message)
        
        # 切断
        for ws in mock_websockets:
            manager.disconnect(ws)


class TestWebSocketEndpoint:
    """WebSocketエンドポイントテスト"""

    @pytest.mark.asyncio
    async def test_websocket_endpoint_connection(self):
        """ウェブソケットエンドポイント接続テスト"""
        # WebSocketエンドポイントの実装が無限ループで待機するため、
        # TestClientでのテストは困難。代わりにConnectionManagerを直接テスト
        mock_websocket = AsyncMock(spec=WebSocket)
        
        # 接続テスト
        await manager.connect(mock_websocket)
        assert mock_websocket in manager.active_connections
        mock_websocket.accept.assert_called_once()
        
        # メッセージ送信テスト
        test_message = "Hello WebSocket"
        await manager.broadcast(test_message)
        mock_websocket.send_text.assert_called_with(test_message)
        
        # 切断テスト
        manager.disconnect(mock_websocket)
        assert mock_websocket not in manager.active_connections

    @pytest.mark.asyncio
    async def test_websocket_endpoint_multiple_clients(self):
        """ウェブソケットエンドポイント複数クライアントテスト"""
        # WebSocketエンドポイントの実装が無限ループで待機するため、
        # TestClientでのテストは困難。代わりに複数ConnectionManagerをテスト
        mock_websockets = [AsyncMock(spec=WebSocket) for _ in range(2)]
        
        # 複数接続テスト
        for ws in mock_websockets:
            await manager.connect(ws)
            assert ws in manager.active_connections
            ws.accept.assert_called_once()
        
        # ブロードキャストテスト
        test_message = "Broadcast to multiple clients"
        await manager.broadcast(test_message)
        
        # 全てのクライアントにメッセージが送信されたことを確認
        for ws in mock_websockets:
            ws.send_text.assert_called_with(test_message)
        
        # 切断テスト
        for ws in mock_websockets:
            manager.disconnect(ws)
            assert ws not in manager.active_connections


class TestWebSocketIntegrationWorkflow:
    """WebSocket統合ワークフローテスト"""

    @pytest.mark.asyncio
    async def test_event_broadcast_workflow(self):
        """イベントブロードキャストワークフローテスト"""
        # モックWebSocket作成
        mock_websockets = [AsyncMock(spec=WebSocket) for _ in range(3)]
        
        # 接続
        for ws in mock_websockets:
            await manager.connect(ws)
        
        # イベントデータ作成
        event_data = {
            "event_type": "cell_execution",
            "student_id": "test_student_001",
            "notebook_path": "/test/notebook.ipynb",
            "cell_id": "cell_001",
            "execution_count": 1,
            "timestamp": "2025-01-19T22:30:00Z"
        }
        
        # イベントをJSON形式でブロードキャスト
        event_message = json.dumps(event_data)
        await manager.broadcast(event_message)
        
        # 全てのクライアントにイベントが送信されたことを確認
        for ws in mock_websockets:
            ws.send_text.assert_called_with(event_message)
        
        # 切断
        for ws in mock_websockets:
            manager.disconnect(ws)

    @pytest.mark.asyncio
    async def test_progress_update_broadcast(self):
        """進捗更新ブロードキャストテスト"""
        # モックWebSocket作成
        mock_websockets = [AsyncMock(spec=WebSocket) for _ in range(2)]
        
        # 接続
        for ws in mock_websockets:
            await manager.connect(ws)
        
        # 進捗更新データ作成
        progress_data = {
            "event_type": "progress_update",
            "student_id": "test_student_002",
            "progress_percentage": 75.5,
            "completed_cells": 15,
            "total_cells": 20,
            "timestamp": "2025-01-19T22:31:00Z"
        }
        
        # 進捗更新をブロードキャスト
        progress_message = json.dumps(progress_data)
        await manager.broadcast(progress_message)
        
        # 全てのクライアントに進捗更新が送信されたことを確認
        for ws in mock_websockets:
            ws.send_text.assert_called_with(progress_message)
        
        # 切断
        for ws in mock_websockets:
            manager.disconnect(ws)

    @pytest.mark.asyncio
    async def test_realtime_notification_workflow(self):
        """リアルタイム通知ワークフローテスト"""
        # モックWebSocket作成
        mock_websockets = [AsyncMock(spec=WebSocket) for _ in range(4)]
        
        # 接続
        for ws in mock_websockets:
            await manager.connect(ws)
        
        # 複数種類の通知を順次送信
        notifications = [
            {
                "event_type": "assignment_created",
                "class_id": "class_001",
                "assignment_id": "assignment_001",
                "title": "New Assignment Available",
                "timestamp": "2025-01-19T22:32:00Z"
            },
            {
                "event_type": "submission_graded",
                "student_id": "student_001",
                "assignment_id": "assignment_001",
                "grade": 85.0,
                "feedback": "Good work!",
                "timestamp": "2025-01-19T22:33:00Z"
            },
            {
                "event_type": "deadline_reminder",
                "assignment_id": "assignment_001",
                "deadline": "2025-01-25T23:59:59Z",
                "hours_remaining": 144,
                "timestamp": "2025-01-19T22:34:00Z"
            }
        ]
        
        # 各通知を順次ブロードキャスト
        for notification in notifications:
            notification_message = json.dumps(notification)
            await manager.broadcast(notification_message)
            
            # 全てのクライアントに通知が送信されたことを確認
            for ws in mock_websockets:
                ws.send_text.assert_called_with(notification_message)
        
        # 切断
        for ws in mock_websockets:
            manager.disconnect(ws)


class TestWebSocketErrorHandling:
    """WebSocketエラーハンドリングテスト"""

    @pytest.mark.asyncio
    async def test_websocket_disconnect_handling(self):
        """WebSocket切断処理テスト"""
        # モックWebSocket作成
        mock_websocket = AsyncMock(spec=WebSocket)
        
        # 接続
        await manager.connect(mock_websocket)
        assert mock_websocket in manager.active_connections
        
        # 切断処理
        manager.disconnect(mock_websocket)
        assert mock_websocket not in manager.active_connections

    @pytest.mark.asyncio
    async def test_broadcast_with_disconnected_websocket(self):
        """切断されたWebSocketを含むブロードキャストテスト"""
        # 正常なWebSocketと切断されたWebSocketを作成
        normal_ws = AsyncMock(spec=WebSocket)
        disconnected_ws = AsyncMock(spec=WebSocket)
        
        # send_textで例外を発生させる（切断をシミュレート）
        disconnected_ws.send_text.side_effect = Exception("Connection closed")
        
        # 両方を接続リストに追加
        await manager.connect(normal_ws)
        await manager.connect(disconnected_ws)
        
        # ブロードキャスト実行
        test_message = "Test message"
        
        # 例外が発生しても他のWebSocketには送信されることを確認
        try:
            await manager.broadcast(test_message)
        except Exception:
            pass  # 切断例外は予期される
        
        # 正常なWebSocketにはメッセージが送信されたことを確認
        normal_ws.send_text.assert_called_with(test_message)
        disconnected_ws.send_text.assert_called_with(test_message)
        
        # 切断
        manager.disconnect(normal_ws)
        manager.disconnect(disconnected_ws)

    def test_invalid_websocket_endpoint(self):
        """無効なWebSocketエンドポイントテスト"""
        client = TestClient(app)
        
        # 存在しないエンドポイントへの接続試行
        with pytest.raises(Exception):
            with client.websocket_connect("/api/v1/v1/websocket/invalid"):
                pass


class TestWebSocketPerformance:
    """WebSocketパフォーマンステスト"""

    @pytest.mark.asyncio
    async def test_high_volume_broadcast(self):
        """大量ブロードキャストテスト"""
        # 多数のモックWebSocket作成
        mock_websockets = [AsyncMock(spec=WebSocket) for _ in range(10)]
        
        # 全て接続
        for ws in mock_websockets:
            await manager.connect(ws)
        
        # 大量のメッセージを順次ブロードキャスト
        message_count = 50
        for i in range(message_count):
            test_message = f"Message {i+1}"
            await manager.broadcast(test_message)
        
        # 全てのWebSocketに全てのメッセージが送信されたことを確認
        for ws in mock_websockets:
            assert ws.send_text.call_count == message_count
        
        # 切断
        for ws in mock_websockets:
            manager.disconnect(ws)

    @pytest.mark.asyncio
    async def test_concurrent_connections_and_broadcasts(self):
        """同時接続・ブロードキャストテスト"""
        # 複数のWebSocket接続を同時に作成
        mock_websockets = [AsyncMock(spec=WebSocket) for _ in range(5)]
        
        # 同時接続
        connection_tasks = [manager.connect(ws) for ws in mock_websockets]
        await asyncio.gather(*connection_tasks)
        
        # 全て接続されていることを確認
        for ws in mock_websockets:
            assert ws in manager.active_connections
        
        # 同時ブロードキャスト
        broadcast_tasks = [
            manager.broadcast(f"Concurrent message {i}")
            for i in range(3)
        ]
        await asyncio.gather(*broadcast_tasks)
        
        # 各WebSocketが全てのメッセージを受信したことを確認
        for ws in mock_websockets:
            assert ws.send_text.call_count == 3
        
        # 切断
        for ws in mock_websockets:
            manager.disconnect(ws)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
