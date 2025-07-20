from sqlalchemy.orm import Session
import pytest
from datetime import datetime, timezone

from crud import crud_assignment_submission
from crud import crud_class, crud_class_assignment
from schemas.lms import (
    AssignmentSubmissionCreate,
    AssignmentSubmissionUpdate,
    ClassCreate,
    ClassAssignmentCreate,
)
from db.models import Notebook, Student


def create_test_assignment_and_student(db_session: Session, class_code: str = "CS101"):
    """
    テスト用のクラス課題と学生を作成するヘルパー関数
    """
    # テスト用のクラスを作成
    class_in = ClassCreate(
        class_code=class_code,
        name="Introduction to Computer Science",
        description="Basic CS course",
    )
    created_class = crud_class.create_class(db=db_session, class_in=class_in)

    # テスト用のノートブックを作成
    notebook = Notebook(
        path=f"/notebooks/{class_code.lower()}_notebook.ipynb",
        name=f"{class_code} Notebook",
    )
    db_session.add(notebook)
    db_session.commit()
    db_session.refresh(notebook)

    # テスト用のクラス課題を作成
    assignment_in = ClassAssignmentCreate(
        class_id=created_class.id,
        notebook_id=notebook.id,
        title=f"{class_code} Assignment",
        description=f"Assignment for {class_code}",
        points=100.0,
    )
    created_assignment = crud_class_assignment.create_class_assignment(
        db=db_session, assignment_in=assignment_in
    )

    # テスト用の学生を作成
    student = Student(
        user_id=f"student_{class_code.lower()}",
        name=f"Test Student {class_code}",
        email=f"student_{class_code.lower()}@example.com",
    )
    db_session.add(student)
    db_session.commit()
    db_session.refresh(student)

    return created_assignment.id, student.id


def test_create_assignment_submission(db_session: Session):
    assignment_id, student_id = create_test_assignment_and_student(db_session, "CS101")

    status = "submitted"

    submission_in = AssignmentSubmissionCreate(
        assignment_id=assignment_id, student_id=student_id, status=status
    )
    db_submission = crud_assignment_submission.create_assignment_submission(
        db=db_session, submission_in=submission_in
    )

    assert db_submission is not None
    assert db_submission.assignment_id == assignment_id
    assert db_submission.student_id == student_id
    assert db_submission.status == status
    assert db_submission.id is not None
    assert db_submission.submitted_at is not None


def test_get_assignment_submission(db_session: Session):
    assignment_id, student_id = create_test_assignment_and_student(db_session, "CS102")

    status = "submitted"

    submission_in = AssignmentSubmissionCreate(
        assignment_id=assignment_id, student_id=student_id, status=status
    )
    created_submission = crud_assignment_submission.create_assignment_submission(
        db=db_session, submission_in=submission_in
    )

    # 作成した提出を取得
    retrieved_submission = crud_assignment_submission.get_assignment_submission(
        db=db_session, submission_id=created_submission.id
    )

    assert retrieved_submission is not None
    assert retrieved_submission.id == created_submission.id
    assert retrieved_submission.assignment_id == assignment_id
    assert retrieved_submission.student_id == student_id
    assert retrieved_submission.status == status


def test_get_assignment_submission_not_found(db_session: Session):
    # 存在しないIDで提出を取得しようとする
    non_existent_id = 99999
    retrieved_submission = crud_assignment_submission.get_assignment_submission(
        db=db_session, submission_id=non_existent_id
    )

    assert retrieved_submission is None


def test_update_assignment_submission(db_session: Session):
    assignment_id, student_id = create_test_assignment_and_student(db_session, "CS103")

    status = "submitted"

    submission_in = AssignmentSubmissionCreate(
        assignment_id=assignment_id, student_id=student_id, status=status
    )
    created_submission = crud_assignment_submission.create_assignment_submission(
        db=db_session, submission_in=submission_in
    )

    # 提出を更新（採点）
    updated_status = "graded"
    updated_grade = 85.5
    updated_feedback = "Good work! Consider improving the algorithm efficiency."

    submission_update = AssignmentSubmissionUpdate(
        status=updated_status, grade=updated_grade, feedback=updated_feedback
    )
    updated_submission = crud_assignment_submission.update_assignment_submission(
        db=db_session,
        submission_id=created_submission.id,
        submission_update=submission_update,
    )

    assert updated_submission is not None
    assert updated_submission.id == created_submission.id
    assert updated_submission.status == updated_status
    assert updated_submission.grade == updated_grade
    assert updated_submission.feedback == updated_feedback
    assert (
        updated_submission.assignment_id == assignment_id
    )  # 未更新のフィールドは変更なし
    assert updated_submission.student_id == student_id  # 未更新のフィールドは変更なし


def test_update_assignment_submission_partial(db_session: Session):
    # 部分更新のテスト
    assignment_id, student_id = create_test_assignment_and_student(db_session, "CS104")

    status = "submitted"

    submission_in = AssignmentSubmissionCreate(
        assignment_id=assignment_id, student_id=student_id, status=status
    )
    created_submission = crud_assignment_submission.create_assignment_submission(
        db=db_session, submission_in=submission_in
    )

    # 成績のみ更新
    updated_grade = 92.0

    submission_update = AssignmentSubmissionUpdate(grade=updated_grade)
    updated_submission = crud_assignment_submission.update_assignment_submission(
        db=db_session,
        submission_id=created_submission.id,
        submission_update=submission_update,
    )

    assert updated_submission is not None
    assert updated_submission.grade == updated_grade
    assert updated_submission.status == status  # 元の値を保持
    assert updated_submission.feedback is None  # 元の値を保持
    assert updated_submission.assignment_id == assignment_id  # 元の値を保持


def test_update_assignment_submission_not_found(db_session: Session):
    # 存在しない提出の更新を試みる
    non_existent_id = 99999
    submission_update = AssignmentSubmissionUpdate(grade=100.0)

    updated_submission = crud_assignment_submission.update_assignment_submission(
        db=db_session,
        submission_id=non_existent_id,
        submission_update=submission_update,
    )

    assert updated_submission is None


def test_delete_assignment_submission(db_session: Session):
    assignment_id, student_id = create_test_assignment_and_student(db_session, "CS105")

    status = "submitted"

    submission_in = AssignmentSubmissionCreate(
        assignment_id=assignment_id, student_id=student_id, status=status
    )
    created_submission = crud_assignment_submission.create_assignment_submission(
        db=db_session, submission_in=submission_in
    )

    # 提出を削除
    deleted_submission = crud_assignment_submission.delete_assignment_submission(
        db=db_session, submission_id=created_submission.id
    )

    assert deleted_submission is not None
    assert deleted_submission.id == created_submission.id

    # 削除後、取得できないことを確認
    retrieved_submission = crud_assignment_submission.get_assignment_submission(
        db=db_session, submission_id=created_submission.id
    )
    assert retrieved_submission is None


def test_delete_assignment_submission_not_found(db_session: Session):
    # 存在しない提出の削除を試みる
    non_existent_id = 99999

    deleted_submission = crud_assignment_submission.delete_assignment_submission(
        db=db_session, submission_id=non_existent_id
    )

    assert deleted_submission is None
