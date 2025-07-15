import asyncio
import sys
import os

# プロジェクトのルートディレクトリをsys.pathに追加
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import json
import redis.asyncio as redis
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine

from core.config import settings
import json
from db.redis_client import PROGRESS_CHANNEL, NOTIFICATION_CHANNEL, get_redis_client
from schemas.progress import StudentProgress
from crud import crud_student
from db.influxdb_client import write_progress_event

# Worker用のDBセッションを作成
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

async def listen_to_redis():
    """RedisのPub/Subをリッスンし、イベントを処理する"""
    redis_client = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, decode_responses=True)
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(PROGRESS_CHANNEL)
    
    print(f"Worker listening on channel: '{PROGRESS_CHANNEL}'")
    
    while True:
        try:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=None)
            if message:
                print(f"Received message: {message['data']}")
                
                # データをPydanticモデルにパース
                progress_data = StudentProgress.model_validate_json(message['data'])
                
                # DBセッションを取得
                db = SessionLocal()
                try:
                    # PostgreSQLにユーザー情報を保存/取得
                    student = crud_student.get_or_create_student(db, user_id=progress_data.userId)
                    print(f"Processed student for PostgreSQL: {student.user_id} (DB ID: {student.id})")
                    
                    # InfluxDBに時系列イベントを書き込む
                    write_progress_event(progress_data)

                    # FastAPIサーバーに処理完了を通知する
                    notification = {
                        "userId": progress_data.userId,
                        "notebookPath": progress_data.notebookPath,
                        "event": progress_data.event,
                        "status": "processed"
                    }
                    # Publisher用のクライアントを別途取得してpublishする
                    publisher_redis = await get_redis_client()
                    await publisher_redis.publish(NOTIFICATION_CHANNEL, json.dumps(notification))
                finally:
                    db.close()

        except Exception as e:
            print(f"An error occurred: {e}")
            # エラーが発生しても処理を継続するために少し待つ
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(listen_to_redis())
