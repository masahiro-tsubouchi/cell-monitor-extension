import redis.asyncio as redis
from core.config import settings

# Redisの非同期接続プールを作成
# decode_responses=True にすることで、Redisからの応答が自動的にUTF-8文字列にデコードされる
redis_pool = redis.ConnectionPool(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    db=0,  # デフォルトのデータベース番号
    decode_responses=True,
)


def get_redis_client() -> redis.Redis:
    """
    FastAPIの依存性注入システムで使用するRedisクライアントを提供する関数。
    コネクションプールからクライアントを取得します。
    """
    return redis.Redis(connection_pool=redis_pool)


# 進捗イベントを発行するPub/Subチャンネル名
PROGRESS_CHANNEL = "progress_events"

# 処理完了をWebSocketクライアントに通知するためのチャンネル名
NOTIFICATION_CHANNEL = "notifications"

# エラーログを発行するPub/Subチャンネル名
ERROR_CHANNEL = "error_logs"
