import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import socketio

from api.api import api_router
from core.config import settings
from core.connection_manager import manager
from core.socketio_server import instructor_socketio_manager
from db.redis_client import get_redis_client, NOTIFICATION_CHANNEL
from db.base import Base
from db.session import engine

# モデルをインポートしてBase.metadata.create_all()でテーブルが作成されるようにする
from db.models import Student, Class, ClassAssignment, AssignmentSubmission  # noqa


async def redis_subscriber():
    """Redisの通知チャンネルを購読し、メッセージをWebSocketクライアントにブロードキャストする"""
    redis = await get_redis_client()
    pubsub = redis.pubsub()
    await pubsub.subscribe(NOTIFICATION_CHANNEL)
    print(f"Subscribed to '{NOTIFICATION_CHANNEL}' channel.")
    try:
        while True:
            message = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=1.0
            )
            if message and message.get("type") == "message":
                print(f"Received notification: {message['data']}")
                # message['data'] が既に文字列の場合とバイト列の場合を処理
                data = message["data"]
                if isinstance(data, bytes):
                    data = data.decode("utf-8")
                await manager.broadcast(data)
            await asyncio.sleep(0.01)
    except asyncio.CancelledError:
        print("Redis subscriber task cancelled.")
    finally:
        await pubsub.close()


# FastAPI 0.109.2以降のlifespan実装
@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPIアプリケーションのライフサイクルを管理するコンテキストマネージャー"""
    # アプリケーション起動時の処理
    print("Starting application...")

    # データベーステーブルの作成
    Base.metadata.create_all(bind=engine)
    print("Database tables created")

    # Redis購読タスクの作成と開始
    redis_subscriber_task = asyncio.create_task(redis_subscriber())
    print("Redis subscriber task started")

    # アプリケーションの実行中はここでyield
    yield

    # アプリケーション終了時の処理
    print("Shutting down application...")

    # Redis購読タスクのクリーンアップ
    print("Cancelling Redis subscriber task...")
    redis_subscriber_task.cancel()

    try:
        await redis_subscriber_task
    except asyncio.CancelledError:
        print("Redis subscriber task cancelled successfully")


# FastAPIアプリケーションの初期化
# lifespanを引数として渡す
# Python 3.12とFastAPI 0.109.2に対応した書き方
# Note: lifespanは空のジェネレーターではなく、asynccontextmanagerである必要がある
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# CORS設定
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# APIルーターの追加
app.include_router(api_router, prefix=settings.API_V1_STR)

# 静的ファイルディレクトリのマウント
import os

static_dir = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(static_dir):
    os.makedirs(static_dir)
app.mount("/static", StaticFiles(directory=static_dir), name="static")


# ルートエンドポイント
@app.get("/")
async def read_root():
    """APIルートエンドポイント"""
    return {"message": f"Welcome to {settings.PROJECT_NAME}"}


# Socket.IOサーバーをFastAPIアプリケーションに統合
# 正しい統合方法: Socket.IOアプリをメインアプリとしてエクスポート
app = socketio.ASGIApp(instructor_socketio_manager.sio, app)
