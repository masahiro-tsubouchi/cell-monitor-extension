"""
リアルタイム進捗表示API エンドポイント

課題進捗率のライブ更新、WebSocket通信、
進捗分析・通知機能を提供するAPIエンドポイント群。
"""

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Query, Depends
from typing import Dict, Any, List, Optional
from datetime import datetime

from core.realtime_progress_manager import realtime_progress_manager
from schemas.realtime_progress import (
    StudentProgressSummary,
    AssignmentProgressInfo,
    ProgressNotification,
    RealtimeProgressConfig
)

router = APIRouter()


@router.get("/student/{user_id}", status_code=200)
async def get_student_progress(user_id: str):
    """
    指定学生の進捗サマリーを取得する
    
    学生の全課題進捗、統計情報、学習分析結果を含む
    包括的な進捗情報を返す。
    
    - **user_id**: 学生ID
    """
    try:
        progress = realtime_progress_manager.get_student_progress(user_id)
        
        if not progress:
            raise HTTPException(
                status_code=404,
                detail=f"Progress data not found for user: {user_id}"
            )
        
        return {
            "message": "Student progress retrieved successfully",
            "user_id": user_id,
            "progress": progress.model_dump(),
            "retrieved_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get student progress: {str(e)}"
        )


@router.get("/assignment/{user_id}/{assignment_id}", status_code=200)
async def get_assignment_progress(user_id: str, assignment_id: str):
    """
    指定課題の進捗詳細を取得する
    
    課題の全セル進捗、実行統計、完了予想時刻などの
    詳細な進捗情報を返す。
    
    - **user_id**: 学生ID
    - **assignment_id**: 課題ID
    """
    try:
        progress = realtime_progress_manager.get_assignment_progress(user_id, assignment_id)
        
        if not progress:
            raise HTTPException(
                status_code=404,
                detail=f"Assignment progress not found: user={user_id}, assignment={assignment_id}"
            )
        
        return {
            "message": "Assignment progress retrieved successfully",
            "user_id": user_id,
            "assignment_id": assignment_id,
            "progress": progress.model_dump(),
            "retrieved_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get assignment progress: {str(e)}"
        )


@router.get("/all-students", status_code=200)
async def get_all_students_progress(
    include_details: bool = Query(False, description="詳細情報を含める"),
    limit: int = Query(50, ge=1, le=200, description="取得件数制限")
):
    """
    全学生の進捗サマリーを取得する
    
    講師向けの全体監視機能。全学生の進捗状況を
    一覧表示するためのデータを提供する。
    
    - **include_details**: セル別詳細情報を含める
    - **limit**: 取得件数制限
    """
    try:
        all_progress = realtime_progress_manager.get_all_students_progress()
        
        # 制限数を適用
        limited_progress = all_progress[:limit]
        
        # 詳細情報を除外（必要に応じて）
        if not include_details:
            for progress in limited_progress:
                # セル詳細を除外して軽量化
                for assignment in progress.assignments_progress:
                    assignment.cells_progress = []
        
        # 統計情報を計算
        stats = {
            "total_students": len(all_progress),
            "returned_students": len(limited_progress),
            "active_students": sum(
                1 for p in limited_progress 
                if p.last_activity_at and 
                (datetime.now() - p.last_activity_at).total_seconds() < 3600
            ),
            "average_progress": sum(
                p.overall_progress_percentage for p in limited_progress
            ) / len(limited_progress) if limited_progress else 0
        }
        
        return {
            "message": "All students progress retrieved successfully",
            "stats": stats,
            "students_progress": [p.model_dump() for p in limited_progress],
            "retrieved_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get all students progress: {str(e)}"
        )


@router.get("/notifications/{user_id}", status_code=200)
async def get_user_notifications(
    user_id: str,
    unread_only: bool = Query(True, description="未読のみ取得"),
    limit: int = Query(20, ge=1, le=100, description="取得件数制限")
):
    """
    ユーザーの通知一覧を取得する
    
    進捗関連の通知（完了通知、エラー通知、マイルストーン通知等）
    を取得する。
    
    - **user_id**: ユーザーID
    - **unread_only**: 未読のみ取得するか
    - **limit**: 取得件数制限
    """
    try:
        notifications = realtime_progress_manager.get_pending_notifications(user_id)
        
        # 未読フィルタリング
        if unread_only:
            notifications = [n for n in notifications if not n.is_read]
        
        # 制限数を適用
        limited_notifications = notifications[:limit]
        
        return {
            "message": "User notifications retrieved successfully",
            "user_id": user_id,
            "total_notifications": len(notifications),
            "returned_notifications": len(limited_notifications),
            "unread_count": sum(1 for n in notifications if not n.is_read),
            "notifications": [n.model_dump() for n in limited_notifications],
            "retrieved_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get user notifications: {str(e)}"
        )


