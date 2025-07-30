from typing import Optional
from sqlalchemy.orm import Session

from db.models import ClassAssignment
from schemas.lms import ClassAssignmentCreate, ClassAssignmentUpdate


def create_class_assignment(
    db: Session, assignment_in: ClassAssignmentCreate
) -> ClassAssignment:
    """
    新しいクラス課題を作成してデータベースに保存する
    """
    db_assignment = ClassAssignment(
        class_id=assignment_in.class_id,
        notebook_id=assignment_in.notebook_id,
        title=assignment_in.title,
        description=assignment_in.description,
        due_date=assignment_in.due_date,
        points=assignment_in.points,
    )
    db.add(db_assignment)
    db.commit()
    db.refresh(db_assignment)
    return db_assignment


def get_class_assignment(db: Session, assignment_id: int) -> Optional[ClassAssignment]:
    """
    IDでクラス課題を取得する
    """
    return db.query(ClassAssignment).filter(ClassAssignment.id == assignment_id).first()


def update_class_assignment(
    db: Session, assignment_id: int, assignment_update: ClassAssignmentUpdate
) -> Optional[ClassAssignment]:
    """
    クラス課題情報を更新する
    """
    db_assignment = (
        db.query(ClassAssignment).filter(ClassAssignment.id == assignment_id).first()
    )
    if not db_assignment:
        return None

    # 更新データを辞書に変換し、None以外の値のみを取得
    update_data = assignment_update.model_dump(exclude_unset=True)

    # 各フィールドを更新
    for field, value in update_data.items():
        if hasattr(db_assignment, field):
            setattr(db_assignment, field, value)

    db.commit()
    db.refresh(db_assignment)
    return db_assignment


def delete_class_assignment(
    db: Session, assignment_id: int
) -> Optional[ClassAssignment]:
    """
    クラス課題を削除する
    """
    db_assignment = (
        db.query(ClassAssignment).filter(ClassAssignment.id == assignment_id).first()
    )
    if not db_assignment:
        return None

    db.delete(db_assignment)
    db.commit()
    return db_assignment
