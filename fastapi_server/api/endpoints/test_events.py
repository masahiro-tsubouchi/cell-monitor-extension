from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from datetime import datetime, timedelta
import asyncio
from collections import defaultdict

from schemas.event import EventData

router = APIRouter()

# テスト用のイベントストレージ（メモリ内）
# 本番環境では使用されない、テスト専用の機能
_test_events_storage: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
_storage_lock = asyncio.Lock()

# イベントの保持時間（分）
EVENT_RETENTION_MINUTES = 10


async def _cleanup_old_events():
    """古いテストイベントをクリーンアップする"""
    async with _storage_lock:
        cutoff_time = datetime.now() - timedelta(minutes=EVENT_RETENTION_MINUTES)
        for test_id in list(_test_events_storage.keys()):
            _test_events_storage[test_id] = [
                event
                for event in _test_events_storage[test_id]
                if datetime.fromisoformat(
                    event.get("received_at", "1970-01-01T00:00:00")
                )
                > cutoff_time
            ]
            # 空になったテストIDは削除
            if not _test_events_storage[test_id]:
                del _test_events_storage[test_id]


@router.post("/test/events/{test_id}")
async def store_test_event(test_id: str, events: List[EventData]):
    """
    テスト用のイベントを受信し、メモリに一時保存する
    test_id: テストケースを識別するための一意のID
    """
    await _cleanup_old_events()

    async with _storage_lock:
        for event in events:
            event_data = event.model_dump()
            event_data["received_at"] = datetime.now().isoformat()
            _test_events_storage[test_id].append(event_data)

    return {"message": f"{len(events)} test events stored for test_id: {test_id}"}


@router.get("/test/events/{test_id}")
async def get_test_events(test_id: str):
    """
    指定されたtest_idのテストイベントを取得する
    """
    await _cleanup_old_events()

    async with _storage_lock:
        events = _test_events_storage.get(test_id, [])
        return {"test_id": test_id, "events": events, "count": len(events)}


@router.delete("/test/events/{test_id}")
async def clear_test_events(test_id: str):
    """
    指定されたtest_idのテストイベントをクリアする
    """
    async with _storage_lock:
        if test_id in _test_events_storage:
            count = len(_test_events_storage[test_id])
            del _test_events_storage[test_id]
            return {"message": f"Cleared {count} events for test_id: {test_id}"}
        else:
            raise HTTPException(
                status_code=404, detail=f"No events found for test_id: {test_id}"
            )


@router.get("/test/events")
async def list_test_ids():
    """
    現在保存されているテストIDの一覧を取得する
    """
    await _cleanup_old_events()

    async with _storage_lock:
        test_ids = list(_test_events_storage.keys())
        return {"test_ids": test_ids, "count": len(test_ids)}
