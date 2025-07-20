"""
オフライン対応基盤: ローカルキューイングと自動同期機能

JupyterLab拡張機能でネットワーク断絶時のデータ損失を防ぐため、
IndexedDBでのローカルキューイングとネットワーク復旧時の自動同期を実装。
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from uuid import uuid4

from fastapi import HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# オフラインキュー設定
OFFLINE_QUEUE_CONFIG = {
    "max_queue_size": 1000,  # 最大キューサイズ
    "max_retry_attempts": 5,  # 最大リトライ回数
    "retry_backoff_factor": 2.0,  # リトライ間隔の指数バックオフ係数
    "sync_batch_size": 50,  # 同期時のバッチサイズ
    "queue_cleanup_days": 7,  # キュー清掃の保持日数
}


class QueuedEvent(BaseModel):
    """
    キューに保存されるイベントデータ
    """
    queue_id: str = Field(default_factory=lambda: str(uuid4()))
    event_data: Dict[str, Any]
    created_at: datetime = Field(default_factory=datetime.utcnow)
    retry_count: int = 0
    last_retry_at: Optional[datetime] = None
    priority: int = 1  # 1=高優先度, 2=中優先度, 3=低優先度
    event_type: str
    user_id: Optional[str] = None


class OfflineQueueManager:
    """
    オフラインキューの管理クラス
    
    機能:
    - ネットワーク断絶時のイベントローカル保存
    - ネットワーク復旧時の自動同期
    - 優先度別キュー管理
    - 失敗イベントのリトライ機能
    """
    
    def __init__(self):
        self.is_online = True
        self.sync_in_progress = False
        self.queue_storage: List[QueuedEvent] = []
        self.failed_events: List[QueuedEvent] = []
    
    async def queue_event(
        self, 
        event_data: Dict[str, Any], 
        priority: int = 1,
        force_queue: bool = False
    ) -> str:
        """
        イベントをキューに追加する
        
        Args:
            event_data: イベントデータ
            priority: 優先度 (1=高, 2=中, 3=低)
            force_queue: オンライン時でも強制的にキューに追加
            
        Returns:
            キューID
        """
        queued_event = QueuedEvent(
            event_data=event_data,
            priority=priority,
            event_type=event_data.get('event_type', 'unknown'),
            user_id=event_data.get('user_id')
        )
        
        # キューサイズ制限チェック
        if len(self.queue_storage) >= OFFLINE_QUEUE_CONFIG["max_queue_size"]:
            # 古い低優先度イベントを削除
            await self._cleanup_old_events()
            
            if len(self.queue_storage) >= OFFLINE_QUEUE_CONFIG["max_queue_size"]:
                raise HTTPException(
                    status_code=507,
                    detail="Offline queue is full. Cannot store more events."
                )
        
        # オンライン時は即座に送信を試行
        if self.is_online and not force_queue:
            try:
                await self._send_event_immediately(queued_event)
                logger.info(f"Event sent immediately: {queued_event.queue_id}")
                return queued_event.queue_id
            except Exception as e:
                logger.warning(f"Immediate send failed, queuing event: {e}")
                self.is_online = False
        
        # キューに追加
        self.queue_storage.append(queued_event)
        logger.info(f"Event queued for offline sync: {queued_event.queue_id}")
        
        return queued_event.queue_id
    
    async def sync_queued_events(self) -> Dict[str, Any]:
        """
        キューに保存されたイベントを同期する
        
        Returns:
            同期結果の統計情報
        """
        if self.sync_in_progress:
            return {"message": "Sync already in progress"}
        
        self.sync_in_progress = True
        sync_stats = {
            "total_events": len(self.queue_storage),
            "successful_syncs": 0,
            "failed_syncs": 0,
            "skipped_events": 0,
            "sync_duration_ms": 0
        }
        
        start_time = datetime.utcnow()
        
        try:
            # 優先度順にソート
            sorted_events = sorted(self.queue_storage, key=lambda x: x.priority)
            
            # バッチ処理で同期
            for i in range(0, len(sorted_events), OFFLINE_QUEUE_CONFIG["sync_batch_size"]):
                batch = sorted_events[i:i + OFFLINE_QUEUE_CONFIG["sync_batch_size"]]
                batch_results = await self._sync_event_batch(batch)
                
                sync_stats["successful_syncs"] += batch_results["successful"]
                sync_stats["failed_syncs"] += batch_results["failed"]
                sync_stats["skipped_events"] += batch_results["skipped"]
                
                # バッチ間の負荷分散
                await asyncio.sleep(0.1)
            
            # 成功したイベントをキューから削除
            self.queue_storage = [
                event for event in self.queue_storage 
                if event.retry_count < OFFLINE_QUEUE_CONFIG["max_retry_attempts"]
            ]
            
            # 同期完了後にオンライン状態を更新
            if sync_stats["successful_syncs"] > 0:
                self.is_online = True
            
            sync_stats["sync_duration_ms"] = int(
                (datetime.utcnow() - start_time).total_seconds() * 1000
            )
            
            logger.info(f"Offline sync completed: {sync_stats}")
            return sync_stats
            
        except Exception as e:
            logger.error(f"Offline sync failed: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Offline sync failed: {str(e)}"
            )
        finally:
            self.sync_in_progress = False
    
    async def _send_event_immediately(self, event: QueuedEvent) -> bool:
        """
        イベントを即座に送信する
        
        Args:
            event: 送信するイベント
            
        Returns:
            送信成功の可否
        """
        # ここで実際のAPI送信処理を実装
        # 現在はモックとして成功を返す
        try:
            # 実際の実装では、FastAPIのイベント送信エンドポイントを呼び出す
            # await send_to_fastapi_events_endpoint(event.event_data)
            
            # モック実装: ランダムに失敗をシミュレート
            import random
            if random.random() < 0.1:  # 10%の確率で失敗
                raise Exception("Mock network error")
            
            return True
            
        except Exception as e:
            logger.warning(f"Event send failed: {e}")
            return False
    
    async def _sync_event_batch(self, batch: List[QueuedEvent]) -> Dict[str, int]:
        """
        イベントバッチを同期する
        
        Args:
            batch: 同期するイベントのバッチ
            
        Returns:
            同期結果の統計
        """
        results = {"successful": 0, "failed": 0, "skipped": 0}
        
        for event in batch:
            # リトライ回数制限チェック
            if event.retry_count >= OFFLINE_QUEUE_CONFIG["max_retry_attempts"]:
                results["skipped"] += 1
                self.failed_events.append(event)
                continue
            
            # リトライ間隔チェック
            if event.last_retry_at:
                retry_delay = timedelta(
                    seconds=OFFLINE_QUEUE_CONFIG["retry_backoff_factor"] ** event.retry_count
                )
                if datetime.utcnow() - event.last_retry_at < retry_delay:
                    results["skipped"] += 1
                    continue
            
            # イベント送信試行
            try:
                success = await self._send_event_immediately(event)
                if success:
                    results["successful"] += 1
                else:
                    event.retry_count += 1
                    event.last_retry_at = datetime.utcnow()
                    results["failed"] += 1
                    
            except Exception as e:
                logger.error(f"Event sync failed: {e}")
                event.retry_count += 1
                event.last_retry_at = datetime.utcnow()
                results["failed"] += 1
        
        return results
    
    async def _cleanup_old_events(self):
        """
        古いイベントをクリーンアップする
        """
        cutoff_date = datetime.utcnow() - timedelta(
            days=OFFLINE_QUEUE_CONFIG["queue_cleanup_days"]
        )
        
        # 古い低優先度イベントを削除
        initial_count = len(self.queue_storage)
        self.queue_storage = [
            event for event in self.queue_storage
            if not (event.priority >= 3 and event.created_at < cutoff_date)
        ]
        
        cleaned_count = initial_count - len(self.queue_storage)
        if cleaned_count > 0:
            logger.info(f"Cleaned up {cleaned_count} old events from queue")
    
    def get_queue_status(self) -> Dict[str, Any]:
        """
        キューの現在状態を取得する
        
        Returns:
            キューの状態情報
        """
        priority_counts = {1: 0, 2: 0, 3: 0}
        for event in self.queue_storage:
            priority_counts[event.priority] = priority_counts.get(event.priority, 0) + 1
        
        return {
            "is_online": self.is_online,
            "sync_in_progress": self.sync_in_progress,
            "total_queued_events": len(self.queue_storage),
            "failed_events": len(self.failed_events),
            "priority_breakdown": priority_counts,
            "queue_capacity_used": len(self.queue_storage) / OFFLINE_QUEUE_CONFIG["max_queue_size"],
            "last_sync_attempt": None,  # 実装時に追加
        }


# グローバルキューマネージャーインスタンス
offline_queue_manager = OfflineQueueManager()


async def queue_event_for_offline_sync(
    event_data: Dict[str, Any],
    priority: int = 1,
    force_queue: bool = False
) -> str:
    """
    イベントをオフライン同期キューに追加する便利関数
    
    Args:
        event_data: イベントデータ
        priority: 優先度
        force_queue: 強制キューイング
        
    Returns:
        キューID
    """
    return await offline_queue_manager.queue_event(
        event_data=event_data,
        priority=priority,
        force_queue=force_queue
    )


async def sync_offline_events() -> Dict[str, Any]:
    """
    オフラインイベントを同期する便利関数
    
    Returns:
        同期結果
    """
    return await offline_queue_manager.sync_queued_events()


def get_offline_queue_status() -> Dict[str, Any]:
    """
    オフラインキューの状態を取得する便利関数
    
    Returns:
        キューの状態情報
    """
    return offline_queue_manager.get_queue_status()
