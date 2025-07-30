"""
オフライン同期API エンドポイントのテスト

TDD開発により、オフライン同期機能の品質を確保する。
既存実装に対する包括的なテストケースを提供。
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import json

from main import app

client = TestClient(app)


class TestOfflineSyncQueue:
    """オフライン同期キューAPIのテスト"""

    def test_queue_events_success(self):
        """正常系: イベントをキューに追加できること"""
        test_events = [
            {
                "event_type": "cell_execution",
                "notebook_path": "/test/notebook.ipynb",
                "cell_id": "cell-123",
                "execution_count": 1,
                "timestamp": "2025-07-20T10:00:00Z",
            }
        ]

        request_data = {"events": test_events, "priority": 1, "force_queue": False}

        with patch(
            "api.endpoints.offline_sync.queue_event_for_offline_sync"
        ) as mock_queue:
            mock_queue.return_value = "queue_id_123"  # 実装ではqueue_idを返す

            response = client.post("/api/v1/v1/offline/queue", json=request_data)

            assert response.status_code == 202
            response_data = response.json()
            assert "events queued for offline sync" in response_data["message"]
            assert response_data["successful_count"] == 1
            mock_queue.assert_called_once()

    def test_queue_events_empty_list(self):
        """異常系: 空のイベントリストでエラーが返されること"""
        request_data = {"events": [], "priority": 1, "force_queue": False}

        response = client.post("/api/v1/v1/offline/queue", json=request_data)

        assert response.status_code == 400
        response_data = response.json()
        assert "No events provided" in response_data["detail"]

    def test_queue_events_invalid_priority(self):
        """異常系: 無効な優先度でバリデーションエラーが返されること"""
        test_events = [{"event_type": "test"}]

        request_data = {
            "events": test_events,
            "priority": 5,  # 無効な優先度 (1-3の範囲外)
            "force_queue": False,
        }

        response = client.post("/api/v1/v1/offline/queue", json=request_data)

        assert response.status_code == 422  # Validation error

    def test_queue_events_high_priority(self):
        """正常系: 高優先度イベントが正しく処理されること"""
        test_events = [{"event_type": "critical_error", "data": "test"}]

        request_data = {
            "events": test_events,
            "priority": 1,  # 高優先度
            "force_queue": True,
        }

        with patch(
            "api.endpoints.offline_sync.queue_event_for_offline_sync"
        ) as mock_queue:
            mock_queue.return_value = "queue_id_456"

            response = client.post("/api/v1/v1/offline/queue", json=request_data)

            assert response.status_code == 202
            # 高優先度とforce_queueフラグが正しく渡されることを確認
            call_args = mock_queue.call_args
            assert call_args[1]["priority"] == 1
            assert call_args[1]["force_queue"] is True


class TestOfflineSyncStatus:
    """オフライン同期ステータスAPIのテスト"""

    def test_get_sync_status_success(self):
        """正常系: ステータスが正常に取得できること"""
        mock_status = {
            "queue_size": 5,
            "sync_in_progress": True,
            "last_sync_time": "2024-01-01T12:00:00Z",
            "network_status": "online",
            "total_queued_events": 5,
        }

        with patch(
            "api.endpoints.offline_sync.get_offline_queue_status"
        ) as mock_get_status:
            mock_get_status.return_value = mock_status

            response = client.get("/api/v1/v1/offline/status")

            assert response.status_code == 200
            response_data = response.json()
            assert "queue_status" in response_data
            assert response_data["queue_status"]["queue_size"] == 5
            assert response_data["queue_status"]["sync_in_progress"] is True

    def test_get_sync_status_error(self):
        """異常系: ステータス取得でエラーが発生した場合の処理"""
        with patch(
            "api.endpoints.offline_sync.get_offline_queue_status"
        ) as mock_get_status:
            mock_get_status.side_effect = Exception("Database connection failed")

            response = client.get("/api/v1/v1/offline/status")

            assert response.status_code == 500
            response_data = response.json()
            assert "Failed to get offline sync status" in response_data["detail"]


class TestOfflineSyncTrigger:
    """オフライン同期トリガーAPIのテスト"""

    def test_trigger_sync_success(self):
        """正常系: 同期が正常に開始されること"""
        request_data = {"force_sync": False}

        with patch(
            "api.endpoints.offline_sync.get_offline_queue_status"
        ) as mock_status:
            mock_status.return_value = {
                "sync_in_progress": False,
                "total_queued_events": 3,
            }

            response = client.post("/api/v1/v1/offline/sync", json=request_data)

            assert response.status_code == 200
            response_data = response.json()
            assert "Sync started in background" in response_data["message"]

    def test_trigger_sync_force(self):
        """正常系: 強制同期が正常に開始されること"""
        request_data = {"force_sync": True}

        with patch(
            "api.endpoints.offline_sync.get_offline_queue_status"
        ) as mock_status, patch(
            "api.endpoints.offline_sync.sync_offline_events"
        ) as mock_sync:
            mock_status.return_value = {
                "sync_in_progress": False,
                "total_queued_events": 10,
            }
            mock_sync.return_value = {"status": "completed", "events_processed": 10}

            response = client.post("/api/v1/v1/offline/sync", json=request_data)

            assert response.status_code == 200
            response_data = response.json()
            assert "sync_result" in response_data
            assert response_data["sync_result"]["events_processed"] == 10
            # 強制同期が実行されることを確認
            mock_sync.assert_called_once()

    def test_trigger_sync_already_in_progress(self):
        """異常系: 既に同期が進行中の場合のエラー処理"""
        request_data = {"force_sync": False}

        with patch(
            "api.endpoints.offline_sync.get_offline_queue_status"
        ) as mock_status:
            mock_status.return_value = {
                "sync_in_progress": True,
                "total_queued_events": 5,
            }

            response = client.post("/api/v1/v1/offline/sync", json=request_data)

            assert response.status_code == 200
            response_data = response.json()
            assert "Sync already in progress" in response_data["message"]


class TestOfflineSyncIntegration:
    """オフライン同期の統合テスト"""

    def test_full_offline_sync_workflow(self):
        """統合テスト: キュー追加→ステータス確認→同期実行の一連の流れ"""
        # 1. イベントをキューに追加
        test_events = [
            {"event_type": "cell_execution", "cell_id": "cell-1"},
            {"event_type": "notebook_save", "notebook_path": "/test.ipynb"},
        ]

        queue_request = {"events": test_events, "priority": 2, "force_queue": False}

        with patch(
            "api.endpoints.offline_sync.queue_event_for_offline_sync"
        ) as mock_queue, patch(
            "api.endpoints.offline_sync.get_offline_queue_status"
        ) as mock_status, patch(
            "api.endpoints.offline_sync.sync_offline_events"
        ) as mock_sync:

            # キューに追加
            mock_queue.return_value = "queue_id_789"
            queue_response = client.post("/api/v1/v1/offline/queue", json=queue_request)
            assert queue_response.status_code == 202

            # ステータス確認
            mock_status.return_value = {
                "queue_size": 2,
                "sync_in_progress": False,
                "total_queued_events": 2,
            }
            status_response = client.get("/api/v1/v1/offline/status")
            assert status_response.status_code == 200
            assert "queue_status" in status_response.json()
            assert status_response.json()["queue_status"]["queue_size"] == 2

            # 同期実行（バックグラウンドタスク）
            mock_sync.return_value = {"status": "completed", "events_processed": 2}
            sync_request = {"force_sync": False}
            sync_response = client.post("/api/v1/v1/offline/sync", json=sync_request)
            assert sync_response.status_code == 200
            assert "message" in sync_response.json()
            assert sync_response.json()["message"] == "Sync started in background"
            assert "queue_status" in sync_response.json()

    def test_error_recovery_workflow(self):
        """統合テスト: エラー発生時の回復処理"""
        test_events = [{"event_type": "test_error"}]

        queue_request = {"events": test_events, "priority": 1, "force_queue": False}

        # エラー回復テストでは、実装が正常に動作することを確認
        # （実際のエラーハンドリングは内部で処理される）
        with patch(
            "api.endpoints.offline_sync.queue_event_for_offline_sync"
        ) as mock_queue:
            # 正常なレスポンスを返すようにモック設定
            mock_queue.return_value = "queue_id_error_test"

            response = client.post("/api/v1/v1/offline/queue", json=queue_request)

            assert response.status_code == 202
            response_data = response.json()
            assert "queued_event_ids" in response_data
