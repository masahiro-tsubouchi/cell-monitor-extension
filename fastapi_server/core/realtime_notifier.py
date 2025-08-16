"""
リアルタイム通知システム
WebSocketとRedisを使用してリアルタイム通知を配信
"""

import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
import redis.asyncio as redis

from core.config import settings
from core.connection_manager import manager

logger = logging.getLogger(__name__)


class RealtimeNotifier:
    """リアルタイム通知システム"""
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
    
    async def initialize(self):
        """通知システムを初期化"""
        try:
            self.redis_client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                decode_responses=True
            )
            await self.redis_client.ping()
            logger.info("Realtime notifier initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize realtime notifier: {e}")
            raise
    
    async def send_progress_notification(self, event_data: Dict[str, Any]):
        """進捗イベント通知をWebSocketクライアントに送信"""
        try:
            notification = {
                "type": "progress_update",
                "timestamp": datetime.utcnow().isoformat(),
                "data": {
                    "email_address": event_data.get("emailAddress"),
                    "notebook_path": event_data.get("notebookPath"),
                    "event_type": event_data.get("eventType"),
                    "cell_index": event_data.get("cellIndex"),
                    "execution_count": event_data.get("executionCount"),
                    "status": "processed"
                }
            }
            
            # 講師用ダッシュボードに通知
            await manager.broadcast_to_instructors(json.dumps(notification))
            
            # 該当学生にも通知（学生用WebSocketが実装されている場合）
            student_notification = {
                "type": "execution_confirmed",
                "timestamp": datetime.utcnow().isoformat(),
                "message": "セルの実行が記録されました",
                "data": {
                    "cell_index": event_data.get("cellIndex"),
                    "execution_count": event_data.get("executionCount")
                }
            }
            
            # 学生個別通知（メールアドレスをclient_idとして使用）
            student_id = event_data.get("emailAddress")
            if student_id:
                await manager.send_personal_message(
                    json.dumps(student_notification),
                    student_id
                )
            
            logger.debug(f"Progress notification sent for {event_data.get('emailAddress')}")
            
        except Exception as e:
            logger.error(f"Failed to send progress notification: {e}")
    
    async def send_help_request_notification(self, help_data: Dict[str, Any]):
        """ヘルプ要請通知を講師に送信"""
        try:
            notification = {
                "type": "help_request",
                "timestamp": datetime.utcnow().isoformat(),
                "priority": "high",
                "data": {
                    "student_email": help_data.get("emailAddress"),
                    "notebook_path": help_data.get("notebookPath"),
                    "cell_index": help_data.get("cellIndex"),
                    "error_message": help_data.get("errorMessage"),
                    "help_type": help_data.get("helpType", "general")
                }
            }
            
            # 講師用ダッシュボードに高優先度で通知
            await manager.broadcast_to_instructors(json.dumps(notification))
            
            # Redis経由でも記録（永続化とバックアップ用）
            if self.redis_client:
                await self.redis_client.publish(
                    "help_requests", 
                    json.dumps(notification)
                )
            
            logger.info(f"Help request notification sent for {help_data.get('emailAddress')}")
            
        except Exception as e:
            logger.error(f"Failed to send help request notification: {e}")
    
    async def send_system_alert(self, alert_type: str, message: str, severity: str = "info"):
        """システムアラートをすべての講師に送信"""
        try:
            alert = {
                "type": "system_alert",
                "timestamp": datetime.utcnow().isoformat(),
                "alert_type": alert_type,
                "severity": severity,
                "message": message
            }
            
            # 講師に送信
            await manager.broadcast_to_instructors(json.dumps(alert))
            
            # 重要度が高い場合は学生にも送信
            if severity in ["warning", "critical"]:
                await manager.broadcast_to_students(json.dumps({
                    **alert,
                    "message": "システムからの重要なお知らせがあります"
                }))
            
            logger.info(f"System alert sent: {alert_type} - {message}")
            
        except Exception as e:
            logger.error(f"Failed to send system alert: {e}")
    
    async def send_batch_statistics(self, stats: Dict[str, Any]):
        """バッチ統計情報を講師ダッシュボードに送信"""
        try:
            notification = {
                "type": "batch_statistics",
                "timestamp": datetime.utcnow().isoformat(),
                "data": stats
            }
            
            await manager.broadcast_to_instructors(json.dumps(notification))
            logger.debug("Batch statistics sent to instructors")
            
        except Exception as e:
            logger.error(f"Failed to send batch statistics: {e}")
    
    async def send_connection_status_update(self):
        """WebSocket接続状況の更新通知"""
        try:
            stats = manager.get_connection_stats()
            notification = {
                "type": "connection_status",
                "timestamp": datetime.utcnow().isoformat(),
                "data": {
                    "total_connections": stats["total_connections"],
                    "rooms": stats["rooms"],
                    "active_students": stats["rooms"].get("students", 0),
                    "active_instructors": stats["rooms"].get("instructors", 0)
                }
            }
            
            # 講師のみに送信
            await manager.broadcast_to_instructors(json.dumps(notification))
            
        except Exception as e:
            logger.error(f"Failed to send connection status update: {e}")
    
    async def shutdown(self):
        """通知システムを終了"""
        try:
            if self.redis_client:
                await self.redis_client.close()
            logger.info("Realtime notifier shutdown completed")
        except Exception as e:
            logger.error(f"Error during realtime notifier shutdown: {e}")


# グローバルインスタンス
realtime_notifier = RealtimeNotifier()


async def initialize_realtime_notifier():
    """リアルタイム通知システムを初期化（アプリケーション起動時に呼び出す）"""
    await realtime_notifier.initialize()


async def shutdown_realtime_notifier():
    """リアルタイム通知システムを終了（アプリケーション終了時に呼び出す）"""
    await realtime_notifier.shutdown()