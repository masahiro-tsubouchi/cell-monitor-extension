import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from main import app
from schemas.lms import AssignmentSubmissionCreate, AssignmentSubmissionUpdate


def create_test_assignment_and_student(client: TestClient):
    """テスト用のAssignmentとStudentを作成するヘルパー関数"""
    from db.session import SessionLocal
    from db.models import Notebook, Student

    # テスト用のクラスを作成
    class_data = {
        "class_code": "CS301",
        "name": "Software Engineering",
        "description": "Software engineering principles",
    }
    class_response = client.post("/api/v1/classes", json=class_data)
    assert class_response.status_code == 201
    class_id = class_response.json()["id"]

    # テスト用のNotebookとAssignmentを作成
    db = SessionLocal()
    try:
        # 既存のNotebookがあるかチェック
        existing_notebook = db.query(Notebook).first()
        if existing_notebook:
            notebook_id = existing_notebook.id
        else:
            # 新しいNotebookを作成
            test_notebook = Notebook(
                name="Submission Test Notebook", path="/test/submission_notebook.ipynb"
            )
            db.add(test_notebook)
            db.commit()
            db.refresh(test_notebook)
            notebook_id = test_notebook.id

        # 既存のStudentがあるかチェック
        existing_student = db.query(Student).first()
        if existing_student:
            student_id = existing_student.id
        else:
            # 新しいStudentを作成
            test_student = Student(
                user_id="S2024001",
                name="Test Student",
                email="test.student@example.com",
            )
            db.add(test_student)
            db.commit()
            db.refresh(test_student)
            student_id = test_student.id

    finally:
        db.close()

    # テスト用のAssignmentを作成
    assignment_data = {
        "class_id": class_id,
        "notebook_id": notebook_id,
        "title": "Submission Test Assignment",
        "description": "Assignment for testing submissions",
        "points": 100.0,
    }
    assignment_response = client.post("/api/v1/assignments", json=assignment_data)
    assert assignment_response.status_code == 201
    assignment_id = assignment_response.json()["id"]

    return assignment_id, student_id


def test_create_submission_api(client: TestClient):
    """提出作成APIのテスト"""
    assignment_id, student_id = create_test_assignment_and_student(client)

    submission_data = {
        "assignment_id": assignment_id,
        "student_id": student_id,
        "status": "submitted",
    }

    response = client.post("/api/v1/submissions", json=submission_data)

    assert response.status_code == 201
    data = response.json()
    assert data["assignment_id"] == submission_data["assignment_id"]
    assert data["student_id"] == submission_data["student_id"]
    assert data["status"] == submission_data["status"]
    assert "id" in data
    assert "submitted_at" in data


