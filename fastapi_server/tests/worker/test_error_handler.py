"""
エラーハンドラーテスト

エラーハンドリング機能のテストを行います。リトライメカニズム、サーキットブレーカーパターン、
エラーログチャネルなどの機能が正しく動作することを確認します。
"""

import pytest
import time
from unittest.mock import AsyncMock, patch

from worker.error_handler import with_retry, handle_event_error, CircuitBreaker


class TestRetryDecorator:
    """リトライデコレータのテストクラス"""

    @pytest.mark.asyncio
    async def test_retry_success_first_attempt(self):
        """最初の試行で成功した場合のテスト"""
        mock_func = AsyncMock(return_value="success")
        decorated_func = with_retry(max_retries=3)(mock_func)

        result = await decorated_func("arg1", key="value")

        assert result == "success"
        mock_func.assert_called_once_with("arg1", key="value")

    @pytest.mark.asyncio
    async def test_retry_success_after_failure(self):
        """一度失敗した後に成功する場合のテスト"""
        mock_func = AsyncMock(side_effect=[Exception("Temporary error"), "success"])
        decorated_func = with_retry(max_retries=3, initial_delay=0.1)(mock_func)

        result = await decorated_func()

        assert result == "success"
        assert mock_func.call_count == 2

    @pytest.mark.asyncio
    async def test_retry_max_failures(self):
        """最大リトライ回数を超える場合のテスト"""
        error = Exception("Persistent error")
        mock_func = AsyncMock(side_effect=[error, error, error, error])

        # エラーロガーをモック
        with patch(
            "worker.error_handler.log_error", new_callable=AsyncMock
        ) as mock_log_error:
            decorated_func = with_retry(max_retries=3, initial_delay=0.1)(mock_func)

            with pytest.raises(Exception) as excinfo:
                await decorated_func()

            assert str(excinfo.value) == "Persistent error"
            assert mock_func.call_count == 4  # 初回 + 3回のリトライ
            assert mock_log_error.called

    @pytest.mark.asyncio
    async def test_retry_with_specific_error_types(self):
        """特定のエラータイプのみリトライする場合のテスト"""
        mock_func = AsyncMock(
            side_effect=[ValueError("Value error"), KeyError("Key error")]
        )
        decorated_func = with_retry(
            max_retries=3, initial_delay=0.1, error_types=(ValueError,)
        )(mock_func)

        # ValueErrorはリトライ対象なのでKeyErrorがスローされるまで進む
        with pytest.raises(KeyError):
            await decorated_func()

        assert mock_func.call_count == 2


class TestHandleEventError:
    """イベントエラーハンドリング関数のテスト"""

    @pytest.mark.asyncio
    async def test_handle_event_error(self):
        """イベントエラー処理のテスト"""
        # テスト用データ
        error = ValueError("テストエラー")
        event_data = {
            "userId": "test_user",
            "event": "cell_execution",
            "notebookPath": "/path/to/notebook.ipynb",
            "cellId": "cell123",
        }
        context = {"retry_count": 2, "operation": "cell_execution_handler"}

        # エラーロガーをモック
        with patch(
            "worker.error_handler.log_error", new_callable=AsyncMock
        ) as mock_log_error:
            await handle_event_error(error, event_data, context)

            # エラーログが正しく呼ばれたことを確認
            mock_log_error.assert_called_once()
            # 引数の検証
            args = mock_log_error.call_args[1]
            assert args["error_type"] == "EVENT_PROCESSING_ValueError"
            assert "テストエラー" in args["message"]
            assert args["user_id"] == "test_user"
            assert args["details"]["event_type"] == "cell_execution"
            assert args["details"]["retry_count"] == 2


class TestCircuitBreaker:
    """サーキットブレーカーのテストクラス"""

    def test_initial_state(self):
        """初期状態のテスト"""
        cb = CircuitBreaker(failure_threshold=3)
        assert cb.state == "CLOSED"
        assert cb.failure_count == 0
        assert cb.is_allowed() is True

    def test_record_failures_until_open(self):
        """障害を記録して回路が開くまでのテスト"""
        cb = CircuitBreaker(failure_threshold=3)

        # 障害を閾値未満記録
        for i in range(2):
            cb.record_failure()
            assert cb.state == "CLOSED"
            assert cb.is_allowed() is True

        # 閾値に達すると回路が開く
        cb.record_failure()
        assert cb.state == "OPEN"
        assert cb.is_allowed() is False

    def test_reset_after_timeout(self):
        """タイムアウト後にリセットするテスト"""
        cb = CircuitBreaker(failure_threshold=2, reset_timeout=0.1)

        # 回路を開く
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "OPEN"

        # タイムアウト後に半開状態になる
        time.sleep(0.2)
        assert cb.is_allowed() is True
        assert cb.state == "HALF_OPEN"

    def test_half_open_to_closed(self):
        """半開状態から閉状態に移行するテスト"""
        cb = CircuitBreaker(failure_threshold=2, reset_timeout=0.1)

        # 回路を開く
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "OPEN"

        # タイムアウト後に半開状態になる
        time.sleep(0.2)
        assert cb.is_allowed() is True
        assert cb.state == "HALF_OPEN"

        # 成功を記録すると閉状態に戻る
        cb.record_success()
        assert cb.state == "CLOSED"
        assert cb.failure_count == 0
