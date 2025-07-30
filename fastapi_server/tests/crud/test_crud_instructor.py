import pytest
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from crud.crud_instructor import (
    create_instructor,
    get_instructor,
    get_instructor_by_email,
    get_instructors,
    update_instructor,
    update_instructor_password,
    update_instructor_status,
    get_instructor_status_history,
    delete_instructor,
    authenticate_instructor,
)
from schemas.instructor import (
    InstructorCreate,
    InstructorUpdate,
    InstructorPasswordUpdate,
    InstructorStatusUpdate,
)
from db.models import Instructor, InstructorStatus, InstructorStatusHistory
from core.security import verify_password


class TestInstructorCRUD:
    """講師CRUD操作のテスト"""

    def test_create_instructor(self, db_session: Session):
        """講師作成のテスト"""
        instructor_data = InstructorCreate(
            email="test@example.com",
            name="テスト講師",
            password="secure_password123",
            role="instructor",
        )

        instructor = create_instructor(db_session, instructor_data)

        assert instructor.id is not None
        assert instructor.email == "test@example.com"
        assert instructor.name == "テスト講師"
        assert instructor.role == "instructor"
        assert instructor.is_active is True
        assert instructor.status == InstructorStatus.OFFLINE
        assert verify_password("secure_password123", instructor.password_hash)

    def test_get_instructor_by_id(self, db_session: Session):
        """ID による講師取得のテスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            email="test@example.com", name="テスト講師", password="secure_password123"
        )
        created_instructor = create_instructor(db_session, instructor_data)

        # 取得テスト
        retrieved_instructor = get_instructor(db_session, created_instructor.id)

        assert retrieved_instructor is not None
        assert retrieved_instructor.id == created_instructor.id
        assert retrieved_instructor.email == "test@example.com"

    def test_get_instructor_by_id_not_found(self, db_session: Session):
        """存在しないIDでの講師取得のテスト"""
        instructor = get_instructor(db_session, 99999)
        assert instructor is None

    def test_get_instructor_by_email(self, db_session: Session):
        """メールアドレスによる講師取得のテスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            email="test@example.com", name="テスト講師", password="secure_password123"
        )
        created_instructor = create_instructor(db_session, instructor_data)

        # 取得テスト
        retrieved_instructor = get_instructor_by_email(db_session, "test@example.com")

        assert retrieved_instructor is not None
        assert retrieved_instructor.id == created_instructor.id
        assert retrieved_instructor.email == "test@example.com"

    def test_get_instructor_by_email_not_found(self, db_session: Session):
        """存在しないメールアドレスでの講師取得のテスト"""
        instructor = get_instructor_by_email(db_session, "nonexistent@example.com")
        assert instructor is None

    def test_get_instructors_list(self, db_session: Session):
        """講師一覧取得のテスト"""
        # テスト用講師を複数作成
        instructor1_data = InstructorCreate(
            email="instructor1@example.com", name="講師1", password="password123"
        )
        instructor2_data = InstructorCreate(
            email="instructor2@example.com", name="講師2", password="password123"
        )

        create_instructor(db_session, instructor1_data)
        create_instructor(db_session, instructor2_data)

        # 一覧取得テスト
        instructors = get_instructors(db_session)

        assert len(instructors) >= 2
        emails = [instructor.email for instructor in instructors]
        assert "instructor1@example.com" in emails
        assert "instructor2@example.com" in emails

    def test_get_instructors_with_active_filter(self, db_session: Session):
        """アクティブフィルターでの講師一覧取得のテスト"""
        # アクティブな講師を作成
        active_instructor_data = InstructorCreate(
            email="active@example.com", name="アクティブ講師", password="password123"
        )
        active_instructor = create_instructor(db_session, active_instructor_data)

        # 非アクティブな講師を作成
        inactive_instructor_data = InstructorCreate(
            email="inactive@example.com",
            name="非アクティブ講師",
            password="password123",
        )
        inactive_instructor = create_instructor(db_session, inactive_instructor_data)
        inactive_instructor.is_active = False
        db_session.commit()

        # アクティブな講師のみ取得
        active_instructors = get_instructors(db_session, is_active=True)
        active_emails = [instructor.email for instructor in active_instructors]

        assert "active@example.com" in active_emails
        assert "inactive@example.com" not in active_emails

    def test_update_instructor(self, db_session: Session):
        """講師情報更新のテスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            email="test@example.com", name="元の名前", password="password123"
        )
        instructor = create_instructor(db_session, instructor_data)

        # 更新データ
        update_data = InstructorUpdate(name="更新された名前", role="admin")

        # 更新テスト
        updated_instructor = update_instructor(db_session, instructor.id, update_data)

        assert updated_instructor is not None
        assert updated_instructor.name == "更新された名前"
        assert updated_instructor.role == "admin"
        assert (
            updated_instructor.email == "test@example.com"
        )  # 変更されていないことを確認

    def test_update_instructor_not_found(self, db_session: Session):
        """存在しない講師の更新のテスト"""
        update_data = InstructorUpdate(name="更新された名前")
        updated_instructor = update_instructor(db_session, 99999, update_data)
        assert updated_instructor is None

    def test_update_instructor_password_success(self, db_session: Session):
        """パスワード更新成功のテスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            email="test@example.com", name="テスト講師", password="old_password123"
        )
        instructor = create_instructor(db_session, instructor_data)

        # パスワード更新データ
        password_update = InstructorPasswordUpdate(
            current_password="old_password123", new_password="new_password456"
        )

        # パスワード更新テスト
        updated_instructor = update_instructor_password(
            db_session, instructor.id, password_update
        )

        assert updated_instructor is not None
        assert verify_password("new_password456", updated_instructor.password_hash)
        assert not verify_password("old_password123", updated_instructor.password_hash)

    def test_update_instructor_password_wrong_current(self, db_session: Session):
        """間違った現在のパスワードでの更新のテスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            email="test@example.com", name="テスト講師", password="correct_password123"
        )
        instructor = create_instructor(db_session, instructor_data)

        # 間違ったパスワード更新データ
        password_update = InstructorPasswordUpdate(
            current_password="wrong_password123", new_password="new_password456"
        )

        # パスワード更新テスト（失敗するはず）
        updated_instructor = update_instructor_password(
            db_session, instructor.id, password_update
        )

        assert updated_instructor is None

    def test_update_instructor_password_not_found(self, db_session: Session):
        """存在しない講師のパスワード更新のテスト"""
        password_update = InstructorPasswordUpdate(
            current_password="old_password123", new_password="new_password456"
        )
        updated_instructor = update_instructor_password(
            db_session, 99999, password_update
        )
        assert updated_instructor is None

    def test_update_instructor_status(self, db_session: Session):
        """講師ステータス更新のテスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            email="test@example.com", name="テスト講師", password="password123"
        )
        instructor = create_instructor(db_session, instructor_data)

        # ステータス更新データ
        status_update = InstructorStatusUpdate(status=InstructorStatus.AVAILABLE)

        # ステータス更新テスト
        updated_instructor = update_instructor_status(
            db_session, instructor.id, status_update
        )

        assert updated_instructor is not None
        assert updated_instructor.status == InstructorStatus.AVAILABLE
        assert updated_instructor.current_session_id is None
        assert updated_instructor.last_login_at is not None

    def test_update_instructor_status_creates_history(self, db_session: Session):
        """ステータス更新時の履歴作成のテスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            email="test@example.com", name="テスト講師", password="password123"
        )
        instructor = create_instructor(db_session, instructor_data)

        # 最初のステータス更新
        status_update1 = InstructorStatusUpdate(status=InstructorStatus.AVAILABLE)
        update_instructor_status(db_session, instructor.id, status_update1)

        # 2回目のステータス更新
        status_update2 = InstructorStatusUpdate(status=InstructorStatus.IN_SESSION)
        update_instructor_status(db_session, instructor.id, status_update2)

        # 履歴確認
        history = get_instructor_status_history(db_session, instructor.id)

        assert len(history) >= 2
        # 最新の履歴が最初に来る（降順）
        assert history[0].status == InstructorStatus.IN_SESSION
        assert history[1].status == InstructorStatus.AVAILABLE
        assert history[1].ended_at is not None  # 前のセッションが終了している

    def test_get_instructor_status_history(self, db_session: Session):
        """講師ステータス履歴取得のテスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            email="test@example.com", name="テスト講師", password="password123"
        )
        instructor = create_instructor(db_session, instructor_data)

        # 複数のステータス更新を実行
        statuses = [
            InstructorStatus.AVAILABLE,
            InstructorStatus.IN_SESSION,
            InstructorStatus.BREAK,
        ]
        for status in statuses:
            status_update = InstructorStatusUpdate(status=status)
            update_instructor_status(db_session, instructor.id, status_update)

        # 履歴取得テスト
        history = get_instructor_status_history(db_session, instructor.id, limit=2)

        assert len(history) == 2
        assert history[0].instructor_id == instructor.id
        # 最新の履歴が最初に来る
        assert history[0].status == InstructorStatus.BREAK

    def test_delete_instructor(self, db_session: Session):
        """講師削除（論理削除）のテスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            email="test@example.com", name="テスト講師", password="password123"
        )
        instructor = create_instructor(db_session, instructor_data)

        # 削除テスト
        result = delete_instructor(db_session, instructor.id)

        assert result is True

        # 削除後の確認
        deleted_instructor = get_instructor(db_session, instructor.id)
        assert deleted_instructor is not None
        assert deleted_instructor.is_active is False

    def test_delete_instructor_not_found(self, db_session: Session):
        """存在しない講師の削除のテスト"""
        result = delete_instructor(db_session, 99999)
        assert result is False

    def test_authenticate_instructor_success(self, db_session: Session):
        """講師認証成功のテスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            email="test@example.com", name="テスト講師", password="correct_password123"
        )
        create_instructor(db_session, instructor_data)

        # 認証テスト
        authenticated_instructor = authenticate_instructor(
            db_session, "test@example.com", "correct_password123"
        )

        assert authenticated_instructor is not None
        assert authenticated_instructor.email == "test@example.com"

    def test_authenticate_instructor_wrong_password(self, db_session: Session):
        """講師認証失敗（間違ったパスワード）のテスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            email="test@example.com", name="テスト講師", password="correct_password123"
        )
        create_instructor(db_session, instructor_data)

        # 認証テスト（間違ったパスワード）
        authenticated_instructor = authenticate_instructor(
            db_session, "test@example.com", "wrong_password123"
        )

        assert authenticated_instructor is None

    def test_authenticate_instructor_nonexistent_email(self, db_session: Session):
        """講師認証失敗（存在しないメール）のテスト"""
        authenticated_instructor = authenticate_instructor(
            db_session, "nonexistent@example.com", "password123"
        )
        assert authenticated_instructor is None

    def test_authenticate_instructor_inactive(self, db_session: Session):
        """講師認証失敗（非アクティブ）のテスト"""
        # テスト用講師を作成
        instructor_data = InstructorCreate(
            email="test@example.com", name="テスト講師", password="password123"
        )
        instructor = create_instructor(db_session, instructor_data)

        # 講師を非アクティブにする
        instructor.is_active = False
        db_session.commit()

        # 認証テスト（非アクティブなので失敗するはず）
        authenticated_instructor = authenticate_instructor(
            db_session, "test@example.com", "password123"
        )

        assert authenticated_instructor is None
