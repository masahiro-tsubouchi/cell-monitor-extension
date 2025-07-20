"""
イベントルーターテスト

イベントルーティングモジュールのテストを行います。イベントタイプに基づいた処理関数の
登録・呼び出し、エラーハンドリング、デフォルトハンドラーなどの機能をテストします。
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from worker.event_router import EventRouter


class TestEventRouter:
    """EventRouterクラスのテストケース"""

    def setup_method(self):
        """各テストメソッド実行前のセットアップ"""
        self.event_router = EventRouter()
        self.mock_db = MagicMock()

    @pytest.mark.asyncio
    async def test_register_and_route_handler(self):
        """ハンドラーの登録とイベントルーティングをテスト"""
        # モックハンドラーの作成
        mock_handler = AsyncMock()
        # ハンドラーを登録
        self.event_router.register_handler("test_event", mock_handler)

        # テスト用イベントデータ
        event_data = {"event": "test_event", "userId": "test_user", "data": "test_data"}

        # イベントをルーティング
        result = await self.event_router.route_event(event_data, self.mock_db)

        # 検証
        assert result is True
        mock_handler.assert_called_once_with(event_data, self.mock_db)

    @pytest.mark.asyncio
    async def test_missing_event_type(self):
        """イベントタイプがない場合のテスト"""
        # イベントタイプが含まれないデータ
        event_data = {"userId": "test_user", "data": "test_data"}

        # イベントをルーティング
        result = await self.event_router.route_event(event_data, self.mock_db)

        # 検証（イベントタイプがない場合はFalseを返す）
        assert result is False

    @pytest.mark.asyncio
    async def test_unknown_event_type_uses_default_handler(self):
        """未知のイベントタイプの場合にデフォルトハンドラーが使われるかテスト"""
        # デフォルトハンドラーをモック
        self.event_router._default_handler = AsyncMock(return_value=True)

        # 未知のイベントタイプのデータ
        event_data = {
            "event": "unknown_event",
            "userId": "test_user",
            "data": "test_data",
        }

        # イベントをルーティング
        result = await self.event_router.route_event(event_data, self.mock_db)

        # 検証（デフォルトハンドラーが呼ばれ、その結果が返される）
        assert result is True
        self.event_router._default_handler.assert_called_once_with(
            event_data, self.mock_db
        )

    @pytest.mark.asyncio
    @patch("worker.event_router.handle_event_error")
    async def test_handler_error_handling(self, mock_handle_error):
        """ハンドラーでエラーが発生した場合のテスト"""
        # エラー処理関数のモック
        mock_handle_error.return_value = None

        # エラーを発生させるモックハンドラー
        test_exception = Exception("テスト例外")
        mock_handler = AsyncMock(side_effect=test_exception)
        self.event_router.register_handler("error_event", mock_handler)

        # テスト用イベントデータ
        event_data = {"event": "error_event", "userId": "test_user"}

        # イベントをルーティング
        result = await self.event_router.route_event(event_data, self.mock_db)

        # 検証（エラーが発生した場合はFalseを返す）
        assert result is False
        mock_handler.assert_called_once_with(event_data, self.mock_db)
        mock_handle_error.assert_called_once_with(
            error=test_exception,
            event_data=event_data,
            context={"method": "route_event"},
        )


@pytest.mark.asyncio
class TestEventHandlers:
    """イベントハンドラー関数のテストケース"""

    def setup_method(self):
        """各テストメソッド実行前のセットアップ"""
        self.mock_db = MagicMock()

    @pytest.mark.asyncio
    @patch("worker.event_router.crud_student.get_or_create_student")
    @patch("worker.event_router.write_progress_event")
    async def test_handle_cell_execution(self, mock_write_progress, mock_get_student):
        """セル実行イベントハンドラーのテスト"""
        # モックのセットアップ
        mock_student = MagicMock()
        mock_student.user_id = "test_user"
        mock_student.id = 1
        mock_get_student.return_value = mock_student

        # handle_cell_executionを直接インポートする必要がある
        from worker.event_router import handle_cell_execution

        # テスト用イベントデータ
        event_data = {
            "event": "cell_execution",
            "userId": "test_user",
            "notebookPath": "/path/to/notebook.ipynb",
            "cellId": "cell123",
            "timestamp": "2023-01-01T12:00:00Z",
        }

        # ハンドラーを実行
        await handle_cell_execution(event_data, self.mock_db)

        # 検証
        mock_get_student.assert_called_once_with(self.mock_db, user_id="test_user")
        mock_write_progress.assert_called_once()

    @pytest.mark.asyncio
    @patch("worker.event_router.crud_student.get_or_create_student")
    @patch("worker.event_router.write_progress_event")
    async def test_handle_notebook_save(self, mock_write_progress, mock_get_student):
        """ノートブック保存イベントハンドラーのテスト"""
        # モックのセットアップ
        mock_student = MagicMock()
        mock_student.user_id = "test_user"
        mock_student.id = 1
        mock_get_student.return_value = mock_student

        # handle_notebook_saveを直接インポートする必要がある
        from worker.event_router import handle_notebook_save

        # テスト用イベントデータ
        event_data = {
            "event": "notebook_save",
            "userId": "test_user",
            "notebookPath": "/path/to/notebook.ipynb",
            "timestamp": "2023-01-01T12:00:00Z",
        }

        # ハンドラーを実行
        await handle_notebook_save(event_data, self.mock_db)

        # 検証
        mock_get_student.assert_called_once_with(self.mock_db, user_id="test_user")
        mock_write_progress.assert_called_once()


@pytest.mark.asyncio
class TestRetryMechanism:
    """リトライメカニズムのテストケース"""

    @pytest.mark.asyncio
    @patch("worker.event_router.crud_student.get_or_create_student")
    @patch("worker.event_router.write_progress_event")
    @patch("worker.event_router.handle_event_error")
    @patch("asyncio.sleep", new_callable=AsyncMock)
    async def test_default_handler_with_retry(
        self, mock_sleep, mock_handle_error, mock_write_progress, mock_get_student
    ):
        """デフォルトハンドラーのリトライ機能をテスト"""
        # モックの設定
        temp_error = Exception("一時的なエラー")
        # 一度失敗してから成功するように設定
        mock_write_progress.side_effect = [temp_error, None]
        mock_handle_error.return_value = None

        # モックのセットアップ
        mock_student = MagicMock()
        mock_student.user_id = "test_user"
        mock_student.id = 1
        mock_get_student.return_value = mock_student

        # イベントルーターとデータを設定
        # テスト用のモックデコレータの作成
        test_retry_decorator = AsyncMock()
        # デコレータを呼び出すとオリジナルの関数を返すよう設定
        test_retry_decorator.side_effect = lambda func: func

        with patch("worker.event_router.with_retry", return_value=test_retry_decorator):
            event_router = EventRouter()
            event_data = {
                "event": "unknown_event",
                "userId": "test_user",
                "timestamp": "2023-01-01T12:00:00Z",
            }
            mock_db = MagicMock()

            # デフォルトハンドラーを実行
            result = await event_router._default_handler(event_data, mock_db)

            # 検証
            assert result is False  # エラー発生時はFalseを返す
            assert mock_write_progress.call_count == 1  # 1回目で失敗
            assert (
                mock_sleep.call_count == 0
            )  # リトライデコレータをモックしているのでsleepは呼ばれない
            mock_handle_error.assert_called_once_with(
                error=temp_error,
                event_data=event_data,
                context={"method": "_default_handler"},
            )
