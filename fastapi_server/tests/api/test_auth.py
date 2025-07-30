import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from main import app
from crud.crud_instructor import create_instructor
from schemas.instructor import InstructorCreate
from db.models import InstructorStatus
from core.security import create_access_token


class TestAuthAPI:
    """認証API のテスト"""

    def test_login_success(self, client: TestClient, db_session: Session):
        """ログイン成功のテスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            email="test@example.com", name="テスト講師", password="secure_password123"
        )
        create_instructor(db_session, instructor_data)

        # ログインリクエスト
        login_data = {"email": "test@example.com", "password": "secure_password123"}
        response = client.post("/api/v1/auth/login", json=login_data)

        assert response.status_code == 200
        data = response.json()

        # レスポンス構造の確認
        assert "instructor" in data
        assert "token" in data

        # 講師情報の確認
        instructor = data["instructor"]
        assert instructor["email"] == "test@example.com"
        assert instructor["name"] == "テスト講師"
        assert instructor["is_active"] is True

        # トークン情報の確認
        token = data["token"]
        assert "access_token" in token
        assert token["token_type"] == "bearer"
        assert "expires_in" in token

    def test_login_wrong_password(self, client: TestClient, db_session: Session):
        """間違ったパスワードでのログインのテスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            email="test@example.com", name="テスト講師", password="correct_password123"
        )
        create_instructor(db_session, instructor_data)

        # 間違ったパスワードでログイン
        login_data = {"email": "test@example.com", "password": "wrong_password123"}
        response = client.post("/api/v1/auth/login", json=login_data)

        assert response.status_code == 401
        assert "Invalid credentials" in response.json()["detail"]

    def test_login_nonexistent_email(self, client: TestClient):
        """存在しないメールでのログインのテスト"""
        login_data = {"email": "nonexistent@example.com", "password": "password123"}
        response = client.post("/api/v1/auth/login", json=login_data)

        assert response.status_code == 401
        assert "Invalid credentials" in response.json()["detail"]

    def test_login_inactive_instructor(self, client: TestClient, db_session: Session):
        """非アクティブ講師でのログインのテスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            email="test@example.com", name="テスト講師", password="password123"
        )
        instructor = create_instructor(db_session, instructor_data)

        # 講師を非アクティブにする
        instructor.is_active = False
        db_session.commit()

        # ログイン試行
        login_data = {"email": "test@example.com", "password": "password123"}
        response = client.post("/api/v1/auth/login", json=login_data)

        assert response.status_code == 401
        assert "Invalid credentials" in response.json()["detail"]

    def test_login_invalid_request_format(self, client: TestClient):
        """無効なリクエスト形式のテスト"""
        # 必須フィールド不足
        login_data = {
            "email": "test@example.com"
            # password が不足
        }
        response = client.post("/api/v1/auth/login", json=login_data)

        assert response.status_code == 422

    def test_get_current_instructor_success(
        self, client: TestClient, db_session: Session
    ):
        """現在の講師情報取得成功のテスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            email="test@example.com", name="テスト講師", password="password123"
        )
        instructor = create_instructor(db_session, instructor_data)

        # アクセストークンを生成
        access_token = create_access_token(data={"sub": instructor.email})
        headers = {"Authorization": f"Bearer {access_token}"}

        # 現在の講師情報取得
        response = client.get("/api/v1/auth/me", headers=headers)

        assert response.status_code == 200
        data = response.json()

        assert data["email"] == "test@example.com"
        assert data["name"] == "テスト講師"
        assert data["is_active"] is True

    def test_get_current_instructor_invalid_token(self, client: TestClient):
        """無効なトークンでの現在講師情報取得のテスト"""
        headers = {"Authorization": "Bearer invalid_token"}
        response = client.get("/api/v1/auth/me", headers=headers)

        assert response.status_code == 401
        assert "Could not validate credentials" in response.json()["detail"]

    def test_get_current_instructor_no_token(self, client: TestClient):
        """トークンなしでの現在講師情報取得のテスト"""
        response = client.get("/api/v1/auth/me")

        assert response.status_code == 403
        assert "Not authenticated" in response.json()["detail"]

    def test_change_password_success(self, client: TestClient, db_session: Session):
        """パスワード変更成功のテスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            email="test@example.com", name="テスト講師", password="old_password123"
        )
        instructor = create_instructor(db_session, instructor_data)

        # アクセストークンを生成
        access_token = create_access_token(data={"sub": instructor.email})
        headers = {"Authorization": f"Bearer {access_token}"}

        # パスワード変更リクエスト
        password_data = {
            "current_password": "old_password123",
            "new_password": "new_password456",
        }
        response = client.put(
            "/api/v1/auth/password", json=password_data, headers=headers
        )

        assert response.status_code == 200
        assert response.json()["message"] == "Password updated successfully"

    def test_change_password_wrong_current(
        self, client: TestClient, db_session: Session
    ):
        """間違った現在パスワードでの変更のテスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            email="test@example.com", name="テスト講師", password="correct_password123"
        )
        instructor = create_instructor(db_session, instructor_data)

        # アクセストークンを生成
        access_token = create_access_token(data={"sub": instructor.email})
        headers = {"Authorization": f"Bearer {access_token}"}

        # 間違った現在パスワードで変更試行
        password_data = {
            "current_password": "wrong_password123",
            "new_password": "new_password456",
        }
        response = client.put(
            "/api/v1/auth/password", json=password_data, headers=headers
        )

        assert response.status_code == 400
        assert "Current password is incorrect" in response.json()["detail"]

    def test_change_password_no_token(self, client: TestClient):
        """トークンなしでのパスワード変更のテスト"""
        password_data = {
            "current_password": "old_password123",
            "new_password": "new_password456",
        }
        response = client.put("/api/v1/auth/password", json=password_data)

        assert response.status_code == 403
        assert "Not authenticated" in response.json()["detail"]

    def test_logout_success(self, client: TestClient, db_session: Session):
        """ログアウト成功のテスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            email="test@example.com", name="テスト講師", password="password123"
        )
        instructor = create_instructor(db_session, instructor_data)

        # アクセストークンを生成
        access_token = create_access_token(data={"sub": instructor.email})
        headers = {"Authorization": f"Bearer {access_token}"}

        # ログアウトリクエスト
        response = client.post("/api/v1/auth/logout", headers=headers)

        assert response.status_code == 200
        assert response.json()["message"] == "Successfully logged out"

    def test_logout_no_token(self, client: TestClient):
        """トークンなしでのログアウトのテスト"""
        response = client.post("/api/v1/auth/logout")

        assert response.status_code == 403
        assert "Not authenticated" in response.json()["detail"]


class TestAuthAPIIntegration:
    """認証API統合テスト"""

    def test_full_authentication_flow(self, client: TestClient, db_session: Session):
        """完全な認証フローのテスト"""
        # 1. 講師を作成
        instructor_data = InstructorCreate(
            email="integration@example.com",
            name="統合テスト講師",
            password="integration_password123",
        )
        create_instructor(db_session, instructor_data)

        # 2. ログイン
        login_data = {
            "email": "integration@example.com",
            "password": "integration_password123",
        }
        login_response = client.post("/api/v1/auth/login", json=login_data)
        assert login_response.status_code == 200

        token = login_response.json()["token"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 3. 現在の講師情報を取得
        me_response = client.get("/api/v1/auth/me", headers=headers)
        assert me_response.status_code == 200
        assert me_response.json()["email"] == "integration@example.com"

        # 4. パスワードを変更
        password_data = {
            "current_password": "integration_password123",
            "new_password": "new_integration_password456",
        }
        password_response = client.put(
            "/api/v1/auth/password", json=password_data, headers=headers
        )
        assert password_response.status_code == 200

        # 5. 新しいパスワードでログイン
        new_login_data = {
            "email": "integration@example.com",
            "password": "new_integration_password456",
        }
        new_login_response = client.post("/api/v1/auth/login", json=new_login_data)
        assert new_login_response.status_code == 200

        # 6. ログアウト
        new_token = new_login_response.json()["token"]["access_token"]
        new_headers = {"Authorization": f"Bearer {new_token}"}
        logout_response = client.post("/api/v1/auth/logout", headers=new_headers)
        assert logout_response.status_code == 200
