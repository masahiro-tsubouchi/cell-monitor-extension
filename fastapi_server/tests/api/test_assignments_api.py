import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from main import app
from schemas.lms import ClassAssignmentCreate, ClassAssignmentUpdate


def create_test_class_and_notebook(client: TestClient):
    """テスト用のClassとNotebookを作成するヘルパー関数"""
    from db.session import SessionLocal
    from db.models import Notebook

    # テスト用のクラスを作成
    class_data = {
        "class_code": "CS201",
        "name": "Advanced Programming",
        "description": "Advanced programming concepts",
    }
    class_response = client.post("/api/v1/classes", json=class_data)
    assert class_response.status_code == 201
    class_id = class_response.json()["id"]

    # テスト用のNotebookを作成
    db = SessionLocal()
    try:
        # 既存のNotebookがあるかチェック
        existing_notebook = db.query(Notebook).first()
        if existing_notebook:
            notebook_id = existing_notebook.id
        else:
            # 新しいNotebookを作成
            test_notebook = Notebook(name="Test Notebook", path="/test/notebook.ipynb")
            db.add(test_notebook)
            db.commit()
            db.refresh(test_notebook)
            notebook_id = test_notebook.id
    finally:
        db.close()

    return class_id, notebook_id


def test_create_assignment_api(client: TestClient):
    """課題作成APIのテスト"""
    class_id, notebook_id = create_test_class_and_notebook(client)

    assignment_data = {
        "class_id": class_id,
        "notebook_id": notebook_id,
        "title": "Python Basics Assignment",
        "description": "Complete the Python programming exercises",
        "points": 100.0,
    }

    response = client.post("/api/v1/assignments", json=assignment_data)

    assert response.status_code == 201
    data = response.json()
    assert data["class_id"] == assignment_data["class_id"]
    assert data["notebook_id"] == assignment_data["notebook_id"]
    assert data["title"] == assignment_data["title"]
    assert data["description"] == assignment_data["description"]
    assert data["points"] == assignment_data["points"]
    assert "id" in data
    assert "created_at" in data


