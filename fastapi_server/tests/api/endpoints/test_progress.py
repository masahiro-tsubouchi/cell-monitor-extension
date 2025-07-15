import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from crud import crud_student


def test_receive_progress_new_user(client: TestClient, db_session: Session):
    user_id = "api_test_user_01"
    
    # 事前にユーザーが存在しないことを確認
    assert crud_student.get_student_by_user_id(db=db_session, user_id=user_id) is None
    
    payload = {
        "userId": user_id,
        "notebookPath": "/path/to/notebook.ipynb",
        "event": "cell_executed",
        "timestamp": "2024-01-01T12:00:00Z"
    }
    
    response = client.post("/api/progress/student-progress", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["processed_user_id"] == user_id
    
    # DBにユーザーが作成されたことを確認
    db_student = crud_student.get_student_by_user_id(db=db_session, user_id=user_id)
    assert db_student is not None
    assert db_student.user_id == user_id


def test_receive_progress_existing_user(client: TestClient, db_session: Session):
    user_id = "api_test_user_02"
    
    # 事前にユーザーを作成しておく
    existing_student = crud_student.get_or_create_student(db=db_session, user_id=user_id)
    
    payload = {
        "userId": user_id,
        "notebookPath": "/path/to/another_notebook.ipynb",
        "event": "notebook_saved",
        "timestamp": "2024-01-01T13:00:00Z"
    }
    
    response = client.post("/api/progress/student-progress", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data["processed_user_id"] == user_id
    
    # DBのユーザーIDが変わっていないことを確認
    db_student = crud_student.get_student_by_user_id(db=db_session, user_id=user_id)
    assert db_student.id == existing_student.id
