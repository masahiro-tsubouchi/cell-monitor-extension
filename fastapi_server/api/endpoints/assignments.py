from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from crud.crud_class_assignment import (
    create_class_assignment,
    get_class_assignment,
    update_class_assignment,
    delete_class_assignment,
)
from db.session import get_db
from schemas.lms import (
    ClassAssignmentCreate,
    ClassAssignmentResponse,
    ClassAssignmentUpdate,
)
from db.models import ClassAssignment

router = APIRouter()


@router.post(
    "/", response_model=ClassAssignmentResponse, status_code=status.HTTP_201_CREATED
)
def create_assignment_endpoint(
    assignment_in: ClassAssignmentCreate, db: Session = Depends(get_db)
):
    """
    新しい課題を作成する
    """
    return create_class_assignment(db=db, assignment_in=assignment_in)


@router.get("/{assignment_id}", response_model=ClassAssignmentResponse)
def get_assignment_endpoint(assignment_id: int, db: Session = Depends(get_db)):
    """
    指定されたIDの課題を取得する
    """
    db_assignment = get_class_assignment(db=db, assignment_id=assignment_id)
    if db_assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment with id {assignment_id} not found",
        )
    return db_assignment


@router.get("/", response_model=List[ClassAssignmentResponse])
def list_assignments_endpoint(
    skip: int = 0,
    limit: int = 100,
    class_id: Optional[int] = Query(None, description="Filter assignments by class ID"),
    db: Session = Depends(get_db),
):
    """
    課題一覧を取得する（オプションでクラス別フィルタリング）
    """
    query = db.query(ClassAssignment)

    # クラス別フィルタリング
    if class_id is not None:
        query = query.filter(ClassAssignment.class_id == class_id)

    assignments = query.offset(skip).limit(limit).all()
    return assignments


@router.put("/{assignment_id}", response_model=ClassAssignmentResponse)
def update_assignment_endpoint(
    assignment_id: int,
    assignment_update: ClassAssignmentUpdate,
    db: Session = Depends(get_db),
):
    """
    指定されたIDの課題を更新する
    """
    db_assignment = update_class_assignment(
        db=db, assignment_id=assignment_id, assignment_update=assignment_update
    )
    if db_assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment with id {assignment_id} not found",
        )
    return db_assignment


@router.delete("/{assignment_id}", response_model=ClassAssignmentResponse)
def delete_assignment_endpoint(assignment_id: int, db: Session = Depends(get_db)):
    """
    指定されたIDの課題を削除する
    """
    db_assignment = delete_class_assignment(db=db, assignment_id=assignment_id)
    if db_assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assignment with id {assignment_id} not found",
        )
    return db_assignment
