"""
WebSocket接続のクリーンアップタスク
定期的に非アクティブな接続を整理する
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

from core.connection_manager import manager

logger = logging.getLogger(__name__)


class WebSocketCleanupService:
    """WebSocket接続のクリーンアップサービス"""
    
    def __init__(self, cleanup_interval_minutes: int = 5, connection_timeout_minutes: int = 30):
        self.cleanup_interval_minutes = cleanup_interval_minutes
        self.connection_timeout_minutes = connection_timeout_minutes
        self.cleanup_task: Optional[asyncio.Task] = None
        self.is_running = False
    
    async def start_cleanup_service(self):
        """クリーンアップサービスを開始"""
        if self.is_running:
            logger.warning("Cleanup service is already running")
            return
        
        self.is_running = True
        self.cleanup_task = asyncio.create_task(self._cleanup_loop())
        logger.info(
            f"WebSocket cleanup service started: "
            f"interval={self.cleanup_interval_minutes}min, "
            f"timeout={self.connection_timeout_minutes}min"
        )
    
    async def stop_cleanup_service(self):
        """クリーンアップサービスを停止"""
        self.is_running = False
        if self.cleanup_task:
            self.cleanup_task.cancel()
            try:
                await self.cleanup_task
            except asyncio.CancelledError:
                pass
        logger.info("WebSocket cleanup service stopped")
    
    async def _cleanup_loop(self):
        """クリーンアップの定期実行ループ"""
        while self.is_running:
            try:
                # 非アクティブ接続をクリーンアップ
                cleaned_count = await manager.cleanup_stale_connections(
                    timeout_minutes=self.connection_timeout_minutes
                )
                
                if cleaned_count > 0:
                    logger.info(f"Cleaned up {cleaned_count} stale WebSocket connections")
                
                # 接続統計をログ出力
                stats = manager.get_connection_stats()
                logger.debug(f"WebSocket stats: {stats['total_connections']} active connections")
                
                # 次のクリーンアップまで待機
                await asyncio.sleep(self.cleanup_interval_minutes * 60)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in WebSocket cleanup loop: {e}")
                await asyncio.sleep(60)  # エラー時は1分待機


# グローバルクリーンアップサービスインスタンス
cleanup_service = WebSocketCleanupService()


async def start_websocket_cleanup():
    """WebSocketクリーンアップサービスを開始（アプリケーション起動時に呼び出す）"""
    await cleanup_service.start_cleanup_service()


async def stop_websocket_cleanup():
    """WebSocketクリーンアップサービスを停止（アプリケーション終了時に呼び出す）"""
    await cleanup_service.stop_cleanup_service()