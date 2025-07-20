from sqlalchemy.orm import Session
import pytest
from datetime import datetime, timezone

from crud import crud_class_assignment
from crud import crud_class
from schemas.lms import ClassAssignmentCreate, ClassAssignmentUpdate, ClassCreate
from db.models import Notebook


def create_test_class_and_notebook(db_session: Session, class_code: str = "CS101"):
    """
    テスト用のクラスとノートブックを作成するヘルパー関数
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

    return created_class.id, notebook.id


def test_create_class_assignment(db_session: Session):
    class_id, notebook_id = create_test_class_and_notebook(db_session, "CS101")
    title = "Python Basics Assignment"
    description = "Complete the Python fundamentals exercises."
    points = 100.0

    assignment_in = ClassAssignmentCreate(
        class_id=class_id,
        notebook_id=notebook_id,
        title=title,
        description=description,
        points=points,
    )
    db_assignment = crud_class_assignment.create_class_assignment(
        db=db_session, assignment_in=assignment_in
    )

    assert db_assignment is not None
    assert db_assignment.class_id == class_id
    assert db_assignment.notebook_id == notebook_id
    assert db_assignment.title == title
    assert db_assignment.description == description
    assert db_assignment.points == points
    assert db_assignment.id is not None


def test_get_class_assignment(db_session: Session):
    class_id, notebook_id = create_test_class_and_notebook(db_session, "CS102")
    title = "Data Analysis Assignment"
    description = "Analyze the provided dataset."

    assignment_in = ClassAssignmentCreate(
        class_id=class_id, notebook_id=notebook_id, title=title, description=description
    )
    created_assignment = crud_class_assignment.create_class_assignment(
        db=db_session, assignment_in=assignment_in
    )

    # 作成した課題を取得
    retrieved_assignment = crud_class_assignment.get_class_assignment(
        db=db_session, assignment_id=created_assignment.id
    )

    assert retrieved_assignment is not None
    assert retrieved_assignment.id == created_assignment.id
    assert retrieved_assignment.class_id == class_id
    assert retrieved_assignment.notebook_id == notebook_id
    assert retrieved_assignment.title == title
    assert retrieved_assignment.description == description


def test_get_class_assignment_not_found(db_session: Session):
    # 存在しないIDで課題を取得しようとする
    non_existent_id = 99999
    retrieved_assignment = crud_class_assignment.get_class_assignment(
        db=db_session, assignment_id=non_existent_id
    )

    assert retrieved_assignment is None


def test_update_class_assignment(db_session: Session):
    class_id, notebook_id = create_test_class_and_notebook(db_session, "CS103")
    title = "Machine Learning Assignment"
    description = "Build a classification model."
    points = 150.0

    assignment_in = ClassAssignmentCreate(
        class_id=class_id,
        notebook_id=notebook_id,
        title=title,
        description=description,
        points=points,
    )
    created_assignment = crud_class_assignment.create_class_assignment(
        db=db_session, assignment_in=assignment_in
    )

    # 課題を更新
    updated_title = "Advanced Machine Learning Assignment"
    updated_description = "Build and evaluate multiple ML models."
    updated_points = 200.0

    assignment_update = ClassAssignmentUpdate(
        title=updated_title, description=updated_description, points=updated_points
    )
    updated_assignment = crud_class_assignment.update_class_assignment(
        db=db_session,
        assignment_id=created_assignment.id,
        assignment_update=assignment_update,
    )

    assert updated_assignment is not None
    assert updated_assignment.id == created_assignment.id
    assert updated_assignment.title == updated_title
    assert updated_assignment.description == updated_description
    assert updated_assignment.points == updated_points
    assert updated_assignment.class_id == class_id  # 未更新のフィールドは変更なし
    assert updated_assignment.notebook_id == notebook_id  # 未更新のフィールドは変更なし


def test_update_class_assignment_partial(db_session: Session):
    class_id, notebook_id = create_test_class_and_notebook(db_session, "CS104")
    title = "Statistics Assignment"
    description = "Statistical analysis exercises."
    points = 80.0

    assignment_in = ClassAssignmentCreate(
        class_id=class_id,
        notebook_id=notebook_id,
        title=title,
        description=description,
        points=points,
    )
    created_assignment = crud_class_assignment.create_class_assignment(
        db=db_session, assignment_in=assignment_in
    )

    # タイトルのみ更新
    updated_title = "Advanced Statistics Assignment"

    assignment_update = ClassAssignmentUpdate(title=updated_title)
    updated_assignment = crud_class_assignment.update_class_assignment(
        db=db_session,
        assignment_id=created_assignment.id,
        assignment_update=assignment_update,
    )

    assert updated_assignment is not None
    assert updated_assignment.title == updated_title
    assert updated_assignment.description == description  # 元の値を保持
    assert updated_assignment.points == points  # 元の値を保持
    assert updated_assignment.class_id == class_id  # 元の値を保持


def test_update_class_assignment_not_found(db_session: Session):
    # 存在しない課題の更新を試みる
    non_existent_id = 99999
    assignment_update = ClassAssignmentUpdate(title="Updated Title")

    updated_assignment = crud_class_assignment.update_class_assignment(
        db=db_session,
        assignment_id=non_existent_id,
        assignment_update=assignment_update,
    )

    assert updated_assignment is None


def test_delete_class_assignment(db_session: Session):
    class_id, notebook_id = create_test_class_and_notebook(db_session, "CS105")
    title = "Web Development Assignment"
    description = "Create a web application."

    assignment_in = ClassAssignmentCreate(
        class_id=class_id, notebook_id=notebook_id, title=title, description=description
    )
    created_assignment = crud_class_assignment.create_class_assignment(
        db=db_session, assignment_in=assignment_in
    )

    # 課題を削除
    deleted_assignment = crud_class_assignment.delete_class_assignment(
        db=db_session, assignment_id=created_assignment.id
    )

    assert deleted_assignment is not None
    assert deleted_assignment.id == created_assignment.id

    # 削除後、取得できないことを確認
    retrieved_assignment = crud_class_assignment.get_class_assignment(
        db=db_session, assignment_id=created_assignment.id
    )
    assert retrieved_assignment is None


def test_delete_class_assignment_not_found(db_session: Session):
    # 存在しない課題の削除を試みる
    non_existent_id = 99999

    deleted_assignment = crud_class_assignment.delete_class_assignment(
        db=db_session, assignment_id=non_existent_id
    )

    assert deleted_assignment is None
