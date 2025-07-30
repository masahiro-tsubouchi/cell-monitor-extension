#!/usr/bin/env python3
"""
テスト用講師データを作成するスクリプト
"""
import sys
import os

# プロジェクトルートをPythonパスに追加
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from db.session import SessionLocal
from crud.crud_instructor import create_instructor, get_instructor_by_email
from schemas.instructor import InstructorCreate


def create_test_instructor():
    """テスト用講師データを作成"""
    db: Session = SessionLocal()

    try:
        # テスト用講師データ
        test_instructor_data = InstructorCreate(
            email="instructor@example.com",
            password="password123",
            name="テスト講師",
            role="instructor",
        )

        # 既に存在するかチェック
        existing_instructor = get_instructor_by_email(db, test_instructor_data.email)
        if existing_instructor:
            print(f"講師 {test_instructor_data.email} は既に存在します。")
            print(f"ID: {existing_instructor.id}, 名前: {existing_instructor.name}")
            return existing_instructor

        # 講師を作成
        instructor = create_instructor(db, test_instructor_data)
        print(f"テスト用講師を作成しました:")
        print(f"ID: {instructor.id}")
        print(f"Email: {instructor.email}")
        print(f"Name: {instructor.name}")
        print(f"Status: {instructor.status}")
        print(f"Active: {instructor.is_active}")

        return instructor

    except Exception as e:
        print(f"エラーが発生しました: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_test_instructor()
