from fastapi import APIRouter, Depends
import redis.asyncio as redis

from schemas.cell_monitor import CellMonitor
from db.redis_client import get_redis_client, NOTIFICATION_CHANNEL

router = APIRouter()


@router.post("/cell-monitor")
async def receive_cell_monitoring(
    cell_data: CellMonitor, redis_client: redis.Redis = Depends(get_redis_client)
):
    """
    セルの監視データを受信し、Redis Pub/Subにイベントを発行する。
    このエンドポイントはJupyterLabの拡張機能から送信されるセル実行情報を受け取ります。
    """
    # 受信したデータを出力して確認
    print(
        f"--- Received Cell Monitor Data ---\n{cell_data.model_dump_json(indent=2)}\n----------------------------------"
    )

    # PydanticモデルをJSON文字列に変換してRedisに発行
    await redis_client.publish(NOTIFICATION_CHANNEL, cell_data.model_dump_json())

    return {
        "status": "ok",
        "message": "Cell monitoring data received and published",
        "user_id": cell_data.userId,
        "cell_id": cell_data.cellId,
    }
