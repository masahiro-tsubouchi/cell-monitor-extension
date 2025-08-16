"""
Workerプロセス用ヘルス監視モジュール
定期的なアライブ信号送信とヘルス状態管理
"""

import asyncio
import json
import logging
import time
from datetime import datetime
from typing import Dict, Any
import redis.asyncio as redis
from core.config import settings

logger = logging.getLogger(__name__)

class WorkerHealthMonitor:
    """Workerプロセスのヘルス監視クラス"""
    
    def __init__(self):
        self.is_running = False
        self.start_time = None
        self.last_heartbeat = None
        self.processed_messages = 0
        self.error_count = 0
        self.redis_client = None
        
    async def initialize(self):
        """ヘルス監視システム初期化"""
        try:
            self.redis_client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                decode_responses=True
            )
            await self.redis_client.ping()
            self.start_time = datetime.utcnow()
            self.is_running = True
            logger.info("[WORKER-HEALTH] Health monitor initialized successfully")
        except Exception as e:
            logger.error(f"[WORKER-HEALTH] Failed to initialize health monitor: {e}")
            raise
    
    async def start_heartbeat(self, interval: int = 30):
        """定期的なハートビート送信開始"""
        logger.info(f"[WORKER-HEALTH] Starting heartbeat with {interval}s interval")
        while self.is_running:
            try:
                await self.send_heartbeat()
                await asyncio.sleep(interval)
            except Exception as e:
                logger.error(f"[WORKER-HEALTH] Heartbeat failed: {e}")
                self.error_count += 1
                await asyncio.sleep(5)  # エラー時は短い間隔で再試行
    
    async def send_heartbeat(self):
        """ハートビート信号をRedisに送信"""
        try:
            heartbeat_data = {
                "worker_id": "main_worker",
                "status": "healthy",
                "timestamp": datetime.utcnow().isoformat(),
                "uptime_seconds": self._get_uptime_seconds(),
                "processed_messages": self.processed_messages,
                "error_count": self.error_count,
                "memory_usage": self._get_memory_usage(),
                "last_activity": self.last_heartbeat.isoformat() if self.last_heartbeat else None
            }
            
            # RedisにハートビートデータをPUBLISH
            await self.redis_client.publish(
                "worker_heartbeat", 
                json.dumps(heartbeat_data)
            )
            
            # RedisにハートビートデータをSET（TTL付き）
            await self.redis_client.setex(
                "worker:main_worker:heartbeat",
                90,  # 90秒のTTL（ハートビート間隔の3倍）
                json.dumps(heartbeat_data)
            )
            
            self.last_heartbeat = datetime.utcnow()
            logger.debug(f"[WORKER-HEALTH] Heartbeat sent: {heartbeat_data['status']}")
            
        except Exception as e:
            logger.error(f"[WORKER-HEALTH] Failed to send heartbeat: {e}")
            self.error_count += 1
    
    def _get_uptime_seconds(self) -> int:
        """アップタイム（秒）を取得"""
        if self.start_time:
            return int((datetime.utcnow() - self.start_time).total_seconds())
        return 0
    
    def _get_memory_usage(self) -> Dict[str, Any]:
        """メモリ使用量情報を取得"""
        try:
            import psutil
            process = psutil.Process()
            memory_info = process.memory_info()
            return {
                "rss_mb": round(memory_info.rss / 1024 / 1024, 2),
                "vms_mb": round(memory_info.vms / 1024 / 1024, 2),
                "percent": round(process.memory_percent(), 2)
            }
        except ImportError:
            return {"error": "psutil not available"}
        except Exception as e:
            return {"error": str(e)}
    
    def increment_processed_messages(self):
        """処理済みメッセージ数をインクリメント"""
        self.processed_messages += 1
        logger.debug(f"[WORKER-HEALTH] Processed messages: {self.processed_messages}")
    
    def increment_error_count(self):
        """エラー数をインクリメント"""
        self.error_count += 1
        logger.warning(f"[WORKER-HEALTH] Error count: {self.error_count}")
    
    def get_health_status(self) -> Dict[str, Any]:
        """現在のヘルス状態を取得"""
        status = "healthy"
        
        # エラー率が高い場合は警告
        if self.processed_messages > 0:
            error_rate = self.error_count / self.processed_messages
            if error_rate > 0.1:  # 10%以上のエラー率
                status = "degraded"
            elif error_rate > 0.3:  # 30%以上のエラー率
                status = "unhealthy"
        
        # 最後のハートビートから時間が経過している場合
        if self.last_heartbeat:
            time_since_heartbeat = (datetime.utcnow() - self.last_heartbeat).total_seconds()
            if time_since_heartbeat > 120:  # 2分以上
                status = "stale"
        
        return {
            "status": status,
            "uptime_seconds": self._get_uptime_seconds(),
            "processed_messages": self.processed_messages,
            "error_count": self.error_count,
            "last_heartbeat": self.last_heartbeat.isoformat() if self.last_heartbeat else None,
            "memory_usage": self._get_memory_usage(),
            "is_running": self.is_running
        }
    
    async def shutdown(self):
        """ヘルス監視システム終了"""
        logger.info("[WORKER-HEALTH] Shutting down health monitor")
        self.is_running = False
        
        # 最終的なヘルス状態を送信
        try:
            final_status = {
                "worker_id": "main_worker", 
                "status": "shutting_down",
                "timestamp": datetime.utcnow().isoformat(),
                "final_stats": self.get_health_status()
            }
            
            await self.redis_client.publish(
                "worker_heartbeat",
                json.dumps(final_status)
            )
            
            # Redis接続を閉じる
            if self.redis_client:
                await self.redis_client.close()
                
        except Exception as e:
            logger.error(f"[WORKER-HEALTH] Error during shutdown: {e}")

# グローバルインスタンス
health_monitor = WorkerHealthMonitor()