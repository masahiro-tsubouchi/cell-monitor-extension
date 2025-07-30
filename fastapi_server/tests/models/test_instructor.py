"""
講師モデルのテスト

AI駆動TDDアプローチによる講師ログイン機能・状態管理システムのテスト実装
Phase 1: 基盤構築 - Instructorモデルとステータス履歴モデルのテスト
"""

import pytest
import uuid
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker, Session
import os
import sys

# プロジェクトのルートディレクトリをsys.pathに追加
sys.path.insert(
    0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
)  # noqa: E402

# テスト対象のモデルをインポート
from db.models import Instructor, InstructorStatusHistory, InstructorStatus, Class
from db.base import Base


class TestInstructorModel:
    """講師モデルのテスト"""

    def test_create_instructor_basic(self, db_session: Session):
        """基本的な講師作成テスト"""
        instructor = Instructor(
            email="test@example.com",
            password_hash="hashed_password_123",
            name="Test Instructor",
            role="instructor",
        )

        db_session.add(instructor)
        db_session.commit()
        db_session.refresh(instructor)

        assert instructor.id is not None
        assert instructor.email == "test@example.com"
        assert instructor.password_hash == "hashed_password_123"
        assert instructor.name == "Test Instructor"
        assert instructor.role == "instructor"
        assert instructor.is_active is True
        assert instructor.status == InstructorStatus.OFFLINE  # デフォルト値
        assert instructor.created_at is not None
        assert instructor.last_login_at is None

    def test_instructor_email_unique_constraint(self, db_session: Session):
        """メールアドレスのユニーク制約テスト"""
        # 最初の講師を作成
        instructor1 = Instructor(
            email="duplicate@example.com", password_hash="hash1", name="Instructor 1"
        )
        db_session.add(instructor1)
        db_session.commit()

        # 同じメールアドレスで2番目の講師を作成（エラーになるはず）
        instructor2 = Instructor(
            email="duplicate@example.com", password_hash="hash2", name="Instructor 2"
        )
        db_session.add(instructor2)

        with pytest.raises(IntegrityError):
            db_session.commit()

    def test_instructor_status_enum_values(self, db_session: Session):
        """講師ステータスのEnum値テスト"""
        valid_statuses = [
            InstructorStatus.AVAILABLE,
            InstructorStatus.IN_SESSION,
            InstructorStatus.BREAK,
            InstructorStatus.OFFLINE,
        ]

        for i, enum_status in enumerate(valid_statuses):
            # ユニークなメールアドレスを使用
            instructor = Instructor(
                email=f"test_enum_{i}_{enum_status.value.lower()}@example.com",
                password_hash="hash",
                name=f"Test {enum_status.value}",
                status=enum_status,
            )
            db_session.add(instructor)
            db_session.commit()
            db_session.refresh(instructor)

            # PostgreSQL環境とSQLite環境の両方で動作するようにEnum値で直接比較
            assert instructor.status == enum_status

            # テスト後にデータを削除
            db_session.delete(instructor)
            db_session.commit()

    def test_instructor_update_status(self, db_session: Session):
        """講師ステータス更新テスト"""
        instructor = Instructor(
            email="status_test@example.com", password_hash="hash", name="Status Test"
        )
        db_session.add(instructor)
        db_session.commit()

        # ステータス更新
        instructor.status = InstructorStatus.AVAILABLE
        instructor.status_updated_at = datetime.now(timezone.utc)
        db_session.commit()
        db_session.refresh(instructor)

        # ステータスの確認
        assert (
            instructor.status == InstructorStatus.AVAILABLE
            or instructor.status.value == "available"
        )
        assert instructor.status.value == "available"
        assert instructor.status_updated_at is not None

    def test_instructor_last_login_update(self, db_session: Session):
        """最終ログイン時刻更新テスト"""
        instructor = Instructor(
            email="login_test@example.com", password_hash="hash", name="Login Test"
        )
        db_session.add(instructor)
        db_session.commit()

        # 最終ログイン時刻を更新
        login_time = datetime.now(timezone.utc)
        instructor.last_login_at = login_time
        db_session.commit()

        # SQLiteはタイムゾーン情報を保持しないため、時刻のみ比較
        assert instructor.last_login_at.replace(tzinfo=None) == login_time.replace(
            tzinfo=None
        )

    def test_instructor_class_relationship(self, db_session: Session):
        """講師とクラスのリレーションシップテスト"""
        # 講師を作成
        instructor = Instructor(
            email="teacher@example.com", password_hash="hash", name="Teacher"
        )
        db_session.add(instructor)
        db_session.commit()

        # クラスを作成（instructor_idを設定）
        class_obj = Class(
            class_code="TEST001", name="Test Class", instructor_id=instructor.id
        )
        db_session.add(class_obj)
        db_session.commit()

        # リレーションシップの確認
        assert len(instructor.classes) == 1
        assert instructor.classes[0].name == "Test Class"
        assert class_obj.instructor == instructor


