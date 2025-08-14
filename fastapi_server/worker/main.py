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
from db.session import SessionLocal  # noqa: E402
from worker.event_router import event_router  # noqa: E402

# ロガーの設定
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("/app/worker.log"),
    ],
)
logger = logging.getLogger(__name__)

# Worker用のDBセッションを作成
engine = create_engine(settings.DATABASE_URL)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def listen_to_redis():
    """RedisのPub/Subをリッスンし、イベントルーターを使用してイベントを処理する"""
    print("[WORKER] Starting worker process...")
    logger.info("[WORKER] Starting worker process...")

    try:
        redis_client = redis.Redis(
            host=settings.REDIS_HOST, port=settings.REDIS_PORT, decode_responses=True
        )
        print(
            f"[WORKER] Redis client created: {settings.REDIS_HOST}:{settings.REDIS_PORT}"
        )
        logger.info(
            f"[WORKER] Redis client created: {settings.REDIS_HOST}:{settings.REDIS_PORT}"
        )

        # Redis接続テスト
        await redis_client.ping()
        print("[WORKER] Redis connection successful")
        logger.info("[WORKER] Redis connection successful")

        pubsub = redis_client.pubsub()
        await pubsub.subscribe(PROGRESS_CHANNEL)
        print(f"[WORKER] Subscribed to channel: '{PROGRESS_CHANNEL}'")
        logger.info(f"[WORKER] Subscribed to channel: '{PROGRESS_CHANNEL}'")

    except Exception as e:
        print(f"[WORKER] Failed to initialize Redis connection: {e}")
        logger.error(f"[WORKER] Failed to initialize Redis connection: {e}")
        raise

    print("[WORKER] Starting message listening loop...")
    logger.info("[WORKER] Starting message listening loop...")

    while True:
        try:
            print("[WORKER] Waiting for message...")
            message = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=10.0  # 10秒タイムアウト追加
            )
            if message:
                print(f"[WORKER] Received message: {message['data']}")
                logger.info(f"[WORKER] Received message: {message['data']}")

                # メッセージをJSONとしてパース
                event_data = json.loads(message["data"])
                print(
                    f"[WORKER] Parsed event data: {event_data.get('eventType', 'unknown')}"
                )
                logger.info(
                    f"[WORKER] Parsed event data: {event_data.get('eventType', 'unknown')}"
                )

                # DBセッションを取得
                db = SessionLocal()
                try:
                    # イベントルーターを使用してイベントタイプに基づいて処理
                    success = await event_router.route_event(event_data, db)

                    if success:
                        # 処理が成功したら通知を送信
                        notification = {
                            "emailAddress": event_data.get("emailAddress"),
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
                            "emailAddress": event_data.get("emailAddress", "unknown"),
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
            else:
                # メッセージがない場合（タイムアウト）は何もしない
                print("[WORKER] No message received (timeout)")
                continue

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
