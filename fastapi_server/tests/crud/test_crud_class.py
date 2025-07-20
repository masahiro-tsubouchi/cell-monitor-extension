from sqlalchemy.orm import Session
import pytest

from crud import crud_class
from schemas.lms import ClassCreate, ClassUpdate


def test_create_class(db_session: Session):
    class_code = "CS101"
    name = "Introduction to Computer Science"
    description = "A foundational course in CS."

    class_in = ClassCreate(class_code=class_code, name=name, description=description)
    db_class = crud_class.create_class(db=db_session, class_in=class_in)

    assert db_class is not None
    assert db_class.class_code == class_code
    assert db_class.name == name
    assert db_class.description == description
    assert db_class.id is not None
    assert db_class.is_active is True


def test_get_class(db_session: Session):
    # まずクラスを作成
    class_code = "CS102"
    name = "Data Structures"
    description = "Advanced data structures and algorithms."

    class_in = ClassCreate(class_code=class_code, name=name, description=description)
    created_class = crud_class.create_class(db=db_session, class_in=class_in)

    # 作成したクラスを取得
    retrieved_class = crud_class.get_class(db=db_session, class_id=created_class.id)

    assert retrieved_class is not None
    assert retrieved_class.id == created_class.id
    assert retrieved_class.class_code == class_code
    assert retrieved_class.name == name
    assert retrieved_class.description == description


def test_get_class_not_found(db_session: Session):
    # 存在しないIDでクラスを取得しようとする
    non_existent_id = 99999
    retrieved_class = crud_class.get_class(db=db_session, class_id=non_existent_id)

    assert retrieved_class is None


def test_update_class(db_session: Session):
    # まずクラスを作成
    class_code = "CS103"
    name = "Algorithms"
    description = "Introduction to algorithms."

    class_in = ClassCreate(class_code=class_code, name=name, description=description)
    created_class = crud_class.create_class(db=db_session, class_in=class_in)

    # クラスを更新
    updated_name = "Advanced Algorithms"
    updated_description = "Advanced algorithmic techniques and analysis."

    class_update = ClassUpdate(name=updated_name, description=updated_description)
    updated_class = crud_class.update_class(
        db=db_session, class_id=created_class.id, class_update=class_update
    )

    assert updated_class is not None
    assert updated_class.id == created_class.id
    assert updated_class.name == updated_name
    assert updated_class.description == updated_description
    assert updated_class.class_code == class_code  # 未更新のフィールドは変更なし
    assert updated_class.is_active is True


def test_update_class_partial(db_session: Session):
    # 部分更新のテスト
    class_code = "CS104"
    name = "Database Systems"
    description = "Introduction to databases."

    class_in = ClassCreate(class_code=class_code, name=name, description=description)
    created_class = crud_class.create_class(db=db_session, class_in=class_in)

    # 名前のみ更新
    updated_name = "Advanced Database Systems"

    class_update = ClassUpdate(name=updated_name)
    updated_class = crud_class.update_class(
        db=db_session, class_id=created_class.id, class_update=class_update
    )

    assert updated_class is not None
    assert updated_class.name == updated_name
    assert updated_class.description == description  # 元の値を保持
    assert updated_class.class_code == class_code  # 元の値を保持


def test_update_class_not_found(db_session: Session):
    # 存在しないクラスの更新を試みる
    non_existent_id = 99999
    class_update = ClassUpdate(name="Updated Name")

    updated_class = crud_class.update_class(
        db=db_session, class_id=non_existent_id, class_update=class_update
    )

    assert updated_class is None


def test_delete_class(db_session: Session):
    # まずクラスを作成
    class_code = "CS105"
    name = "Software Engineering"
    description = "Principles of software engineering."

    class_in = ClassCreate(class_code=class_code, name=name, description=description)
    created_class = crud_class.create_class(db=db_session, class_in=class_in)

    # クラスを削除
    deleted_class = crud_class.delete_class(db=db_session, class_id=created_class.id)

    assert deleted_class is not None
    assert deleted_class.id == created_class.id

    # 削除後、取得できないことを確認
    retrieved_class = crud_class.get_class(db=db_session, class_id=created_class.id)
    assert retrieved_class is None


def test_delete_class_not_found(db_session: Session):
    # 存在しないクラスの削除を試みる
    non_existent_id = 99999

    deleted_class = crud_class.delete_class(db=db_session, class_id=non_existent_id)

    assert deleted_class is None