class TestInstructorStatusHistoryModel:
    """講師ステータス履歴モデルのテスト"""

    def test_create_status_history(self, db_session: Session):
        """基本的なステータス履歴作成テスト"""
        # 講師を作成
        instructor = Instructor(
            email="history_test@example.com", password_hash="hash", name="History Test"
        )
        db_session.add(instructor)
        db_session.commit()

        # ステータス履歴を作成
        history = InstructorStatusHistory(
            instructor_id=instructor.id, status=InstructorStatus.IN_SESSION
        )
        db_session.add(history)
        db_session.commit()
        db_session.refresh(history)

        assert history.id is not None
        assert history.instructor_id == instructor.id
        assert history.status == InstructorStatus.IN_SESSION
        assert history.started_at is not None
        assert history.ended_at is None
        assert history.duration_minutes is None

    def test_status_history_end_session(self, db_session: Session):
        """ステータス履歴のセッション終了テスト"""
        # 講師とステータス履歴を作成
        instructor = Instructor(
            email="end_test@example.com", password_hash="hash", name="End Test"
        )
        db_session.add(instructor)
        db_session.commit()

        history = InstructorStatusHistory(
            instructor_id=instructor.id, status=InstructorStatus.IN_SESSION
        )
        db_session.add(history)
        db_session.commit()

        # セッション終了時刻を設定
        end_time = datetime.now(timezone.utc)
        history.ended_at = end_time
        db_session.commit()

        # SQLiteはタイムゾーン情報を保持しないため、時刻のみ比較
        assert history.ended_at.replace(tzinfo=None) == end_time.replace(tzinfo=None)

    def test_status_history_instructor_relationship(self, db_session: Session):
        """ステータス履歴と講師のリレーションシップテスト"""
        # 講師を作成
        instructor = Instructor(
            email="relationship_test@example.com",
            password_hash="hash",
            name="Relationship Test",
        )
        db_session.add(instructor)
        db_session.commit()

        # 複数のステータス履歴を作成
        history1 = InstructorStatusHistory(
            instructor_id=instructor.id, status=InstructorStatus.AVAILABLE
        )
        history2 = InstructorStatusHistory(
            instructor_id=instructor.id, status=InstructorStatus.IN_SESSION
        )

        db_session.add_all([history1, history2])
        db_session.commit()

        # リレーションシップの確認
        assert len(instructor.status_history) == 2
        assert history1.instructor == instructor
        assert history2.instructor == instructor

    def test_status_history_foreign_key_constraint(self, db_session: Session):
        """ステータス履歴の外部キー制約テスト"""
        # 存在しない講師IDでステータス履歴を作成（エラーになるはず）
        history = InstructorStatusHistory(
            instructor_id=99999, status=InstructorStatus.AVAILABLE  # 存在しないID
        )
        db_session.add(history)

        with pytest.raises(IntegrityError):
            db_session.commit()


class TestInstructorModelIntegration:
    """講師モデルの統合テスト"""

    def test_instructor_full_lifecycle(self, db_session: Session):
        """講師の完全なライフサイクルテスト"""
        # 1. 講師作成
        instructor = Instructor(
            email="lifecycle@example.com",
            password_hash="initial_hash",
            name="Lifecycle Test",
        )
        db_session.add(instructor)
        db_session.commit()

        # 2. ログイン（last_login_at更新）
        login_time = datetime.now(timezone.utc)
        instructor.last_login_at = login_time
        instructor.status = InstructorStatus.AVAILABLE
        db_session.commit()
        db_session.refresh(instructor)
        assert (
            instructor.status == InstructorStatus.AVAILABLE
            or instructor.status.value == "available"
        )

        instructor.status = InstructorStatus.IN_SESSION
        db_session.commit()
        db_session.refresh(instructor)
        assert (
            instructor.status == InstructorStatus.IN_SESSION
            or instructor.status.value == "in_session"
        )

        instructor.status = InstructorStatus.BREAK
        db_session.commit()
        db_session.refresh(instructor)
        assert instructor.status == InstructorStatus.BREAK

        instructor.status = InstructorStatus.OFFLINE
        db_session.commit()
        db_session.refresh(instructor)
        assert instructor.status == InstructorStatus.OFFLINE
        db_session.commit()

        # 検証
        # SQLiteはタイムゾーン情報を保持しないため、時刻のみ比較
        assert instructor.last_login_at.replace(tzinfo=None) == login_time.replace(
            tzinfo=None
        )
        assert instructor.status == InstructorStatus.OFFLINE

    def test_multiple_instructors_status_management(self, db_session: Session):
        """複数講師のステータス管理テスト"""
        # 複数の講師を作成
        instructors = []
        for i in range(3):
            instructor = Instructor(
                email=f"multi_{i}@example.com",
                password_hash=f"hash_{i}",
                name=f"Instructor {i}",
                status=(
                    InstructorStatus.AVAILABLE
                    if i % 2 == 0
                    else InstructorStatus.OFFLINE
                ),
            )
            instructors.append(instructor)
            db_session.add(instructor)

        db_session.commit()

        # ステータス別の講師数を確認
        available_count = (
            db_session.query(Instructor)
            .filter(Instructor.status == InstructorStatus.AVAILABLE)
            .count()
        )
        offline_count = (
            db_session.query(Instructor)
            .filter(Instructor.status == InstructorStatus.OFFLINE)
            .count()
        )

        assert available_count == 2  # インデックス0, 2
        assert offline_count == 1  # インデックス1
