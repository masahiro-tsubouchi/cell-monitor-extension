import asyncio
import json
import logging
import os
import sys
import signal

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
from worker.health_monitor import health_monitor  # noqa: E402
from worker.parallel_processor import (  # noqa: E402
    parallel_processor,
    initialize_parallel_processing,
    shutdown_parallel_processing,
    process_event_parallel
)
from core.realtime_notifier import realtime_notifier  # noqa: E402
from core.influxdb_batch_writer import batch_writer  # noqa: E402

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

    # ヘルス監視システム初期化
    try:
        await health_monitor.initialize()
        print("[WORKER] Health monitor initialized")
    except Exception as e:
        print(f"[WORKER] Failed to initialize health monitor: {e}")
        logger.error(f"[WORKER] Failed to initialize health monitor: {e}")
        return
    
    # リアルタイム通知システム初期化
    try:
        await realtime_notifier.initialize()
        print("[WORKER] Realtime notifier initialized")
    except Exception as e:
        print(f"[WORKER] Failed to initialize realtime notifier: {e}")
        logger.error(f"[WORKER] Failed to initialize realtime notifier: {e}")
        # 通知システムは必須ではないため、エラーでも続行
    
    # InfluxDBバッチライター初期化
    try:
        await batch_writer.start_batch_writer()
        print("[WORKER] InfluxDB batch writer initialized")
    except Exception as e:
        print(f"[WORKER] Failed to initialize InfluxDB batch writer: {e}")
        logger.error(f"[WORKER] Failed to initialize InfluxDB batch writer: {e}")
        # バッチライターは必須ではないため、エラーでも続行

    # Phase 3: 並列処理システム初期化
    try:
        await initialize_parallel_processing()
        print("[WORKER] Parallel processing system initialized")
        logger.info("[WORKER] Parallel processing system initialized")
    except Exception as e:
        print(f"[WORKER] Failed to initialize parallel processing: {e}")
        logger.error(f"[WORKER] Failed to initialize parallel processing: {e}")
        raise

    # ハートビートタスクを開始
    heartbeat_task = asyncio.create_task(health_monitor.start_heartbeat())
    
    try:
        # 統一接続プールを使用
        redis_client = await get_redis_client()
        print(
            f"[WORKER] Redis client created using shared pool: {settings.REDIS_HOST}:{settings.REDIS_PORT}"
        )
        logger.info(
            f"[WORKER] Redis client created using shared pool: {settings.REDIS_HOST}:{settings.REDIS_PORT}"
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
        await health_monitor.shutdown()
        heartbeat_task.cancel()
        raise

    print("[WORKER] Starting message listening loop...")
    logger.info("[WORKER] Starting message listening loop...")

    message_count = 0
    last_activity_log = 0

    try:
        while health_monitor.is_running:
            try:
                # 100メッセージ毎に活動ログを出力
                if message_count - last_activity_log >= 100:
                    print(f"[WORKER] Processed {message_count} messages total")
                    last_activity_log = message_count

                message = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=10.0  # 10秒タイムアウト
                )
                
                if message:
                    message_count += 1
                    print(f"[WORKER] Received message #{message_count}: {message['data'][:100]}...")
                    logger.info(f"[WORKER] Received message #{message_count}")

                    # メッセージをJSONとしてパース
                    event_data = json.loads(message["data"])
                    logger.info(
                        f"[WORKER] Parsed event data: {event_data.get('eventType', 'unknown')}"
                    )

                    # Phase 3強化: 並列処理システムでイベント処理
                    try:
                        task_id = await process_event_parallel(event_data)
                        logger.debug(f"[WORKER] Event queued for parallel processing: {task_id}")
                        success = True  # 並列キューイング成功
                    except Exception as parallel_error:
                        logger.warning(f"[WORKER] Parallel processing failed, falling back to direct processing: {parallel_error}")
                        
                        # フォールバック: 従来の直接処理
                        db = SessionLocal()
                        try:
                            success = await event_router.route_event(event_data, db)
                        finally:
                            db.close()
                    
                    # ヘルス監視: 処理済みメッセージ数を更新
                    health_monitor.increment_processed_messages()

                    if success:
                            # 処理が成功したら通知を送信
                            notification = {
                                "emailAddress": event_data.get("emailAddress"),
                                "notebookPath": event_data.get("notebookPath"),
                                "event": event_data.get("event"),
                                "status": "processed",
                                "processedAt": json.dumps(health_monitor.get_health_status())
                            }
                            # Publisher用のクライアントを別途取得してpublishする
                            publisher_redis = await get_redis_client()
                            await publisher_redis.publish(
                                NOTIFICATION_CHANNEL, json.dumps(notification)
                            )
                            
                            # リアルタイムWebSocket通知を送信
                            try:
                                event_type = event_data.get("eventType", "unknown")
                                if event_type in ["execute_request", "cell_execution"]:
                                    await realtime_notifier.send_progress_notification(event_data)
                                elif event_type in ["help_request", "error_occurred"]:
                                    await realtime_notifier.send_help_request_notification(event_data)
                            except Exception as notify_error:
                                logger.warning(f"リアルタイム通知送信に失敗: {notify_error}")
                            
                            # InfluxDBバッチライターに追加
                            try:
                                await batch_writer.add_progress_point(event_data)
                            except Exception as batch_error:
                                logger.warning(f"InfluxDBバッチ書き込み追加に失敗: {batch_error}")
                            
                            logger.info(
                                f"処理完了通知を送信: {event_data.get('event')} イベント"
                            )
                    else:
                        # ヘルス監視: エラー数を更新
                        health_monitor.increment_error_count()
                        
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
                        
                else:
                    # メッセージがない場合（タイムアウト）
                    if message_count % 60 == 0:  # 10分毎にログ出力 (10秒*60回)
                        print(f"[WORKER] Waiting... (Processed {health_monitor.processed_messages} messages so far)")

            except json.JSONDecodeError as e:
                logger.error(f"JSON解析エラー: {e}")
                health_monitor.increment_error_count()
                continue
                
            except Exception as e:
                logger.error(f"イベント処理中に予期しないエラーが発生しました: {e}")
                health_monitor.increment_error_count()
                
                try:
                    # エラーログチャネルにエラーを記録
                    error_log = {
                        "timestamp": "unknown",  # イベントデータが取得できない場合
                        "error_type": str(type(e).__name__),
                        "error_message": str(e),
                        "status": "system_error",
                        "worker_health": health_monitor.get_health_status()
                    }
                    publisher_redis = await get_redis_client()
                    await publisher_redis.publish(ERROR_CHANNEL, json.dumps(error_log))
                except Exception as publish_error:
                    logger.critical(f"エラーログの発行に失敗しました: {publish_error}")

                # エラーが発生しても処理を継続するために少し待つ
                await asyncio.sleep(5)

    finally:
        # クリーンアップ
        print("[WORKER] Shutting down worker process...")
        logger.info("[WORKER] Shutting down worker process...")
        
        # ハートビートタスクをキャンセル
        heartbeat_task.cancel()
        try:
            await heartbeat_task
        except asyncio.CancelledError:
            pass
        
        # Phase 3: 並列処理システム終了
        try:
            await shutdown_parallel_processing()
            print("[WORKER] Parallel processing system shutdown completed")
            logger.info("[WORKER] Parallel processing system shutdown completed")
        except Exception as e:
            logger.error(f"Parallel processing shutdown error: {e}")

        # InfluxDBバッチライター終了
        try:
            await batch_writer.stop_batch_writer()
        except Exception as e:
            logger.error(f"InfluxDB batch writer shutdown error: {e}")
        
        # ヘルス監視システム終了
        await health_monitor.shutdown()
        
        # Redis接続を閉じる
        try:
            await pubsub.close()
            # Redis接続は共有プールのため明示的にcloseしない
        except Exception as e:
            logger.error(f"Redis cleanup error: {e}")


def signal_handler(signum, frame):
    """シグナルハンドラー: 正常な終了処理"""
    print(f"[WORKER] Received signal {signum}, shutting down gracefully...")
    logger.info(f"[WORKER] Received signal {signum}, shutting down gracefully...")
    health_monitor.is_running = False


if __name__ == "__main__":
    # シグナルハンドラーを設定
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    try:
        asyncio.run(listen_to_redis())
    except KeyboardInterrupt:
        print("[WORKER] Received keyboard interrupt, shutting down...")
        logger.info("[WORKER] Received keyboard interrupt, shutting down...")
    except Exception as e:
        print(f"[WORKER] Unexpected error: {e}")
        logger.error(f"[WORKER] Unexpected error: {e}")
        raise
