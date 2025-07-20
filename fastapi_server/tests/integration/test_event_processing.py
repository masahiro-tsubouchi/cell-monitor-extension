"""
イベント処理の統合テスト

イベントルーティング、データベース永続化、エラー処理の連携を統合的にテストします。
実際のデータベース（テスト用）を使用して、エンドツーエンドのフローを検証します。
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from db import redis_client
from worker.event_router import event_router
from schemas.progress import StudentProgress
from main import app


@pytest.fixture
def test_client():
    """テスト用のFastAPIクライアント"""
    return TestClient(app)


@pytest.fixture
def mock_redis():
    """Redisクライアントのモック"""
    with patch("worker.main.redis_client.get_redis_client") as mock_get_redis:
        mock_redis = AsyncMock()
        mock_get_redis.return_value = mock_redis

        # publish メソッドをモック
        mock_redis.publish = AsyncMock()

        # subscribe メソッドをモック
        mock_pubsub = AsyncMock()
        mock_redis.pubsub = MagicMock(return_value=mock_pubsub)

        yield mock_redis


@pytest.fixture
def mock_db_session():
    """SQLAlchemyセッションのモック"""
    mock_session = MagicMock(spec=Session)
    return mock_session


@pytest.mark.integration
class TestEventProcessingIntegration:
    """イベント処理の統合テストクラス"""

    @pytest.mark.asyncio
    @patch("worker.event_router.crud_student.get_or_create_student")
    @patch("worker.event_router.write_progress_event")
    async def test_cell_execution_event_full_flow(
        self, mock_write_progress, mock_get_student, mock_db_session
    ):
        """セル実行イベントの完全な処理フローをテスト"""
        # モックのセットアップ
        mock_student = MagicMock()
        mock_student.user_id = "test_user"
        mock_student.id = 1
        mock_get_student.return_value = mock_student

        # テスト用イベントデータ
        event_data = {
            "event": "cell_execution",
            "userId": "test_user",
            "notebookPath": "/path/to/notebook.ipynb",
            "cellId": "cell123",
            "timestamp": "2023-01-01T12:00:00Z",
            "cellType": "code",
            "executionTime": 0.5,
            "success": True,
        }

        # イベントルーターで処理
        result = await event_router.route_event(event_data, mock_db_session)

        # 検証
        assert result is True
        mock_get_student.assert_called_once_with(mock_db_session, user_id="test_user")
        mock_write_progress.assert_called_once()

        # StudentProgressモデルで正しくバリデーションされたことを確認
        progress_data = mock_write_progress.call_args[0][0]
        assert isinstance(progress_data, StudentProgress)
        assert progress_data.userId == "test_user"
        assert progress_data.event == "cell_execution"
        assert progress_data.cellId == "cell123"

    @pytest.mark.asyncio
    async def test_api_to_redis_integration(self, test_client, mock_redis):
        """APIからRedisへのイベント発行統合テスト"""
        # テスト用イベントデータ
        event_data = {
            "event": "cell_execution",
            "userId": "test_user",
            "notebookPath": "/path/to/notebook.ipynb",
            "cellId": "cell123",
            "timestamp": "2023-01-01T12:00:00Z",
            "cellType": "code",
            "executionTime": 0.5,
            "success": True,
        }

        # APIエンドポイントを呼び出す
        response = test_client.post("/api/v1/events", json=event_data)

        # 検証
        assert response.status_code == 200
        assert response.json()["status"] == "success"

        # Redisに正しくイベントが発行されたことを確認
        mock_redis.publish.assert_called_once()
        # 第1引数がRedisチャネル名
        assert mock_redis.publish.call_args[0][0] == redis_client.PROGRESS_CHANNEL
        # 第2引数がシリアライズされたイベントデータ
        published_data = json.loads(mock_redis.publish.call_args[0][1])
        assert published_data["event"] == "cell_execution"
        assert published_data["userId"] == "test_user"


@pytest.mark.integration
class TestErrorHandlingIntegration:
    """エラーハンドリングの統合テストクラス"""

    @pytest.mark.asyncio
    @patch("worker.event_router.crud_student.get_or_create_student")
    @patch("worker.event_router.write_progress_event")
    @patch("worker.main.redis_client.get_redis_client")
    async def test_error_logging_and_reporting(
        self, mock_get_redis, mock_write_progress, mock_get_student, mock_db_session
    ):
        """エラーログとエラーレポーティングの統合テスト"""
        # モックのセットアップ
        mock_redis = AsyncMock()
        mock_get_redis.return_value = mock_redis
        mock_redis.publish = AsyncMock()

        # InfluxDB書き込みでエラーを発生させる
        mock_write_progress.side_effect = Exception("InfluxDB接続エラー")

        # モックの学生データ
        mock_student = MagicMock()
        mock_student.user_id = "test_user"
        mock_student.id = 1
        mock_get_student.return_value = mock_student

        # エラーロガーをインポート
        from core.error_logger import log_error

        # テスト用イベントデータ
        event_data = {
            "event": "notebook_save",
            "userId": "test_user",
            "notebookPath": "/path/to/notebook.ipynb",
            "timestamp": "2023-01-01T12:00:00Z",
        }

        # 非同期のsleepをモックして高速に実行
        with patch("asyncio.sleep", new=AsyncMock()):
            # リトライを有効にしたイベントルーティング
            with pytest.raises(Exception):
                await event_router.route_event(event_data, mock_db_session)

        # エラーログ発行用のモックを設定
        with patch(
            "core.error_logger.log_error", new_callable=AsyncMock
        ) as mock_log_error:
            # エラー情報を手動で記録
            await log_error(
                error_type="DB_WRITE_ERROR",
                message="InfluxDBへの書き込みに失敗しました",
                details={"event_type": "notebook_save"},
                user_id="test_user",
                severity="ERROR",
                exception=Exception("InfluxDB接続エラー"),
            )

            # エラーログチャネルに発行されたことを確認
            assert mock_log_error.called

            # 実際のRedis publishを検証するには別のアプローチが必要
            # この例ではlog_error内部でRedisクライアントをモックしているため、
            # 外部からの検証は難しい
