import asyncio
import json
import logging
import os
import sys

# プロジェクトのルートディレクトリをsys.pathに追加
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import redis.asyncio as redis  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from core.config import settings  # noqa: E402
from db.redis_client import (  # noqa: E402
    ERROR_CHANNEL,
    NOTIFICATION_CHANNEL,
    PROGRESS_CHANNEL,
    get_redis_client,
)
from db.session import DbSessionLocal  # noqa: E402
from worker.event_router import event_router  # noqa: E402

# ロガーの設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Worker用のDBセッションを作成
engine = create_engine(settings.DATABASE_URL)


def get_db():
    db = DbSessionLocal()
    try:
        yield db
    finally:
        db.close()


async def listen_to_redis():
    """RedisのPub/Subをリッスンし、イベントルーターを使用してイベントを処理する"""
    redis_client = redis.Redis(
        host=settings.REDIS_HOST, port=settings.REDIS_PORT, decode_responses=True
    )
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(PROGRESS_CHANNEL)

    logger.info(f"Worker listening on channel: '{PROGRESS_CHANNEL}'")

    while True:
        try:
            message = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=None
            )
            if message:
                logger.info(f"Received message: {message['data']}")

                # メッセージをJSONとしてパース
                event_data = json.loads(message["data"])

                # DBセッションを取得
                db = DbSessionLocal()
                try:
                    # イベントルーターを使用してイベントタイプに基づいて処理
                    success = await event_router.route_event(event_data, db)

                    if success:
                        # 処理が成功したら通知を送信
                        notification = {
                            "userId": event_data.get("userId"),
                            "notebookPath": event_data.get("notebookPath"),
                            "event": event_data.get("event"),
                            "status": "processed",
                        }
                        # Publisher用のクライアントを別途取得してpublishする
                        publisher_redis = await get_redis_client()
                        await publisher_redis.publish(
                            NOTIFICATION_CHANNEL, json.dumps(notification)
                        )
                        logger.info(
                            f"処理完了通知を送信: {event_data.get('event')} イベント"
                        )
                    else:
                        # 処理に失敗した場合はエラーログを送信
                        error_log = {
                            "timestamp": event_data.get("timestamp", "unknown"),
                            "userId": event_data.get("userId", "unknown"),
                            "event": event_data.get("event", "unknown"),
                            "error": "イベント処理に失敗しました",
                            "status": "failed",
                        }
                        publisher_redis = await get_redis_client()
                        await publisher_redis.publish(
                            ERROR_CHANNEL, json.dumps(error_log)
                        )
                        logger.error(f"処理失敗: {error_log}")
                finally:
                    db.close()

        except Exception as e:
            logger.error(f"イベント処理中に予期しないエラーが発生しました: {e}")
            try:
                # エラーログチャネルにエラーを記録
                error_log = {
                    "timestamp": "unknown",  # イベントデータが取得できない場合
                    "error_type": str(type(e).__name__),
                    "error_message": str(e),
                    "status": "system_error",
                }
                publisher_redis = await get_redis_client()
                await publisher_redis.publish(ERROR_CHANNEL, json.dumps(error_log))
            except Exception as publish_error:
                logger.critical(f"エラーログの発行に失敗しました: {publish_error}")

            # エラーが発生しても処理を継続するために少し待つ
            await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(listen_to_redis())
