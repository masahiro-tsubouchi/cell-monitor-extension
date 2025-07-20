"""
リアルタイム進捗管理マネージャー

課題進捗率のライブ更新、WebSocket通信、
進捗分析・予測機能を提供するコアモジュール。
"""

import asyncio
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Set
import logging
from collections import defaultdict, deque

from schemas.realtime_progress import (
    CellProgressInfo,
    AssignmentProgressInfo,
    StudentProgressSummary,
    ProgressUpdateEvent,
    ProgressNotification,
    ProgressAnalytics,
    ProgressStatus,
    CellExecutionStatus,
    NotificationLevel
)
from core.connection_manager import manager
from db.redis_client import get_redis_client

logger = logging.getLogger(__name__)


class RealtimeProgressManager:
    """
    リアルタイム進捗管理マネージャー
    
    学生の課題進捗をリアルタイムで追跡し、
    WebSocketを通じてライブ更新を提供する。
    """
    
    def __init__(self):
        # 進捗データストレージ
        self.student_progress: Dict[str, StudentProgressSummary] = {}
        self.assignment_progress: Dict[str, Dict[str, AssignmentProgressInfo]] = defaultdict(dict)
        self.cell_progress: Dict[str, Dict[str, CellProgressInfo]] = defaultdict(dict)
        
        # 通知管理
        self.pending_notifications: Dict[str, List[ProgressNotification]] = defaultdict(list)
        self.notification_history: deque = deque(maxlen=1000)
        
        # WebSocket接続管理
        self.active_subscribers: Dict[str, Set[str]] = defaultdict(set)  # user_id -> connection_ids
        self.instructor_subscribers: Set[str] = set()  # instructor connection_ids
        
        # 分析データ
        self.progress_analytics: Dict[str, ProgressAnalytics] = {}
        self.learning_patterns: Dict[str, Dict[str, Any]] = defaultdict(dict)
        
        # 設定
        self.update_batch_size = 50
        self.analytics_update_interval = 300  # 5分
        self.cleanup_interval = 3600  # 1時間
        
        # 統計情報
        self.stats = {
            'total_events_processed': 0,
            'total_notifications_sent': 0,
            'active_sessions': 0,
            'last_cleanup': datetime.now()
        }
    
    async def process_cell_execution_event(
        self,
        user_id: str,
        assignment_id: str,
        cell_id: str,
        event_data: Dict[str, Any]
    ) -> None:
        """
        セル実行イベントを処理して進捗を更新する
        
        Args:
            user_id: 学生ID
            assignment_id: 課題ID
            cell_id: セルID
            event_data: イベントデータ
        """
        try:
            # セル進捗情報を更新
            cell_progress = await self._update_cell_progress(
                user_id, assignment_id, cell_id, event_data
            )
            
            # 課題進捗情報を更新
            assignment_progress = await self._update_assignment_progress(
                user_id, assignment_id
            )
            
            # 学生全体進捗を更新
            student_progress = await self._update_student_progress(user_id)
            
            # 進捗更新イベントを生成
            update_event = ProgressUpdateEvent(
                event_id=str(uuid.uuid4()),
                event_type="cell_execution",
                timestamp=datetime.now(),
                user_id=user_id,
                assignment_id=assignment_id,
                cell_id=cell_id,
                update_type="cell_progress",
                previous_value=None,  # 簡易実装
                new_value=cell_progress.model_dump(),
                progress_info={
                    'assignment_progress': assignment_progress.progress_percentage,
                    'overall_progress': student_progress.overall_progress_percentage
                }
            )
            
            # WebSocketで更新を配信
            await self._broadcast_progress_update(update_event)
            
            # 通知を生成（必要に応じて）
            await self._generate_progress_notifications(
                user_id, assignment_id, cell_progress, assignment_progress
            )
            
            # 統計更新
            self.stats['total_events_processed'] += 1
            
            logger.debug(
                f"Processed cell execution event: user={user_id}, "
                f"assignment={assignment_id}, cell={cell_id}"
            )
            
        except Exception as e:
            logger.error(f"Failed to process cell execution event: {e}")
            await self._handle_processing_error(user_id, assignment_id, cell_id, e)
    
    async def _update_cell_progress(
        self,
        user_id: str,
        assignment_id: str,
        cell_id: str,
        event_data: Dict[str, Any]
    ) -> CellProgressInfo:
        """セル進捗情報を更新する"""
        
        # 既存の進捗情報を取得または新規作成
        key = f"{user_id}:{assignment_id}"
        if cell_id not in self.cell_progress[key]:
            self.cell_progress[key][cell_id] = CellProgressInfo(
                cell_id=cell_id,
                cell_index=event_data.get('cellIndex', 0),
                cell_type=event_data.get('cellType', 'code')
            )
        
        cell_progress = self.cell_progress[key][cell_id]
        
        # イベントデータから情報を更新
        if event_data.get('eventType') == 'cell_execution_start':
            cell_progress.execution_status = CellExecutionStatus.RUNNING
            cell_progress.last_executed_at = datetime.now()
            
        elif event_data.get('eventType') == 'cell_execution_complete':
            cell_progress.execution_status = CellExecutionStatus.COMPLETED
            cell_progress.execution_count = event_data.get('executionCount', 0)
            cell_progress.execution_duration_ms = event_data.get('executionDurationMs', 0)
            cell_progress.is_completed = True
            cell_progress.completion_score = 1.0
            
            # エラー情報をクリア
            cell_progress.has_error = False
            cell_progress.error_message = None
            cell_progress.error_type = None
            
        elif event_data.get('eventType') == 'cell_execution_error':
            cell_progress.execution_status = CellExecutionStatus.ERROR
            cell_progress.has_error = True
            cell_progress.error_message = event_data.get('errorMessage')
            cell_progress.error_type = event_data.get('errorType', 'execution_error')
            cell_progress.completion_score = 0.0
        
        # メタデータ更新
        if 'code' in event_data:
            cell_progress.code_length = len(event_data['code'].splitlines())
        
        if 'result' in event_data:
            cell_progress.output_length = len(str(event_data['result']))
        
        # メモリ使用量（環境情報から取得）
        if 'metadata' in event_data and 'memory_usage_mb' in event_data['metadata']:
            cell_progress.memory_usage_mb = event_data['metadata']['memory_usage_mb']
        
        return cell_progress
    
    async def _update_assignment_progress(
        self,
        user_id: str,
        assignment_id: str
    ) -> AssignmentProgressInfo:
        """課題進捗情報を更新する"""
        
        # 既存の進捗情報を取得または新規作成
        if assignment_id not in self.assignment_progress[user_id]:
            self.assignment_progress[user_id][assignment_id] = AssignmentProgressInfo(
                assignment_id=assignment_id,
                assignment_name=f"Assignment {assignment_id}",  # 実際にはDBから取得
                notebook_path=f"/assignments/{assignment_id}.ipynb",
                last_updated_at=datetime.now()
            )
        
        assignment_progress = self.assignment_progress[user_id][assignment_id]
        
        # セル進捗から課題進捗を計算
        cell_key = f"{user_id}:{assignment_id}"
        cells = self.cell_progress[cell_key]
        
        if cells:
            assignment_progress.total_cells = len(cells)
            assignment_progress.completed_cells = sum(
                1 for cell in cells.values() if cell.is_completed
            )
            assignment_progress.error_cells = sum(
                1 for cell in cells.values() if cell.has_error
            )
            
            # 進捗率を計算
            if assignment_progress.total_cells > 0:
                assignment_progress.progress_percentage = (
                    assignment_progress.completed_cells / assignment_progress.total_cells * 100
                )
            
            # ステータスを更新
            if assignment_progress.completed_cells == 0:
                assignment_progress.overall_status = ProgressStatus.NOT_STARTED
            elif assignment_progress.completed_cells == assignment_progress.total_cells:
                assignment_progress.overall_status = ProgressStatus.COMPLETED
            else:
                assignment_progress.overall_status = ProgressStatus.IN_PROGRESS
            
            # セル詳細を更新
            assignment_progress.cells_progress = list(cells.values())
            
            # 時間情報を更新
            assignment_progress.last_updated_at = datetime.now()
            assignment_progress.total_execution_time_ms = sum(
                cell.execution_duration_ms or 0 for cell in cells.values()
            )
            
            # 開始時刻を設定（初回のみ）
            if not assignment_progress.started_at and assignment_progress.completed_cells > 0:
                assignment_progress.started_at = datetime.now()
            
            # 完了予想時刻を計算
            if assignment_progress.overall_status == ProgressStatus.IN_PROGRESS:
                assignment_progress.estimated_completion_time = self._estimate_completion_time(
                    assignment_progress
                )
        
        return assignment_progress
    
    async def _update_student_progress(self, user_id: str) -> StudentProgressSummary:
        """学生全体進捗を更新する"""
        
        # 既存の進捗情報を取得または新規作成
        if user_id not in self.student_progress:
            self.student_progress[user_id] = StudentProgressSummary(
                user_id=user_id,
                user_name=f"Student {user_id}",  # 実際にはDBから取得
                last_activity_at=datetime.now()
            )
        
        student_progress = self.student_progress[user_id]
        
        # 課題進捗から全体進捗を計算
        assignments = self.assignment_progress[user_id]
        
        if assignments:
            student_progress.total_assignments = len(assignments)
            student_progress.completed_assignments = sum(
                1 for assignment in assignments.values()
                if assignment.overall_status == ProgressStatus.COMPLETED
            )
            student_progress.in_progress_assignments = sum(
                1 for assignment in assignments.values()
                if assignment.overall_status == ProgressStatus.IN_PROGRESS
            )
            
            # 全体進捗率を計算
            if student_progress.total_assignments > 0:
                total_progress = sum(
                    assignment.progress_percentage for assignment in assignments.values()
                )
                student_progress.overall_progress_percentage = (
                    total_progress / student_progress.total_assignments
                )
            
            # 課題詳細を更新
            student_progress.assignments_progress = list(assignments.values())
            
            # 活動統計を更新
            student_progress.total_execution_count = sum(
                assignment.completed_cells + assignment.error_cells
                for assignment in assignments.values()
            )
            student_progress.total_execution_time_ms = sum(
                assignment.total_execution_time_ms for assignment in assignments.values()
            )
            
            if student_progress.total_execution_count > 0:
                student_progress.average_execution_time_ms = (
                    student_progress.total_execution_time_ms / student_progress.total_execution_count
                )
            
            # エラー率を計算
            total_cells = sum(assignment.total_cells for assignment in assignments.values())
            total_error_cells = sum(assignment.error_cells for assignment in assignments.values())
            if total_cells > 0:
                student_progress.error_rate = total_error_cells / total_cells
            
            # 時間情報を更新
            student_progress.last_activity_at = datetime.now()
            
            # 初回活動時刻を設定（初回のみ）
            if not student_progress.first_activity_at and student_progress.total_execution_count > 0:
                student_progress.first_activity_at = datetime.now()
            
            # 学習分析指標を計算
            await self._calculate_learning_metrics(student_progress)
        
        return student_progress
    
    async def _calculate_learning_metrics(self, student_progress: StudentProgressSummary) -> None:
        """学習分析指標を計算する"""
        
        try:
            # 学習速度を計算
            if student_progress.first_activity_at and student_progress.last_activity_at:
                time_diff = student_progress.last_activity_at - student_progress.first_activity_at
                hours = time_diff.total_seconds() / 3600
                if hours > 0:
                    student_progress.learning_velocity = student_progress.completed_assignments / hours
            
            # 集中度スコアを計算（簡易版）
            if student_progress.total_execution_count > 0:
                # エラー率が低く、実行時間が安定している場合は集中度が高い
                base_focus = 1.0 - student_progress.error_rate
                student_progress.focus_score = max(0.0, min(1.0, base_focus))
            
            # 継続性スコアを計算（簡易版）
            if student_progress.total_assignments > 0:
                completion_rate = student_progress.completed_assignments / student_progress.total_assignments
                student_progress.consistency_score = completion_rate
            
        except Exception as e:
            logger.warning(f"Failed to calculate learning metrics for {student_progress.user_id}: {e}")
    
    def _estimate_completion_time(self, assignment_progress: AssignmentProgressInfo) -> Optional[datetime]:
        """課題完了予想時刻を計算する"""
        
        try:
            if assignment_progress.completed_cells == 0:
                return None
            
            # 平均実行時間を計算
            completed_cells = [
                cell for cell in assignment_progress.cells_progress
                if cell.is_completed and cell.execution_duration_ms
            ]
            
            if not completed_cells:
                return None
            
            avg_duration_ms = sum(
                cell.execution_duration_ms for cell in completed_cells
            ) / len(completed_cells)
            
            # 残りセル数
            remaining_cells = assignment_progress.total_cells - assignment_progress.completed_cells
            
            # 予想残り時間（バッファを含む）
            estimated_remaining_ms = remaining_cells * avg_duration_ms * 1.5  # 50%バッファ
            
            return datetime.now() + timedelta(milliseconds=estimated_remaining_ms)
            
        except Exception as e:
            logger.warning(f"Failed to estimate completion time: {e}")
            return None
    
    async def _broadcast_progress_update(self, update_event: ProgressUpdateEvent) -> None:
        """進捗更新をWebSocketで配信する"""
        
        try:
            # 学生本人への配信
            user_connections = self.active_subscribers.get(update_event.user_id, set())
            for connection_id in user_connections:
                await manager.send_personal_message(
                    json.dumps({
                        "type": "progress_update",
                        "data": update_event.model_dump()
                    }),
                    connection_id
                )
            
            # 講師への配信
            for connection_id in self.instructor_subscribers:
                await manager.send_personal_message(
                    json.dumps({
                        "type": "student_progress_update",
                        "data": update_event.model_dump()
                    }),
                    connection_id
                )
            
            logger.debug(f"Broadcasted progress update: {update_event.event_id}")
            
        except Exception as e:
            logger.error(f"Failed to broadcast progress update: {e}")
    
    async def _generate_progress_notifications(
        self,
        user_id: str,
        assignment_id: str,
        cell_progress: CellProgressInfo,
        assignment_progress: AssignmentProgressInfo
    ) -> None:
        """進捗に基づいて通知を生成する"""
        
        notifications = []
        
        try:
            # セル実行エラーの通知
            if cell_progress.has_error:
                notifications.append(ProgressNotification(
                    notification_id=str(uuid.uuid4()),
                    recipient_id=user_id,
                    recipient_type="student",
                    title="セル実行エラー",
                    message=f"セル {cell_progress.cell_index} でエラーが発生しました: {cell_progress.error_message}",
                    level=NotificationLevel.ERROR,
                    assignment_id=assignment_id,
                    user_id=user_id,
                    created_at=datetime.now()
                ))
            
            # 課題完了の通知
            if assignment_progress.overall_status == ProgressStatus.COMPLETED:
                notifications.append(ProgressNotification(
                    notification_id=str(uuid.uuid4()),
                    recipient_id=user_id,
                    recipient_type="student",
                    title="課題完了",
                    message=f"課題 '{assignment_progress.assignment_name}' が完了しました！",
                    level=NotificationLevel.SUCCESS,
                    assignment_id=assignment_id,
                    user_id=user_id,
                    created_at=datetime.now()
                ))
                
                # 講師への通知も追加
                notifications.append(ProgressNotification(
                    notification_id=str(uuid.uuid4()),
                    recipient_id="instructor",  # 実際には具体的な講師IDを使用
                    recipient_type="instructor",
                    title="学生課題完了",
                    message=f"学生 {user_id} が課題 '{assignment_progress.assignment_name}' を完了しました",
                    level=NotificationLevel.INFO,
                    assignment_id=assignment_id,
                    user_id=user_id,
                    created_at=datetime.now()
                ))
            
            # 進捗マイルストーン通知（25%, 50%, 75%）
            progress_percentage = assignment_progress.progress_percentage
            milestones = [25, 50, 75]
            
            for milestone in milestones:
                if (progress_percentage >= milestone and 
                    not self._milestone_notified(user_id, assignment_id, milestone)):
                    
                    notifications.append(ProgressNotification(
                        notification_id=str(uuid.uuid4()),
                        recipient_id=user_id,
                        recipient_type="student",
                        title=f"進捗 {milestone}% 達成",
                        message=f"課題 '{assignment_progress.assignment_name}' の進捗が {milestone}% に達しました",
                        level=NotificationLevel.INFO,
                        assignment_id=assignment_id,
                        user_id=user_id,
                        created_at=datetime.now()
                    ))
                    
                    # マイルストーン通知済みフラグを設定
                    self._set_milestone_notified(user_id, assignment_id, milestone)
            
            # 通知を保存・送信
            for notification in notifications:
                self.pending_notifications[notification.recipient_id].append(notification)
                self.notification_history.append(notification)
                await self._send_notification(notification)
            
            self.stats['total_notifications_sent'] += len(notifications)
            
        except Exception as e:
            logger.error(f"Failed to generate progress notifications: {e}")
    
    def _milestone_notified(self, user_id: str, assignment_id: str, milestone: int) -> bool:
        """マイルストーン通知済みかチェックする（簡易実装）"""
        # 実際の実装では永続化ストレージを使用
        key = f"{user_id}:{assignment_id}:{milestone}"
        return hasattr(self, '_milestone_flags') and key in getattr(self, '_milestone_flags', set())
    
    def _set_milestone_notified(self, user_id: str, assignment_id: str, milestone: int) -> None:
        """マイルストーン通知済みフラグを設定する（簡易実装）"""
        if not hasattr(self, '_milestone_flags'):
            self._milestone_flags = set()
        key = f"{user_id}:{assignment_id}:{milestone}"
        self._milestone_flags.add(key)
    
    async def _send_notification(self, notification: ProgressNotification) -> None:
        """通知を送信する"""
        
        try:
            # WebSocketで通知を送信
            if notification.recipient_type == "student":
                user_connections = self.active_subscribers.get(notification.recipient_id, set())
                for connection_id in user_connections:
                    await manager.send_personal_message(
                        json.dumps({
                            "type": "notification",
                            "data": notification.model_dump()
                        }),
                        connection_id
                    )
            
            elif notification.recipient_type == "instructor":
                for connection_id in self.instructor_subscribers:
                    await manager.send_personal_message(
                        json.dumps({
                            "type": "notification",
                            "data": notification.model_dump()
                        }),
                        connection_id
                    )
            
            # Redisにも通知を送信（他のサービスとの連携用）
            redis_client = await get_redis_client()
            await redis_client.publish(
                "progress_notifications",
                json.dumps(notification.model_dump())
            )
            
        except Exception as e:
            logger.error(f"Failed to send notification {notification.notification_id}: {e}")
    
    async def _handle_processing_error(
        self,
        user_id: str,
        assignment_id: str,
        cell_id: str,
        error: Exception
    ) -> None:
        """処理エラーをハンドリングする"""
        
        logger.error(
            f"Progress processing error: user={user_id}, "
            f"assignment={assignment_id}, cell={cell_id}, error={error}"
        )
        
        # エラー通知を生成
        error_notification = ProgressNotification(
            notification_id=str(uuid.uuid4()),
            recipient_id="system",
            recipient_type="system",
            title="進捗処理エラー",
            message=f"進捗処理中にエラーが発生しました: {str(error)}",
            level=NotificationLevel.ERROR,
            assignment_id=assignment_id,
            user_id=user_id,
            created_at=datetime.now()
        )
        
        self.notification_history.append(error_notification)
    
    # WebSocket接続管理メソッド
    async def subscribe_user(self, user_id: str, connection_id: str) -> None:
        """学生の進捗更新を購読する"""
        self.active_subscribers[user_id].add(connection_id)
        self.stats['active_sessions'] = sum(len(connections) for connections in self.active_subscribers.values())
        logger.info(f"User {user_id} subscribed to progress updates (connection: {connection_id})")
    
    async def unsubscribe_user(self, user_id: str, connection_id: str) -> None:
        """学生の進捗更新購読を解除する"""
        self.active_subscribers[user_id].discard(connection_id)
        if not self.active_subscribers[user_id]:
            del self.active_subscribers[user_id]
        self.stats['active_sessions'] = sum(len(connections) for connections in self.active_subscribers.values())
        logger.info(f"User {user_id} unsubscribed from progress updates (connection: {connection_id})")
    
    async def subscribe_instructor(self, connection_id: str) -> None:
        """講師の全体進捗監視を購読する"""
        self.instructor_subscribers.add(connection_id)
        logger.info(f"Instructor subscribed to all progress updates (connection: {connection_id})")
    
    async def unsubscribe_instructor(self, connection_id: str) -> None:
        """講師の全体進捗監視購読を解除する"""
        self.instructor_subscribers.discard(connection_id)
        logger.info(f"Instructor unsubscribed from all progress updates (connection: {connection_id})")
    
    # データ取得メソッド
    def get_student_progress(self, user_id: str) -> Optional[StudentProgressSummary]:
        """学生の進捗サマリーを取得する"""
        return self.student_progress.get(user_id)
    
    def get_assignment_progress(self, user_id: str, assignment_id: str) -> Optional[AssignmentProgressInfo]:
        """課題進捗を取得する"""
        return self.assignment_progress[user_id].get(assignment_id)
    
    def get_all_students_progress(self) -> List[StudentProgressSummary]:
        """全学生の進捗サマリーを取得する"""
        return list(self.student_progress.values())
    
    def get_pending_notifications(self, user_id: str) -> List[ProgressNotification]:
        """未読通知を取得する"""
        return self.pending_notifications.get(user_id, [])
    
    def get_stats(self) -> Dict[str, Any]:
        """統計情報を取得する"""
        return self.stats.copy()


# グローバルインスタンス
realtime_progress_manager = RealtimeProgressManager()
