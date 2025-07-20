from typing import Optional
from sqlalchemy.orm import Session

from db.models import Class
from schemas.lms import ClassCreate, ClassUpdate


def create_class(db: Session, class_in: ClassCreate) -> Class:
    """
    新しいクラスを作成してデータベースに保存する
    """
    db_class = Class(
        name=class_in.name,
        class_code=class_in.class_code,
        description=class_in.description,
    )
    db.add(db_class)
    db.commit()
    db.refresh(db_class)
    return db_class


def get_class(db: Session, class_id: int) -> Optional[Class]:
    """
    IDでクラスを取得する
    """
    return db.query(Class).filter(Class.id == class_id).first()


def update_class(db: Session, class_id: int, class_update: ClassUpdate) -> Optional[Class]:
    """
    クラス情報を更新する
    """
    db_class = db.query(Class).filter(Class.id == class_id).first()
    if not db_class:
        return None

    # 更新データを辞書に変換し、None以外の値のみを取得
    update_data = class_update.model_dump(exclude_unset=True)

    # 各フィールドを更新
    for field, value in update_data.items():
        if hasattr(db_class, field):
            setattr(db_class, field, value)

    db.commit()
    db.refresh(db_class)
    return db_class


def delete_class(db: Session, class_id: int) -> Optional[Class]:
    """
    クラスを削除する
    """
    db_class = db.query(Class).filter(Class.id == class_id).first()
    if not db_class:
        return None

    db.delete(db_class)
    db.commit()
    return db_class
