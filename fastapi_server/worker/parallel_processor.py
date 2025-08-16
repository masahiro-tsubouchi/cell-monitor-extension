"""
Phase 3.2: 並列イベント処理システム
バックグラウンドワーカーの並列処理最適化

特徴:
- 複数ワーカープロセス並列実行
- 動的負荷分散
- イベントタイプ別処理優先度
- 障害回復機能
- パフォーマンス監視
"""

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum
import concurrent.futures
from collections import defaultdict

logger = logging.getLogger(__name__)


class EventPriority(Enum):
    """イベント処理優先度"""
    HIGH = 1      # cell_executed, code_completed など
    MEDIUM = 2    # progress_update, status_change など
    LOW = 3       # log_entry, debug_info など


class WorkerStatus(Enum):
    """ワーカー状態"""
    IDLE = "idle"
    PROCESSING = "processing"
    ERROR = "error"
    SHUTDOWN = "shutdown"


@dataclass
class ProcessingTask:
    """処理タスク"""
    task_id: str
    event_data: Dict[str, Any]
    priority: EventPriority
    created_at: datetime
    retries: int = 0
    max_retries: int = 3
    processing_timeout: float = 30.0  # 30秒
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "event_data": self.event_data,
            "priority": self.priority.name,
            "created_at": self.created_at.isoformat(),
            "retries": self.retries,
            "max_retries": self.max_retries
        }


@dataclass
class WorkerMetrics:
    """ワーカーメトリクス"""
    worker_id: str
    status: WorkerStatus = WorkerStatus.IDLE
    tasks_processed: int = 0
    tasks_failed: int = 0
    last_activity: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    processing_time_avg: float = 0.0
    current_task: Optional[str] = None
    
    def update_processing_time(self, duration: float):
        """平均処理時間更新"""
        if self.tasks_processed == 0:
            self.processing_time_avg = duration
        else:
            # 移動平均
            self.processing_time_avg = (self.processing_time_avg * 0.8) + (duration * 0.2)


