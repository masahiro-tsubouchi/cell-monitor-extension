"""
オフライン同期API エンドポイント

JupyterLab拡張機能のオフライン対応を支援するAPIエンドポイント群。
ネットワーク断絶時のデータ損失防止と復旧時の自動同期を提供。
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict, Any, List
from pydantic import BaseModel, Field

from core.offline_queue import (
    queue_event_for_offline_sync,
    sync_offline_events,
    get_offline_queue_status,
    offline_queue_manager
)

router = APIRouter()


class OfflineEventRequest(BaseModel):
    """
    オフラインイベント送信リクエスト
    """
    events: List[Dict[str, Any]]
    priority: int = Field(default=1, ge=1, le=3, description="優先度 (1=高, 2=中, 3=低)")
    force_queue: bool = Field(default=False, description="オンライン時でも強制的にキューに追加")


class SyncRequest(BaseModel):
    """
    同期リクエスト
    """
    force_sync: bool = Field(default=False, description="進行中でも強制的に同期を開始")


@router.post("/queue", status_code=202)
async def queue_events_for_offline(request: OfflineEventRequest):
    """
    イベントをオフライン同期キューに追加する
    
    ネットワーク断絶時やサーバーエラー時に、
    イベントをローカルキューに保存して後で同期する。
    
    - **events**: 送信するイベントのリスト
    - **priority**: 同期優先度 (1=高優先度, 2=中優先度, 3=低優先度)
    - **force_queue**: オンライン時でも強制的にキューに追加
    """
    if not request.events:
        raise HTTPException(
            status_code=400,
            detail="No events provided"
        )
    
    if len(request.events) > 100:
        raise HTTPException(
            status_code=413,
            detail="Too many events. Maximum 100 events per request."
        )
    
    queued_ids = []
    failed_events = []
    
    try:
        for event_data in request.events:
            try:
                queue_id = await queue_event_for_offline_sync(
                    event_data=event_data,
                    priority=request.priority,
                    force_queue=request.force_queue
                )
                queued_ids.append(queue_id)
                
            except Exception as e:
                failed_events.append({
                    "event": event_data,
                    "error": str(e)
                })
        
        response = {
            "message": f"{len(queued_ids)} events queued for offline sync",
            "queued_event_ids": queued_ids,
            "successful_count": len(queued_ids),
            "failed_count": len(failed_events)
        }
        
        if failed_events:
            response["failed_events"] = failed_events
        
        return response
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to queue events: {str(e)}"
        )


@router.post("/sync", status_code=200)
async def sync_offline_events_endpoint(
    request: SyncRequest,
    background_tasks: BackgroundTasks
):
    """
    オフラインキューに保存されたイベントを同期する
    
    ネットワーク復旧後に、キューに保存されたイベントを
    バッチ処理でサーバーに送信する。
    
    - **force_sync**: 既に同期が進行中でも強制的に新しい同期を開始
    """
    try:
        # 現在の同期状況をチェック
        queue_status = get_offline_queue_status()
        
        if queue_status["sync_in_progress"] and not request.force_sync:
            return {
                "message": "Sync already in progress",
                "queue_status": queue_status
            }
        
        if queue_status["total_queued_events"] == 0:
            return {
                "message": "No events to sync",
                "queue_status": queue_status
            }
        
        # バックグラウンドで同期を実行
        if request.force_sync:
            # 強制同期の場合は即座に実行
            sync_result = await sync_offline_events()
            return {
                "message": "Forced sync completed",
                "sync_result": sync_result,
                "queue_status": get_offline_queue_status()
            }
        else:
            # 通常同期の場合はバックグラウンドタスクで実行
            background_tasks.add_task(sync_offline_events)
            return {
                "message": "Sync started in background",
                "queue_status": queue_status
            }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to sync offline events: {str(e)}"
        )


@router.get("/status", status_code=200)
async def get_offline_sync_status():
    """
    オフライン同期キューの現在状態を取得する
    
    キューに保存されているイベント数、同期進行状況、
    ネットワーク状態などの詳細情報を返す。
    """
    try:
        queue_status = get_offline_queue_status()
        
        # 追加の統計情報を計算
        additional_stats = {
            "queue_health": _calculate_queue_health(queue_status),
            "recommendations": _generate_recommendations(queue_status)
        }
        
        return {
            "queue_status": queue_status,
            "additional_stats": additional_stats,
            "timestamp": "2025-01-19T12:00:00Z"  # 実際の実装では現在時刻を使用
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get offline sync status: {str(e)}"
        )


@router.delete("/clear", status_code=200)
async def clear_offline_queue():
    """
    オフライン同期キューをクリアする
    
    ⚠️ 注意: この操作は取り消せません。
    キューに保存されているすべてのイベントが削除されます。
    """
    try:
        initial_count = len(offline_queue_manager.queue_storage)
        failed_count = len(offline_queue_manager.failed_events)
        
        # キューをクリア
        offline_queue_manager.queue_storage.clear()
        offline_queue_manager.failed_events.clear()
        
        return {
            "message": "Offline queue cleared successfully",
            "cleared_events": initial_count,
            "cleared_failed_events": failed_count,
            "queue_status": get_offline_queue_status()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear offline queue: {str(e)}"
        )


@router.get("/failed-events", status_code=200)
async def get_failed_events():
    """
    同期に失敗したイベントの一覧を取得する
    
    最大リトライ回数を超えて失敗したイベントや、
    永続的なエラーで同期できないイベントを返す。
    """
    try:
        failed_events = offline_queue_manager.failed_events
        
        # 失敗イベントの詳細情報を構築
        failed_details = []
        for event in failed_events:
            failed_details.append({
                "queue_id": event.queue_id,
                "event_type": event.event_type,
                "user_id": event.user_id,
                "created_at": event.created_at.isoformat(),
                "retry_count": event.retry_count,
                "last_retry_at": event.last_retry_at.isoformat() if event.last_retry_at else None,
                "priority": event.priority,
                "event_data": event.event_data
            })
        
        return {
            "failed_events_count": len(failed_events),
            "failed_events": failed_details,
            "recommendations": [
                "Review failed events for data corruption",
                "Check network connectivity",
                "Verify server endpoint availability",
                "Consider manual data recovery if needed"
            ]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get failed events: {str(e)}"
        )


def _calculate_queue_health(queue_status: Dict[str, Any]) -> str:
    """
    キューの健全性を評価する
    
    Args:
        queue_status: キューの状態情報
        
    Returns:
        健全性レベル (excellent, good, warning, critical)
    """
    capacity_used = queue_status.get("queue_capacity_used", 0)
    failed_events = queue_status.get("failed_events", 0)
    total_events = queue_status.get("total_queued_events", 0)
    
    if capacity_used > 0.9 or failed_events > 100:
        return "critical"
    elif capacity_used > 0.7 or failed_events > 50:
        return "warning"
    elif capacity_used > 0.3 or total_events > 0:
        return "good"
    else:
        return "excellent"


def _generate_recommendations(queue_status: Dict[str, Any]) -> List[str]:
    """
    キューの状態に基づいて推奨事項を生成する
    
    Args:
        queue_status: キューの状態情報
        
    Returns:
        推奨事項のリスト
    """
    recommendations = []
    
    capacity_used = queue_status.get("queue_capacity_used", 0)
    failed_events = queue_status.get("failed_events", 0)
    is_online = queue_status.get("is_online", True)
    
    if not is_online:
        recommendations.append("Network connectivity issues detected. Check internet connection.")
    
    if capacity_used > 0.8:
        recommendations.append("Queue capacity is high. Consider increasing sync frequency.")
    
    if failed_events > 20:
        recommendations.append("Many failed events detected. Review error logs and server status.")
    
    if queue_status.get("total_queued_events", 0) == 0:
        recommendations.append("Queue is empty. All events are synchronized.")
    
    if not recommendations:
        recommendations.append("Queue is operating normally.")
    
    return recommendations