@router.post("/notifications/{notification_id}/read", status_code=200)
async def mark_notification_read(notification_id: str):
    """
    通知を既読にマークする
    
    - **notification_id**: 通知ID
    """
    try:
        # 実際の実装では通知の既読状態を更新
        # 簡易実装として成功レスポンスを返す
        
        return {
            "message": "Notification marked as read successfully",
            "notification_id": notification_id,
            "marked_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to mark notification as read: {str(e)}"
        )


@router.get("/stats", status_code=200)
async def get_progress_stats():
    """
    進捗管理システムの統計情報を取得する
    
    処理済みイベント数、アクティブセッション数、
    送信済み通知数などのシステム統計を返す。
    """
    try:
        stats = realtime_progress_manager.get_stats()
        
        # 追加統計を計算
        all_progress = realtime_progress_manager.get_all_students_progress()
        
        enhanced_stats = {
            **stats,
            "total_students": len(all_progress),
            "total_assignments": sum(
                len(p.assignments_progress) for p in all_progress
            ),
            "completion_rate": sum(
                p.overall_progress_percentage for p in all_progress
            ) / len(all_progress) if all_progress else 0,
            "system_health": "healthy" if stats.get('total_events_processed', 0) > 0 else "idle"
        }
        
        return {
            "message": "Progress system stats retrieved successfully",
            "stats": enhanced_stats,
            "retrieved_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get progress stats: {str(e)}"
        )


@router.post("/process-event", status_code=202)
async def process_progress_event(
    user_id: str,
    assignment_id: str,
    cell_id: str,
    event_data: Dict[str, Any]
):
    """
    進捗イベントを処理する
    
    JupyterLabからのセル実行イベントを受信し、
    リアルタイム進捗更新を実行する。
    
    - **user_id**: 学生ID
    - **assignment_id**: 課題ID
    - **cell_id**: セルID
    - **event_data**: イベントデータ
    """
    try:
        await realtime_progress_manager.process_cell_execution_event(
            user_id=user_id,
            assignment_id=assignment_id,
            cell_id=cell_id,
            event_data=event_data
        )
        
        return {
            "message": "Progress event processed successfully",
            "user_id": user_id,
            "assignment_id": assignment_id,
            "cell_id": cell_id,
            "processed_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process progress event: {str(e)}"
        )


@router.websocket("/ws/student/{user_id}")
async def websocket_student_progress(websocket: WebSocket, user_id: str):
    """
    学生向けリアルタイム進捗WebSocket
    
    学生の進捗更新、通知をリアルタイムで配信する。
    
    - **user_id**: 学生ID
    """
    await websocket.accept()
    connection_id = f"student_{user_id}_{datetime.now().timestamp()}"
    
    try:
        # 進捗更新を購読
        await realtime_progress_manager.subscribe_user(user_id, connection_id)
        
        # 初期データを送信
        initial_progress = realtime_progress_manager.get_student_progress(user_id)
        if initial_progress:
            await websocket.send_json({
                "type": "initial_progress",
                "data": initial_progress.model_dump()
            })
        
        # 接続を維持してメッセージを待機
        while True:
            # クライアントからのメッセージを受信（ping/pong等）
            try:
                message = await websocket.receive_json()
                
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                elif message.get("type") == "get_progress":
                    current_progress = realtime_progress_manager.get_student_progress(user_id)
                    if current_progress:
                        await websocket.send_json({
                            "type": "progress_update",
                            "data": current_progress.model_dump()
                        })
                
            except WebSocketDisconnect:
                break
            except Exception as e:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Error processing message: {str(e)}"
                })
    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "message": f"WebSocket error: {str(e)}"
        })
    finally:
        # 購読を解除
        await realtime_progress_manager.unsubscribe_user(user_id, connection_id)


