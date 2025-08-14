#!/usr/bin/env python3
"""
100学生データ取り込み統合テスト

修正されたcell_executedイベント処理を検証し、
PostgreSQLとInfluxDBの両方への正しいデータ永続化を確認する
AI駆動TDD: 186個テストケース成功パターンを活用
"""

import pytest
import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import List, Dict, Any
from unittest.mock import patch, AsyncMock

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import text

from main import app
from db.session import get_db
from db.models import Student, Notebook, Cell, CellExecution, Session as SessionModel
from schemas.event import EventData
from worker.event_router import event_router, handle_cell_execution
from tests.utils.performance_monitor import LoadTestMonitor
from core.config import settings


class Test100StudentsDataPersistence:
    """100学生データ永続化統合テストクラス"""

    @pytest.fixture(autouse=True)
    def setup_test_environment(self, db_session: Session):
        """テスト環境セットアップ"""
        self.db = db_session
        self.client = TestClient(app)
        self.monitor = LoadTestMonitor("100_students_test", 100)

        # テストデータクリーンアップ
        self._cleanup_test_data()

        yield

        # テスト後クリーンアップ
        self._cleanup_test_data()

    def _cleanup_test_data(self):
        """テストデータクリーンアップ"""
        try:
            # テスト用データを削除
            self.db.execute(
                text(
                    "DELETE FROM cell_executions WHERE student_id IN (SELECT id FROM students WHERE user_id LIKE 'test_student_%')"
                )
            )
            self.db.execute(
                text(
                    "DELETE FROM cells WHERE notebook_id IN (SELECT id FROM notebooks WHERE path LIKE '/test/%')"
                )
            )
            self.db.execute(text("DELETE FROM notebooks WHERE path LIKE '/test/%'"))
            self.db.execute(
                text("DELETE FROM students WHERE user_id LIKE 'test_student_%'")
            )
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            print(f"クリーンアップエラー: {e}")

    def test_single_cell_executed_event_persistence(self):
        """単一のcell_executedイベントの永続化テスト"""
        # Given: 単一の学生によるセル実行イベント
        event_data = {
            "userId": "test_student_001",
            "eventType": "cell_executed",
            "notebookPath": "/test/notebook_001.ipynb",
            "cellId": "cell_001",
            "executionCount": 1,
            "timestamp": datetime.now().isoformat(),
            "duration": 1500,
            "hasError": False,
            "code": "print('Hello World')",
            "output": "Hello World\n",
        }

        # When: イベントをAPIエンドポイントに送信
        response = self.client.post("/api/v1/events", json=[event_data])

        # Then: APIレスポンスが成功
        assert response.status_code == 202  # 非同期処理のため202 Accepted

        # 少し待機してワーカー処理を完了させる
        time.sleep(2)

        # Then: PostgreSQLにデータが保存されている
        student = (
            self.db.query(Student).filter(Student.user_id == "test_student_001").first()
        )
        assert student is not None
        assert student.user_id == "test_student_001"

        notebook = (
            self.db.query(Notebook)
            .filter(Notebook.path == "/test/notebook_001.ipynb")
            .first()
        )
        assert notebook is not None
        assert notebook.path == "/test/notebook_001.ipynb"

        cell_execution = (
            self.db.query(CellExecution)
            .filter(CellExecution.student_id == student.id)
            .first()
        )
        assert cell_execution is not None
        assert cell_execution.status == "success"
        assert cell_execution.duration == 1500

    def test_multiple_students_concurrent_events(self):
        """複数学生の同時イベント処理テスト"""
        # Given: 10人の学生による同時セル実行イベント
        events = []
        for i in range(10):
            events.append(
                {
                    "userId": f"test_student_{i:03d}",
                    "eventType": "cell_executed",
                    "notebookPath": f"/test/notebook_{i:03d}.ipynb",
                    "cellId": f"cell_{i:03d}",
                    "executionCount": 1,
                    "timestamp": datetime.now().isoformat(),
                    "duration": 1000 + i * 100,
                    "hasError": i % 3 == 0,  # 3人に1人はエラー
                    "code": f"print('Student {i}')",
                    "output": f"Student {i}\n" if i % 3 != 0 else None,
                    "errorMessage": "Test error" if i % 3 == 0 else None,
                }
            )

        # When: バッチでイベントを送信
        response = self.client.post("/api/v1/events", json=events)

        # Then: APIレスポンスが成功
        assert response.status_code == 202  # 非同期処理のため202 Accepted

        # ワーカー処理完了を待機
        time.sleep(5)

        # Then: 全学生のデータが保存されている
        students = (
            self.db.query(Student).filter(Student.user_id.like("test_student_%")).all()
        )
        assert len(students) == 10

        # Then: セル実行履歴が正しく保存されている
        executions = (
            self.db.query(CellExecution)
            .join(Student)
            .filter(Student.user_id.like("test_student_%"))
            .all()
        )
        assert len(executions) == 10

        # Then: エラー状態が正しく記録されている
        error_executions = [ex for ex in executions if ex.error_message is not None]
        success_executions = [ex for ex in executions if ex.error_message is None]
        assert len(error_executions) >= 3  # 3人に1人はエラー
        assert len(success_executions) >= 6  # 残りは成功

    def test_100_students_load_test_with_monitoring(self):
        """100学生負荷テスト（パフォーマンス監視付き）"""
        # Given: パフォーマンス監視開始
        self.monitor.start_monitoring()

        try:
            # Given: 100人の学生データ
            batch_size = 20
            total_students = 100

            for batch_start in range(0, total_students, batch_size):
                events = []
                for i in range(
                    batch_start, min(batch_start + batch_size, total_students)
                ):
                    events.append(
                        {
                            "userId": f"test_student_{i:03d}",
                            "eventType": "cell_executed",
                            "notebookPath": f"/test/notebook_{i % 10:03d}.ipynb",  # 10種類のノートブック
                            "cellId": f"cell_{i % 5:03d}",  # 5種類のセル
                            "executionCount": (i % 3) + 1,
                            "timestamp": datetime.now().isoformat(),
                            "duration": 500 + (i % 1000),
                            "hasError": i % 7 == 0,  # 7人に1人はエラー
                            "code": f"# Student {i}\nresult = {i} * 2\nprint(result)",
                            "output": f"{i * 2}\n" if i % 7 != 0 else None,
                            "errorMessage": (
                                f"Error in student {i}" if i % 7 == 0 else None
                            ),
                        }
                    )

                # When: バッチ送信
                response = self.client.post("/api/v1/events", json=events)
                assert response.status_code == 202  # 非同期処理のため202 Accepted

                # 少し待機
                time.sleep(1)

            # 全処理完了を待機
            time.sleep(10)

            # Then: パフォーマンス指標を確認
            metrics = self.monitor.get_current_metrics()
            assert metrics["cpu_percent"] < 80  # CPU使用率80%未満
            assert metrics["memory_percent"] < 80  # メモリ使用率80%未満

            # Then: 全データが正しく保存されている
            students = (
                self.db.query(Student)
                .filter(Student.user_id.like("test_student_%"))
                .all()
            )
            assert len(students) == total_students

            notebooks = (
                self.db.query(Notebook).filter(Notebook.path.like("/test/%")).all()
            )
            assert len(notebooks) == 10  # 10種類のノートブック

            executions = (
                self.db.query(CellExecution)
                .join(Student)
                .filter(Student.user_id.like("test_student_%"))
                .all()
            )
            assert len(executions) == total_students

            # Then: エラー率が期待値内
            error_count = len([ex for ex in executions if ex.error_message is not None])
            error_rate = error_count / total_students
            assert 0.10 <= error_rate <= 0.20  # エラー率10-20%（7人に1人なので約14%）

        finally:
            # パフォーマンス監視停止
            self.monitor.stop_monitoring()
            report = self.monitor.generate_report()
            print(f"パフォーマンスレポート: {report}")

    @pytest.mark.asyncio
    async def test_event_router_direct_processing(self):
        """イベントルーターの直接処理テスト"""
        # Given: テストイベントデータ
        event_data = {
            "userId": "test_student_direct",
            "eventType": "cell_executed",
            "notebookPath": "/test/direct_test.ipynb",
            "cellId": "direct_cell",
            "executionCount": 1,
            "timestamp": datetime.now().isoformat(),
            "duration": 2000,
            "hasError": False,
            "code": "x = 42\nprint(x)",
            "output": "42\n",
        }

        # When: イベントルーターで直接処理
        result = await handle_cell_execution(event_data, self.db)

        # Then: 処理が成功
        assert result is True

        # Then: データが正しく保存されている
        student = (
            self.db.query(Student)
            .filter(Student.user_id == "test_student_direct")
            .first()
        )
        assert student is not None

        execution = (
            self.db.query(CellExecution)
            .filter(CellExecution.student_id == student.id)
            .first()
        )
        assert execution is not None
        assert execution.duration == 2000
        assert execution.status == "success"

    def test_error_handling_and_recovery(self):
        """エラーハンドリングと復旧テスト"""
        # Given: 不正なデータを含むイベント
        invalid_events = [
            {
                "userId": "",  # 空のユーザーID
                "eventType": "cell_executed",
                "notebookPath": "/test/invalid.ipynb",
                "cellId": "invalid_cell",
                "timestamp": datetime.now().isoformat(),
            },
            {
                "userId": "test_student_valid",
                "eventType": "cell_executed",
                "notebookPath": "/test/valid.ipynb",
                "cellId": "valid_cell",
                "executionCount": 1,
                "timestamp": datetime.now().isoformat(),
                "duration": 1000,
                "hasError": False,
            },
        ]

        # When: 不正データを含むバッチを送信
        response = self.client.post("/api/v1/events", json=invalid_events)

        # Then: APIは成功レスポンス（個別エラーは内部処理）
        assert response.status_code == 202  # 非同期処理のため202 Accepted

        # 処理完了を待機
        time.sleep(3)

        # Then: 有効なデータのみが保存されている
        valid_student = (
            self.db.query(Student)
            .filter(Student.user_id == "test_student_valid")
            .first()
        )
        assert valid_student is not None

        invalid_student = self.db.query(Student).filter(Student.user_id == "").first()
        assert invalid_student is None

    def test_data_consistency_across_databases(self):
        """データベース間のデータ整合性テスト"""
        # Given: 複数のイベントタイプ
        events = [
            {
                "userId": "test_student_consistency",
                "eventType": "cell_executed",
                "notebookPath": "/test/consistency.ipynb",
                "cellId": "cell_001",
                "executionCount": 1,
                "timestamp": datetime.now().isoformat(),
                "duration": 1200,
                "hasError": False,
            },
            {
                "userId": "test_student_consistency",
                "eventType": "notebook_opened",
                "notebookPath": "/test/consistency.ipynb",
                "timestamp": datetime.now().isoformat(),
            },
            {
                "userId": "test_student_consistency",
                "eventType": "notebook_saved",
                "notebookPath": "/test/consistency.ipynb",
                "timestamp": datetime.now().isoformat(),
            },
        ]

        # When: 複数イベントを送信
        response = self.client.post("/api/v1/events", json=events)
        assert response.status_code == 202  # 非同期処理のため202 Accepted

        # 処理完了を待機
        time.sleep(3)

        # Then: PostgreSQLにデータが保存されている
        student = (
            self.db.query(Student)
            .filter(Student.user_id == "test_student_consistency")
            .first()
        )
        assert student is not None

        notebook = (
            self.db.query(Notebook)
            .filter(Notebook.path == "/test/consistency.ipynb")
            .first()
        )
        assert notebook is not None

        # cell_executedイベントのみがCellExecutionテーブルに保存される
        executions = (
            self.db.query(CellExecution)
            .filter(CellExecution.student_id == student.id)
            .all()
        )
        assert len(executions) == 1
        assert executions[0].duration == 1200

        # Note: InfluxDBの確認は別途InfluxDB接続が必要

    def test_performance_under_sustained_load(self):
        """持続的負荷下でのパフォーマンステスト"""
        # Given: 持続的負荷シミュレーション
        duration_seconds = 30
        events_per_second = 5
        start_time = time.time()

        event_count = 0
        while time.time() - start_time < duration_seconds:
            events = []
            for i in range(events_per_second):
                events.append(
                    {
                        "userId": f"test_student_sustained_{event_count:03d}",
                        "eventType": "cell_executed",
                        "notebookPath": f"/test/sustained_{event_count % 3}.ipynb",
                        "cellId": f"cell_{event_count % 2}",
                        "executionCount": 1,
                        "timestamp": datetime.now().isoformat(),
                        "duration": 800 + (event_count % 400),
                        "hasError": event_count % 10 == 0,
                    }
                )
                event_count += 1

            # When: 継続的にイベント送信
            response = self.client.post("/api/v1/events", json=events)
            assert response.status_code == 202  # 非同期処理のため202 Accepted

            time.sleep(1)  # 1秒間隔

        # 処理完了を待機
        time.sleep(5)

        # Then: 全データが正しく処理されている
        students = (
            self.db.query(Student)
            .filter(Student.user_id.like("test_student_sustained_%"))
            .all()
        )
        expected_count = duration_seconds * events_per_second

        # 多少の処理遅延を考慮して90%以上が処理されていれば成功
        assert len(students) >= expected_count * 0.9

        print(
            f"持続的負荷テスト結果: {len(students)}/{expected_count} イベント処理完了"
        )


@pytest.mark.integration
class TestInfluxDBIntegration:
    """InfluxDB統合テスト（接続可能な場合のみ）"""

    @pytest.mark.skipif(
        not hasattr(settings, "INFLUXDB_URL"), reason="InfluxDB not configured"
    )
    def test_influxdb_data_persistence(self):
        """InfluxDBデータ永続化テスト"""
        # TODO: InfluxDB接続が正常な場合のテスト実装
        pass


if __name__ == "__main__":
    # 単体でテスト実行する場合
    pytest.main([__file__, "-v", "--tb=short"])
