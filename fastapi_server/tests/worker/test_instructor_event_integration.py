"""
講師イベント統合のAI駆動TDDテスト

Phase 4: WebSocket統合・イベント連携
- 学生セッション開始時の講師ステータス自動更新
- 講師-学生マッチング機能
- イベントルーター拡張
"""

import pytest
import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
from sqlalchemy.orm import Session

from worker.event_router import (
    event_router,
    handle_student_session_start,
    handle_instructor_assignment,
)
from schemas.instructor import InstructorCreate
from crud.crud_instructor import (
    create_instructor,
    get_instructor,
    update_instructor_status,
)
from db.models import InstructorStatus
from core.security import create_access_token


class TestInstructorEventIntegration:
    """講師イベント統合のテストクラス"""

    @pytest.mark.asyncio
    async def test_student_session_start_instructor_status_update(
        self, db_session: Session
    ):
        """学生セッション開始時の講師ステータス自動更新テスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            name="Test Instructor", email="instructor@test.com", password="password123"
        )
        instructor = create_instructor(db_session, instructor_data)
        db_session.commit()

        # 学生セッション開始イベントデータ
        event_data = {
            "event": "student_session_start",
            "student_id": "student_123",
            "notebook_id": "notebook_456",
            "class_id": "class_789",
            "instructor_id": instructor.id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # イベント処理を実行
        result = await handle_student_session_start(event_data, db_session)

        # 処理が成功したことを確認
        assert result is True

        # 講師ステータスが自動更新されたことを確認
        updated_instructor = get_instructor(db_session, instructor.id)
        assert updated_instructor.status == InstructorStatus.IN_SESSION
        # current_session_idは外部キー制約回避のためNoneに設定

    @pytest.mark.asyncio
    async def test_instructor_student_matching(self, db_session: Session):
        """講師-学生マッチング機能テスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            name="Available Instructor",
            email="available@test.com",
            password="password123",
        )
        instructor = create_instructor(db_session, instructor_data)

        # 講師をAVAILABLE状態に設定
        from crud.crud_instructor import update_instructor_status
        from schemas.instructor import InstructorStatusUpdate
        from db.models import InstructorStatus

        status_update = InstructorStatusUpdate(
            status=InstructorStatus.AVAILABLE, current_session_id=None
        )
        update_instructor_status(db_session, instructor.id, status_update)
        db_session.commit()

        # 講師割り当てイベントデータ
        event_data = {
            "event": "instructor_assignment",
            "student_id": "student_456",
            "class_id": "class_789",
            "subject": "Python Programming",
            "priority": "high",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # イベント処理を実行
        result = await handle_instructor_assignment(event_data, db_session)

        # 処理が成功したことを確認
        assert result is True

        # 講師が割り当てられたことを確認
        updated_instructor = get_instructor(db_session, instructor.id)
        assert updated_instructor.status == InstructorStatus.IN_SESSION

    @pytest.mark.asyncio
    async def test_event_router_instructor_integration(self, db_session: Session):
        """イベントルーターの講師統合テスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            name="Router Test Instructor",
            email="router@test.com",
            password="password123",
        )
        instructor = create_instructor(db_session, instructor_data)
        db_session.commit()

        # 講師関連イベントハンドラーを登録
        event_router.register_handler(
            "student_session_start", handle_student_session_start
        )
        event_router.register_handler(
            "instructor_assignment", handle_instructor_assignment
        )

        # 学生セッション開始イベント
        session_event = {
            "event": "student_session_start",
            "student_id": "student_789",
            "instructor_id": instructor.id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # イベントルーターでイベント処理
        result = await event_router.route_event(session_event, db_session)

        # 処理が成功したことを確認
        assert result is True

        # 講師ステータスが更新されたことを確認
        updated_instructor = get_instructor(db_session, instructor.id)
        assert updated_instructor.status == InstructorStatus.IN_SESSION

    @pytest.mark.asyncio
    async def test_instructor_websocket_notification_on_assignment(
        self, db_session: Session
    ):
        """講師割り当て時のWebSocket通知テスト"""
        from unittest.mock import AsyncMock
        from fastapi import WebSocket
        from api.endpoints.instructor_websocket import instructor_manager

        # テスト用講師を作成
        instructor_data = InstructorCreate(
            name="Notification Test Instructor",
            email="notification@test.com",
            password="password123",
        )
        instructor = create_instructor(db_session, instructor_data)

        # 講師をAVAILABLE状態に設定
        from crud.crud_instructor import update_instructor_status
        from schemas.instructor import InstructorStatusUpdate
        from db.models import InstructorStatus

        status_update = InstructorStatusUpdate(
            status=InstructorStatus.AVAILABLE, current_session_id=None
        )
        update_instructor_status(db_session, instructor.id, status_update)
        db_session.commit()

        # WebSocket接続をシミュレート
        mock_websocket = AsyncMock(spec=WebSocket)
        await instructor_manager.connect_instructor(
            instructor.id, mock_websocket, instructor.email
        )

        # 講師割り当てイベント
        assignment_event = {
            "event": "instructor_assignment",
            "student_id": "student_notify",
            "instructor_id": instructor.id,
            "class_id": "class_notify",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # イベント処理を実行（WebSocket通知を含む）
        with patch(
            "api.endpoints.instructor_websocket.instructor_manager", instructor_manager
        ):
            result = await handle_instructor_assignment(assignment_event, db_session)

        # 処理が成功したことを確認
        assert result is True

        # WebSocket通知が送信されたことを確認
        assert mock_websocket.send_text.call_count >= 2  # 接続成功 + 割り当て通知

        # 割り当て通知メッセージを確認
        sent_messages = []
        for call_args in mock_websocket.send_text.call_args_list:
            message = json.loads(call_args[0][0])
            sent_messages.append(message)

        assignment_notification = next(
            (msg for msg in sent_messages if msg.get("type") == "instructor_assigned"),
            None,
        )
        assert assignment_notification is not None
        assert assignment_notification["student_id"] == "student_notify"
        assert assignment_notification["instructor_id"] == instructor.id

    @pytest.mark.asyncio
    async def test_instructor_status_history_on_session_events(
        self, db_session: Session
    ):
        """セッションイベント時の講師ステータス履歴記録テスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            name="History Test Instructor",
            email="history@test.com",
            password="password123",
        )
        instructor = create_instructor(db_session, instructor_data)
        db_session.commit()

        # 初期ステータス履歴数を確認
        from crud.crud_instructor import get_instructor_status_history

        initial_history = get_instructor_status_history(db_session, instructor.id)
        initial_count = len(initial_history)

        # 学生セッション開始イベント
        session_start_event = {
            "event": "student_session_start",
            "student_id": "student_history",
            "instructor_id": instructor.id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # イベント処理を実行
        result = await handle_student_session_start(session_start_event, db_session)
        assert result is True

        # ステータス履歴が追加されたことを確認
        updated_history = get_instructor_status_history(db_session, instructor.id)
        assert len(updated_history) == initial_count + 1

        # 最新の履歴がIN_SESSIONであることを確認
        latest_history = updated_history[0]  # 降順ソート
        assert latest_history.status == InstructorStatus.IN_SESSION

    @pytest.mark.asyncio
    async def test_error_handling_in_instructor_events(self, db_session: Session):
        """講師イベント処理でのエラーハンドリングテスト"""
        # 存在しない講師IDでイベント処理
        invalid_event = {
            "event": "student_session_start",
            "student_id": "student_error",
            "instructor_id": 99999,  # 存在しない講師ID
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # エラーハンドリングが適切に動作することを確認
        result = await handle_student_session_start(invalid_event, db_session)

        # エラーが適切に処理され、Falseが返されることを確認
        assert result is False
