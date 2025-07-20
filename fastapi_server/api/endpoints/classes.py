from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from crud.crud_class import create_class, get_class, update_class, delete_class
from db.session import get_db
from schemas.lms import ClassCreate, ClassResponse, ClassUpdate
from db.models import Class

router = APIRouter()


@router.post("/", response_model=ClassResponse, status_code=status.HTTP_201_CREATED)
def create_class_endpoint(class_in: ClassCreate, db: Session = Depends(get_db)):
    """
    新しいクラスを作成する
    """
    # クラスコードの重複チェック
    existing_class = (
        db.query(Class).filter(Class.class_code == class_in.class_code).first()
    )
    if existing_class:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Class with code '{class_in.class_code}' already exists",
        )

    return create_class(db=db, class_in=class_in)


@router.get("/{class_id}", response_model=ClassResponse)
def get_class_endpoint(class_id: int, db: Session = Depends(get_db)):
    """
    指定されたIDのクラスを取得する
    """
    db_class = get_class(db=db, class_id=class_id)
    if db_class is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Class with id {class_id} not found",
        )
    return db_class


@router.get("/", response_model=List[ClassResponse])
def list_classes_endpoint(
    skip: int = 0, limit: int = 100, db: Session = Depends(get_db)
):
    """
    クラス一覧を取得する
    """
    classes = db.query(Class).offset(skip).limit(limit).all()
    return classes


@router.put("/{class_id}", response_model=ClassResponse)
def update_class_endpoint(
    class_id: int, class_update: ClassUpdate, db: Session = Depends(get_db)
):
    """
    指定されたIDのクラスを更新する
    """
    db_class = update_class(db=db, class_id=class_id, class_update=class_update)
    if db_class is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Class with id {class_id} not found",
        )
    return db_class


@router.delete("/{class_id}", response_model=ClassResponse)
def delete_class_endpoint(class_id: int, db: Session = Depends(get_db)):
    """
    指定されたIDのクラスを削除する
    """
    db_class = delete_class(db=db, class_id=class_id)
    if db_class is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Class with id {class_id} not found",
        )
    return db_class
