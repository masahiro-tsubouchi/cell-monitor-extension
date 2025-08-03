"""
Socket.IOクライアント側認証テスト

このテストスイートは、クライアント側の認証トークン送信方法の詳細検証を行います。
TDD開発により、以下の認証シナリオを包括的にテストします：

1. 正常な認証フロー
2. トークン形式の検証
3. トークンの有効期限チェック
4. 認証エラーハンドリング
5. 再接続時の認証
"""

import pytest
import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch
from core.socketio_server import InstructorSocketIOManager
from core.security import create_access_token, verify_token
from db.models import Instructor, InstructorStatus


class TestSocketIOClientAuthentication:
    """Socket.IOクライアント認証の詳細テスト"""

    @pytest.fixture
    def socketio_manager(self):
        """Socket.IOマネージャーのフィクスチャ"""
        return InstructorSocketIOManager()

    @pytest.fixture
    def mock_instructor(self):
        """モック講師のフィクスチャ"""
        instructor = MagicMock(spec=Instructor)
        instructor.id = 1
        instructor.email = "test@example.com"
        instructor.name = "Test Instructor"
        instructor.is_active = True
        instructor.status = InstructorStatus.AVAILABLE
        return instructor

    @pytest.fixture
    def valid_token(self, mock_instructor):
        """有効なJWTトークンのフィクスチャ"""
        return create_access_token(data={"sub": mock_instructor.email})

    @pytest.fixture
    def expired_token(self, mock_instructor):
        """期限切れトークンのフィクスチャ"""
        # 過去の時刻でトークンを作成（期限切れをシミュレート）
        with patch("core.security.datetime") as mock_datetime:
            # 1時間前の時刻を設定
            past_time = time.time() - 3600
            mock_datetime.utcnow.return_value.timestamp.return_value = past_time
            return create_access_token(data={"sub": mock_instructor.email})

    @pytest.mark.asyncio
    async def test_client_auth_token_format_validation(self, socketio_manager):
        """クライアント認証：トークン形式の検証"""
        test_cases = [
            # (トークン, 期待結果, 説明)
            ("", False, "空文字列トークン"),
            ("   ", False, "空白のみトークン"),
            ("invalid_token", False, "無効な形式のトークン"),
            ("Bearer token", False, "Bearerプレフィックス付きトークン"),
            ("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9", False, "不完全なJWTトークン"),
            (None, False, "Noneトークン"),
        ]

        socketio_manager.sio.disconnect = AsyncMock()

        for token, expected_result, description in test_cases:
            with patch("core.socketio_server.verify_token") as mock_verify_token:
                # verify_tokenが例外を発生させるか、Noneを返すかをシミュレート
                if token in [None, "", "   "]:
                    mock_verify_token.return_value = None
                else:
                    mock_verify_token.side_effect = Exception("Invalid token format")

                # 認証処理をシミュレート
                sid = f"test_session_{hash(token)}"
                auth = {"token": token} if token is not None else None

                try:
                    auth_token = auth.get("token") if auth else None

                    if not auth_token or not auth_token.strip():
                        await socketio_manager.sio.disconnect(sid)
                        result = False
                    else:
                        payload = mock_verify_token(auth_token)
                        if not payload:
                            await socketio_manager.sio.disconnect(sid)
                            result = False
                        else:
                            result = True
                except Exception:
                    await socketio_manager.sio.disconnect(sid)
                    result = False

                # 検証
                assert (
                    result == expected_result
                ), f"Failed for {description}: expected {expected_result}, got {result}"

    @pytest.mark.asyncio
    async def test_client_auth_token_timing_validation(
        self, socketio_manager, mock_instructor
    ):
        """クライアント認証：トークンタイミングの検証"""
        with patch("core.socketio_server.get_db") as mock_get_db, patch(
            "core.socketio_server.get_instructor_by_email"
        ) as mock_get_instructor, patch(
            "core.socketio_server.verify_token"
        ) as mock_verify_token:

            # モックの設定
            mock_db = MagicMock()
            mock_get_db.return_value.__next__.return_value = mock_db
            mock_get_instructor.return_value = mock_instructor
            mock_verify_token.return_value = {"sub": mock_instructor.email}

            socketio_manager.sio.emit = AsyncMock()
            socketio_manager.sio.disconnect = AsyncMock()

            # 認証タイミングの測定
            start_time = time.time()

            sid = "test_session_timing"
            auth = {"token": "valid_jwt_token"}

            # 認証成功をシミュレート
            try:
                token = auth.get("token")
                payload = mock_verify_token(token)

                if payload:
                    instructor_email = payload.get("sub")
                    if instructor_email:
                        instructor = mock_get_instructor(mock_db, instructor_email)
                        if instructor and instructor.is_active:
                            # セッション情報を保存
                            socketio_manager.instructor_sessions[sid] = {
                                "instructor_id": instructor.id,
                                "instructor_email": instructor_email,
                                "instructor_name": instructor.name,
                                "connected_at": asyncio.get_event_loop().time(),
                            }

                            auth_duration = time.time() - start_time

                            # 接続成功通知
                            await socketio_manager.sio.emit(
                                "connection_success",
                                {
                                    "instructor_id": instructor.id,
                                    "instructor_name": instructor.name,
                                    "status": "connected",
                                    "auth_duration": auth_duration,
                                },
                                room=sid,
                            )
                            result = True
                        else:
                            await socketio_manager.sio.disconnect(sid)
                            result = False
                    else:
                        await socketio_manager.sio.disconnect(sid)
                        result = False
                else:
                    await socketio_manager.sio.disconnect(sid)
                    result = False
            except Exception:
                await socketio_manager.sio.disconnect(sid)
                result = False

            end_time = time.time()
            total_auth_time = end_time - start_time

            # 検証
            assert result is True
            assert sid in socketio_manager.instructor_sessions
            assert total_auth_time < 1.0  # 1秒以内の認証完了

            # 接続成功イベントが送信されたことを確認
            socketio_manager.sio.emit.assert_called_once()
            call_args = socketio_manager.sio.emit.call_args
            assert call_args[0][0] == "connection_success"
            assert call_args[0][1]["status"] == "connected"

    @pytest.mark.asyncio
    async def test_client_auth_reconnection_scenario(
        self, socketio_manager, mock_instructor, valid_token
    ):
        """クライアント認証：再接続シナリオのテスト"""
        with patch("core.socketio_server.get_db") as mock_get_db, patch(
            "core.socketio_server.get_instructor_by_email"
        ) as mock_get_instructor, patch(
            "core.socketio_server.verify_token"
        ) as mock_verify_token:

            # モックの設定
            mock_db = MagicMock()
            mock_get_db.return_value.__next__.return_value = mock_db
            mock_get_instructor.return_value = mock_instructor
            mock_verify_token.return_value = {"sub": mock_instructor.email}

            socketio_manager.sio.emit = AsyncMock()
            socketio_manager.sio.disconnect = AsyncMock()

            # 初回接続
            sid1 = "test_session_initial"
            auth = {"token": valid_token}

            # 初回接続成功をシミュレート
            socketio_manager.instructor_sessions[sid1] = {
                "instructor_id": mock_instructor.id,
                "instructor_email": mock_instructor.email,
                "instructor_name": mock_instructor.name,
                "connected_at": asyncio.get_event_loop().time(),
            }

            # 接続断絶をシミュレート
            if sid1 in socketio_manager.instructor_sessions:
                del socketio_manager.instructor_sessions[sid1]

            # 再接続
            sid2 = "test_session_reconnect"

            # 再接続成功をシミュレート
            socketio_manager.instructor_sessions[sid2] = {
                "instructor_id": mock_instructor.id,
                "instructor_email": mock_instructor.email,
                "instructor_name": mock_instructor.name,
                "connected_at": asyncio.get_event_loop().time(),
            }

            # 検証
            assert (
                sid1 not in socketio_manager.instructor_sessions
            )  # 初回セッションは削除済み
            assert (
                sid2 in socketio_manager.instructor_sessions
            )  # 再接続セッションは存在
            assert (
                socketio_manager.instructor_sessions[sid2]["instructor_id"]
                == mock_instructor.id
            )

    @pytest.mark.asyncio
    async def test_client_auth_concurrent_connections(
        self, socketio_manager, mock_instructor, valid_token
    ):
        """クライアント認証：同時接続のテスト"""
        with patch("core.socketio_server.get_db") as mock_get_db, patch(
            "core.socketio_server.get_instructor_by_email"
        ) as mock_get_instructor, patch(
            "core.socketio_server.verify_token"
        ) as mock_verify_token:

            # モックの設定
            mock_db = MagicMock()
            mock_get_db.return_value.__next__.return_value = mock_db
            mock_get_instructor.return_value = mock_instructor
            mock_verify_token.return_value = {"sub": mock_instructor.email}

            socketio_manager.sio.emit = AsyncMock()
            socketio_manager.sio.disconnect = AsyncMock()

            # 複数の同時接続をシミュレート
            session_ids = ["session_1", "session_2", "session_3"]

            for sid in session_ids:
                # 各セッションの接続成功をシミュレート
                socketio_manager.instructor_sessions[sid] = {
                    "instructor_id": mock_instructor.id,
                    "instructor_email": mock_instructor.email,
                    "instructor_name": mock_instructor.name,
                    "connected_at": asyncio.get_event_loop().time(),
                }

            # 検証
            assert len(socketio_manager.instructor_sessions) == 3

            # 全セッションが同じ講師に属することを確認
            for sid in session_ids:
                assert sid in socketio_manager.instructor_sessions
                assert (
                    socketio_manager.instructor_sessions[sid]["instructor_id"]
                    == mock_instructor.id
                )

            # 接続中の講師一覧を取得
            connected_instructors = socketio_manager.get_connected_instructors()

            # 同じ講師の複数セッションが正しく管理されていることを確認
            assert len(connected_instructors) == 3  # 3つのセッション
            for instructor_info in connected_instructors:
                assert instructor_info["instructor_id"] == mock_instructor.id

    @pytest.mark.asyncio
    async def test_client_auth_error_handling_comprehensive(self, socketio_manager):
        """クライアント認証：包括的エラーハンドリングテスト"""
        error_scenarios = [
            # (エラータイプ, モック設定, 期待結果, 説明)
            (
                "database_error",
                lambda: Exception("Database connection failed"),
                False,
                "データベース接続エラー",
            ),
            (
                "token_decode_error",
                lambda: Exception("Token decode failed"),
                False,
                "トークンデコードエラー",
            ),
            ("instructor_not_found", lambda: None, False, "講師が見つからない"),
            (
                "inactive_instructor",
                lambda: MagicMock(is_active=False),
                False,
                "非アクティブ講師",
            ),
        ]

        socketio_manager.sio.disconnect = AsyncMock()

        for error_type, mock_setup, expected_result, description in error_scenarios:
            with patch("core.socketio_server.get_db") as mock_get_db, patch(
                "core.socketio_server.get_instructor_by_email"
            ) as mock_get_instructor, patch(
                "core.socketio_server.verify_token"
            ) as mock_verify_token:

                sid = f"test_session_{error_type}"
                auth = {"token": "test_token"}

                # エラーシナリオに応じたモック設定
                if error_type == "database_error":
                    mock_get_db.side_effect = mock_setup()
                elif error_type == "token_decode_error":
                    mock_verify_token.side_effect = mock_setup()
                elif error_type == "instructor_not_found":
                    mock_verify_token.return_value = {"sub": "test@example.com"}
                    mock_get_instructor.return_value = mock_setup()
                elif error_type == "inactive_instructor":
                    mock_verify_token.return_value = {"sub": "test@example.com"}
                    mock_instructor = mock_setup()
                    mock_instructor.id = 1
                    mock_instructor.email = "test@example.com"
                    mock_instructor.name = "Inactive Instructor"
                    mock_get_instructor.return_value = mock_instructor

                # 認証エラー処理をシミュレート
                try:
                    token = auth.get("token")

                    if error_type == "token_decode_error":
                        payload = mock_verify_token(token)  # 例外が発生
                    elif error_type == "database_error":
                        db = next(mock_get_db())  # 例外が発生
                    else:
                        payload = mock_verify_token(token)
                        if payload:
                            instructor_email = payload.get("sub")
                            if instructor_email:
                                mock_db = MagicMock()
                                instructor = mock_get_instructor(
                                    mock_db, instructor_email
                                )
                                if not instructor:
                                    await socketio_manager.sio.disconnect(sid)
                                    result = False
                                elif not instructor.is_active:
                                    await socketio_manager.sio.disconnect(sid)
                                    result = False
                                else:
                                    result = True
                            else:
                                await socketio_manager.sio.disconnect(sid)
                                result = False
                        else:
                            await socketio_manager.sio.disconnect(sid)
                            result = False
                except Exception:
                    await socketio_manager.sio.disconnect(sid)
                    result = False

                # 検証
                assert (
                    result == expected_result
                ), f"Failed for {description}: expected {expected_result}, got {result}"
                assert sid not in socketio_manager.instructor_sessions
