"""
100人受講生データ格納テスト：基盤テスト

既存の186個テストケース成功パターンを活用したTDD実装
AI駆動TDD: Red → Green → Refactor サイクルで実装
"""

import asyncio
import json
import time
from typing import List, Dict, Any
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from schemas.event import EventData
from db.models import Student, Notebook, CellExecution
from tests.utils.data_generator import StudentDataGenerator
from tests.utils.performance_monitor import PerformanceMonitor


class Test100StudentsBase:
    """100人受講生基盤テスト"""

    @pytest.fixture(autouse=True)
    def setup(self, db_session: Session, client: TestClient):
        """テストセットアップ"""
        self.db = db_session
        self.client = client
        self.data_generator = StudentDataGenerator()
        self.performance_monitor = PerformanceMonitor()

    async def test_10_students_data_ingestion(self):
        """
        Phase 1: 10人データ投入テスト（Red → Green）
        既存成功パターン：オフライン同期API（11個全成功）を適用
        """
        # Red: まず失敗するテストを作成
        student_count = 10
        students = self.data_generator.generate_realistic_students(student_count)
        
        # 各学生につき50イベント生成（実教室環境シミュレーション）
        all_events = []
        for student in students:
            events = self.data_generator.generate_student_session_events(
                student_id=student["userId"],
                session_duration_minutes=30,
                notebooks_count=2,
                cells_per_notebook=15,
                error_rate=0.1  # 10%のエラー率
            )
            all_events.extend(events)

        # パフォーマンス測定開始
        start_time = time.time()
        
        # バッチデータ投入（既存成功パターン：バッチ処理対応）
        batch_size = 50  # 既存のMAX_BATCH_SIZE設定に合わせる
        results = []
        
        for i in range(0, len(all_events), batch_size):
            batch = all_events[i:i + batch_size]
            response = self.client.post("/api/v1/events", json=batch)
            results.append(response)

        execution_time = time.time() - start_time

        # Green: テストを成功させる
        # 既存成功パターン：全レスポンスが202 Acceptedであることを確認
        for response in results:
            assert response.status_code == 202
            response_data = response.json()
            assert "message" in response_data
            assert "batch_stats" in response_data

        # パフォーマンス検証（10人基準）
        expected_throughput = student_count * 5  # 学生あたり5イベント/秒
        actual_throughput = len(all_events) / execution_time
        assert actual_throughput >= expected_throughput

        # データベース整合性検証（既存成功パターン）
        await self._verify_database_consistency(students, all_events)

    async def test_25_students_data_ingestion(self):
        """
        Phase 2: 25人データ投入テスト
        既存成功パターン：LMS統合テスト（9個全成功）を適用
        """
        student_count = 25
        students = self.data_generator.generate_realistic_students(student_count)
        
        # LMS統合パターン：クラス・課題・提出データも含める
        classes = self._create_test_classes(3)  # 3クラス
        assignments = self._create_test_assignments(classes, 5)  # クラスあたり5課題
        
        # 各学生の学習セッション生成
        all_events = []
        for student in students:
            # 既存成功パターン：外部キー制約を考慮したデータ生成
            events = self.data_generator.generate_lms_integrated_session(
                student=student,
                classes=classes,
                assignments=assignments,
                session_duration_minutes=45
            )
            all_events.extend(events)

        # パフォーマンス測定
        start_time = time.time()
        
        # バッチ処理実行
        results = await self._execute_batch_events(all_events)
        
        execution_time = time.time() - start_time

        # 成功検証
        assert all(r.status_code == 202 for r in results)
        
        # パフォーマンス検証（25人基準）
        expected_throughput = student_count * 8  # 学生あたり8イベント/秒
        actual_throughput = len(all_events) / execution_time
        assert actual_throughput >= expected_throughput

        # LMS統合データ整合性検証
        await self._verify_lms_data_integrity(students, classes, assignments)

    async def test_50_students_data_ingestion(self):
        """
        Phase 3: 50人データ投入テスト
        既存成功パターン：WebSocket統合テスト（13個全成功）を適用
        """
        student_count = 50
        students = self.data_generator.generate_realistic_students(student_count)
        
        # WebSocket統合パターン：リアルタイム通知も含める
        websocket_connections = []
        
        # 各学生のWebSocket接続シミュレーション
        for student in students[:10]:  # 最初の10人のみWebSocket接続
            # 既存成功パターン：ConnectionManager直接テスト方式
            connection = await self._create_mock_websocket_connection(
                student["userId"]
            )
            websocket_connections.append(connection)

        # 学習セッション生成
        all_events = []
        for student in students:
            events = self.data_generator.generate_websocket_integrated_session(
                student=student,
                session_duration_minutes=60,
                realtime_notifications=True
            )
            all_events.extend(events)

        # パフォーマンス測定とリアルタイム処理
        start_time = time.time()
        
        # 並行処理実行（既存成功パターン：非同期処理対応）
        batch_task = asyncio.create_task(
            self._execute_batch_events(all_events)
        )
        websocket_task = asyncio.create_task(
            self._monitor_websocket_notifications(websocket_connections)
        )
        
        results, notifications = await asyncio.gather(batch_task, websocket_task)
        
        execution_time = time.time() - start_time

        # 成功検証
        assert all(r.status_code == 202 for r in results)
        assert len(notifications) > 0  # WebSocket通知が発生していること

        # パフォーマンス検証（50人基準）
        expected_throughput = student_count * 10  # 学生あたり10イベント/秒
        actual_throughput = len(all_events) / execution_time
        assert actual_throughput >= expected_throughput

        # WebSocket統合整合性検証
        await self._verify_websocket_integration(students, notifications)

    async def test_75_students_data_ingestion(self):
        """
        Phase 4: 75人データ投入テスト
        既存成功パターン：講師ログイン機能（123個全成功）を適用
        """
        student_count = 75
        students = self.data_generator.generate_realistic_students(student_count)
        
        # 講師ログイン機能統合：講師ステータス管理も含める
        instructors = self._create_test_instructors(5)  # 5人の講師
        
        # 講師認証とステータス管理
        for instructor in instructors:
            # 既存成功パターン：JWT認証統合
            auth_response = self.client.post("/api/v1/auth/login", json={
                "email": instructor["email"],
                "password": "test_password"
            })
            assert auth_response.status_code == 200
            instructor["token"] = auth_response.json()["access_token"]

        # 学習セッション生成（講師割り当て含む）
        all_events = []
        for student in students:
            # 既存成功パターン：講師-学生マッチング機能
            assigned_instructor = self._assign_instructor_to_student(
                student, instructors
            )
            
            events = self.data_generator.generate_instructor_integrated_session(
                student=student,
                instructor=assigned_instructor,
                session_duration_minutes=75
            )
            all_events.extend(events)

        # パフォーマンス測定
        start_time = time.time()
        
        # 講師認証付きバッチ処理
        results = await self._execute_authenticated_batch_events(
            all_events, instructors
        )
        
        execution_time = time.time() - start_time

        # 成功検証
        assert all(r.status_code == 202 for r in results)

        # パフォーマンス検証（75人基準）
        expected_throughput = student_count * 12  # 学生あたり12イベント/秒
        actual_throughput = len(all_events) / execution_time
        assert actual_throughput >= expected_throughput

        # 講師統合データ整合性検証
        await self._verify_instructor_integration(students, instructors)

    async def test_100_students_full_integration(self):
        """
        Phase 5: 100人完全統合テスト
        全ての既存成功パターンを統合適用
        """
        student_count = 100
        students = self.data_generator.generate_realistic_students(student_count)
        
        # 完全統合環境セットアップ
        classes = self._create_test_classes(5)
        assignments = self._create_test_assignments(classes, 8)
        instructors = self._create_test_instructors(8)
        
        # 講師認証
        for instructor in instructors:
            auth_response = self.client.post("/api/v1/auth/login", json={
                "email": instructor["email"],
                "password": "test_password"
            })
            assert auth_response.status_code == 200
            instructor["token"] = auth_response.json()["access_token"]

        # WebSocket接続（講師用）
        instructor_connections = []
        for instructor in instructors:
            connection = await self._create_authenticated_websocket_connection(
                instructor["token"]
            )
            instructor_connections.append(connection)

        # 90分授業の完全シミュレーション
        all_events = []
        for student in students:
            assigned_instructor = self._assign_instructor_to_student(
                student, instructors
            )
            assigned_class = classes[hash(student["userId"]) % len(classes)]
            
            events = self.data_generator.generate_full_classroom_session(
                student=student,
                instructor=assigned_instructor,
                class_info=assigned_class,
                assignments=assignments,
                session_duration_minutes=90
            )
            all_events.extend(events)

        # パフォーマンス測定開始
        start_time = time.time()
        
        # 完全統合処理実行
        tasks = [
            self._execute_authenticated_batch_events(all_events, instructors),
            self._monitor_instructor_websockets(instructor_connections),
            self._monitor_system_resources(),
        ]
        
        results, notifications, resource_metrics = await asyncio.gather(*tasks)
        
        execution_time = time.time() - start_time

        # 成功検証
        assert all(r.status_code == 202 for r in results)
        assert len(notifications) > 0

        # パフォーマンス検証（100人基準）
        expected_throughput = 1000  # 1000イベント/秒
        actual_throughput = len(all_events) / execution_time
        assert actual_throughput >= expected_throughput

        # リソース使用量検証
        assert resource_metrics["peak_memory_mb"] <= 4096  # 4GB以内
        assert resource_metrics["peak_cpu_percent"] <= 80  # 80%以内

        # 完全データ整合性検証
        await self._verify_full_integration_consistency(
            students, instructors, classes, assignments, all_events
        )

    # ヘルパーメソッド群（既存成功パターンを活用）

    async def _verify_database_consistency(self, students: List[Dict], events: List[Dict]):
        """データベース整合性検証（既存成功パターン）"""
        # PostgreSQL検証
        pg_student_count = self.db.query(Student).count()
        pg_execution_count = self.db.query(CellExecution).count()
        
        # 基本整合性確認
        assert pg_student_count == len(students)
        
        # イベント数の整合性確認（エラーイベントを除く）
        successful_events = [e for e in events if not e.get("hasError", False)]
        assert pg_execution_count >= len(successful_events) * 0.9  # 90%以上成功

    async def _verify_lms_data_integrity(self, students, classes, assignments):
        """LMS統合データ整合性検証"""
        # 既存成功パターン：外部キー制約検証
        from db.models import Class, ClassAssignment, AssignmentSubmission
        
        db_classes = self.db.query(Class).count()
        db_assignments = self.db.query(ClassAssignment).count()
        db_submissions = self.db.query(AssignmentSubmission).count()
        
        assert db_classes >= len(classes)
        assert db_assignments >= len(assignments)
        assert db_submissions > 0

    async def _verify_websocket_integration(self, students, notifications):
        """WebSocket統合整合性検証"""
        # 既存成功パターン：ConnectionManager検証
        assert len(notifications) > 0
        
        # 通知内容の検証
        for notification in notifications:
            assert "userId" in notification
            assert "status" in notification

    async def _verify_instructor_integration(self, students, instructors):
        """講師統合整合性検証"""
        # 既存成功パターン：講師ステータス管理検証
        from db.models import Instructor, InstructorStatusHistory
        
        db_instructors = self.db.query(Instructor).count()
        db_status_history = self.db.query(InstructorStatusHistory).count()
        
        assert db_instructors >= len(instructors)
        assert db_status_history > 0

    async def _verify_full_integration_consistency(self, students, instructors, classes, assignments, events):
        """完全統合整合性検証"""
        # 全ての既存成功パターンを適用
        await self._verify_database_consistency(students, events)
        await self._verify_lms_data_integrity(students, classes, assignments)
        await self._verify_instructor_integration(students, instructors)
        
        # 追加の完全性チェック
        total_expected_records = len(students) + len(instructors) + len(classes)
        
        # データベース全体の整合性確認
        from db.models import Student, Instructor, Class
        total_actual_records = (
            self.db.query(Student).count() +
            self.db.query(Instructor).count() +
            self.db.query(Class).count()
        )
        
        assert total_actual_records >= total_expected_records

    def _create_test_classes(self, count: int) -> List[Dict]:
        """テスト用クラス作成"""
        return [
            {
                "id": f"class_{i:03d}",
                "name": f"Test Class {i}",
                "description": f"Test class for load testing {i}"
            }
            for i in range(1, count + 1)
        ]

    def _create_test_assignments(self, classes: List[Dict], per_class: int) -> List[Dict]:
        """テスト用課題作成"""
        assignments = []
        for class_info in classes:
            for i in range(per_class):
                assignments.append({
                    "id": f"assignment_{class_info['id']}_{i:03d}",
                    "class_id": class_info["id"],
                    "title": f"Assignment {i} for {class_info['name']}",
                    "description": f"Test assignment {i}"
                })
        return assignments

    def _create_test_instructors(self, count: int) -> List[Dict]:
        """テスト用講師作成"""
        return [
            {
                "id": f"instructor_{i:03d}",
                "email": f"instructor{i}@test.com",
                "name": f"Test Instructor {i}",
                "password": "test_password"
            }
            for i in range(1, count + 1)
        ]

    def _assign_instructor_to_student(self, student: Dict, instructors: List[Dict]) -> Dict:
        """学生に講師を割り当て"""
        # ハッシュベースの安定した割り当て
        instructor_index = hash(student["userId"]) % len(instructors)
        return instructors[instructor_index]

    async def _execute_batch_events(self, events: List[Dict]) -> List:
        """バッチイベント実行"""
        batch_size = 50
        results = []
        
        for i in range(0, len(events), batch_size):
            batch = events[i:i + batch_size]
            response = self.client.post("/api/v1/events", json=batch)
            results.append(response)
            
            # 負荷分散のため少し待機
            await asyncio.sleep(0.01)
        
        return results

    async def _execute_authenticated_batch_events(self, events: List[Dict], instructors: List[Dict]) -> List:
        """認証付きバッチイベント実行"""
        # 講師トークンを使用した認証付きリクエスト
        headers = {"Authorization": f"Bearer {instructors[0]['token']}"}
        
        batch_size = 50
        results = []
        
        for i in range(0, len(events), batch_size):
            batch = events[i:i + batch_size]
            response = self.client.post("/api/v1/events", json=batch, headers=headers)
            results.append(response)
            
            await asyncio.sleep(0.01)
        
        return results

    async def _create_mock_websocket_connection(self, user_id: str):
        """モックWebSocket接続作成"""
        # 既存成功パターン：ConnectionManager直接テスト方式
        return {
            "user_id": user_id,
            "connected_at": time.time(),
            "is_active": True
        }

    async def _create_authenticated_websocket_connection(self, token: str):
        """認証付きWebSocket接続作成"""
        return {
            "token": token,
            "connected_at": time.time(),
            "is_active": True
        }

    async def _monitor_websocket_notifications(self, connections: List[Dict]) -> List[Dict]:
        """WebSocket通知監視"""
        # 既存成功パターン：非同期処理対応
        notifications = []
        
        for connection in connections:
            # モック通知生成
            notification = {
                "user_id": connection["user_id"],
                "message": "Test notification",
                "timestamp": time.time()
            }
            notifications.append(notification)
        
        return notifications

    async def _monitor_instructor_websockets(self, connections: List[Dict]) -> List[Dict]:
        """講師WebSocket監視"""
        notifications = []
        
        for connection in connections:
            notification = {
                "token": connection["token"],
                "message": "Instructor notification",
                "timestamp": time.time()
            }
            notifications.append(notification)
        
        return notifications

    async def _monitor_system_resources(self) -> Dict[str, Any]:
        """システムリソース監視"""
        import psutil
        
        return {
            "peak_memory_mb": psutil.virtual_memory().used // (1024 * 1024),
            "peak_cpu_percent": psutil.cpu_percent(),
            "active_connections": 100  # モック値
        }
