import pytest
from datetime import datetime, timezone
from pydantic import ValidationError
from schemas.instructor import (
    InstructorCreate,
    InstructorLogin,
    InstructorUpdate,
    InstructorPasswordUpdate,
    InstructorStatusUpdate,
    InstructorResponse,
    InstructorStatusResponse,
    InstructorStatusHistoryResponse,
    TokenResponse,
    LoginResponse,
)
from db.models import InstructorStatus


class TestInstructorCreateSchema:
    """講師作成スキーマのテスト"""

    def test_instructor_create_valid_data(self):
        """有効なデータでの講師作成スキーマテスト"""
        data = {
            "email": "instructor@example.com",
            "name": "田中太郎",
            "password": "secure_password123",
            "role": "instructor",
        }
        schema = InstructorCreate(**data)
        assert schema.email == "instructor@example.com"
        assert schema.name == "田中太郎"
        assert schema.password == "secure_password123"
        assert schema.role == "instructor"

    def test_instructor_create_default_role(self):
        """デフォルトロールでの講師作成スキーマテスト"""
        data = {
            "email": "instructor@example.com",
            "name": "田中太郎",
            "password": "secure_password123",
        }
        schema = InstructorCreate(**data)
        assert schema.role == "instructor"

    def test_instructor_create_invalid_email(self):
        """無効なメールアドレスでのバリデーションエラーテスト"""
        data = {
            "email": "invalid_email",
            "name": "田中太郎",
            "password": "secure_password123",
        }
        with pytest.raises(ValidationError) as exc_info:
            InstructorCreate(**data)
        assert "value is not a valid email address" in str(exc_info.value)

    def test_instructor_create_missing_required_fields(self):
        """必須フィールド不足でのバリデーションエラーテスト"""
        data = {
            "email": "instructor@example.com"
            # name と password が不足
        }
        with pytest.raises(ValidationError) as exc_info:
            InstructorCreate(**data)
        errors = str(exc_info.value)
        assert "name" in errors
        assert "password" in errors


class TestInstructorLoginSchema:
    """講師ログインスキーマのテスト"""

    def test_instructor_login_valid_data(self):
        """有効なデータでの講師ログインスキーマテスト"""
        data = {"email": "instructor@example.com", "password": "secure_password123"}
        schema = InstructorLogin(**data)
        assert schema.email == "instructor@example.com"
        assert schema.password == "secure_password123"

    def test_instructor_login_invalid_email(self):
        """無効なメールアドレスでのバリデーションエラーテスト"""
        data = {"email": "invalid_email", "password": "secure_password123"}
        with pytest.raises(ValidationError) as exc_info:
            InstructorLogin(**data)
        assert "value is not a valid email address" in str(exc_info.value)


class TestInstructorUpdateSchema:
    """講師更新スキーマのテスト"""

    def test_instructor_update_partial_data(self):
        """部分的なデータでの講師更新スキーマテスト"""
        data = {"name": "更新された名前"}
        schema = InstructorUpdate(**data)
        assert schema.name == "更新された名前"
        assert schema.role is None
        assert schema.is_active is None

    def test_instructor_update_all_fields(self):
        """全フィールドでの講師更新スキーマテスト"""
        data = {"name": "更新された名前", "role": "admin", "is_active": False}
        schema = InstructorUpdate(**data)
        assert schema.name == "更新された名前"
        assert schema.role == "admin"
        assert schema.is_active is False

    def test_instructor_update_empty_data(self):
        """空データでの講師更新スキーマテスト"""
        schema = InstructorUpdate()
        assert schema.name is None
        assert schema.role is None
        assert schema.is_active is None


class TestInstructorPasswordUpdateSchema:
    """パスワード更新スキーマのテスト"""

    def test_password_update_valid_data(self):
        """有効なデータでのパスワード更新スキーマテスト"""
        data = {
            "current_password": "old_password123",
            "new_password": "new_password456",
        }
        schema = InstructorPasswordUpdate(**data)
        assert schema.current_password == "old_password123"
        assert schema.new_password == "new_password456"

    def test_password_update_missing_fields(self):
        """必須フィールド不足でのバリデーションエラーテスト"""
        data = {
            "current_password": "old_password123"
            # new_password が不足
        }
        with pytest.raises(ValidationError) as exc_info:
            InstructorPasswordUpdate(**data)
        assert "new_password" in str(exc_info.value)


