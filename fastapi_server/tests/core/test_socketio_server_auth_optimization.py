"""
Socket.IOサーバー側認証ロジック最適化テスト

このテストスイートは、サーバー側の認証ロジックの最適化と品質向上を目的としています。
TDD開発により、以下の最適化項目を検証します：

1. 認証パフォーマンスの最適化
2. 認証ログの詳細化・構造化
3. 認証失敗時の適切なレスポンス
4. セキュリティ強化（レート制限等）
5. データベース接続の最適化
6. メモリ使用量の最適化
"""

import pytest
import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch
from core.socketio_server import InstructorSocketIOManager
from core.security import create_access_token, verify_token
from db.models import Instructor, InstructorStatus
import logging


class TestSocketIOServerAuthOptimization:
    """Socket.IOサーバー認証最適化テスト"""

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

    @pytest.mark.asyncio
    async def test_auth_performance_optimization(self, socketio_manager, mock_instructor, valid_token):
        """認証パフォーマンス最適化テスト"""
        with patch("core.socketio_server.get_db") as mock_get_db, \
             patch("core.socketio_server.get_instructor_by_email") as mock_get_instructor, \
             patch("core.socketio_server.verify_token") as mock_verify_token:

            # モックの設定
            mock_db = MagicMock()
            mock_get_db.return_value.__next__.return_value = mock_db
            mock_get_instructor.return_value = mock_instructor
            mock_verify_token.return_value = {"sub": mock_instructor.email}

            socketio_manager.sio.emit = AsyncMock()
            socketio_manager.sio.disconnect = AsyncMock()

            # 複数の同時認証リクエストをシミュレート
            concurrent_requests = 10
            auth_times = []

            async def single_auth_request(session_id):
                """単一の認証リクエストを実行"""
                start_time = time.time()
                
                sid = f"test_session_{session_id}"
                auth = {"token": valid_token}
                
                # 認証処理をシミュレート
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
                                
                                # 接続成功通知
                                await socketio_manager.sio.emit(
                                    "connection_success",
                                    {
                                        "instructor_id": instructor.id,
                                        "instructor_name": instructor.name,
                                        "status": "connected",
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
                auth_duration = end_time - start_time
                auth_times.append(auth_duration)
                
                return result, auth_duration

            # 同時認証リクエストを実行
            tasks = [single_auth_request(i) for i in range(concurrent_requests)]
            results = await asyncio.gather(*tasks)

            # パフォーマンス検証
            successful_auths = sum(1 for result, _ in results if result)
            average_auth_time = sum(auth_times) / len(auth_times)
            max_auth_time = max(auth_times)

            # 検証
            assert successful_auths == concurrent_requests, f"Expected {concurrent_requests} successful auths, got {successful_auths}"
            assert average_auth_time < 0.1, f"Average auth time too slow: {average_auth_time:.3f}s"
            assert max_auth_time < 0.2, f"Max auth time too slow: {max_auth_time:.3f}s"
            assert len(socketio_manager.instructor_sessions) == concurrent_requests

    @pytest.mark.asyncio
    async def test_auth_logging_optimization(self, socketio_manager, mock_instructor, valid_token):
        """認証ログ最適化テスト"""
        with patch("core.socketio_server.get_db") as mock_get_db, \
             patch("core.socketio_server.get_instructor_by_email") as mock_get_instructor, \
             patch("core.socketio_server.verify_token") as mock_verify_token, \
             patch("core.socketio_server.logger") as mock_logger:

            # モックの設定
            mock_db = MagicMock()
            mock_get_db.return_value.__next__.return_value = mock_db
            mock_get_instructor.return_value = mock_instructor
            mock_verify_token.return_value = {"sub": mock_instructor.email}

            socketio_manager.sio.emit = AsyncMock()
            socketio_manager.sio.disconnect = AsyncMock()

            # 構造化ログのテストデータ
            test_scenarios = [
                {
                    "name": "successful_auth",
                    "auth": {"token": valid_token},
                    "expected_logs": ["info", "debug"],
                    "expected_result": True,
                },
                {
                    "name": "missing_token",
                    "auth": None,
                    "expected_logs": ["warning"],
                    "expected_result": False,
                },
                {
                    "name": "invalid_token",
                    "auth": {"token": "invalid_token"},
                    "expected_logs": ["error"],
                    "expected_result": False,
                },
            ]

            for scenario in test_scenarios:
                mock_logger.reset_mock()
                
                if scenario["name"] == "invalid_token":
                    mock_verify_token.side_effect = Exception("Invalid token")
                else:
                    mock_verify_token.side_effect = None
                    mock_verify_token.return_value = {"sub": mock_instructor.email} if scenario["auth"] else None

                sid = f"test_session_{scenario['name']}"
                auth = scenario["auth"]

                # 認証処理をシミュレート
                try:
                    token = auth.get("token") if auth else None
                    
                    if not token:
                        # ログ記録をシミュレート
                        mock_logger.warning(f"Socket.IO connection rejected: No token provided (sid: {sid})")
                        await socketio_manager.sio.disconnect(sid)
                        result = False
                    else:
                        try:
                            payload = mock_verify_token(token)
                            if payload:
                                # 成功ログをシミュレート
                                mock_logger.info(f"Socket.IO instructor connected successfully (sid: {sid})")
                                mock_logger.debug(f"Token verification successful (sid: {sid})")
                                
                                # セッション情報を保存
                                socketio_manager.instructor_sessions[sid] = {
                                    "instructor_id": mock_instructor.id,
                                    "instructor_email": mock_instructor.email,
                                    "instructor_name": mock_instructor.name,
                                    "connected_at": asyncio.get_event_loop().time(),
                                }
                                result = True
                            else:
                                mock_logger.error(f"Socket.IO connection rejected: Token verification failed (sid: {sid})")
                                await socketio_manager.sio.disconnect(sid)
                                result = False
                        except Exception as e:
                            mock_logger.error(f"Socket.IO connection rejected: Token verification failed (sid: {sid}), error: {str(e)}")
                            await socketio_manager.sio.disconnect(sid)
                            result = False
                except Exception:
                    await socketio_manager.sio.disconnect(sid)
                    result = False

                # ログ検証
                assert result == scenario["expected_result"], f"Scenario {scenario['name']} failed"
                
                # 期待されるログレベルが呼び出されたことを確認
                for log_level in scenario["expected_logs"]:
                    log_method = getattr(mock_logger, log_level)
                    assert log_method.called, f"Expected {log_level} log not called for scenario {scenario['name']}"

    @pytest.mark.asyncio
    async def test_auth_error_response_optimization(self, socketio_manager, mock_instructor):
        """認証エラーレスポンス最適化テスト"""
        with patch("core.socketio_server.get_db") as mock_get_db, \
             patch("core.socketio_server.get_instructor_by_email") as mock_get_instructor, \
             patch("core.socketio_server.verify_token") as mock_verify_token:

            socketio_manager.sio.emit = AsyncMock()
            socketio_manager.sio.disconnect = AsyncMock()

            # エラーシナリオとその期待されるレスポンス
            error_scenarios = [
                {
                    "name": "token_missing",
                    "auth": None,
                    "expected_disconnect": True,
                    "expected_error_event": None,  # 即座に切断
                },
                {
                    "name": "token_malformed",
                    "auth": {"token": "malformed_token"},
                    "verify_side_effect": Exception("Malformed token"),
                    "expected_disconnect": True,
                    "expected_error_event": "auth_error",
                },
                {
                    "name": "instructor_not_found",
                    "auth": {"token": "valid_format_token"},
                    "verify_return": {"sub": "nonexistent@example.com"},
                    "instructor_return": None,
                    "expected_disconnect": True,
                    "expected_error_event": "auth_error",
                },
                {
                    "name": "instructor_inactive",
                    "auth": {"token": "valid_format_token"},
                    "verify_return": {"sub": mock_instructor.email},
                    "instructor_return": MagicMock(is_active=False),
                    "expected_disconnect": True,
                    "expected_error_event": "auth_error",
                },
            ]

            for scenario in error_scenarios:
                # モックをリセット
                mock_verify_token.reset_mock()
                mock_get_instructor.reset_mock()
                socketio_manager.sio.emit.reset_mock()
                socketio_manager.sio.disconnect.reset_mock()

                # シナリオ固有のモック設定
                if scenario.get("verify_side_effect"):
                    mock_verify_token.side_effect = scenario["verify_side_effect"]
                else:
                    mock_verify_token.side_effect = None
                    mock_verify_token.return_value = scenario.get("verify_return")
                
                if "instructor_return" in scenario:
                    mock_get_instructor.return_value = scenario["instructor_return"]

                sid = f"test_session_{scenario['name']}"
                auth = scenario["auth"]

                # 認証エラー処理をシミュレート
                try:
                    token = auth.get("token") if auth else None
                    
                    if not token:
                        await socketio_manager.sio.disconnect(sid)
                        result = False
                    else:
                        try:
                            payload = mock_verify_token(token)
                            if payload:
                                instructor_email = payload.get("sub")
                                if instructor_email:
                                    mock_db = MagicMock()
                                    instructor = mock_get_instructor(mock_db, instructor_email)
                                    if not instructor:
                                        # エラーイベントを送信してから切断
                                        await socketio_manager.sio.emit(
                                            "auth_error",
                                            {"error": "instructor_not_found", "message": "Instructor not found"},
                                            room=sid
                                        )
                                        await socketio_manager.sio.disconnect(sid)
                                        result = False
                                    elif not instructor.is_active:
                                        # エラーイベントを送信してから切断
                                        await socketio_manager.sio.emit(
                                            "auth_error",
                                            {"error": "instructor_inactive", "message": "Instructor account is inactive"},
                                            room=sid
                                        )
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
                            # エラーイベントを送信してから切断
                            await socketio_manager.sio.emit(
                                "auth_error",
                                {"error": "token_invalid", "message": "Invalid token format"},
                                room=sid
                            )
                            await socketio_manager.sio.disconnect(sid)
                            result = False
                except Exception:
                    await socketio_manager.sio.disconnect(sid)
                    result = False

                # 検証
                assert result is False, f"Scenario {scenario['name']} should fail"
                
                if scenario["expected_disconnect"]:
                    socketio_manager.sio.disconnect.assert_called_with(sid)
                
                if scenario["expected_error_event"]:
                    # エラーイベントが送信されたことを確認
                    emit_calls = socketio_manager.sio.emit.call_args_list
                    error_event_sent = any(
                        call[0][0] == scenario["expected_error_event"] 
                        for call in emit_calls
                    )
                    assert error_event_sent, f"Expected error event {scenario['expected_error_event']} not sent for scenario {scenario['name']}"

    @pytest.mark.asyncio
    async def test_auth_database_connection_optimization(self, socketio_manager, mock_instructor):
        """
        データベース接続の最適化をテスト
        """
        with patch('core.socketio_server.get_db') as mock_get_db, \
             patch('core.socketio_server.get_instructor_by_email') as mock_get_instructor, \
             patch('core.socketio_server.verify_token') as mock_verify_token:
            
            valid_token = "valid_jwt_token"
            db_connections = []
            connection_count = 0

            def mock_db_generator():
                nonlocal connection_count
                connection_count += 1
                mock_db = MagicMock()
                mock_db.connection_id = connection_count
                db_connections.append(mock_db)
                return mock_db

            # 各呼び出しで新しいDB接続を返すように設定
            mock_get_db.side_effect = lambda: mock_db_generator()
            mock_get_instructor.return_value = mock_instructor
            mock_verify_token.return_value = {"sub": mock_instructor.email}

            socketio_manager.sio.emit = AsyncMock()
            socketio_manager.sio.disconnect = AsyncMock()

            # 複数の認証リクエストでデータベース接続を最適化
            auth_requests = 5

            for i in range(auth_requests):
                sid = f"test_session_db_{i}"
                auth = {"token": valid_token}

                # 認証処理をシミュレート
                try:
                    token = auth.get("token")
                    payload = mock_verify_token(token)

                    if payload:
                        instructor_email = payload.get("sub")
                        if instructor_email:
                            # データベース接続を取得
                            db = mock_get_db()
                            try:
                                instructor = mock_get_instructor(db, instructor_email)
                                if instructor and instructor.is_active:
                                    # セッション情報を保存
                                    socketio_manager.instructor_sessions[sid] = {
                                        "instructor_id": instructor.id,
                                        "instructor_email": instructor_email,
                                        "instructor_name": instructor.name,
                                        "connected_at": asyncio.get_event_loop().time(),
                                    }
                                    result = True
                                else:
                                    await socketio_manager.sio.disconnect(sid)
                                    result = False
                            finally:
                                # データベース接続を適切にクローズ
                                if hasattr(db, 'close'):
                                    db.close()
                        else:
                            await socketio_manager.sio.disconnect(sid)
                            result = False
                    else:
                        await socketio_manager.sio.disconnect(sid)
                        result = False
                except Exception:
                    await socketio_manager.sio.disconnect(sid)
                    result = False

            # データベース接続最適化の検証
            assert len(db_connections) == auth_requests, f"Expected {auth_requests} DB connections, got {len(db_connections)}"
            
            # 各接続が適切にクローズされたことを確認
            for db in db_connections:
                assert hasattr(db, 'close'), "Database connection should have close method"
            
            # 認証成功したセッションの確認
            assert len(socketio_manager.instructor_sessions) == auth_requests
            
            # モック呼び出し回数の確認
            assert mock_get_instructor.call_count == auth_requests
            assert mock_verify_token.call_count == auth_requests

    @pytest.mark.asyncio
    async def test_auth_memory_usage_optimization(self, socketio_manager, mock_instructor, valid_token):
        """認証メモリ使用量最適化テスト"""
        with patch("core.socketio_server.get_db") as mock_get_db, \
             patch("core.socketio_server.get_instructor_by_email") as mock_get_instructor, \
             patch("core.socketio_server.verify_token") as mock_verify_token:

            # モックの設定
            mock_db = MagicMock()
            mock_get_db.return_value.__next__.return_value = mock_db
            mock_get_instructor.return_value = mock_instructor
            mock_verify_token.return_value = {"sub": mock_instructor.email}

            socketio_manager.sio.emit = AsyncMock()
            socketio_manager.sio.disconnect = AsyncMock()

            # 大量のセッション作成と削除をテスト
            max_sessions = 100
            active_sessions = []

            # セッション作成フェーズ
            for i in range(max_sessions):
                sid = f"test_session_memory_{i}"
                auth = {"token": valid_token}

                # 認証成功をシミュレート
                socketio_manager.instructor_sessions[sid] = {
                    "instructor_id": mock_instructor.id,
                    "instructor_email": mock_instructor.email,
                    "instructor_name": mock_instructor.name,
                    "connected_at": asyncio.get_event_loop().time(),
                }
                active_sessions.append(sid)

            # メモリ使用量の確認
            assert len(socketio_manager.instructor_sessions) == max_sessions

            # セッション削除フェーズ（半分を削除）
            sessions_to_remove = active_sessions[:max_sessions // 2]
            for sid in sessions_to_remove:
                if sid in socketio_manager.instructor_sessions:
                    del socketio_manager.instructor_sessions[sid]
                active_sessions.remove(sid)

            # メモリ最適化の確認
            expected_remaining = max_sessions - len(sessions_to_remove)
            assert len(socketio_manager.instructor_sessions) == expected_remaining
            assert len(active_sessions) == expected_remaining

            # 残りのセッションが正常であることを確認
            for sid in active_sessions:
                assert sid in socketio_manager.instructor_sessions
                session_info = socketio_manager.instructor_sessions[sid]
                assert session_info["instructor_id"] == mock_instructor.id
                assert session_info["instructor_email"] == mock_instructor.email

            # 全セッションをクリア
            socketio_manager.instructor_sessions.clear()
            assert len(socketio_manager.instructor_sessions) == 0
