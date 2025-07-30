import pytest
import json
from unittest.mock import AsyncMock
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from db.redis_client import get_redis_client


@pytest.fixture
def mock_redis():
    """Redisクライアントのモック（FastAPI依存性オーバーライド用）"""
    mock_redis = AsyncMock()
    mock_redis.publish = AsyncMock()
    return mock_redis


def test_receive_progress_new_user(client: TestClient, db_session: Session, mock_redis):
    # FastAPI依存性オーバーライドでRedisクライアントをモック
    client.app.dependency_overrides[get_redis_client] = lambda: mock_redis

    user_id = "api_test_user_01"

    payload = {
        "userId": user_id,
        "notebookPath": "/path/to/notebook.ipynb",
        "event": "cell_executed",
        "timestamp": "2024-01-01T12:00:00Z",
    }

    response = client.post("/api/v1/progress/student-progress", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["processed_user_id"] == user_id

    # Redisにpublishが呼ばれたことを確認（Progress APIの実際の責任範囲）
    mock_redis.publish.assert_called_once()
    # publishの引数を確認
    call_args = mock_redis.publish.call_args
    assert call_args[0][0] == "progress_events"  # PROGRESS_CHANNEL
    # イベントデータがJSONで送信されていることを確認
    import json

    published_data = json.loads(call_args[0][1])
    assert published_data["userId"] == user_id

    # クリーンアップ: 依存性オーバーライドをリセット
    client.app.dependency_overrides.clear()


def test_receive_progress_existing_user(
    client: TestClient, db_session: Session, mock_redis
):
    # FastAPI依存性オーバーライドでRedisクライアントをモック
    client.app.dependency_overrides[get_redis_client] = lambda: mock_redis

    user_id = "api_test_user_02"

    payload = {
        "userId": user_id,
        "notebookPath": "/path/to/another_notebook.ipynb",
        "event": "notebook_saved",
        "timestamp": "2024-01-01T13:00:00Z",
    }

    response = client.post("/api/v1/progress/student-progress", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["processed_user_id"] == user_id

    # Redisにpublishが呼ばれたことを確認（Progress APIの実際の責任範囲）
    mock_redis.publish.assert_called_once()
    # publishの引数を確認
    call_args = mock_redis.publish.call_args
    assert call_args[0][0] == "progress_events"  # PROGRESS_CHANNEL
    # イベントデータがJSONで送信されていることを確認
    import json

    published_data = json.loads(call_args[0][1])
    assert published_data["userId"] == user_id

    # クリーンアップ: 依存性オーバーライドをリセット
    client.app.dependency_overrides.clear()
