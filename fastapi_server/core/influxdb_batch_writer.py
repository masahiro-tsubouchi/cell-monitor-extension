"""
InfluxDBバッチライター
効率的なバッチ書き込みとメトリクス収集
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from collections import defaultdict
import json

from influxdb_client import Point
from core.config import settings
from db.influxdb_client import influx_client, write_api

logger = logging.getLogger(__name__)


class InfluxDBBatchWriter:
    """InfluxDBのバッチ書き込みとメトリクス管理"""
    
    def __init__(self, batch_size: int = 100, flush_interval_seconds: int = 30):
        self.batch_size = batch_size
        self.flush_interval_seconds = flush_interval_seconds
        self.point_buffer: List[Point] = []
        self.metrics_buffer: Dict[str, Any] = defaultdict(int)
        self.last_flush_time = datetime.utcnow()
        self.flush_task: Optional[asyncio.Task] = None
        self.is_running = False
        
        # メトリクス統計
        self.total_points_written = 0
        self.total_batches_written = 0
        self.write_errors = 0
        
    async def start_batch_writer(self):
        """バッチライターを開始"""
        if self.is_running:
            logger.warning("Batch writer is already running")
            return
        
        self.is_running = True
        self.flush_task = asyncio.create_task(self._flush_loop())
        logger.info(
            f"InfluxDB batch writer started: "
            f"batch_size={self.batch_size}, "
            f"flush_interval={self.flush_interval_seconds}s"
        )
    
    async def stop_batch_writer(self):
        """バッチライターを停止"""
        self.is_running = False
        
        # 最終フラッシュを実行
        await self._flush_buffer()
        
        if self.flush_task:
            self.flush_task.cancel()
            try:
                await self.flush_task
            except asyncio.CancelledError:
                pass
        
        logger.info(
            f"InfluxDB batch writer stopped. "
            f"Total points written: {self.total_points_written}, "
            f"Total batches: {self.total_batches_written}, "
            f"Errors: {self.write_errors}"
        )
    
    async def add_progress_point(self, event_data: Dict[str, Any]):
        """進捗イベントポイントをバッファに追加"""
        try:
            # 基本情報の抽出
            email = event_data.get("emailAddress", "unknown")
            notebook_path = event_data.get("notebookPath", "")
            event_type = event_data.get("eventType", "unknown")
            
            # ノートブック情報の解析
            notebook_name = notebook_path.split("/")[-1] if notebook_path else "unknown"
            notebook_dir = "/".join(notebook_path.split("/")[:-1]) if "/" in notebook_path else "root"
            
            # ポイント作成
            point = (
                Point("student_progress_v2")
                .tag("email_address", email)
                .tag("event_type", event_type)
                .tag("notebook_name", notebook_name)
                .tag("notebook_dir", notebook_dir)
                .tag("session_id", event_data.get("sessionId", "unknown"))
                .field("notebook_path", notebook_path)
                .field("cell_index", event_data.get("cellIndex", -1))
                .field("cell_id", event_data.get("cellId", ""))
                .field("execution_count", event_data.get("executionCount", -1))
                .field("duration_ms", event_data.get("executionDurationMs", 0))
                .field("has_error", event_data.get("hasError", False))
                .time(datetime.utcnow())
            )
            
            await self._add_point_to_buffer(point)
            
            # メトリクス更新
            self.metrics_buffer[f"events_{event_type}"] += 1
            self.metrics_buffer[f"students_{email}"] += 1
            self.metrics_buffer["total_events"] += 1
            
        except Exception as e:
            logger.error(f"Failed to create progress point: {e}")
            self.write_errors += 1
    
    async def add_system_metrics_point(self, metrics: Dict[str, Any]):
        """システムメトリクスポイントをバッファに追加"""
        try:
            point = (
                Point("system_metrics")
                .tag("metric_type", "system_health")
                .field("websocket_connections", metrics.get("websocket_connections", 0))
                .field("worker_processed_messages", metrics.get("worker_processed_messages", 0))
                .field("worker_error_count", metrics.get("worker_error_count", 0))
                .field("redis_memory_usage", metrics.get("redis_memory_usage", 0))
                .field("postgres_connections", metrics.get("postgres_connections", 0))
                .time(datetime.utcnow())
            )
            
            await self._add_point_to_buffer(point)
            
        except Exception as e:
            logger.error(f"Failed to create system metrics point: {e}")
            self.write_errors += 1
    
    async def add_performance_metrics_point(self, metrics: Dict[str, Any]):
        """パフォーマンスメトリクスポイントをバッファに追加"""
        try:
            point = (
                Point("performance_metrics")
                .tag("metric_type", "performance")
                .field("api_response_time_ms", metrics.get("api_response_time", 0))
                .field("db_query_time_ms", metrics.get("db_query_time", 0))
                .field("memory_usage_mb", metrics.get("memory_usage", 0))
                .field("cpu_usage_percent", metrics.get("cpu_usage", 0))
                .time(datetime.utcnow())
            )
            
            await self._add_point_to_buffer(point)
            
        except Exception as e:
            logger.error(f"Failed to create performance metrics point: {e}")
            self.write_errors += 1
    
    async def _add_point_to_buffer(self, point: Point):
        """ポイントをバッファに追加し、必要に応じてフラッシュ"""
        self.point_buffer.append(point)
        
        # バッチサイズに達したら即座にフラッシュ
        if len(self.point_buffer) >= self.batch_size:
            await self._flush_buffer()
    
    async def _flush_loop(self):
        """定期的なフラッシュループ"""
        while self.is_running:
            try:
                await asyncio.sleep(self.flush_interval_seconds)
                
                # 時間ベースのフラッシュ
                time_since_flush = (datetime.utcnow() - self.last_flush_time).total_seconds()
                if time_since_flush >= self.flush_interval_seconds and self.point_buffer:
                    await self._flush_buffer()
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in flush loop: {e}")
                await asyncio.sleep(5)
    
    async def _flush_buffer(self):
        """バッファをInfluxDBにフラッシュ"""
        if not self.point_buffer:
            return
        
        try:
            # バッファのコピーを作成して並行書き込みを避ける
            points_to_write = self.point_buffer.copy()
            self.point_buffer.clear()
            
            # InfluxDBに書き込み
            await asyncio.get_event_loop().run_in_executor(
                None, 
                lambda: write_api.write(
                    bucket=settings.INFLUXDB_BUCKET,
                    org=settings.INFLUXDB_ORG,
                    record=points_to_write
                )
            )
            
            # 統計更新
            self.total_points_written += len(points_to_write)
            self.total_batches_written += 1
            self.last_flush_time = datetime.utcnow()
            
            logger.debug(
                f"Flushed {len(points_to_write)} points to InfluxDB. "
                f"Total: {self.total_points_written} points in {self.total_batches_written} batches"
            )
            
        except Exception as e:
            logger.error(f"Failed to flush buffer to InfluxDB: {e}")
            self.write_errors += 1
            # 書き込み失敗時はポイントを戻す（メモリ制限に注意）
            if len(self.point_buffer) < self.batch_size * 2:
                self.point_buffer.extend(points_to_write)
    
    def get_batch_writer_stats(self) -> Dict[str, Any]:
        """バッチライターの統計情報を取得"""
        return {
            "is_running": self.is_running,
            "buffer_size": len(self.point_buffer),
            "total_points_written": self.total_points_written,
            "total_batches_written": self.total_batches_written,
            "write_errors": self.write_errors,
            "batch_size": self.batch_size,
            "flush_interval_seconds": self.flush_interval_seconds,
            "last_flush_time": self.last_flush_time.isoformat() if self.last_flush_time else None,
            "recent_metrics": dict(self.metrics_buffer)
        }


# グローバルインスタンス
batch_writer = InfluxDBBatchWriter()


async def start_influxdb_batch_writer():
    """InfluxDBバッチライターを開始（アプリケーション起動時に呼び出す）"""
    await batch_writer.start_batch_writer()


async def stop_influxdb_batch_writer():
    """InfluxDBバッチライターを停止（アプリケーション終了時に呼び出す）"""
    await batch_writer.stop_batch_writer()