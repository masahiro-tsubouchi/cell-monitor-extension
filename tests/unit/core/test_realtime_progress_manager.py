"""
リアルタイム進捗管理マネージャーの単体テスト

RealtimeProgressManagerクラスの各機能をテストし、
進捗追跡、通知生成、WebSocket配信が正常に動作することを確認。
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timedelta

from core.realtime_progress_manager import (
    RealtimeProgressManager,
    realtime_progress_manager
)
from schemas.realtime_progress import (
    CellProgressInfo,
    AssignmentProgressInfo,
    StudentProgressSummary,
    ProgressUpdateEvent,
    ProgressNotification,
    ProgressStatus,
    CellExecutionStatus,
    NotificationLevel
)


class TestRealtimeProgressManager:
    """RealtimeProgressManagerクラスのテスト"""

    @pytest.fixture
    def manager(self):
        """テスト用のRealtimeProgressManagerインスタンス"""
        return RealtimeProgressManager()

    @pytest.fixture
    def sample_event_data(self):
        """テスト用のイベントデータ"""
        return {
            "eventType": "cell_execution_complete",
            "eventTime": datetime.now().isoformat(),
            "cellIndex": 1,
            "cellType": "code",
            "executionCount": 1,
            "executionDurationMs": 150.0,
            "hasError": False,
            "errorMessage": None,
            "code": "print('Hello, World!')",
            "result": "Hello, World!",
            "metadata": {
                "memory_usage_mb": 64.5,
                "cpu_usage_percent": 12.3
            }
        }

    @pytest.mark.asyncio
    async def test_process_cell_execution_event_success(self, manager, sample_event_data):
        """セル実行イベント処理の正常系テスト"""

        user_id = "test_user_001"
        assignment_id = "assignment_001"
        cell_id = "cell_001"

        with patch.object(manager, '_broadcast_progress_update', new_callable=AsyncMock) as mock_broadcast, \
             patch.object(manager, '_generate_progress_notifications', new_callable=AsyncMock) as mock_notify:

            await manager.process_cell_execution_event(
                user_id=user_id,
                assignment_id=assignment_id,
                cell_id=cell_id,
                event_data=sample_event_data
            )

            # セル進捗が作成されていることを確認
            cell_key = f"{user_id}:{assignment_id}"
            assert cell_id in manager.cell_progress[cell_key]

            cell_progress = manager.cell_progress[cell_key][cell_id]
            assert cell_progress.cell_id == cell_id
            assert cell_progress.execution_status == CellExecutionStatus.COMPLETED
            assert cell_progress.is_completed is True
            assert cell_progress.execution_duration_ms == 150.0

            # 課題進捗が作成されていることを確認
            assert assignment_id in manager.assignment_progress[user_id]
            assignment_progress = manager.assignment_progress[user_id][assignment_id]
            assert assignment_progress.assignment_id == assignment_id
            assert assignment_progress.total_cells == 1
            assert assignment_progress.completed_cells == 1
            assert assignment_progress.progress_percentage == 100.0

            # 学生進捗が作成されていることを確認
            assert user_id in manager.student_progress
            student_progress = manager.student_progress[user_id]
            assert student_progress.user_id == user_id
            assert student_progress.total_assignments == 1
            assert student_progress.completed_assignments == 1

            # 配信・通知が呼ばれていることを確認
            mock_broadcast.assert_called_once()
            mock_notify.assert_called_once()

            # 統計が更新されていることを確認
            assert manager.stats['total_events_processed'] == 1

    @pytest.mark.asyncio
    async def test_update_cell_progress_execution_start(self, manager):
        """セル実行開始時の進捗更新テスト"""

        user_id = "test_user"
        assignment_id = "test_assignment"
        cell_id = "test_cell"

        event_data = {
            "eventType": "cell_execution_start",
            "cellIndex": 0,
            "cellType": "code"
        }

        cell_progress = await manager._update_cell_progress(
            user_id, assignment_id, cell_id, event_data
        )

        assert cell_progress.cell_id == cell_id
        assert cell_progress.execution_status == CellExecutionStatus.RUNNING
        assert cell_progress.last_executed_at is not None
        assert cell_progress.is_completed is False

    @pytest.mark.asyncio
    async def test_update_cell_progress_execution_error(self, manager):
        """セル実行エラー時の進捗更新テスト"""

        user_id = "test_user"
        assignment_id = "test_assignment"
        cell_id = "test_cell"

        event_data = {
            "eventType": "cell_execution_error",
            "cellIndex": 0,
            "cellType": "code",
            "errorMessage": "NameError: name 'undefined_var' is not defined",
            "errorType": "NameError"
        }

        cell_progress = await manager._update_cell_progress(
            user_id, assignment_id, cell_id, event_data
        )

        assert cell_progress.execution_status == CellExecutionStatus.ERROR
        assert cell_progress.has_error is True
        assert cell_progress.error_message == "NameError: name 'undefined_var' is not defined"
        assert cell_progress.error_type == "NameError"
        assert cell_progress.completion_score == 0.0

    @pytest.mark.asyncio
    async def test_update_assignment_progress_multiple_cells(self, manager):
        """複数セルでの課題進捗更新テスト"""

        user_id = "test_user"
        assignment_id = "test_assignment"

        # 3つのセルを作成（2つ完了、1つエラー）
        cell_key = f"{user_id}:{assignment_id}"

        manager.cell_progress[cell_key]["cell_001"] = CellProgressInfo(
            cell_id="cell_001",
            cell_index=0,
            cell_type="code",
            execution_status=CellExecutionStatus.COMPLETED,
            is_completed=True,
            execution_duration_ms=100.0
        )

        manager.cell_progress[cell_key]["cell_002"] = CellProgressInfo(
            cell_id="cell_002",
            cell_index=1,
            cell_type="code",
            execution_status=CellExecutionStatus.COMPLETED,
            is_completed=True,
            execution_duration_ms=200.0
        )

        manager.cell_progress[cell_key]["cell_003"] = CellProgressInfo(
            cell_id="cell_003",
            cell_index=2,
            cell_type="code",
            execution_status=CellExecutionStatus.ERROR,
            has_error=True,
            is_completed=False
        )

        assignment_progress = await manager._update_assignment_progress(user_id, assignment_id)

        assert assignment_progress.total_cells == 3
        assert assignment_progress.completed_cells == 2
        assert assignment_progress.error_cells == 1
        assert assignment_progress.progress_percentage == (2/3) * 100  # 約66.67%
        assert assignment_progress.overall_status == ProgressStatus.IN_PROGRESS
        assert assignment_progress.total_execution_time_ms == 300.0

    @pytest.mark.asyncio
    async def test_update_student_progress_multiple_assignments(self, manager):
        """複数課題での学生進捗更新テスト"""

        user_id = "test_user"

        # 2つの課題を作成（1つ完了、1つ進行中）
        manager.assignment_progress[user_id]["assignment_001"] = AssignmentProgressInfo(
            assignment_id="assignment_001",
            assignment_name="Assignment 1",
            notebook_path="/assignments/assignment_001.ipynb",
            overall_status=ProgressStatus.COMPLETED,
            progress_percentage=100.0,
            total_cells=3,
            completed_cells=3,
            error_cells=0,
            total_execution_time_ms=500.0,
            last_updated_at=datetime.now()
        )

        manager.assignment_progress[user_id]["assignment_002"] = AssignmentProgressInfo(
            assignment_id="assignment_002",
            assignment_name="Assignment 2",
            notebook_path="/assignments/assignment_002.ipynb",
            overall_status=ProgressStatus.IN_PROGRESS,
            progress_percentage=50.0,
            total_cells=4,
            completed_cells=2,
            error_cells=1,
            total_execution_time_ms=300.0,
            last_updated_at=datetime.now()
        )

        student_progress = await manager._update_student_progress(user_id)

        assert student_progress.total_assignments == 2
        assert student_progress.completed_assignments == 1
        assert student_progress.in_progress_assignments == 1
        assert student_progress.overall_progress_percentage == 75.0  # (100 + 50) / 2
        assert student_progress.total_execution_count == 6  # 3 + 2 + 1
        assert student_progress.total_execution_time_ms == 800.0
        assert student_progress.error_rate == 1/7  # 1 error out of 7 total cells

    def test_estimate_completion_time(self, manager):
        """完了予想時刻計算のテスト"""

        assignment_progress = AssignmentProgressInfo(
            assignment_id="test_assignment",
            assignment_name="Test Assignment",
            notebook_path="/test.ipynb",
            total_cells=10,
            completed_cells=3,
            cells_progress=[
                CellProgressInfo(
                    cell_id="cell_001",
                    cell_index=0,
                    cell_type="code",
                    is_completed=True,
                    execution_duration_ms=100.0
                ),
                CellProgressInfo(
                    cell_id="cell_002",
                    cell_index=1,
                    cell_type="code",
                    is_completed=True,
                    execution_duration_ms=200.0
                ),
                CellProgressInfo(
                    cell_id="cell_003",
                    cell_index=2,
                    cell_type="code",
                    is_completed=True,
                    execution_duration_ms=150.0
                )
            ],
            last_updated_at=datetime.now()
        )

        estimated_time = manager._estimate_completion_time(assignment_progress)

        assert estimated_time is not None
        assert estimated_time > datetime.now()

        # 平均実行時間: (100 + 200 + 150) / 3 = 150ms
        # 残りセル数: 10 - 3 = 7
        # 予想残り時間: 7 * 150 * 1.5 = 1575ms
        expected_duration = timedelta(milliseconds=1575)
        actual_duration = estimated_time - datetime.now()

        # 多少の誤差を許容（±100ms）
        assert abs(actual_duration.total_seconds() - expected_duration.total_seconds()) < 0.1

    @pytest.mark.asyncio
    async def test_generate_progress_notifications_error(self, manager):
        """エラー通知生成のテスト"""

        user_id = "test_user"
        assignment_id = "test_assignment"

        cell_progress = CellProgressInfo(
            cell_id="test_cell",
            cell_index=1,
            cell_type="code",
            execution_status=CellExecutionStatus.ERROR,
            has_error=True,
            error_message="Test error message"
        )

        assignment_progress = AssignmentProgressInfo(
            assignment_id=assignment_id,
            assignment_name="Test Assignment",
            notebook_path="/test.ipynb",
            overall_status=ProgressStatus.IN_PROGRESS,
            progress_percentage=25.0,
            last_updated_at=datetime.now()
        )

        with patch.object(manager, '_send_notification', new_callable=AsyncMock) as mock_send:
            await manager._generate_progress_notifications(
                user_id, assignment_id, cell_progress, assignment_progress
            )

            # エラー通知が生成されていることを確認
            assert len(manager.pending_notifications[user_id]) > 0

            error_notification = manager.pending_notifications[user_id][0]
            assert error_notification.level == NotificationLevel.ERROR
            assert "エラー" in error_notification.title
            assert "Test error message" in error_notification.message

            # 通知送信が呼ばれていることを確認
            assert mock_send.call_count > 0

    @pytest.mark.asyncio
    async def test_generate_progress_notifications_completion(self, manager):
        """完了通知生成のテスト"""

        user_id = "test_user"
        assignment_id = "test_assignment"

        cell_progress = CellProgressInfo(
            cell_id="test_cell",
            cell_index=1,
            cell_type="code",
            execution_status=CellExecutionStatus.COMPLETED,
            is_completed=True
        )

        assignment_progress = AssignmentProgressInfo(
            assignment_id=assignment_id,
            assignment_name="Test Assignment",
            notebook_path="/test.ipynb",
            overall_status=ProgressStatus.COMPLETED,
            progress_percentage=100.0,
            last_updated_at=datetime.now()
        )

        with patch.object(manager, '_send_notification', new_callable=AsyncMock) as mock_send:
            await manager._generate_progress_notifications(
                user_id, assignment_id, cell_progress, assignment_progress
            )

            # 完了通知が生成されていることを確認
            notifications = manager.pending_notifications[user_id]
            completion_notifications = [
                n for n in notifications
                if n.level == NotificationLevel.SUCCESS and "完了" in n.title
            ]
            assert len(completion_notifications) > 0

            # 学生向けと講師向けの通知が生成されていることを確認
            student_notifications = [n for n in notifications if n.recipient_type == "student"]
            instructor_notifications = [n for n in notifications if n.recipient_type == "instructor"]

            assert len(student_notifications) > 0
            # 講師向け通知は別のキューに保存される（簡易実装では同じキューを使用）

    @pytest.mark.asyncio
    async def test_subscribe_unsubscribe_user(self, manager):
        """ユーザー購読・購読解除のテスト"""

        user_id = "test_user"
        connection_id = "connection_123"

        # 購読
        await manager.subscribe_user(user_id, connection_id)

        assert user_id in manager.active_subscribers
        assert connection_id in manager.active_subscribers[user_id]
        assert manager.stats['active_sessions'] == 1

        # 購読解除
        await manager.unsubscribe_user(user_id, connection_id)

        assert user_id not in manager.active_subscribers
        assert manager.stats['active_sessions'] == 0

    @pytest.mark.asyncio
    async def test_subscribe_unsubscribe_instructor(self, manager):
        """講師購読・購読解除のテスト"""

        connection_id = "instructor_connection_123"

        # 購読
        await manager.subscribe_instructor(connection_id)

        assert connection_id in manager.instructor_subscribers

        # 購読解除
        await manager.unsubscribe_instructor(connection_id)

        assert connection_id not in manager.instructor_subscribers

    def test_get_student_progress(self, manager):
        """学生進捗取得のテスト"""

        user_id = "test_user"

        # 進捗データが存在しない場合
        progress = manager.get_student_progress(user_id)
        assert progress is None

        # 進捗データを作成
        test_progress = StudentProgressSummary(
            user_id=user_id,
            user_name="Test User",
            total_assignments=2,
            completed_assignments=1,
            overall_progress_percentage=50.0,
            last_activity_at=datetime.now()
        )
        manager.student_progress[user_id] = test_progress

        # 進捗データが取得できることを確認
        retrieved_progress = manager.get_student_progress(user_id)
        assert retrieved_progress is not None
        assert retrieved_progress.user_id == user_id
        assert retrieved_progress.overall_progress_percentage == 50.0

    def test_get_assignment_progress(self, manager):
        """課題進捗取得のテスト"""

        user_id = "test_user"
        assignment_id = "test_assignment"

        # 進捗データが存在しない場合
        progress = manager.get_assignment_progress(user_id, assignment_id)
        assert progress is None

        # 進捗データを作成
        test_progress = AssignmentProgressInfo(
            assignment_id=assignment_id,
            assignment_name="Test Assignment",
            notebook_path="/test.ipynb",
            progress_percentage=75.0,
            last_updated_at=datetime.now()
        )
        manager.assignment_progress[user_id][assignment_id] = test_progress

        # 進捗データが取得できることを確認
        retrieved_progress = manager.get_assignment_progress(user_id, assignment_id)
        assert retrieved_progress is not None
        assert retrieved_progress.assignment_id == assignment_id
        assert retrieved_progress.progress_percentage == 75.0

    def test_get_all_students_progress(self, manager):
        """全学生進捗取得のテスト"""

        # 複数の学生進捗を作成
        for i in range(3):
            user_id = f"user_{i:03d}"
            progress = StudentProgressSummary(
                user_id=user_id,
                user_name=f"User {i}",
                overall_progress_percentage=i * 25.0,
                last_activity_at=datetime.now()
            )
            manager.student_progress[user_id] = progress

        all_progress = manager.get_all_students_progress()

        assert len(all_progress) == 3
        assert all(isinstance(p, StudentProgressSummary) for p in all_progress)

        # ソート順序は保証されないが、全ユーザーが含まれていることを確認
        user_ids = {p.user_id for p in all_progress}
        expected_user_ids = {"user_000", "user_001", "user_002"}
        assert user_ids == expected_user_ids

    def test_get_pending_notifications(self, manager):
        """未読通知取得のテスト"""

        user_id = "test_user"

        # 通知が存在しない場合
        notifications = manager.get_pending_notifications(user_id)
        assert notifications == []

        # 通知を作成
        test_notifications = [
            ProgressNotification(
                notification_id="notif_001",
                recipient_id=user_id,
                recipient_type="student",
                title="Test Notification 1",
                message="Test message 1",
                level=NotificationLevel.INFO,
                created_at=datetime.now()
            ),
            ProgressNotification(
                notification_id="notif_002",
                recipient_id=user_id,
                recipient_type="student",
                title="Test Notification 2",
                message="Test message 2",
                level=NotificationLevel.SUCCESS,
                created_at=datetime.now()
            )
        ]

        manager.pending_notifications[user_id] = test_notifications

        # 通知が取得できることを確認
        retrieved_notifications = manager.get_pending_notifications(user_id)
        assert len(retrieved_notifications) == 2
        assert retrieved_notifications[0].title == "Test Notification 1"
        assert retrieved_notifications[1].title == "Test Notification 2"

    def test_get_stats(self, manager):
        """統計情報取得のテスト"""

        # 初期統計
        stats = manager.get_stats()
        assert 'total_events_processed' in stats
        assert 'total_notifications_sent' in stats
        assert 'active_sessions' in stats
        assert 'last_cleanup' in stats

        # 統計を更新
        manager.stats['total_events_processed'] = 100
        manager.stats['total_notifications_sent'] = 50

        updated_stats = manager.get_stats()
        assert updated_stats['total_events_processed'] == 100
        assert updated_stats['total_notifications_sent'] == 50


class TestRealtimeProgressManagerIntegration:
    """RealtimeProgressManagerの統合テスト"""

    @pytest.mark.asyncio
    async def test_full_workflow_single_assignment(self):
        """単一課題の完全ワークフローテスト"""

        manager = RealtimeProgressManager()
        user_id = "integration_test_user"
        assignment_id = "integration_test_assignment"

        with patch.object(manager, '_broadcast_progress_update', new_callable=AsyncMock), \
             patch.object(manager, '_send_notification', new_callable=AsyncMock):

            # セル1実行開始
            await manager.process_cell_execution_event(
                user_id, assignment_id, "cell_001",
                {"eventType": "cell_execution_start", "cellIndex": 0, "cellType": "code"}
            )

            # セル1実行完了
            await manager.process_cell_execution_event(
                user_id, assignment_id, "cell_001",
                {
                    "eventType": "cell_execution_complete",
                    "cellIndex": 0,
                    "cellType": "code",
                    "executionCount": 1,
                    "executionDurationMs": 100.0,
                    "code": "print('Hello')",
                    "result": "Hello"
                }
            )

            # セル2実行エラー
            await manager.process_cell_execution_event(
                user_id, assignment_id, "cell_002",
                {
                    "eventType": "cell_execution_error",
                    "cellIndex": 1,
                    "cellType": "code",
                    "errorMessage": "NameError: name 'x' is not defined",
                    "code": "print(x)"
                }
            )

            # セル2再実行成功
            await manager.process_cell_execution_event(
                user_id, assignment_id, "cell_002",
                {
                    "eventType": "cell_execution_complete",
                    "cellIndex": 1,
                    "cellType": "code",
                    "executionCount": 2,
                    "executionDurationMs": 150.0,
                    "code": "x = 42\nprint(x)",
                    "result": "42"
                }
            )

            # 最終状態を確認
            student_progress = manager.get_student_progress(user_id)
            assert student_progress is not None
            assert student_progress.total_assignments == 1
            assert student_progress.completed_assignments == 1
            assert student_progress.overall_progress_percentage == 100.0

            assignment_progress = manager.get_assignment_progress(user_id, assignment_id)
            assert assignment_progress is not None
            assert assignment_progress.total_cells == 2
            assert assignment_progress.completed_cells == 2
            assert assignment_progress.error_cells == 0  # 最終的にはエラーなし
            assert assignment_progress.progress_percentage == 100.0
            assert assignment_progress.overall_status == ProgressStatus.COMPLETED

            # 通知が生成されていることを確認
            notifications = manager.get_pending_notifications(user_id)
            assert len(notifications) > 0

            # 完了通知が含まれていることを確認
            completion_notifications = [
                n for n in notifications
                if n.level == NotificationLevel.SUCCESS and "完了" in n.title
            ]
            assert len(completion_notifications) > 0
