from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, timezone

from db.models import Instructor, InstructorStatusHistory, InstructorStatus
from schemas.instructor import (
    InstructorCreate,
    InstructorUpdate,
    InstructorPasswordUpdate,
    InstructorStatusUpdate,
)
from core.security import get_password_hash, verify_password


def create_instructor(db: Session, instructor_in: InstructorCreate) -> Instructor:
    """
    新しい講師を作成してデータベースに保存する
    """
    # パスワードをハッシュ化
    hashed_password = get_password_hash(instructor_in.password)

    db_instructor = Instructor(
        email=instructor_in.email,
        password_hash=hashed_password,
        name=instructor_in.name,
        role=instructor_in.role,
        status=InstructorStatus.OFFLINE,
        is_active=True,
    )
    db.add(db_instructor)
    db.commit()
    db.refresh(db_instructor)
    return db_instructor


def get_instructor(db: Session, instructor_id: int) -> Optional[Instructor]:
    """
    IDで講師を取得する
    """
    return db.query(Instructor).filter(Instructor.id == instructor_id).first()


def get_instructor_by_email(db: Session, email: str) -> Optional[Instructor]:
    """
    メールアドレスで講師を取得する
    """
    return db.query(Instructor).filter(Instructor.email == email).first()


def get_instructors(
    db: Session, skip: int = 0, limit: int = 100, is_active: Optional[bool] = None
) -> List[Instructor]:
    """
    講師一覧を取得する
    """
    query = db.query(Instructor)
    if is_active is not None:
        query = query.filter(Instructor.is_active == is_active)
    return query.offset(skip).limit(limit).all()


def update_instructor(
    db: Session, instructor_id: int, instructor_update: InstructorUpdate
) -> Optional[Instructor]:
    """
    講師情報を更新する
    """
    db_instructor = db.query(Instructor).filter(Instructor.id == instructor_id).first()
    if not db_instructor:
        return None

    # 更新データを辞書に変換し、None以外の値のみを取得
    update_data = instructor_update.model_dump(exclude_unset=True)

    # 各フィールドを更新
    for field, value in update_data.items():
        if hasattr(db_instructor, field):
            setattr(db_instructor, field, value)

    db.commit()
    db.refresh(db_instructor)
    return db_instructor


def update_instructor_password(
    db: Session, instructor_id: int, password_update: InstructorPasswordUpdate
) -> Optional[Instructor]:
    """
    講師のパスワードを更新する
    """
    db_instructor = db.query(Instructor).filter(Instructor.id == instructor_id).first()
    if not db_instructor:
        return None

    # 現在のパスワードを検証
    if not verify_password(
        password_update.current_password, db_instructor.password_hash
    ):
        return None

    # 新しいパスワードをハッシュ化して更新
    db_instructor.password_hash = get_password_hash(password_update.new_password)
    db.commit()
    db.refresh(db_instructor)
    return db_instructor


def update_instructor_status(
    db: Session, instructor_id: int, status_update: InstructorStatusUpdate
) -> Optional[Instructor]:
    """
    講師のステータスを更新し、履歴を記録する
    """
    db_instructor = db.query(Instructor).filter(Instructor.id == instructor_id).first()
    if not db_instructor:
        return None

    # 現在の進行中セッションを終了
    current_history = (
        db.query(InstructorStatusHistory)
        .filter(
            InstructorStatusHistory.instructor_id == instructor_id,
            InstructorStatusHistory.ended_at.is_(None),
        )
        .first()
    )

    now = datetime.now(timezone.utc)

    if current_history:
        # 現在のセッションを終了
        current_history.ended_at = now
        duration = (now - current_history.started_at).total_seconds() / 60
        current_history.duration_minutes = int(duration)

    # 新しいステータス履歴を作成
    new_history = InstructorStatusHistory(
        instructor_id=instructor_id, status=status_update.status, started_at=now
    )
    db.add(new_history)

    # 講師のステータスを更新
    db_instructor.status = status_update.status
    db_instructor.current_session_id = status_update.current_session_id
    db_instructor.status_updated_at = now

    # ログイン時の場合、last_login_atを更新
    if status_update.status in [
        InstructorStatus.AVAILABLE,
        InstructorStatus.IN_SESSION,
    ]:
        db_instructor.last_login_at = now

    db.commit()
    db.refresh(db_instructor)
    return db_instructor


def get_instructor_status_history(
    db: Session, instructor_id: int, skip: int = 0, limit: int = 50
) -> List[InstructorStatusHistory]:
    """
    講師のステータス履歴を取得する
    """
    return (
        db.query(InstructorStatusHistory)
        .filter(InstructorStatusHistory.instructor_id == instructor_id)
        .order_by(desc(InstructorStatusHistory.started_at))
        .offset(skip)
        .limit(limit)
        .all()
    )


def delete_instructor(db: Session, instructor_id: int) -> bool:
    """
    講師を削除する（論理削除：is_activeをFalseに設定）
    """
    db_instructor = db.query(Instructor).filter(Instructor.id == instructor_id).first()
    if not db_instructor:
        return False

    db_instructor.is_active = False
    db.commit()
    return True


def authenticate_instructor(
    db: Session, email: str, password: str
) -> Optional[Instructor]:
    """
    講師の認証を行う
    """
    instructor = get_instructor_by_email(db, email=email)
    if not instructor:
        return None
    if not instructor.is_active:
        return None
    if not verify_password(password, instructor.password_hash):
        return None
    return instructor
