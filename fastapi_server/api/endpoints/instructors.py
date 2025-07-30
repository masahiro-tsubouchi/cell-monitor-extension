"""
講師管理API エンドポイント

Phase 5: 講師管理API実装
- GET / - 講師一覧取得
- POST / - 新規講師作成
- GET /{instructor_id} - 講師詳細取得
- PUT /{instructor_id} - 講師情報更新
- DELETE /{instructor_id} - 講師削除
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from db.session import get_db
from core.security import get_current_instructor, security
from crud.crud_instructor import (
    get_instructors,
    get_instructor,
    get_instructor_by_email,
    create_instructor,
    update_instructor,
    delete_instructor,
)
from schemas.instructor import InstructorCreate, InstructorUpdate, InstructorResponse
from db.models import Instructor

router = APIRouter()


@router.get("/", response_model=List[InstructorResponse])
async def get_instructors_list(
    skip: int = Query(0, ge=0, description="スキップする件数"),
    limit: int = Query(100, ge=1, le=1000, description="取得する最大件数"),
    is_active: Optional[bool] = Query(None, description="アクティブ状態でフィルター"),
    db: Session = Depends(get_db),
    current_instructor: Instructor = Depends(get_current_instructor),
):
    """
    講師一覧を取得する

    - **skip**: スキップする件数（デフォルト: 0）
    - **limit**: 取得する最大件数（デフォルト: 100）
    - **is_active**: アクティブ状態でフィルター（True/False/None）
    """
    instructors = get_instructors(db, skip=skip, limit=limit, is_active=is_active)
    return instructors


@router.post("/", response_model=InstructorResponse, status_code=201)
async def create_new_instructor(
    instructor_data: InstructorCreate,
    db: Session = Depends(get_db),
    current_instructor: Instructor = Depends(get_current_instructor),
):
    """
    新規講師を作成する

    - **instructor_data**: 講師作成データ
    """
    # メールアドレスの重複チェック
    existing_instructor = get_instructor_by_email(db, instructor_data.email)
    if existing_instructor:
        raise HTTPException(status_code=400, detail="Email already registered")

    # 新規講師を作成
    new_instructor = create_instructor(db, instructor_data)
    return new_instructor


@router.get("/{instructor_id}", response_model=InstructorResponse)
async def get_instructor_by_id(
    instructor_id: int,
    db: Session = Depends(get_db),
    current_instructor: Instructor = Depends(get_current_instructor),
):
    """
    指定されたIDの講師詳細を取得する

    - **instructor_id**: 講師ID
    """
    instructor = get_instructor(db, instructor_id)
    if not instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")
    return instructor


@router.put("/{instructor_id}", response_model=InstructorResponse)
async def update_instructor_by_id(
    instructor_id: int,
    instructor_update: InstructorUpdate,
    db: Session = Depends(get_db),
    current_instructor: Instructor = Depends(get_current_instructor),
):
    """
    指定されたIDの講師情報を更新する

    - **instructor_id**: 講師ID
    - **instructor_update**: 更新データ
    """
    # 講師の存在確認
    existing_instructor = get_instructor(db, instructor_id)
    if not existing_instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")

    # 講師情報を更新
    updated_instructor = update_instructor(db, instructor_id, instructor_update)
    return updated_instructor


@router.delete("/{instructor_id}")
async def delete_instructor_by_id(
    instructor_id: int,
    db: Session = Depends(get_db),
    current_instructor: Instructor = Depends(get_current_instructor),
):
    """
    指定されたIDの講師を削除する（論理削除）

    - **instructor_id**: 講師ID
    """
    # 講師の存在確認
    existing_instructor = get_instructor(db, instructor_id)
    if not existing_instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")

    # 自分自身を削除しようとした場合はエラー
    if instructor_id == current_instructor.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    # 講師を削除（論理削除）
    success = delete_instructor(db, instructor_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete instructor")

    return {"message": "Instructor successfully deleted"}
