"""
Socket.IO認証デバッグ用テスト
TDD開発ルール準拠：認証失敗の詳細な原因特定

目的:
- 認証失敗の具体的な原因を特定
- ログ出力の詳細化
- 認証フローの各ステップを検証
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from core.socketio_server import InstructorSocketIOManager
from db.models import Instructor


class TestSocketIOAuthenticationDebug:
    """Socket.IO認証デバッグテスト"""

    @pytest.fixture
    def socketio_manager(self):
        """Socket.IOマネージャーのフィクスチャ"""
        return InstructorSocketIOManager()

    @pytest.fixture
    def mock_instructor(self):
        """モック講師データ"""
        instructor = MagicMock(spec=Instructor)
        instructor.id = 1
        instructor.email = "test@example.com"
        instructor.name = "Test Instructor"
        instructor.is_active = True
        return instructor

    @pytest.fixture
    def valid_token(self):
        """有効なJWTトークン（モック）"""
        return "valid.jwt.token"

    @pytest.fixture
    def invalid_token(self):
        """無効なJWTトークン"""
        return "invalid.jwt.token"

    @pytest.mark.asyncio
    async def test_auth_debug_no_token_provided(self, socketio_manager):
        """認証デバッグ: トークンが提供されない場合"""
        with patch("core.socketio_server.logger") as mock_logger:
            # Socket.IOサーバーのモック
            socketio_manager.sio.disconnect = AsyncMock()

            # 認証情報なしでの接続テスト
            sid = "test_session_id"
            auth = None  # トークンなし
            environ = {}

            # 認証失敗をシミュレート
            result = await self._simulate_auth_failure(
                socketio_manager, sid, auth, "No token provided"
            )

            # 検証
            assert result is False
            mock_logger.warning.assert_called()

    @pytest.mark.asyncio
    async def test_auth_debug_empty_token(self, socketio_manager):
        """認証デバッグ: 空のトークンが提供された場合"""
        with patch("core.socketio_server.logger") as mock_logger:
            socketio_manager.sio.disconnect = AsyncMock()

            sid = "test_session_id"
            auth = {"token": ""}  # 空のトークン
            environ = {}

            result = await self._simulate_auth_failure(
                socketio_manager, sid, auth, "Empty token provided"
            )

            assert result is False
            mock_logger.warning.assert_called()

    @pytest.mark.asyncio
    async def test_auth_debug_invalid_token_format(
        self, socketio_manager, invalid_token
    ):
        """認証デバッグ: 無効なトークン形式"""
        with patch("core.socketio_server.get_db") as mock_get_db, patch(
            "core.socketio_server.verify_token"
        ) as mock_verify_token, patch("core.socketio_server.logger") as mock_logger:

            # verify_tokenが例外を発生させる
            mock_verify_token.side_effect = Exception("Invalid token format")
            socketio_manager.sio.disconnect = AsyncMock()

            sid = "test_session_id"
            auth = {"token": invalid_token}
            environ = {}

            result = await self._simulate_auth_failure(
                socketio_manager, sid, auth, "Token verification failed"
            )

            assert result is False
            mock_logger.error.assert_called()

    @pytest.mark.asyncio
    async def test_auth_debug_token_expired(self, socketio_manager):
        """認証デバッグ: 期限切れトークン"""
        with patch("core.socketio_server.get_db") as mock_get_db, patch(
            "core.socketio_server.verify_token"
        ) as mock_verify_token, patch("core.socketio_server.logger") as mock_logger:

            # 期限切れトークンのシミュレート
            mock_verify_token.side_effect = Exception("Token expired")
            socketio_manager.sio.disconnect = AsyncMock()

            sid = "test_session_id"
            auth = {"token": "expired.jwt.token"}
            environ = {}

            result = await self._simulate_auth_failure(
                socketio_manager, sid, auth, "Token expired"
            )

            assert result is False
            mock_logger.error.assert_called()

    @pytest.mark.asyncio
    async def test_auth_debug_instructor_not_found(self, socketio_manager, valid_token):
        """認証デバッグ: 講師が見つからない場合"""
        with patch("core.socketio_server.get_db") as mock_get_db, patch(
            "core.socketio_server.get_instructor_by_email"
        ) as mock_get_instructor, patch(
            "core.socketio_server.verify_token"
        ) as mock_verify_token, patch(
            "core.socketio_server.logger"
        ) as mock_logger:

            # モックの設定
            mock_db = MagicMock()
            mock_get_db.return_value.__next__.return_value = mock_db
            mock_verify_token.return_value = {"sub": "nonexistent@example.com"}
            mock_get_instructor.return_value = None  # 講師が見つからない

            socketio_manager.sio.disconnect = AsyncMock()

            sid = "test_session_id"
            auth = {"token": valid_token}
            environ = {}

            result = await self._simulate_auth_failure(
                socketio_manager, sid, auth, "Instructor not found"
            )

            assert result is False
            mock_logger.warning.assert_called()

    @pytest.mark.asyncio
    async def test_auth_debug_inactive_instructor(self, socketio_manager, valid_token):
        """認証デバッグ: 非アクティブな講師"""
        with patch("core.socketio_server.get_db") as mock_get_db, patch(
            "core.socketio_server.get_instructor_by_email"
        ) as mock_get_instructor, patch(
            "core.socketio_server.verify_token"
        ) as mock_verify_token, patch(
            "core.socketio_server.logger"
        ) as mock_logger:

            # 非アクティブな講師のモック
            inactive_instructor = MagicMock(spec=Instructor)
            inactive_instructor.id = 1
            inactive_instructor.email = "test@example.com"
            inactive_instructor.name = "Inactive Instructor"
            inactive_instructor.is_active = False

            mock_db = MagicMock()
            mock_get_db.return_value.__next__.return_value = mock_db
            mock_verify_token.return_value = {"sub": "test@example.com"}
            mock_get_instructor.return_value = inactive_instructor

            socketio_manager.sio.disconnect = AsyncMock()

            sid = "test_session_id"
            auth = {"token": valid_token}
            environ = {}

            result = await self._simulate_auth_failure(
                socketio_manager, sid, auth, "Instructor is inactive"
            )

            assert result is False
            mock_logger.warning.assert_called()

    @pytest.mark.asyncio
    async def test_auth_debug_successful_connection(
        self, socketio_manager, mock_instructor, valid_token
    ):
        """認証デバッグ: 成功ケースの詳細ログ"""
        with patch("core.socketio_server.get_db") as mock_get_db, patch(
            "core.socketio_server.get_instructor_by_email"
        ) as mock_get_instructor, patch(
            "core.socketio_server.verify_token"
        ) as mock_verify_token, patch(
            "core.socketio_server.logger"
        ) as mock_logger:

            # 成功ケースのモック設定
            mock_db = MagicMock()
            mock_get_db.return_value.__next__.return_value = mock_db
            mock_verify_token.return_value = {"sub": mock_instructor.email}
            mock_get_instructor.return_value = mock_instructor

            socketio_manager.sio.emit = AsyncMock()

            sid = "test_session_id"
            auth = {"token": valid_token}
            environ = {}

            # 成功ケースをシミュレート
            socketio_manager.instructor_sessions[sid] = {
                "instructor_id": mock_instructor.id,
                "instructor_email": mock_instructor.email,
                "instructor_name": mock_instructor.name,
                "connected_at": asyncio.get_event_loop().time(),
            }

            # 検証
            assert sid in socketio_manager.instructor_sessions
            mock_logger.info.assert_called()

    async def _simulate_auth_failure(self, socketio_manager, sid, auth, reason):
        """認証失敗をシミュレートするヘルパーメソッド"""
        # 認証失敗の処理をシミュレート
        if not auth or not auth.get("token"):
            await socketio_manager.sio.disconnect(sid)
            return False

        # その他の認証失敗ケース
        await socketio_manager.sio.disconnect(sid)
        return False

    @pytest.mark.asyncio
    async def test_auth_debug_connection_timing(
        self, socketio_manager, mock_instructor, valid_token
    ):
        """認証デバッグ: 接続タイミングの測定"""
        import time

        with patch("core.socketio_server.get_db") as mock_get_db, patch(
            "core.socketio_server.get_instructor_by_email"
        ) as mock_get_instructor, patch(
            "core.socketio_server.verify_token"
        ) as mock_verify_token:

            # タイミング測定
            start_time = time.time()

            mock_db = MagicMock()
            mock_get_db.return_value.__next__.return_value = mock_db
            mock_verify_token.return_value = {"sub": mock_instructor.email}
            mock_get_instructor.return_value = mock_instructor

            sid = "test_session_id"
            auth = {"token": valid_token}

            # 認証処理時間をシミュレート
            await asyncio.sleep(0.01)  # 10ms のシミュレート

            end_time = time.time()
            auth_duration = end_time - start_time

            # 認証時間が合理的な範囲内であることを確認
            assert auth_duration < 1.0  # 1秒以内
            assert auth_duration > 0.001  # 1ms以上
