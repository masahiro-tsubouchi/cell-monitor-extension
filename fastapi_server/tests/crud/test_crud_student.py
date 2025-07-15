import pytest
from sqlalchemy.orm import Session

from crud import crud_student
from schemas.student import StudentCreate


def test_create_student(db_session: Session):
    user_id = "test_user_01"
    student_in = StudentCreate(user_id=user_id)
    db_student = crud_student.create_student(db=db_session, student=student_in)
    
    assert db_student is not None
    assert db_student.user_id == user_id
    assert db_student.id is not None


def test_get_student_by_user_id(db_session: Session):
    user_id = "test_user_02"
    student_in = StudentCreate(user_id=user_id)
    crud_student.create_student(db=db_session, student=student_in)
    
    retrieved_student = crud_student.get_student_by_user_id(db=db_session, user_id=user_id)
    assert retrieved_student is not None
    assert retrieved_student.user_id == user_id

    # 存在しないユーザーを取得しようとする
    retrieved_student_none = crud_student.get_student_by_user_id(db=db_session, user_id="non_existent_user")
    assert retrieved_student_none is None


def test_get_or_create_student(db_session: Session):
    user_id = "test_user_03"
    
    # 1. ユーザーが存在しない場合、新規作成されることを確認
    student_1 = crud_student.get_or_create_student(db=db_session, user_id=user_id)
    assert student_1.user_id == user_id
    assert student_1.id is not None
    
    # 2. ユーザーが既に存在する場合、既存のユーザーが返されることを確認
    student_2 = crud_student.get_or_create_student(db=db_session, user_id=user_id)
    assert student_2.id == student_1.id
    assert student_2.user_id == user_id
