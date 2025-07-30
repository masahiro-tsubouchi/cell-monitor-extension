"""
講師認証付きWebSocket接続のAI駆動TDDテスト

Phase 4: WebSocket統合・イベント連携
- 講師認証付きWebSocket接続
- 講師ステータス変更のリアルタイム通知
- 学生-講師間リアルタイム通信
"""

import pytest
import json
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from db.models import Instructor, InstructorStatus
from core.security import create_access_token
from crud.crud_instructor import create_instructor
from schemas.instructor import InstructorCreate


class TestInstructorWebSocket:
    """講師認証付きWebSocket接続のテストクラス"""

    @pytest.mark.asyncio
    async def test_websocket_connection_with_valid_token(self, db_session: Session):
        """有効なJWTトークンでのWebSocket接続テスト"""
        from unittest.mock import AsyncMock
        from fastapi import WebSocket
        from api.endpoints.instructor_websocket import (
            instructor_manager,
            authenticate_websocket_token,
        )

        # テスト用講師を作成
        instructor_data = InstructorCreate(
            name="Test Instructor", email="instructor@test.com", password="password123"
        )
        instructor = create_instructor(db_session, instructor_data)
        db_session.commit()  # データベースにコミット

        # JWTトークンを生成
        token = create_access_token(data={"sub": instructor.email})

        # 認証テスト
        auth_info = await authenticate_websocket_token(token, db_session)
        assert auth_info is not None
        assert auth_info["instructor_id"] == instructor.id
        assert auth_info["email"] == instructor.email

        # WebSocket接続マネージャーテスト
        mock_websocket = AsyncMock(spec=WebSocket)

        # 講師接続テスト
        await instructor_manager.connect_instructor(
            instructor.id, mock_websocket, instructor.email
        )

        # 接続が正常に管理されていることを確認
        assert instructor.id in instructor_manager.instructor_connections
        assert (
            instructor_manager.instructor_connections[instructor.id] == mock_websocket
        )

        # WebSocket acceptが呼ばれたことを確認
        mock_websocket.accept.assert_called_once()

        # 接続成功メッセージが送信されたことを確認
        mock_websocket.send_text.assert_called_once()
        sent_message = json.loads(mock_websocket.send_text.call_args[0][0])
        assert sent_message["type"] == "connection_success"
        assert sent_message["instructor_id"] == instructor.id

    @pytest.mark.asyncio
    async def test_websocket_connection_with_invalid_token(self, db_session: Session):
        """無効なJWTトークンでのWebSocket接続テスト"""
        from api.endpoints.instructor_websocket import authenticate_websocket_token

        invalid_token = "invalid.jwt.token"

        # 無効トークンでの認証失敗を確認
        auth_info = await authenticate_websocket_token(invalid_token, db_session)
        assert auth_info is None

    @pytest.mark.asyncio
    async def test_websocket_connection_without_token(self, db_session: Session):
        """トークンなしでのWebSocket接続テスト"""
        from api.endpoints.instructor_websocket import authenticate_websocket_token

        # 空トークンでの認証失敗を確認
        auth_info = await authenticate_websocket_token("", db_session)
        assert auth_info is None

    @pytest.mark.asyncio
    async def test_websocket_instructor_status_notification(self, db_session: Session):
        """講師ステータス変更のリアルタイム通知テスト（簡素化版）"""
        from unittest.mock import AsyncMock
        from fastapi import WebSocket
        from api.endpoints.instructor_websocket import instructor_manager

        # テスト用講師を作成
        instructor_data = InstructorCreate(
            name="Test Instructor", email="instructor@test.com", password="password123"
        )
        instructor = create_instructor(db_session, instructor_data)
        db_session.commit()

        # WebSocket接続マネージャーテスト
        mock_websocket = AsyncMock(spec=WebSocket)

        # 講師接続を確立
        await instructor_manager.connect_instructor(
            instructor.id, mock_websocket, instructor.email
        )

        # 接続成功メッセージが送信されたことを確認
        assert mock_websocket.send_text.call_count == 1
        connection_message = json.loads(mock_websocket.send_text.call_args[0][0])
        assert connection_message["type"] == "connection_success"
        assert connection_message["instructor_id"] == instructor.id

        # ステータス更新メッセージを手動で送信シミュレート
        status_update_message = {
            "type": "status_updated",
            "instructor_id": instructor.id,
            "status": "in_session",
            "session_id": 123,
            "updated_at": "2025-01-19T12:00:00Z",
        }

        # ステータス更新通知を送信
        await instructor_manager.send_to_instructor(
            instructor.id, status_update_message
        )

        # メッセージが送信されたことを確認
        assert mock_websocket.send_text.call_count == 2

        # 最新のメッセージを確認
        last_call_args = mock_websocket.send_text.call_args_list[-1]
        sent_message = json.loads(last_call_args[0][0])

        assert sent_message["type"] == "status_updated"
        assert sent_message["instructor_id"] == instructor.id
        assert sent_message["status"] == "in_session"
        assert sent_message["session_id"] == 123

    @pytest.mark.asyncio
    async def test_websocket_student_instructor_communication(
        self, db_session: Session
    ):
        """学生-講師間リアルタイム通信テスト（簡素化版）"""
        from unittest.mock import AsyncMock
        from fastapi import WebSocket
        from api.endpoints.instructor_websocket import (
            instructor_manager,
            handle_student_message,
            handle_instructor_reply,
        )

        # テスト用講師を作成
        instructor_data = InstructorCreate(
            name="Test Instructor", email="instructor@test.com", password="password123"
        )
        instructor = create_instructor(db_session, instructor_data)
        db_session.commit()

        # WebSocket接続マネージャーテスト
        mock_websocket = AsyncMock(spec=WebSocket)

        # 講師接続を確立
        await instructor_manager.connect_instructor(
            instructor.id, mock_websocket, instructor.email
        )

        # 学生からのメッセージをシミュレート
        student_message = {
            "type": "student_message",
            "student_id": "student_123",
            "message": "質問があります",
            "timestamp": "2025-01-19T12:00:00Z",
        }

        # 学生メッセージ処理を実行
        await handle_student_message(instructor.id, student_message)

        # 講師からの返信をシミュレート
        instructor_reply = {
            "type": "instructor_reply",
            "student_id": "student_123",
            "message": "どのような質問でしょうか？",
            "timestamp": "2025-01-19T12:01:00Z",
        }

        # 講師返信処理を実行
        await handle_instructor_reply(instructor.id, instructor_reply)

        # メッセージが送信されたことを確認
        # 接続成功 + 学生メッセージ受信 + 講師返信確認
        assert mock_websocket.send_text.call_count >= 3

        # 送信されたメッセージを確認
        sent_messages = []
        for call_args in mock_websocket.send_text.call_args_list:
            message = json.loads(call_args[0][0])
            sent_messages.append(message)

        # 学生メッセージ受信通知を確認
        student_msg_received = next(
            (
                msg
                for msg in sent_messages
                if msg.get("type") == "student_message_received"
            ),
            None,
        )
        assert student_msg_received is not None
        assert student_msg_received["student_id"] == "student_123"
        assert student_msg_received["message"] == "質問があります"

        # 講師返信確認を確認
        reply_sent = next(
            (msg for msg in sent_messages if msg.get("type") == "reply_sent"), None
        )
        assert reply_sent is not None
        assert reply_sent["student_id"] == "student_123"

    def test_websocket_multiple_instructor_connections(
        self, client: TestClient, db_session: Session
    ):
        """複数講師の同時WebSocket接続テスト"""
        # テスト用講師を2人作成
        instructor1_data = InstructorCreate(
            name="Instructor 1", email="instructor1@test.com", password="password123"
        )
        instructor1 = create_instructor(db_session, instructor1_data)

        instructor2_data = InstructorCreate(
            name="Instructor 2", email="instructor2@test.com", password="password456"
        )
        instructor2 = create_instructor(db_session, instructor2_data)

        # 各講師のJWTトークンを生成
        token1 = create_access_token(data={"sub": instructor1.email})
        token2 = create_access_token(data={"sub": instructor2.email})

        # 両方の講師でWebSocket接続を確立
        with client.websocket_connect(
            f"/api/v1/ws/instructor/{instructor1.id}?token={token1}"
        ) as ws1, client.websocket_connect(
            f"/api/v1/ws/instructor/{instructor2.id}?token={token2}"
        ) as ws2:

            # 両方の接続成功メッセージを受信
            data1 = ws1.receive_json()
            data2 = ws2.receive_json()

            assert data1["type"] == "connection_success"
            assert data1["instructor_id"] == instructor1.id

            assert data2["type"] == "connection_success"
            assert data2["instructor_id"] == instructor2.id

            # 講師1から講師2へのメッセージ送信をテスト
            inter_instructor_message = {
                "type": "instructor_to_instructor",
                "target_instructor_id": instructor2.id,
                "message": "授業の進捗はいかがですか？",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

            ws1.send_json(inter_instructor_message)

            # 講師2がメッセージを受信
            received_message = ws2.receive_json()
            assert received_message["type"] == "instructor_message_received"
            assert received_message["from_instructor_id"] == instructor1.id
            assert received_message["message"] == "授業の進捗はいかがですか？"

    def test_websocket_connection_cleanup_on_disconnect(
        self, client: TestClient, db_session: Session
    ):
        """WebSocket切断時のクリーンアップテスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            name="Test Instructor", email="instructor@test.com", password="password123"
        )
        instructor = create_instructor(db_session, instructor_data)

        # JWTトークンを生成
        token = create_access_token(data={"sub": instructor.email})

        # WebSocket接続を確立して切断
        with client.websocket_connect(
            f"/api/v1/ws/instructor/{instructor.id}?token={token}"
        ) as websocket:
            # 接続成功メッセージを受信
            connection_data = websocket.receive_json()
            assert connection_data["type"] == "connection_success"

            # 明示的に切断
            websocket.close()

        # 切断後、新しい接続が正常に動作することを確認
        with client.websocket_connect(
            f"/api/v1/ws/instructor/{instructor.id}?token={token}"
        ) as new_websocket:
            new_connection_data = new_websocket.receive_json()
            assert new_connection_data["type"] == "connection_success"
            assert new_connection_data["instructor_id"] == instructor.id


class TestInstructorWebSocketIntegration:
    """講師WebSocket統合テストクラス"""

    def test_full_instructor_websocket_workflow(
        self, client: TestClient, db_session: Session
    ):
        """講師WebSocket完全ワークフローテスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            name="Test Instructor", email="instructor@test.com", password="password123"
        )
        instructor = create_instructor(db_session, instructor_data)

        # JWTトークンを生成
        token = create_access_token(data={"sub": instructor.email})

        # WebSocket接続を確立
        with client.websocket_connect(
            f"/api/v1/instructor/ws/instructor/{instructor.id}?token={token}"
        ) as websocket:
            # 1. 接続成功
            connection_data = websocket.receive_json()
            assert connection_data["type"] == "connection_success"

            # 2. ステータス更新
            websocket.send_json(
                {
                    "type": "status_update",
                    "status": "TEACHING",
                    "session_id": "session_123",
                }
            )

            status_response = websocket.receive_json()
            assert status_response["type"] == "status_updated"
            assert status_response["status"] == "TEACHING"

            # 3. 学生メッセージ受信
            websocket.send_json(
                {
                    "type": "student_message",
                    "student_id": "student_123",
                    "message": "質問があります",
                }
            )

            message_response = websocket.receive_json()
            assert message_response["type"] == "student_message_received"

            # 4. 講師返信
            websocket.send_json(
                {
                    "type": "instructor_reply",
                    "student_id": "student_123",
                    "message": "どのような質問でしょうか？",
                }
            )

            reply_response = websocket.receive_json()
            assert reply_response["type"] == "reply_sent"

            # 5. ステータス終了
            websocket.send_json(
                {"type": "status_update", "status": "AVAILABLE", "session_id": None}
            )

            final_status = websocket.receive_json()
            assert final_status["type"] == "status_updated"
            assert final_status["status"] == "AVAILABLE"
