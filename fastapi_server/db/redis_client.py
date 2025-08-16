import redis.asyncio as redis
from typing import Optional
from core.config import settings
import logging

logger = logging.getLogger(__name__)

# Redisの非同期接続プールを作成（最適化されたパラメータ）
# decode_responses=True にすることで、Redisからの応答が自動的にUTF-8文字列にデコードされる
redis_pool = redis.ConnectionPool(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    db=0,  # デフォルトのデータベース番号
    decode_responses=True,
    max_connections=50,  # 200ユーザー + バックグラウンドタスク用
    retry_on_timeout=True,
    health_check_interval=30,  # 30秒ごとにヘルスチェック
)

# グローバルRedisクライアントインスタンス（シングルトンパターン）
_redis_client: Optional[redis.Redis] = None


async def get_redis_client() -> redis.Redis:
    """
    FastAPIの依存性注入システムで使用するRedisクライアントを提供する関数。
    シングルトンパターンで単一のクライアントインスタンスを再利用します。
    """
    global _redis_client
    
    if _redis_client is None:
        _redis_client = redis.Redis(connection_pool=redis_pool)
        logger.info("Redis client initialized with optimized connection pool")
    
    return _redis_client


def get_redis_client_sync() -> redis.Redis:
    """
    同期的な処理で使用するRedisクライアント（後方互換性のため）
    """
    return redis.Redis(connection_pool=redis_pool)


# 進捗イベントを発行するPub/Subチャンネル名
PROGRESS_CHANNEL = "progress_events"

# 処理完了をWebSocketクライアントに通知するためのチャンネル名
NOTIFICATION_CHANNEL = "notifications"

# エラーログを発行するPub/Subチャンネル名
ERROR_CHANNEL = "error_logs"
