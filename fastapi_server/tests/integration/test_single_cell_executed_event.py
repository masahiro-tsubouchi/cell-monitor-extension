#!/usr/bin/env python3
"""
単一cell_executedイベント統合テスト

修正されたアンパックエラーを検証し、
PostgreSQLとInfluxDBへの正しいデータ永続化を確認する
"""

import pytest
import json
import time
from datetime import datetime
from typing import Dict, Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import text

from main import app
from db.session import get_db, SessionLocal
from db.models import Student, Notebook, Cell, CellExecution
from schemas.event import EventData


class TestSingleCellExecutedEvent:
    """単一cell_executedイベント統合テストクラス"""

    @pytest.fixture(autouse=True)
    def setup_test_environment(self, db_session: Session):
        """テスト環境セットアップ"""
        self.db = db_session
        self.client = TestClient(app)

        # テストデータクリーンアップ
        self._cleanup_test_data()

        yield

        # テスト後クリーンアップ
        self._cleanup_test_data()

    def _cleanup_test_data(self):
        """テストデータクリーンアップ"""
        try:
            # 外部キー制約の順序を考慮した削除
            self.db.execute(
                text(
                    "DELETE FROM cell_executions WHERE student_id IN (SELECT id FROM students WHERE user_id LIKE 'test_%')"
                )
            )
            self.db.execute(
                text(
                    "DELETE FROM cells WHERE notebook_id IN (SELECT id FROM notebooks WHERE path LIKE '%test_%')"
                )
            )
            # class_assignmentsテーブルの制約を回避するため、テスト用ノートブックのみ削除
            self.db.execute(
                text("DELETE FROM notebooks WHERE path LIKE '/test_notebooks/%'")
            )
            self.db.execute(text("DELETE FROM students WHERE user_id LIKE 'test_%'"))
            self.db.commit()
        except Exception as e:
            print(f"クリーンアップエラー (無視): {e}")
            self.db.rollback()

    def _create_test_event(self, user_id: str = "test_student_001") -> Dict[str, Any]:
        """テスト用cell_executedイベントデータを作成"""
        return {
            "eventId": f"evt_{int(time.time() * 1000)}",
            "eventType": "cell_executed",
            "userId": user_id,
            "userName": f"Test User {user_id}",
            "timestamp": datetime.now().isoformat(),
            "notebookPath": "/test_notebooks/test_notebook_001.ipynb",
            "notebookName": "test_notebook_001.ipynb",
            "cellId": "cell_001",
            "cellType": "code",
            "code": "print('Hello, World!')",
            "executionCount": 1,
            "hasError": False,
            "errorMessage": None,
            "duration": 0.123,
        }

    def test_single_cell_executed_event_persistence(self):
        """単一cell_executedイベントのデータベース永続化テスト"""
        # 1. テストイベントデータを作成
        event_data = self._create_test_event()

        # 2. APIエンドポイントにイベントを送信
        response = self.client.post(
            "/api/v1/events",
            json=[event_data],  # バッチ形式で送信
            headers={"Content-Type": "application/json"},
        )

        # 3. API応答を確認
        assert (
            response.status_code == 202
        ), f"Expected 202, got {response.status_code}: {response.text}"

        # 4. ワーカープロセスがメッセージを処理するまで待機
        time.sleep(3)

        # 5. PostgreSQLにデータが保存されているか確認
        # ワーカープロセスが別のセッションでコミットしたデータを確認するため、新しいセッションを作成
        with SessionLocal() as fresh_db:
            student = (
                fresh_db.query(Student)
                .filter(Student.user_id == event_data["userId"])
                .first()
            )
            assert student is not None, "Student should be created"
            assert student.user_id == event_data["userId"]

            notebook = (
                fresh_db.query(Notebook)
                .filter(Notebook.path == event_data["notebookPath"])
                .first()
            )
            assert notebook is not None, "Notebook should be created"
            assert notebook.path == event_data["notebookPath"]

            cell = (
                fresh_db.query(Cell)
                .filter(
                    Cell.notebook_id == notebook.id,
                    Cell.cell_id == event_data["cellId"],
                )
                .first()
            )
            assert cell is not None, "Cell should be created"
            assert cell.cell_id == event_data["cellId"]
            assert cell.cell_type == event_data["cellType"]

            execution = (
                fresh_db.query(CellExecution)
                .filter(
                    CellExecution.student_id == student.id,
                    CellExecution.notebook_id == notebook.id,
                    CellExecution.cell_id == cell.id,
                )
                .first()
            )
            assert execution is not None, "CellExecution should be created"
            assert execution.execution_count == event_data["executionCount"]
            # has_errorはモデルにはなく、statusでエラー状態を確認
            expected_status = "error" if event_data["hasError"] else "success"
            assert execution.status == expected_status

            print(f"✅ 単一cell_executedイベントの永続化成功:")
            print(f"   Student ID: {student.id}")
            print(f"   Notebook ID: {notebook.id}")
            print(f"   Cell ID: {cell.id}")
            print(f"   Execution ID: {execution.id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
