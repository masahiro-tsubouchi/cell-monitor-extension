"""
講師管理API（/api/v1/instructors）のAI駆動TDDテスト

Phase 5: 講師管理API実装
- GET / - 講師一覧取得
- POST / - 新規講師作成
- GET /{instructor_id} - 講師詳細取得
- PUT /{instructor_id} - 講師情報更新
- DELETE /{instructor_id} - 講師削除
"""

import pytest
import json
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from main import app
from schemas.instructor import InstructorCreate, InstructorUpdate
from crud.crud_instructor import create_instructor, get_instructor
from core.security import create_access_token
from db.models import InstructorStatus


class TestInstructorManagementAPI:
    """講師管理APIのテストクラス"""

    def create_test_instructor(
        self, db_session: Session, email: str = "test@example.com"
    ):
        """テスト用講師を作成するヘルパー関数"""
        instructor_data = InstructorCreate(
            name="Test Instructor", email=email, password="password123"
        )
        instructor = create_instructor(db_session, instructor_data)
        db_session.commit()
        db_session.refresh(instructor)  # データベースから最新の状態を取得
        return instructor

    def get_auth_headers(self, instructor_email: str):
        """認証ヘッダーを取得するヘルパー関数"""
        token = create_access_token(data={"sub": instructor_email})
        return {"Authorization": f"Bearer {token}"}

    def test_get_instructors_list_success(
        self, client: TestClient, db_session: Session
    ):
        """講師一覧取得成功テスト"""
        # テスト用講師を複数作成
        instructor1 = self.create_test_instructor(db_session, "instructor1@test.com")
        instructor2 = self.create_test_instructor(db_session, "instructor2@test.com")

        # 認証ヘッダーを取得
        headers = self.get_auth_headers(instructor1.email)

        # 講師一覧を取得
        response = client.get("/api/v1/instructors/", headers=headers)

        # レスポンスを検証
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2

        # 講師情報の構造を確認
        instructor_data = data[0]
        assert "id" in instructor_data
        assert "name" in instructor_data
        assert "email" in instructor_data
        assert "status" in instructor_data
        assert "is_active" in instructor_data
        assert "password" not in instructor_data  # パスワードは含まれない

    def test_get_instructors_list_with_pagination(
        self, client: TestClient, db_session: Session
    ):
        """講師一覧取得（ページネーション）テスト"""
        # テスト用講師を作成
        instructor = self.create_test_instructor(db_session)
        headers = self.get_auth_headers(instructor.email)

        # ページネーションパラメータでリクエスト
        response = client.get("/api/v1/instructors/?skip=0&limit=5", headers=headers)

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) <= 5

    def test_get_instructors_list_active_filter(
        self, client: TestClient, db_session: Session
    ):
        """講師一覧取得（アクティブフィルター）テスト"""
        # テスト用講師を作成
        instructor = self.create_test_instructor(db_session)
        headers = self.get_auth_headers(instructor.email)

        # アクティブフィルターでリクエスト
        response = client.get("/api/v1/instructors/?is_active=true", headers=headers)

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # 全ての講師がアクティブであることを確認
        for instructor_data in data:
            assert instructor_data["is_active"] is True

    def test_get_instructors_list_unauthorized(
        self, client: TestClient, db_session: Session
    ):
        """講師一覧取得（未認証）テスト"""
        response = client.get("/api/v1/instructors/")
        assert response.status_code == 403  # FastAPI HTTPBearerのデフォルト動作

    def test_create_instructor_success(self, client: TestClient, db_session: Session):
        """新規講師作成成功テスト"""
        # 管理者権限の講師を作成
        admin_instructor = self.create_test_instructor(db_session, "admin@test.com")
        headers = self.get_auth_headers(admin_instructor.email)

        # 新規講師データ
        new_instructor_data = {
            "name": "New Instructor",
            "email": "new@test.com",
            "password": "newpassword123",
            "role": "instructor",
        }

        # 新規講師作成リクエスト
        response = client.post(
            "/api/v1/instructors/", json=new_instructor_data, headers=headers
        )

        # レスポンスを検証
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == new_instructor_data["name"]
        assert data["email"] == new_instructor_data["email"]
        assert data["role"] == new_instructor_data["role"]
        assert data["is_active"] is True
        assert data["status"] == InstructorStatus.OFFLINE.value
        assert "password" not in data  # パスワードは含まれない

        # データベースに保存されていることを確認
        created_instructor = get_instructor(db_session, data["id"])
        assert created_instructor is not None
        assert created_instructor.email == new_instructor_data["email"]

    def test_create_instructor_duplicate_email(
        self, client: TestClient, db_session: Session
    ):
        """新規講師作成（重複メール）テスト"""
        # 既存講師を作成
        existing_instructor = self.create_test_instructor(
            db_session, "existing@test.com"
        )
        headers = self.get_auth_headers(existing_instructor.email)

        # 同じメールアドレスで新規講師作成を試行
        duplicate_instructor_data = {
            "name": "Duplicate Instructor",
            "email": "existing@test.com",  # 重複メール
            "password": "password123",
        }

        response = client.post(
            "/api/v1/instructors/", json=duplicate_instructor_data, headers=headers
        )

        # 重複エラーを確認
        assert response.status_code == 400
        data = response.json()
        assert "already registered" in data["detail"].lower()

    def test_create_instructor_invalid_data(
        self, client: TestClient, db_session: Session
    ):
        """新規講師作成（無効データ）テスト"""
        instructor = self.create_test_instructor(db_session)
        headers = self.get_auth_headers(instructor.email)

        # 無効なデータ（メールアドレス不正）
        invalid_data = {
            "name": "Invalid Instructor",
            "email": "invalid-email",  # 無効なメール形式
            "password": "password123",
        }

        response = client.post(
            "/api/v1/instructors/", json=invalid_data, headers=headers
        )

        assert response.status_code == 422  # バリデーションエラー

    def test_get_instructor_by_id_success(
        self, client: TestClient, db_session: Session
    ):
        """講師詳細取得成功テスト"""
        instructor = self.create_test_instructor(db_session)
        headers = self.get_auth_headers(instructor.email)

        # 講師詳細を取得
        response = client.get(f"/api/v1/instructors/{instructor.id}", headers=headers)

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == instructor.id
        assert data["name"] == instructor.name
        assert data["email"] == instructor.email
        assert "password" not in data

    def test_get_instructor_by_id_not_found(
        self, client: TestClient, db_session: Session
    ):
        """講師詳細取得（存在しない）テスト"""
        instructor = self.create_test_instructor(db_session)
        headers = self.get_auth_headers(instructor.email)

        # 存在しない講師IDで取得
        response = client.get("/api/v1/instructors/99999", headers=headers)

        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()

    def test_update_instructor_success(self, client: TestClient, db_session: Session):
        """講師情報更新成功テスト"""
        instructor = self.create_test_instructor(db_session)
        headers = self.get_auth_headers(instructor.email)

        # 更新データ
        update_data = {"name": "Updated Instructor Name", "role": "senior_instructor"}

        # 講師情報を更新
        response = client.put(
            f"/api/v1/instructors/{instructor.id}", json=update_data, headers=headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["role"] == update_data["role"]
        assert data["email"] == instructor.email  # メールは変更されない

    def test_update_instructor_not_found(self, client: TestClient, db_session: Session):
        """講師情報更新（存在しない）テスト"""
        instructor = self.create_test_instructor(db_session)
        headers = self.get_auth_headers(instructor.email)

        update_data = {"name": "Updated Name"}

        # 存在しない講師IDで更新
        response = client.put(
            "/api/v1/instructors/99999", json=update_data, headers=headers
        )

        assert response.status_code == 404

    def test_delete_instructor_success(self, client: TestClient, db_session: Session):
        """講師削除成功テスト"""
        # 削除対象の講師を作成
        target_instructor = self.create_test_instructor(db_session, "target@test.com")
        # 削除実行者の講師を作成
        admin_instructor = self.create_test_instructor(db_session, "admin@test.com")
        headers = self.get_auth_headers(admin_instructor.email)

        # 講師を削除
        response = client.delete(
            f"/api/v1/instructors/{target_instructor.id}", headers=headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "successfully deleted" in data["message"].lower()

        # 論理削除されていることを確認
        deleted_instructor = get_instructor(db_session, target_instructor.id)
        assert deleted_instructor.is_active is False

    def test_delete_instructor_not_found(self, client: TestClient, db_session: Session):
        """講師削除（存在しない）テスト"""
        instructor = self.create_test_instructor(db_session)
        headers = self.get_auth_headers(instructor.email)

        # 存在しない講師IDで削除
        response = client.delete("/api/v1/instructors/99999", headers=headers)

        assert response.status_code == 404

    def test_instructor_management_integration_flow(
        self, client: TestClient, db_session: Session
    ):
        """講師管理統合フローテスト"""
        # 管理者講師を作成
        admin_instructor = self.create_test_instructor(db_session, "admin@test.com")
        headers = self.get_auth_headers(admin_instructor.email)

        # 1. 新規講師作成
        new_instructor_data = {
            "name": "Integration Test Instructor",
            "email": "integration@test.com",
            "password": "password123",
        }

        create_response = client.post(
            "/api/v1/instructors/", json=new_instructor_data, headers=headers
        )
        assert create_response.status_code == 201
        created_instructor = create_response.json()
        instructor_id = created_instructor["id"]

        # 2. 講師詳細取得
        get_response = client.get(
            f"/api/v1/instructors/{instructor_id}", headers=headers
        )
        assert get_response.status_code == 200

        # 3. 講師情報更新
        update_data = {"name": "Updated Integration Instructor"}
        update_response = client.put(
            f"/api/v1/instructors/{instructor_id}", json=update_data, headers=headers
        )
        assert update_response.status_code == 200
        updated_instructor = update_response.json()
        assert updated_instructor["name"] == update_data["name"]

        # 4. 講師一覧で確認
        list_response = client.get("/api/v1/instructors/", headers=headers)
        assert list_response.status_code == 200
        instructors = list_response.json()
        updated_instructor_in_list = next(
            (inst for inst in instructors if inst["id"] == instructor_id), None
        )
        assert updated_instructor_in_list is not None
        assert updated_instructor_in_list["name"] == update_data["name"]

        # 5. 講師削除
        delete_response = client.delete(
            f"/api/v1/instructors/{instructor_id}", headers=headers
        )
        assert delete_response.status_code == 200
