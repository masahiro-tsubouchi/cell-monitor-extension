"""
講師ステータス管理API エンドポイント

Phase 6: 講師ステータス管理API実装
- GET /{instructor_id} - 講師現在ステータス取得
- PUT /{instructor_id} - 講師ステータス更新
- GET /{instructor_id}/history - ステータス履歴取得
- POST /bulk - 一括ステータス更新
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from db.session import get_db
from core.security import get_current_instructor
from crud.crud_instructor import (
    get_instructor,
    update_instructor_status,
    get_instructor_status_history,
)
from schemas.instructor import (
    InstructorStatusUpdate,
    InstructorStatusResponse,
    InstructorStatusHistoryResponse,
)
from db.models import Instructor, InstructorStatus

router = APIRouter()


@router.get("/{instructor_id}", response_model=InstructorStatusResponse)
async def get_instructor_status(
    instructor_id: int,
    db: Session = Depends(get_db),
    current_instructor: Instructor = Depends(get_current_instructor),
):
    """
    指定された講師の現在のステータスを取得する

    - **instructor_id**: 講師ID
    """
    instructor = get_instructor(db, instructor_id)
    if not instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")

    return InstructorStatusResponse(
        instructor_id=instructor.id,
        status=instructor.status,
        current_session_id=instructor.current_session_id,
        status_updated_at=instructor.status_updated_at,
    )


@router.put("/{instructor_id}", response_model=InstructorStatusResponse)
async def update_instructor_status_endpoint(
    instructor_id: int,
    status_update: InstructorStatusUpdate,
    db: Session = Depends(get_db),
    current_instructor: Instructor = Depends(get_current_instructor),
):
    """
    指定された講師のステータスを更新する

    - **instructor_id**: 講師ID
    - **status_update**: ステータス更新データ
    """
    # 講師の存在確認
    existing_instructor = get_instructor(db, instructor_id)
    if not existing_instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")

    # ステータスを更新
    updated_instructor = update_instructor_status(db, instructor_id, status_update)

    return InstructorStatusResponse(
        instructor_id=updated_instructor.id,
        status=updated_instructor.status,
        current_session_id=updated_instructor.current_session_id,
        status_updated_at=updated_instructor.status_updated_at,
    )


@router.get(
    "/{instructor_id}/history", response_model=List[InstructorStatusHistoryResponse]
)
async def get_instructor_status_history_endpoint(
    instructor_id: int,
    skip: int = Query(0, ge=0, description="スキップする件数"),
    limit: int = Query(100, ge=1, le=1000, description="取得する最大件数"),
    db: Session = Depends(get_db),
    current_instructor: Instructor = Depends(get_current_instructor),
):
    """
    指定された講師のステータス履歴を取得する

    - **instructor_id**: 講師ID
    - **skip**: スキップする件数（デフォルト: 0）
    - **limit**: 取得する最大件数（デフォルト: 100）
    """
    # 講師の存在確認
    instructor = get_instructor(db, instructor_id)
    if not instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")

    # ステータス履歴を取得
    history = get_instructor_status_history(db, instructor_id, skip=skip, limit=limit)

    return [
        InstructorStatusHistoryResponse(
            id=entry.id,
            instructor_id=entry.instructor_id,
            status=entry.status,
            session_id=None,  # InstructorStatusHistoryモデルにはsession_idフィールドが存在しないためNullに設定
            started_at=entry.started_at,
            ended_at=entry.ended_at,
            duration_minutes=entry.duration_minutes,
        )
        for entry in history
    ]


@router.post("/bulk")
async def bulk_update_instructor_status(
    bulk_update_data: dict,
    db: Session = Depends(get_db),
    current_instructor: Instructor = Depends(get_current_instructor),
):
    """
    複数の講師のステータスを一括更新する

    - **bulk_update_data**: 一括更新データ
    """
    updates = bulk_update_data.get("updates", [])
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")

    results = []
    updated_count = 0

    for update in updates:
        try:
            instructor_id = update.get("instructor_id")
            status_value = update.get("status")
            current_session_id = update.get("current_session_id")

            # 講師の存在確認
            instructor = get_instructor(db, instructor_id)
            if not instructor:
                results.append(
                    {
                        "instructor_id": instructor_id,
                        "success": False,
                        "error": "Instructor not found",
                    }
                )
                continue

            # ステータス更新データを作成
            status_update = InstructorStatusUpdate(
                status=InstructorStatus(status_value),
                current_session_id=current_session_id,
            )

            # ステータスを更新
            updated_instructor = update_instructor_status(
                db, instructor_id, status_update
            )

            results.append(
                {
                    "instructor_id": instructor_id,
                    "status": updated_instructor.status.value,
                    "current_session_id": updated_instructor.current_session_id,
                    "success": True,
                }
            )
            updated_count += 1

        except Exception as e:
            results.append(
                {"instructor_id": instructor_id, "success": False, "error": str(e)}
            )

    # 部分的な成功の場合は207 Multi-Status、全て成功の場合は200を返す
    status_code = 207 if updated_count < len(updates) else 200

    return {"updated_count": updated_count, "results": results}
