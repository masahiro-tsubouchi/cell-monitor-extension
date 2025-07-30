"""
講師ログイン機能のセキュリティ機能テスト（AI駆動TDD）

Phase 2: 認証・セキュリティのTDDテストケース
- パスワードハッシュ化（bcrypt）
- JWT トークン生成・検証
- 認証依存性注入
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import patch
from jose import jwt, JWTError

from core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    verify_token,
    get_current_instructor,
    authenticate_instructor,
)
from core.config import settings
from db.models import Instructor, InstructorStatus
from sqlalchemy.orm import Session


class TestPasswordSecurity:
    """パスワードセキュリティのテスト"""

    def test_password_hashing_basic(self):
        """基本的なパスワードハッシュ化テスト"""
        password = "test_password_123"
        hashed = get_password_hash(password)

        # ハッシュ化されたパスワードは元のパスワードと異なる
        assert hashed != password
        # ハッシュ化されたパスワードは空でない
        assert len(hashed) > 0
        # bcryptハッシュの形式（$2b$で始まる）
        assert hashed.startswith("$2b$")

    def test_password_verification_success(self):
        """パスワード検証成功テスト"""
        password = "secure_password_456"
        hashed = get_password_hash(password)

        # 正しいパスワードで検証成功
        assert verify_password(password, hashed) is True

    def test_password_verification_failure(self):
        """パスワード検証失敗テスト"""
        password = "correct_password"
        wrong_password = "wrong_password"
        hashed = get_password_hash(password)

        # 間違ったパスワードで検証失敗
        assert verify_password(wrong_password, hashed) is False

    def test_password_hash_uniqueness(self):
        """同じパスワードでも異なるハッシュが生成されることのテスト"""
        password = "same_password"
        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)

        # 同じパスワードでも異なるハッシュが生成される（salt使用）
        assert hash1 != hash2
        # 両方とも検証は成功する
        assert verify_password(password, hash1) is True
        assert verify_password(password, hash2) is True


class TestJWTTokenSecurity:
    """JWT トークンセキュリティのテスト"""

    def test_create_access_token_basic(self):
        """基本的なアクセストークン作成テスト"""
        data = {"sub": "instructor@example.com"}
        token = create_access_token(data)

        # トークンが生成される
        assert token is not None
        assert len(token) > 0
        # JWT形式（3つの部分がドットで区切られている）
        assert len(token.split(".")) == 3

    def test_create_access_token_with_expiration(self):
        """有効期限付きアクセストークン作成テスト"""
        data = {"sub": "instructor@example.com"}
        expires_delta = timedelta(minutes=15)
        token = create_access_token(data, expires_delta)

        # トークンをデコードして有効期限を確認
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        exp_timestamp = payload.get("exp")

        assert exp_timestamp is not None
        # 有効期限が現在時刻より未来であることを確認
        assert exp_timestamp > datetime.utcnow().timestamp()

    def test_verify_token_success(self):
        """トークン検証成功テスト"""
        data = {"sub": "instructor@example.com"}
        token = create_access_token(data)

        # トークン検証成功
        payload = verify_token(token)
        assert payload is not None
        assert payload.get("sub") == "instructor@example.com"

    def test_verify_token_invalid(self):
        """無効なトークン検証テスト"""
        invalid_token = "invalid.jwt.token"

        # 無効なトークンでNoneが返される
        payload = verify_token(invalid_token)
        assert payload is None

    def test_verify_token_expired(self):
        """期限切れトークン検証テスト"""
        data = {"sub": "instructor@example.com"}
        # 過去の時刻で有効期限を設定
        expires_delta = timedelta(seconds=-1)
        token = create_access_token(data, expires_delta)

        # 期限切れトークンでNoneが返される
        payload = verify_token(token)
        assert payload is None


class TestInstructorAuthentication:
    """講師認証のテスト"""

    def test_authenticate_instructor_success(self, db_session: Session):
        """講師認証成功テスト"""
        # テスト用講師を作成
        password = "test_password"
        hashed_password = get_password_hash(password)
        instructor = Instructor(
            email="auth_test@example.com",
            password_hash=hashed_password,
            name="Auth Test Instructor",
            status=InstructorStatus.AVAILABLE,
        )
        db_session.add(instructor)
        db_session.commit()
        db_session.refresh(instructor)

        # 認証成功
        authenticated_instructor = authenticate_instructor(
            db_session, "auth_test@example.com", password
        )
        assert authenticated_instructor is not None
        assert authenticated_instructor.email == "auth_test@example.com"
        assert authenticated_instructor.id == instructor.id

        # テスト後クリーンアップ
        db_session.delete(instructor)
        db_session.commit()

    def test_authenticate_instructor_wrong_password(self, db_session: Session):
        """講師認証失敗テスト（パスワード間違い）"""
        # テスト用講師を作成
        password = "correct_password"
        hashed_password = get_password_hash(password)
        instructor = Instructor(
            email="auth_fail_test@example.com",
            password_hash=hashed_password,
            name="Auth Fail Test Instructor",
            status=InstructorStatus.AVAILABLE,
        )
        db_session.add(instructor)
        db_session.commit()

        # 間違ったパスワードで認証失敗
        authenticated_instructor = authenticate_instructor(
            db_session, "auth_fail_test@example.com", "wrong_password"
        )
        assert authenticated_instructor is None

        # テスト後クリーンアップ
        db_session.delete(instructor)
        db_session.commit()

    def test_authenticate_instructor_nonexistent_email(self, db_session: Session):
        """講師認証失敗テスト（存在しないメールアドレス）"""
        # 存在しないメールアドレスで認証失敗
        authenticated_instructor = authenticate_instructor(
            db_session, "nonexistent@example.com", "any_password"
        )
        assert authenticated_instructor is None

    def test_authenticate_instructor_inactive(self, db_session: Session):
        """非アクティブ講師の認証失敗テスト"""
        # 非アクティブなテスト用講師を作成
        password = "test_password"
        hashed_password = get_password_hash(password)
        instructor = Instructor(
            email="inactive_test@example.com",
            password_hash=hashed_password,
            name="Inactive Test Instructor",
            status=InstructorStatus.OFFLINE,
            is_active=False,  # 非アクティブ
        )
        db_session.add(instructor)
        db_session.commit()

        # 非アクティブ講師で認証失敗
        authenticated_instructor = authenticate_instructor(
            db_session, "inactive_test@example.com", password
        )
        assert authenticated_instructor is None

        # テスト後クリーンアップ
        db_session.delete(instructor)
        db_session.commit()


class TestCurrentInstructorDependency:
    """現在の講師取得依存性のテスト"""

    @pytest.mark.asyncio
    async def test_get_current_instructor_success(self, db_session: Session):
        """現在の講師取得成功テスト"""
        from fastapi.security import HTTPAuthorizationCredentials

        # テスト用講師を作成
        instructor = Instructor(
            email="current_test@example.com",
            password_hash=get_password_hash("password"),
            name="Current Test Instructor",
            status=InstructorStatus.AVAILABLE,
        )
        db_session.add(instructor)
        db_session.commit()
        db_session.refresh(instructor)

        # 有効なトークンを作成
        token_data = {"sub": instructor.email}
        token = create_access_token(token_data)

        # HTTPAuthorizationCredentialsオブジェクトをモック
        mock_credentials = HTTPAuthorizationCredentials(
            scheme="Bearer", credentials=token
        )

        # 現在の講師取得成功
        current_instructor = await get_current_instructor(mock_credentials, db_session)
        assert current_instructor is not None
        assert current_instructor.email == instructor.email
        assert current_instructor.id == instructor.id

        # テスト後クリーンアップ
        db_session.delete(instructor)
        db_session.commit()

    @pytest.mark.asyncio
    async def test_get_current_instructor_invalid_token(self, db_session: Session):
        """無効なトークンでの現在の講師取得失敗テスト"""
        from fastapi.security import HTTPAuthorizationCredentials
        from fastapi import HTTPException

        invalid_token = "invalid.jwt.token"

        # HTTPAuthorizationCredentialsオブジェクトをモック
        mock_credentials = HTTPAuthorizationCredentials(
            scheme="Bearer", credentials=invalid_token
        )

        # 無効なトークンでHTTPExceptionが発生
        with pytest.raises(HTTPException):
            await get_current_instructor(mock_credentials, db_session)

    @pytest.mark.asyncio
    async def test_get_current_instructor_nonexistent_user(self, db_session: Session):
        """存在しない講師のトークンでの失敗テスト"""
        from fastapi.security import HTTPAuthorizationCredentials
        from fastapi import HTTPException

        # 存在しない講師のトークンを作成
        token_data = {"sub": "nonexistent@example.com"}
        token = create_access_token(token_data)

        # HTTPAuthorizationCredentialsオブジェクトをモック
        mock_credentials = HTTPAuthorizationCredentials(
            scheme="Bearer", credentials=token
        )

        # 存在しない講師でHTTPExceptionが発生
        with pytest.raises(HTTPException):
            await get_current_instructor(mock_credentials, db_session)


class TestSecurityIntegration:
    """セキュリティ機能統合テスト"""

    def test_full_authentication_flow(self, db_session: Session):
        """完全な認証フローのテスト"""
        # 1. 講師を作成
        password = "integration_test_password"
        instructor = Instructor(
            email="integration@example.com",
            password_hash=get_password_hash(password),
            name="Integration Test Instructor",
            status=InstructorStatus.AVAILABLE,
        )
        db_session.add(instructor)
        db_session.commit()
        db_session.refresh(instructor)

        # 2. 認証
        authenticated_instructor = authenticate_instructor(
            db_session, instructor.email, password
        )
        assert authenticated_instructor is not None

        # 3. トークン生成
        token_data = {"sub": authenticated_instructor.email}
        access_token = create_access_token(token_data)
        assert access_token is not None

        # 4. トークン検証
        payload = verify_token(access_token)
        assert payload is not None
        assert payload.get("sub") == instructor.email

        # テスト後クリーンアップ
        db_session.delete(instructor)
        db_session.commit()