class ParallelEventProcessor:
    """
    並列イベント処理システム
    
    Phase 3強化機能:
    - 複数ワーカー並列実行
    - 動的負荷分散
    - 優先度ベースキューイング
    - 自動スケーリング
    - 障害回復
    """
    
    def __init__(self, max_workers: int = 8, auto_scale: bool = True):
        self.max_workers = max_workers
        self.auto_scale = auto_scale
        self.workers: Dict[str, WorkerMetrics] = {}
        
        # 優先度別キュー
        self.task_queues: Dict[EventPriority, asyncio.Queue] = {
            EventPriority.HIGH: asyncio.Queue(maxsize=100),
            EventPriority.MEDIUM: asyncio.Queue(maxsize=200),
            EventPriority.LOW: asyncio.Queue(maxsize=500)
        }
        
        # 処理統計
        self.processing_stats = {
            "total_tasks_processed": 0,
            "total_tasks_failed": 0,
            "avg_processing_time": 0.0,
            "queue_sizes": {},
            "active_workers": 0,
            "last_reset": datetime.now(timezone.utc)
        }
        
        # イベントハンドラー
        self.event_handlers: Dict[str, Callable] = {}
        self.middleware_stack: List[Callable] = []
        
        # 制御フラグ
        self.is_running = False
        self.shutdown_event = asyncio.Event()
        
        # ワーカータスク
        self.worker_tasks: List[asyncio.Task] = []
        self.monitor_task: Optional[asyncio.Task] = None
        
    async def initialize(self):
        """並列処理システム初期化"""
        logger.info("Initializing parallel event processor...")
        
        # 初期ワーカー作成
        initial_workers = min(4, self.max_workers)  # 最初は4つのワーカー
        for i in range(initial_workers):
            await self._create_worker(f"worker_{i}")
        
        # 監視タスク開始
        self.monitor_task = asyncio.create_task(self._monitor_system())
        
        self.is_running = True
        logger.info(f"Parallel processor initialized with {initial_workers} workers")
        
    async def shutdown(self):
        """並列処理システム終了"""
        logger.info("Shutting down parallel event processor...")
        
        self.is_running = False
        self.shutdown_event.set()
        
        # 全ワーカータスクの停止
        for task in self.worker_tasks:
            task.cancel()
        
        # 監視タスクの停止
        if self.monitor_task:
            self.monitor_task.cancel()
        
        # 未処理タスクの待機（最大10秒）
        try:
            await asyncio.wait_for(self._wait_for_completion(), timeout=10.0)
        except asyncio.TimeoutError:
            logger.warning("Shutdown timeout - some tasks may be incomplete")
        
        logger.info("Parallel processor shutdown completed")
        
    async def add_event_handler(self, event_type: str, handler: Callable):
        """イベントハンドラー追加"""
        self.event_handlers[event_type] = handler
        logger.debug(f"Added event handler for {event_type}")
        
    async def add_middleware(self, middleware: Callable):
        """ミドルウェア追加"""
        self.middleware_stack.append(middleware)
        logger.debug(f"Added middleware: {middleware.__name__}")
        
    async def process_event(self, event_data: Dict[str, Any]) -> str:
        """
        イベントを並列処理キューに追加
        
        Args:
            event_data: 処理対象のイベントデータ
            
        Returns:
            タスクID
        """
        # タスク作成
        task_id = str(uuid.uuid4())[:8]
        priority = self._determine_priority(event_data)
        
        task = ProcessingTask(
            task_id=task_id,
            event_data=event_data,
            priority=priority,
            created_at=datetime.now(timezone.utc)
        )
        
        # 優先度キューに追加
        try:
            await self.task_queues[priority].put(task)
            logger.debug(f"Task {task_id} queued with priority {priority.name}")
            return task_id
        except asyncio.QueueFull:
            logger.error(f"Queue full for priority {priority.name}")
            raise Exception(f"Processing queue full for priority {priority.name}")
    
    async def process_batch(self, events: List[Dict[str, Any]]) -> List[str]:
        """
        バッチイベント並列処理
        
        Args:
            events: 処理対象のイベントリスト
            
        Returns:
            タスクIDリスト
        """
        task_ids = []
        
        # 優先度別にグループ化
        priority_groups = defaultdict(list)
        for event in events:
            priority = self._determine_priority(event)
            priority_groups[priority].append(event)
        
        # 並列バッチ投入
        for priority, priority_events in priority_groups.items():
            batch_tasks = []
            for event in priority_events:
                task_id = str(uuid.uuid4())[:8]
                task = ProcessingTask(
                    task_id=task_id,
                    event_data=event,
                    priority=priority,
                    created_at=datetime.now(timezone.utc)
                )
                batch_tasks.append(task)
                task_ids.append(task_id)
            
            # バッチキューイング
            queue = self.task_queues[priority]
            for task in batch_tasks:
                try:
                    await queue.put(task)
                except asyncio.QueueFull:
                    logger.warning(f"Queue full for priority {priority.name}, dropping task {task.task_id}")
        
        logger.info(f"Batch queued: {len(task_ids)} tasks across priorities")
        return task_ids
    
    def _determine_priority(self, event_data: Dict[str, Any]) -> EventPriority:
        """イベント優先度判定"""
        event_type = event_data.get("eventType", event_data.get("type", "unknown"))
        
        # 高優先度: セル実行、コード完了など
        if event_type in ["cell_executed", "code_completed", "error_occurred"]:
            return EventPriority.HIGH
        
        # 中優先度: 進捗更新、ステータス変更など
        elif event_type in ["progress_update", "status_change", "notebook_saved"]:
            return EventPriority.MEDIUM
        
        # 低優先度: ログ、デバッグ情報など
        else:
            return EventPriority.LOW
    
    async def _create_worker(self, worker_id: str):
        """新しいワーカー作成"""
        metrics = WorkerMetrics(worker_id=worker_id)
        self.workers[worker_id] = metrics
        
        # ワーカータスク開始
        worker_task = asyncio.create_task(self._worker_loop(worker_id))
        self.worker_tasks.append(worker_task)
        
        logger.info(f"Created worker: {worker_id}")
        
    async def _worker_loop(self, worker_id: str):
        """ワーカーメインループ"""
        metrics = self.workers[worker_id]
        
        try:
            while self.is_running and not self.shutdown_event.is_set():
                task = None
                
                try:
                    # 優先度順にタスク取得
                    task = await self._get_next_task()
                    
                    if task is None:
                        # タスクがない場合は短時間待機
                        await asyncio.sleep(0.1)
                        continue
                    
                    # タスク処理
                    metrics.status = WorkerStatus.PROCESSING
                    metrics.current_task = task.task_id
                    metrics.last_activity = datetime.now(timezone.utc)
                    
                    start_time = time.time()
                    
                    # 実際の処理実行
                    await self._process_task(task)
                    
                    # 処理時間記録
                    processing_time = time.time() - start_time
                    metrics.update_processing_time(processing_time)
                    metrics.tasks_processed += 1
                    
                    logger.debug(f"Worker {worker_id} completed task {task.task_id} in {processing_time:.3f}s")
                    
                except Exception as e:
                    # タスク処理エラー
                    metrics.tasks_failed += 1
                    metrics.status = WorkerStatus.ERROR
                    
                    if task:
                        await self._handle_task_error(task, e)
                    
                    logger.error(f"Worker {worker_id} error processing task: {e}")
                    
                    # エラー後の短時間待機
                    await asyncio.sleep(1.0)
                
                finally:
                    # ワーカー状態リセット
                    metrics.status = WorkerStatus.IDLE
                    metrics.current_task = None
                    
        except asyncio.CancelledError:
            logger.info(f"Worker {worker_id} cancelled")
        except Exception as e:
            logger.error(f"Worker {worker_id} fatal error: {e}")
        finally:
            metrics.status = WorkerStatus.SHUTDOWN
            logger.info(f"Worker {worker_id} stopped")
    
    async def _get_next_task(self) -> Optional[ProcessingTask]:
        """次のタスクを優先度順に取得"""
        # 高優先度から順に確認
        for priority in [EventPriority.HIGH, EventPriority.MEDIUM, EventPriority.LOW]:
            queue = self.task_queues[priority]
            
            try:
                # ノンブロッキングで取得
                task = queue.get_nowait()
                queue.task_done()
                return task
            except asyncio.QueueEmpty:
                continue
        
        return None
    
    async def _process_task(self, task: ProcessingTask):
        """個別タスク処理"""
        event_data = task.event_data
        event_type = event_data.get("eventType", event_data.get("type", "unknown"))
        
        # ミドルウェア実行
        for middleware in self.middleware_stack:
            try:
                event_data = await middleware(event_data) or event_data
            except Exception as e:
                logger.warning(f"Middleware error: {e}")
        
        # イベントハンドラー実行
        if event_type in self.event_handlers:
            handler = self.event_handlers[event_type]
            try:
                await handler(event_data)
            except Exception as e:
                logger.error(f"Handler error for {event_type}: {e}")
                raise
        else:
            # デフォルト処理
            await self._default_event_handler(event_data)
    
    async def _default_event_handler(self, event_data: Dict[str, Any]):
        """デフォルトイベントハンドラー - event_routerにフォールバック"""
        # 基本的な処理（ログ出力、統計更新など）
        event_type = event_data.get("eventType", "unknown")
        user_id = event_data.get("emailAddress", event_data.get("userId", "unknown"))
        
        logger.debug(f"Default processing: {event_type} from {user_id}")
        
        # event_routerにフォールバック（実際のデータベース保存処理）
        try:
            from worker.event_router import event_router
            from db.session import SessionLocal
            
            db = SessionLocal()
            try:
                success = await event_router.route_event(event_data, db)
                if success:
                    logger.debug(f"Event {event_type} processed successfully via event_router fallback")
                else:
                    logger.warning(f"Event {event_type} processing failed via event_router fallback")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Default event handler fallback error: {e}")
        
        # 統計更新
        self.processing_stats["total_tasks_processed"] += 1
    
    async def _handle_task_error(self, task: ProcessingTask, error: Exception):
        """タスクエラー処理"""
        task.retries += 1
        
        if task.retries <= task.max_retries:
            # リトライ
            logger.warning(f"Retrying task {task.task_id} ({task.retries}/{task.max_retries})")
            
            # 指数バックオフで再キューイング
            await asyncio.sleep(0.5 * (2 ** task.retries))
            
            try:
                await self.task_queues[task.priority].put(task)
            except asyncio.QueueFull:
                logger.error(f"Failed to requeue task {task.task_id}")
        else:
            # 最大リトライ回数到達
            logger.error(f"Task {task.task_id} failed permanently after {task.retries} retries: {error}")
            self.processing_stats["total_tasks_failed"] += 1
    
    async def _monitor_system(self):
        """システム監視ループ"""
        try:
            while self.is_running:
                # 統計更新
                await self._update_statistics()
                
                # 自動スケーリング
                if self.auto_scale:
                    await self._auto_scale_workers()
                
                # ヘルスチェック
                await self._health_check()
                
                # 5秒間隔で監視
                await asyncio.sleep(5.0)
                
        except asyncio.CancelledError:
            logger.info("System monitor cancelled")
        except Exception as e:
            logger.error(f"System monitor error: {e}")
    
    async def _update_statistics(self):
        """統計情報更新"""
        # アクティブワーカー数
        active_workers = sum(1 for w in self.workers.values() if w.status != WorkerStatus.SHUTDOWN)
        self.processing_stats["active_workers"] = active_workers
        
        # キューサイズ
        for priority, queue in self.task_queues.items():
            self.processing_stats["queue_sizes"][priority.name] = queue.qsize()
        
        # 平均処理時間
        if self.workers:
            avg_times = [w.processing_time_avg for w in self.workers.values() if w.processing_time_avg > 0]
            if avg_times:
                self.processing_stats["avg_processing_time"] = sum(avg_times) / len(avg_times)
    
    async def _auto_scale_workers(self):
        """自動ワーカースケーリング"""
        # 高優先度キューの負荷チェック
        high_queue_size = self.task_queues[EventPriority.HIGH].qsize()
        active_workers = self.processing_stats["active_workers"]
        
        # スケールアップ条件
        if high_queue_size > 20 and active_workers < self.max_workers:
            new_worker_id = f"worker_{len(self.workers)}"
            await self._create_worker(new_worker_id)
            logger.info(f"Scaled up: created {new_worker_id} (total: {active_workers + 1})")
        
        # スケールダウン条件（簡易版）
        elif high_queue_size == 0 and active_workers > 2:
            # 実装簡易化のため、スケールダウンは手動またはより複雑なロジックで
            pass
    
    async def _health_check(self):
        """ヘルスチェック"""
        current_time = datetime.now(timezone.utc)
        
        for worker_id, metrics in list(self.workers.items()):
            # 長時間応答なしのワーカーをチェック
            time_since_activity = (current_time - metrics.last_activity).total_seconds()
            
            if time_since_activity > 60 and metrics.status == WorkerStatus.PROCESSING:
                logger.warning(f"Worker {worker_id} appears stuck (no activity for {time_since_activity:.1f}s)")
                metrics.status = WorkerStatus.ERROR
    
    async def _wait_for_completion(self):
        """未処理タスクの完了待機"""
        # 全キューが空になるまで待機
        while any(not queue.empty() for queue in self.task_queues.values()):
            await asyncio.sleep(0.1)
    
    def get_statistics(self) -> Dict[str, Any]:
        """処理統計取得"""
        stats = dict(self.processing_stats)
        
        # ワーカー詳細追加
        stats["workers"] = {
            worker_id: {
                "status": metrics.status.value,
                "tasks_processed": metrics.tasks_processed,
                "tasks_failed": metrics.tasks_failed,
                "avg_processing_time": metrics.processing_time_avg,
                "current_task": metrics.current_task
            }
            for worker_id, metrics in self.workers.items()
        }
        
        return stats


# グローバルインスタンス
parallel_processor = ParallelEventProcessor(max_workers=8, auto_scale=True)


# ヘルパー関数
async def initialize_parallel_processing():
    """並列処理システム初期化"""
    await parallel_processor.initialize()


async def shutdown_parallel_processing():
    """並列処理システム終了"""
    await parallel_processor.shutdown()


async def process_event_parallel(event_data: Dict[str, Any]) -> str:
    """並列イベント処理"""
    return await parallel_processor.process_event(event_data)


async def process_batch_parallel(events: List[Dict[str, Any]]) -> List[str]:
    """並列バッチ処理"""
    return await parallel_processor.process_batch(events)