def test_get_assignment_api(client: TestClient):
    """課題取得APIのテスト"""
    class_id, notebook_id = create_test_class_and_notebook(client)

    # まず課題を作成
    assignment_data = {
        "class_id": class_id,
        "notebook_id": notebook_id,
        "title": "Data Structures Assignment",
        "description": "Implement various data structures",
        "points": 150.0,
    }
    create_response = client.post("/api/v1/assignments", json=assignment_data)
    created_assignment = create_response.json()
    assignment_id = created_assignment["id"]

    # 作成した課題を取得
    response = client.get(f"/api/v1/assignments/{assignment_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == assignment_id
    assert data["class_id"] == assignment_data["class_id"]
    assert data["notebook_id"] == assignment_data["notebook_id"]
    assert data["title"] == assignment_data["title"]
    assert data["description"] == assignment_data["description"]
    assert data["points"] == assignment_data["points"]


def test_get_assignment_not_found_api(client: TestClient):
    """存在しない課題取得APIのテスト"""
    non_existent_id = 99999

    response = client.get(f"/api/v1/assignments/{non_existent_id}")

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data


def test_list_assignments_api(client: TestClient):
    """課題一覧取得APIのテスト"""
    class_id, notebook_id = create_test_class_and_notebook(client)

    # テスト用の課題を複数作成
    assignments_data = [
        {
            "class_id": class_id,
            "notebook_id": notebook_id,
            "title": "Assignment 1",
            "description": "First assignment",
            "points": 50.0,
        },
        {
            "class_id": class_id,
            "notebook_id": notebook_id,
            "title": "Assignment 2",
            "description": "Second assignment",
            "points": 75.0,
        },
    ]

    created_assignments = []
    for assignment_data in assignments_data:
        response = client.post("/api/v1/assignments", json=assignment_data)
        created_assignments.append(response.json())

    # 課題一覧を取得
    response = client.get("/api/v1/assignments")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 2  # 少なくとも作成した2つの課題が含まれる

    # 作成した課題が含まれていることを確認
    assignment_titles = [assignment["title"] for assignment in data]
    assert "Assignment 1" in assignment_titles
    assert "Assignment 2" in assignment_titles


def test_update_assignment_api(client: TestClient):
    """課題更新APIのテスト"""
    class_id, notebook_id = create_test_class_and_notebook(client)

    # まず課題を作成
    assignment_data = {
        "class_id": class_id,
        "notebook_id": notebook_id,
        "title": "Original Assignment",
        "description": "Original description",
        "points": 100.0,
    }
    create_response = client.post("/api/v1/assignments", json=assignment_data)
    created_assignment = create_response.json()
    assignment_id = created_assignment["id"]

    # 課題を更新
    update_data = {
        "title": "Updated Assignment",
        "description": "Updated description with more details",
        "points": 120.0,
    }

    response = client.put(f"/api/v1/assignments/{assignment_id}", json=update_data)

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == assignment_id
    assert data["title"] == update_data["title"]
    assert data["description"] == update_data["description"]
    assert data["points"] == update_data["points"]
    assert data["class_id"] == assignment_data["class_id"]  # 未更新フィールドは保持
    assert (
        data["notebook_id"] == assignment_data["notebook_id"]
    )  # 未更新フィールドは保持


def test_update_assignment_partial_api(client: TestClient):
    """課題部分更新APIのテスト"""
    class_id, notebook_id = create_test_class_and_notebook(client)

    # まず課題を作成
    assignment_data = {
        "class_id": class_id,
        "notebook_id": notebook_id,
        "title": "Partial Update Test",
        "description": "Original description",
        "points": 80.0,
    }
    create_response = client.post("/api/v1/assignments", json=assignment_data)
    created_assignment = create_response.json()
    assignment_id = created_assignment["id"]

    # タイトルのみ更新
    update_data = {"title": "Partially Updated Assignment"}

    response = client.put(f"/api/v1/assignments/{assignment_id}", json=update_data)

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == update_data["title"]
    assert data["description"] == assignment_data["description"]  # 元の値を保持
    assert data["points"] == assignment_data["points"]  # 元の値を保持


def test_update_assignment_not_found_api(client: TestClient):
    """存在しない課題更新APIのテスト"""
    non_existent_id = 99999
    update_data = {"title": "Updated Title"}

    response = client.put(f"/api/v1/assignments/{non_existent_id}", json=update_data)

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data


def test_delete_assignment_api(client: TestClient):
    """課題削除APIのテスト"""
    class_id, notebook_id = create_test_class_and_notebook(client)

    # まず課題を作成
    assignment_data = {
        "class_id": class_id,
        "notebook_id": notebook_id,
        "title": "Assignment to Delete",
        "description": "This assignment will be deleted",
        "points": 60.0,
    }
    create_response = client.post("/api/v1/assignments", json=assignment_data)
    created_assignment = create_response.json()
    assignment_id = created_assignment["id"]

    # 課題を削除
    response = client.delete(f"/api/v1/assignments/{assignment_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == assignment_id

    # 削除後、取得できないことを確認
    get_response = client.get(f"/api/v1/assignments/{assignment_id}")
    assert get_response.status_code == 404


def test_delete_assignment_not_found_api(client: TestClient):
    """存在しない課題削除APIのテスト"""
    non_existent_id = 99999

    response = client.delete(f"/api/v1/assignments/{non_existent_id}")

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data


def test_create_assignment_validation_error_api(client: TestClient):
    """課題作成時のバリデーションエラーテスト"""
    # 必須フィールドが不足したデータ
    invalid_data = {"description": "Missing required fields"}

    response = client.post("/api/v1/assignments", json=invalid_data)

    assert response.status_code == 422
    data = response.json()
    assert "detail" in data


def test_list_assignments_by_class_api(client: TestClient):
    """クラス別課題一覧取得APIのテスト"""
    class_id, notebook_id = create_test_class_and_notebook(client)

    # 特定のクラス用の課題を作成
    assignment_data = {
        "class_id": class_id,
        "notebook_id": notebook_id,
        "title": "Class Specific Assignment",
        "description": "Assignment for specific class",
        "points": 90.0,
    }
    create_response = client.post("/api/v1/assignments", json=assignment_data)
    assert create_response.status_code == 201

    # クラス別課題一覧を取得
    response = client.get(f"/api/v1/assignments?class_id={class_id}")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

    # 全ての課題が指定されたクラスに属していることを確認
    for assignment in data:
        assert assignment["class_id"] == class_id