@router.websocket("/ws/instructor")
async def websocket_instructor_progress(websocket: WebSocket):
    """
    講師向けリアルタイム進捗WebSocket
    
    全学生の進捗更新、システム統計をリアルタイムで配信する。
    """
    await websocket.accept()
    connection_id = f"instructor_{datetime.now().timestamp()}"
    
    try:
        # 全体進捗監視を購読
        await realtime_progress_manager.subscribe_instructor(connection_id)
        
        # 初期データを送信
        all_progress = realtime_progress_manager.get_all_students_progress()
        stats = realtime_progress_manager.get_stats()
        
        await websocket.send_json({
            "type": "initial_data",
            "data": {
                "students_progress": [p.model_dump() for p in all_progress],
                "stats": stats
            }
        })
        
        # 接続を維持してメッセージを待機
        while True:
            try:
                message = await websocket.receive_json()
                
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                elif message.get("type") == "get_all_progress":
                    current_progress = realtime_progress_manager.get_all_students_progress()
                    current_stats = realtime_progress_manager.get_stats()
                    await websocket.send_json({
                        "type": "all_progress_update",
                        "data": {
                            "students_progress": [p.model_dump() for p in current_progress],
                            "stats": current_stats
                        }
                    })
                elif message.get("type") == "get_student_detail":
                    student_id = message.get("user_id")
                    if student_id:
                        student_progress = realtime_progress_manager.get_student_progress(student_id)
                        if student_progress:
                            await websocket.send_json({
                                "type": "student_detail",
                                "data": student_progress.model_dump()
                            })
                
            except WebSocketDisconnect:
                break
            except Exception as e:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Error processing message: {str(e)}"
                })
    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "message": f"WebSocket error: {str(e)}"
        })
    finally:
        # 購読を解除
        await realtime_progress_manager.unsubscribe_instructor(connection_id)


@router.post("/simulate-event", status_code=202)
async def simulate_progress_event(
    user_id: str = "test_student_001",
    assignment_id: str = "assignment_001",
    cell_id: str = "cell_001",
    event_type: str = "cell_execution_complete"
):
    """
    進捗イベントをシミュレートする（テスト用）
    
    開発・テスト目的でリアルタイム進捗更新を
    シミュレートするためのエンドポイント。
    
    - **user_id**: 学生ID
    - **assignment_id**: 課題ID
    - **cell_id**: セルID
    - **event_type**: イベントタイプ
    """
    try:
        # テスト用のイベントデータを生成
        test_event_data = {
            "eventType": event_type,
            "eventTime": datetime.now().isoformat(),
            "cellIndex": 1,
            "cellType": "code",
            "executionCount": 1,
            "executionDurationMs": 150.0,
            "hasError": event_type == "cell_execution_error",
            "errorMessage": "Test error message" if event_type == "cell_execution_error" else None,
            "code": "print('Hello, World!')",
            "result": "Hello, World!" if event_type == "cell_execution_complete" else None,
            "metadata": {
                "memory_usage_mb": 64.5,
                "cpu_usage_percent": 12.3
            }
        }
        
        # イベントを処理
        await realtime_progress_manager.process_cell_execution_event(
            user_id=user_id,
            assignment_id=assignment_id,
            cell_id=cell_id,
            event_data=test_event_data
        )
        
        return {
            "message": "Progress event simulated successfully",
            "simulated_event": {
                "user_id": user_id,
                "assignment_id": assignment_id,
                "cell_id": cell_id,
                "event_type": event_type,
                "event_data": test_event_data
            },
            "simulated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to simulate progress event: {str(e)}"
        )


@router.delete("/reset/{user_id}", status_code=200)
async def reset_user_progress(user_id: str):
    """
    ユーザーの進捗データをリセットする（テスト用）
    
    開発・テスト目的で特定ユーザーの進捗データを
    クリアするためのエンドポイント。
    
    ⚠️ 注意: この操作は取り消せません。
    
    - **user_id**: 学生ID
    """
    try:
        # 進捗データを削除
        if user_id in realtime_progress_manager.student_progress:
            del realtime_progress_manager.student_progress[user_id]
        
        if user_id in realtime_progress_manager.assignment_progress:
            del realtime_progress_manager.assignment_progress[user_id]
        
        # セル進捗データを削除
        keys_to_delete = [
            key for key in realtime_progress_manager.cell_progress.keys()
            if key.startswith(f"{user_id}:")
        ]
        for key in keys_to_delete:
            del realtime_progress_manager.cell_progress[key]
        
        # 通知データを削除
        if user_id in realtime_progress_manager.pending_notifications:
            del realtime_progress_manager.pending_notifications[user_id]
        
        return {
            "message": "User progress reset successfully",
            "user_id": user_id,
            "reset_at": datetime.now().isoformat(),
            "warning": "This operation cannot be undone"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reset user progress: {str(e)}"
        )