def test_get_submission_api(client: TestClient):
    """提出取得APIのテスト"""
    assignment_id, student_id = create_test_assignment_and_student(client)

    # まず提出を作成
    submission_data = {
        "assignment_id": assignment_id,
        "student_id": student_id,
        "status": "submitted",
        "grade": 85.0,
        "feedback": "Good work!",
    }
    create_response = client.post("/api/v1/submissions", json=submission_data)
    created_submission = create_response.json()
    submission_id = created_submission["id"]

    # 作成した提出を取得
    response = client.get(f"/api/v1/submissions/{submission_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == submission_id
    assert data["assignment_id"] == submission_data["assignment_id"]
    assert data["student_id"] == submission_data["student_id"]
    assert data["status"] == submission_data["status"]
    assert data["grade"] == submission_data["grade"]
    assert data["feedback"] == submission_data["feedback"]


def test_get_submission_not_found_api(client: TestClient):
    """存在しない提出取得APIのテスト"""
    non_existent_id = 99999

    response = client.get(f"/api/v1/submissions/{non_existent_id}")

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data


def test_list_submissions_api(client: TestClient):
    """提出一覧取得APIのテスト"""
    assignment_id, student_id = create_test_assignment_and_student(client)

    # テスト用の提出を複数作成
    submissions_data = [
        {
            "assignment_id": assignment_id,
            "student_id": student_id,
            "status": "submitted",
            "grade": 90.0,
        },
        {
            "assignment_id": assignment_id,
            "student_id": student_id,
            "status": "graded",
            "grade": 85.0,
        },
    ]

    created_submissions = []
    for submission_data in submissions_data:
        response = client.post("/api/v1/submissions", json=submission_data)
        created_submissions.append(response.json())

    # 提出一覧を取得
    response = client.get("/api/v1/submissions")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 2  # 少なくとも作成した2つの提出が含まれる


def test_update_submission_api(client: TestClient):
    """提出更新APIのテスト"""
    assignment_id, student_id = create_test_assignment_and_student(client)

    # まず提出を作成
    submission_data = {
        "assignment_id": assignment_id,
        "student_id": student_id,
        "status": "submitted",
    }
    create_response = client.post("/api/v1/submissions", json=submission_data)
    created_submission = create_response.json()
    submission_id = created_submission["id"]

    # 提出を更新（採点）
    update_data = {
        "status": "graded",
        "grade": 92.0,
        "feedback": "Excellent work! Well structured code.",
    }

    response = client.put(f"/api/v1/submissions/{submission_id}", json=update_data)

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == submission_id
    assert data["status"] == update_data["status"]
    assert data["grade"] == update_data["grade"]
    assert data["feedback"] == update_data["feedback"]
    assert (
        data["assignment_id"] == submission_data["assignment_id"]
    )  # 未更新フィールドは保持
    assert data["student_id"] == submission_data["student_id"]  # 未更新フィールドは保持


def test_update_submission_partial_api(client: TestClient):
    """提出部分更新APIのテスト"""
    assignment_id, student_id = create_test_assignment_and_student(client)

    # まず提出を作成
    submission_data = {
        "assignment_id": assignment_id,
        "student_id": student_id,
        "status": "submitted",
        "grade": 80.0,
        "feedback": "Initial feedback",
    }
    create_response = client.post("/api/v1/submissions", json=submission_data)
    created_submission = create_response.json()
    submission_id = created_submission["id"]

    # 成績のみ更新
    update_data = {"grade": 88.0}

    response = client.put(f"/api/v1/submissions/{submission_id}", json=update_data)

    assert response.status_code == 200
    data = response.json()
    assert data["grade"] == update_data["grade"]
    assert data["status"] == submission_data["status"]  # 元の値を保持
    assert data["feedback"] == submission_data["feedback"]  # 元の値を保持


def test_update_submission_not_found_api(client: TestClient):
    """存在しない提出更新APIのテスト"""
    non_existent_id = 99999
    update_data = {"grade": 95.0}

    response = client.put(f"/api/v1/submissions/{non_existent_id}", json=update_data)

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data


def test_delete_submission_api(client: TestClient):
    """提出削除APIのテスト"""
    assignment_id, student_id = create_test_assignment_and_student(client)

    # まず提出を作成
    submission_data = {
        "assignment_id": assignment_id,
        "student_id": student_id,
        "status": "submitted",
    }
    create_response = client.post("/api/v1/submissions", json=submission_data)
    created_submission = create_response.json()
    submission_id = created_submission["id"]

    # 提出を削除
    response = client.delete(f"/api/v1/submissions/{submission_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == submission_id

    # 削除後、取得できないことを確認
    get_response = client.get(f"/api/v1/submissions/{submission_id}")
    assert get_response.status_code == 404


def test_delete_submission_not_found_api(client: TestClient):
    """存在しない提出削除APIのテスト"""
    non_existent_id = 99999

    response = client.delete(f"/api/v1/submissions/{non_existent_id}")

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data


def test_create_submission_validation_error_api(client: TestClient):
    """提出作成時のバリデーションエラーテスト"""
    # 必須フィールドが不足したデータ
    invalid_data = {"status": "submitted"}

    response = client.post("/api/v1/submissions", json=invalid_data)

    assert response.status_code == 422
    data = response.json()
    assert "detail" in data


def test_list_submissions_by_assignment_api(client: TestClient):
    """課題別提出一覧取得APIのテスト"""
    assignment_id, student_id = create_test_assignment_and_student(client)

    # 特定の課題用の提出を作成
    submission_data = {
        "assignment_id": assignment_id,
        "student_id": student_id,
        "status": "submitted",
        "grade": 87.0,
    }
    create_response = client.post("/api/v1/submissions", json=submission_data)
    assert create_response.status_code == 201

    # 課題別提出一覧を取得
    response = client.get(f"/api/v1/submissions?assignment_id={assignment_id}")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

    # 全ての提出が指定された課題に属していることを確認
    for submission in data:
        assert submission["assignment_id"] == assignment_id


def test_list_submissions_by_student_api(client: TestClient):
    """学生別提出一覧取得APIのテスト"""
    assignment_id, student_id = create_test_assignment_and_student(client)

    # 特定の学生の提出を作成
    submission_data = {
        "assignment_id": assignment_id,
        "student_id": student_id,
        "status": "submitted",
        "grade": 91.0,
    }
    create_response = client.post("/api/v1/submissions", json=submission_data)
    assert create_response.status_code == 201

    # 学生別提出一覧を取得
    response = client.get(f"/api/v1/submissions?student_id={student_id}")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

    # 全ての提出が指定された学生に属していることを確認
    for submission in data:
        assert submission["student_id"] == student_id
