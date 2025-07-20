import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from main import app
from schemas.lms import ClassCreate, ClassUpdate


def test_create_class_api(client: TestClient):
    """クラス作成APIのテスト"""
    class_data = {
        "class_code": "CS101",
        "name": "Introduction to Computer Science",
        "description": "Basic CS course",
    }

    response = client.post("/api/v1/classes", json=class_data)

    assert response.status_code == 201
    data = response.json()
    assert data["class_code"] == class_data["class_code"]
    assert data["name"] == class_data["name"]
    assert data["description"] == class_data["description"]
    assert data["is_active"] is True
    assert "id" in data
    assert "created_at" in data


def test_get_class_api(client: TestClient):
    """クラス取得APIのテスト"""
    # まずクラスを作成
    class_data = {
        "class_code": "CS102",
        "name": "Data Structures",
        "description": "Advanced data structures",
    }
    create_response = client.post("/api/v1/classes", json=class_data)
    created_class = create_response.json()
    class_id = created_class["id"]

    # 作成したクラスを取得
    response = client.get(f"/api/v1/classes/{class_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == class_id
    assert data["class_code"] == class_data["class_code"]
    assert data["name"] == class_data["name"]
    assert data["description"] == class_data["description"]


def test_get_class_not_found_api(client: TestClient):
    """存在しないクラス取得APIのテスト"""
    non_existent_id = 99999

    response = client.get(f"/api/v1/classes/{non_existent_id}")

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data


def test_list_classes_api(client: TestClient):
    """クラス一覧取得APIのテスト"""
    # テスト用のクラスを複数作成
    classes_data = [
        {
            "class_code": "CS103",
            "name": "Algorithms",
            "description": "Algorithm design and analysis",
        },
        {
            "class_code": "CS104",
            "name": "Database Systems",
            "description": "Database design and implementation",
        },
    ]

    created_classes = []
    for class_data in classes_data:
        response = client.post("/api/v1/classes", json=class_data)
        created_classes.append(response.json())

    # クラス一覧を取得
    response = client.get("/api/v1/classes")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 2  # 少なくとも作成した2つのクラスが含まれる

    # 作成したクラスが含まれていることを確認
    class_codes = [cls["class_code"] for cls in data]
    assert "CS103" in class_codes
    assert "CS104" in class_codes


def test_update_class_api(client: TestClient):
    """クラス更新APIのテスト"""
    # まずクラスを作成
    class_data = {
        "class_code": "CS105",
        "name": "Software Engineering",
        "description": "Software development principles",
    }
    create_response = client.post("/api/v1/classes", json=class_data)
    created_class = create_response.json()
    class_id = created_class["id"]

    # クラスを更新
    update_data = {
        "name": "Advanced Software Engineering",
        "description": "Advanced software development and architecture",
    }

    response = client.put(f"/api/v1/classes/{class_id}", json=update_data)

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == class_id
    assert data["name"] == update_data["name"]
    assert data["description"] == update_data["description"]
    assert data["class_code"] == class_data["class_code"]  # 未更新フィールドは保持


def test_update_class_partial_api(client: TestClient):
    """クラス部分更新APIのテスト"""
    # まずクラスを作成
    class_data = {
        "class_code": "CS106",
        "name": "Machine Learning",
        "description": "Introduction to ML",
    }
    create_response = client.post("/api/v1/classes", json=class_data)
    created_class = create_response.json()
    class_id = created_class["id"]

    # 名前のみ更新
    update_data = {"name": "Advanced Machine Learning"}

    response = client.put(f"/api/v1/classes/{class_id}", json=update_data)

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == update_data["name"]
    assert data["description"] == class_data["description"]  # 元の値を保持
    assert data["class_code"] == class_data["class_code"]  # 元の値を保持


def test_update_class_not_found_api(client: TestClient):
    """存在しないクラス更新APIのテスト"""
    non_existent_id = 99999
    update_data = {"name": "Updated Name"}

    response = client.put(f"/api/v1/classes/{non_existent_id}", json=update_data)

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data


def test_delete_class_api(client: TestClient):
    """クラス削除APIのテスト"""
    # まずクラスを作成
    class_data = {
        "class_code": "CS107",
        "name": "Web Development",
        "description": "Full-stack web development",
    }
    create_response = client.post("/api/v1/classes", json=class_data)
    created_class = create_response.json()
    class_id = created_class["id"]

    # クラスを削除
    response = client.delete(f"/api/v1/classes/{class_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == class_id

    # 削除後、取得できないことを確認
    get_response = client.get(f"/api/v1/classes/{class_id}")
    assert get_response.status_code == 404


def test_delete_class_not_found_api(client: TestClient):
    """存在しないクラス削除APIのテスト"""
    non_existent_id = 99999

    response = client.delete(f"/api/v1/classes/{non_existent_id}")

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data


def test_create_class_validation_error_api(client: TestClient):
    """クラス作成時のバリデーションエラーテスト"""
    # 必須フィールドが不足したデータ
    invalid_data = {"description": "Missing required fields"}

    response = client.post("/api/v1/classes", json=invalid_data)

    assert response.status_code == 422
    data = response.json()
    assert "detail" in data


def test_create_class_duplicate_code_api(client: TestClient):
    """重複するクラスコード作成のテスト"""
    class_data = {
        "class_code": "CS108",
        "name": "Test Class",
        "description": "Test description",
    }

    # 最初のクラスを作成
    response1 = client.post("/api/v1/classes", json=class_data)
    assert response1.status_code == 201

    # 同じクラスコードで再度作成を試みる
    response2 = client.post("/api/v1/classes", json=class_data)
    assert response2.status_code == 400
    data = response2.json()
    assert "detail" in data
