import redis.asyncio as redis
from typing import Optional
from core.config import settings
import logging
import asyncio
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

# Redisの非同期接続プールを作成（負荷テスト対応の最適化されたパラメータ）
# decode_responses=True にすることで、Redisからの応答が自動的にUTF-8文字列にデコードされる
redis_pool = redis.ConnectionPool(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    db=0,  # デフォルトのデータベース番号
    decode_responses=True,
    max_connections=500,  # 本番環境対応（200ユーザー + 講師10名 + ワーカー + バッファ）
    retry_on_timeout=True,
    retry_on_error=[redis.BusyLoadingError, redis.ConnectionError],  # エラー時のリトライ設定
    health_check_interval=30,  # 30秒ごとにヘルスチェック
    socket_timeout=5,  # ソケットタイムアウト
    socket_connect_timeout=5,  # 接続タイムアウト
    socket_keepalive=True,  # TCP KeepAlive有効
    socket_keepalive_options={},  # TCP KeepAliveオプション
)

# グローバルRedisクライアントインスタンス（シングルトンパターン）
_redis_client: Optional[redis.Redis] = None

# サーキットブレーカー状態管理
_circuit_breaker_state = {
    "failure_count": 0,
    "last_failure_time": 0,
    "is_open": False,
    "failure_threshold": 5,  # 5回連続失敗でサーキットブレーカー開放
    "recovery_timeout": 30,  # 30秒後に復旧試行
}


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


import time
from typing import Any, Dict


def _update_circuit_breaker(success: bool) -> None:
    """サーキットブレーカーの状態を更新"""
    global _circuit_breaker_state
    
    if success:
        _circuit_breaker_state["failure_count"] = 0
        _circuit_breaker_state["is_open"] = False
    else:
        _circuit_breaker_state["failure_count"] += 1
        _circuit_breaker_state["last_failure_time"] = time.time()
        
        if _circuit_breaker_state["failure_count"] >= _circuit_breaker_state["failure_threshold"]:
            _circuit_breaker_state["is_open"] = True
            logger.warning(f"Redis Circuit Breaker opened after {_circuit_breaker_state['failure_count']} failures")


def _should_allow_request() -> bool:
    """リクエストを許可するかどうかを判定"""
    if not _circuit_breaker_state["is_open"]:
        return True
    
    # 復旧タイムアウト後は復旧試行を許可
    time_since_failure = time.time() - _circuit_breaker_state["last_failure_time"]
    if time_since_failure >= _circuit_breaker_state["recovery_timeout"]:
        logger.info("Redis Circuit Breaker attempting recovery")
        return True
    
    return False


@asynccontextmanager
async def get_redis_connection():
    """Redis接続のコンテキストマネージャー（自動クリーンアップ）"""
    if not _should_allow_request():
        logger.warning("Redis Circuit Breaker is open, request blocked")
        raise redis.ConnectionError("Redis Circuit Breaker is open")
    
    client = None
    try:
        client = await get_redis_client()
        yield client
        _update_circuit_breaker(success=True)
    except Exception as e:
        _update_circuit_breaker(success=False)
        logger.error(f"Redis operation failed: {e}")
        raise
    finally:
        # 接続プールを使用しているため、明示的なクリーンアップは不要
        pass


async def safe_redis_publish(channel: str, message: str, max_retries: int = 5) -> bool:
    """
    高負荷対応のRedis Publish操作
    
    Args:
        channel: Pub/Subチャンネル名
        message: 送信メッセージ
        max_retries: 最大リトライ回数
    
    Returns:
        bool: 送信成功フラグ
    """
    for attempt in range(max_retries):
        try:
            async with get_redis_connection() as redis_client:
                result = await redis_client.publish(channel, message)
                logger.debug(f"Redis publish successful to {channel}, subscribers: {result}")
                return True
                
        except redis.ConnectionError as e:
            if "Too many connections" in str(e):
                # 接続数制限エラーの場合は少し待ってリトライ
                wait_time = min(2 ** attempt, 10)  # 指数バックオフ（最大10秒）
                logger.warning(f"Redis connection limit reached, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                await asyncio.sleep(wait_time)
                continue
            else:
                logger.error(f"Redis connection error: {e}")
                break
                
        except Exception as e:
            logger.error(f"Redis publish failed (attempt {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(0.5)  # 短い待機
            
    logger.error(f"Redis publish failed after {max_retries} attempts to channel {channel}")
    return False


async def get_redis_info() -> Dict[str, Any]:
    """Redis接続情報と統計を取得"""
    try:
        async with get_redis_connection() as redis_client:
            info = await redis_client.info("clients")
            pool_info = {
                "max_connections": redis_pool.max_connections,
                "created_connections": redis_pool.created_connections,
            }
            
            return {
                "redis_info": info,
                "pool_info": pool_info,
                "circuit_breaker": _circuit_breaker_state.copy()
            }
    except Exception as e:
        logger.error(f"Failed to get Redis info: {e}")
        return {
            "error": str(e),
            "circuit_breaker": _circuit_breaker_state.copy()
        }
