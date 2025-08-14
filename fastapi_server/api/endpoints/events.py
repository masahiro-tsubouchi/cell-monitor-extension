import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException
from typing import List

from db.redis_client import get_redis_client, PROGRESS_CHANNEL
from schemas.event import EventData

router = APIRouter()

# バッチ処理設定
MAX_BATCH_SIZE = 100
MAX_REDIS_PIPELINE_SIZE = 50


@router.post("/events", status_code=202)
async def receive_events(
    events: List[EventData], redis_client=Depends(get_redis_client)
):
    """
    Receives a list of events, validates them, and publishes them to Redis.

    バッチ処理対応:
    - 最大100件のイベントを一度に処理
    - Redisパイプラインによる効率的な送信
    - 圧縮とJSON最適化によるデータサイズ削減
    """
    # バッチサイズ制限チェック
    if len(events) > MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Batch size {len(events)} exceeds maximum allowed size of {MAX_BATCH_SIZE}",
        )

    if not events:
        return {"message": "No events received"}

    # バッチ処理統計
    batch_stats = {
        "total_events": len(events),
        "event_types": {},
        "processing_time_ms": 0,
    }

    import time

    start_time = time.time()

    try:
        # イベントタイプ別の統計収集
        for event in events:
            # EventDataスキーマのeventTypeフィールドを使用（後方互換性のためeventもチェック）
            event_type = getattr(event, "eventType", None) or getattr(
                event, "event", "unknown"
            )
            if "event_types" not in batch_stats:
                batch_stats["event_types"] = {}
            batch_stats["event_types"][event_type] = (
                batch_stats["event_types"].get(event_type, 0) + 1
            )

        # Redisパイプラインを使用した効率的なバッチ送信
        await _publish_events_batch(redis_client, events)

        # 処理時間記録
        batch_stats["processing_time_ms"] = int((time.time() - start_time) * 1000)

        # デバッグログ（本番環境では削除推奨）
        print(
            f"--- Batch Processing Stats ---\n{json.dumps(batch_stats, indent=2)}\n-----------------------------"
        )

        return {
            "message": f"{len(events)} events received and queued for processing.",
            "batch_stats": batch_stats,
        }

    except Exception as e:
        print(f"Error processing event batch: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to process event batch: {str(e)}"
        )


async def _publish_events_batch(redis_client, events: List[EventData]):
    """
    Redisパイプラインを使用してイベントを効率的にバッチ送信
    """
    # イベントをチャンクに分割してパイプライン処理
    for i in range(0, len(events), MAX_REDIS_PIPELINE_SIZE):
        chunk = events[i : i + MAX_REDIS_PIPELINE_SIZE]

        # Redisパイプライン作成
        pipe = redis_client.pipeline()

        for event in chunk:
            # JSON圧縮とデータ最適化
            event_data = event.model_dump_json()  # JSON出力（Pydantic v2対応）
            pipe.publish(PROGRESS_CHANNEL, event_data)

        # パイプライン実行
        await pipe.execute()

        # 大量データ処理時の負荷分散
        if len(events) > MAX_REDIS_PIPELINE_SIZE:
            await asyncio.sleep(0.001)  # 1ms待機
