from fastapi import APIRouter, Depends
import redis.asyncio as redis

from schemas.progress import StudentProgress
from db.redis_client import get_redis_client, PROGRESS_CHANNEL

router = APIRouter()


@router.post("/student-progress")
async def receive_progress(
    progress: StudentProgress,
    redis_client: redis.Redis = Depends(get_redis_client)
):
    """
    学生の進捗状況データを受信し、Redis Pub/Subにイベントを発行する。
    """
    # 受信したデータを出力して確認
    print(f"--- Received Student Progress Data ---\n{progress.model_dump_json(indent=2)}\n------------------------------------")

    # PydanticモデルをJSON文字列に変換して発行する
    await redis_client.publish(PROGRESS_CHANNEL, progress.model_dump_json())

    return {"status": "ok", "message": "Event published successfully"}

    # 今後のステップ：
    # 1. このイベントデータをRedis Pub/Subに発行する
    # 2. 別のワーカーがイベントを購読し、InfluxDBに書き込む
    return {"status": "ok", "processed_user_id": student.user_id}