class TestInstructorStatusUpdateSchema:
    """講師ステータス更新スキーマのテスト"""

    def test_status_update_valid_data(self):
        """有効なデータでのステータス更新スキーマテスト"""
        data = {"status": InstructorStatus.AVAILABLE, "current_session_id": 123}
        schema = InstructorStatusUpdate(**data)
        assert schema.status == InstructorStatus.AVAILABLE
        assert schema.current_session_id == 123

    def test_status_update_without_session(self):
        """セッションIDなしでのステータス更新スキーマテスト"""
        data = {"status": InstructorStatus.OFFLINE}
        schema = InstructorStatusUpdate(**data)
        assert schema.status == InstructorStatus.OFFLINE
        assert schema.current_session_id is None

    def test_status_update_invalid_status(self):
        """無効なステータスでのバリデーションエラーテスト"""
        data = {"status": "INVALID_STATUS"}
        with pytest.raises(ValidationError) as exc_info:
            InstructorStatusUpdate(**data)
        assert "Input should be" in str(exc_info.value)


class TestInstructorResponseSchema:
    """講師レスポンススキーマのテスト"""

    def test_instructor_response_valid_data(self):
        """有効なデータでの講師レスポンススキーマテスト"""
        now = datetime.now(timezone.utc)
        data = {
            "id": 1,
            "email": "instructor@example.com",
            "name": "田中太郎",
            "role": "instructor",
            "is_active": True,
            "status": InstructorStatus.AVAILABLE,
            "current_session_id": 123,
            "status_updated_at": now,
            "last_login_at": now,
            "created_at": now,
            "updated_at": now,
        }
        schema = InstructorResponse(**data)
        assert schema.id == 1
        assert schema.email == "instructor@example.com"
        assert schema.name == "田中太郎"
        assert schema.status == InstructorStatus.AVAILABLE
        assert schema.current_session_id == 123

    def test_instructor_response_optional_fields(self):
        """オプショナルフィールドでの講師レスポンススキーマテスト"""
        now = datetime.now(timezone.utc)
        data = {
            "id": 1,
            "email": "instructor@example.com",
            "name": "田中太郎",
            "role": "instructor",
            "is_active": True,
            "status": InstructorStatus.OFFLINE,
            "status_updated_at": now,
            "created_at": now,
        }
        schema = InstructorResponse(**data)
        assert schema.current_session_id is None
        assert schema.last_login_at is None
        assert schema.updated_at is None


class TestTokenResponseSchema:
    """トークンレスポンススキーマのテスト"""

    def test_token_response_valid_data(self):
        """有効なデータでのトークンレスポンススキーマテスト"""
        data = {
            "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            "expires_in": 1800,
        }
        schema = TokenResponse(**data)
        assert schema.access_token == "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        assert schema.token_type == "bearer"
        assert schema.expires_in == 1800

    def test_token_response_custom_token_type(self):
        """カスタムトークンタイプでのトークンレスポンススキーマテスト"""
        data = {"access_token": "token123", "token_type": "custom", "expires_in": 3600}
        schema = TokenResponse(**data)
        assert schema.token_type == "custom"


class TestLoginResponseSchema:
    """ログインレスポンススキーマのテスト"""

    def test_login_response_valid_data(self):
        """有効なデータでのログインレスポンススキーマテスト"""
        now = datetime.now(timezone.utc)
        instructor_data = {
            "id": 1,
            "email": "instructor@example.com",
            "name": "田中太郎",
            "role": "instructor",
            "is_active": True,
            "status": InstructorStatus.AVAILABLE,
            "status_updated_at": now,
            "created_at": now,
        }
        token_data = {
            "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            "expires_in": 1800,
        }
        data = {"instructor": instructor_data, "token": token_data}
        schema = LoginResponse(**data)
        assert schema.instructor.id == 1
        assert schema.instructor.email == "instructor@example.com"
        assert schema.token.access_token == "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        assert schema.token.token_type == "bearer"


class TestInstructorStatusHistoryResponseSchema:
    """講師ステータス履歴レスポンススキーマのテスト"""

    def test_status_history_response_valid_data(self):
        """有効なデータでのステータス履歴レスポンススキーマテスト"""
        now = datetime.now(timezone.utc)
        data = {
            "id": 1,
            "instructor_id": 1,
            "status": InstructorStatus.IN_SESSION,
            "session_id": 123,
            "started_at": now,
            "ended_at": now,
            "duration_minutes": 60,
        }
        schema = InstructorStatusHistoryResponse(**data)
        assert schema.id == 1
        assert schema.instructor_id == 1
        assert schema.status == InstructorStatus.IN_SESSION
        assert schema.session_id == 123
        assert schema.duration_minutes == 60

    def test_status_history_response_ongoing_session(self):
        """進行中セッションでのステータス履歴レスポンススキーマテスト"""
        now = datetime.now(timezone.utc)
        data = {
            "id": 1,
            "instructor_id": 1,
            "status": InstructorStatus.IN_SESSION,
            "started_at": now,
        }
        schema = InstructorStatusHistoryResponse(**data)
        assert schema.ended_at is None
        assert schema.duration_minutes is None
        assert schema.session_id is None
