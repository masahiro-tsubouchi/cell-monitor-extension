"""
データベース管理API テスト
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from db.models import Student, Session as SessionModel, CellExecution, Team
from main import app

client = TestClient(app)


class TestAdminDatabaseAPI:
    """管理者DB API テスト"""
    
    def test_get_database_tables(self):
        """テーブル一覧取得のテスト"""
        response = client.get("/api/v1/admin/database/tables")
        
        assert response.status_code == 200
        data = response.json()
        assert "tables" in data
        assert len(data["tables"]) > 0
        
        # 主要テーブルが含まれているか確認
        table_names = [table["table_name"] for table in data["tables"]]
        assert "students" in table_names
        assert "sessions" in table_names
        assert "cell_executions" in table_names
    
    def test_get_database_stats(self, db_session: Session):
        """データベース統計取得のテスト"""
        # Given: テストデータを作成
        team = Team(team_name="Test Team", description="Test")
        db_session.add(team)
        db_session.commit()
        
        student = Student(
            email="test@example.com",
            name="Test Student",
            team_id=team.id
        )
        db_session.add(student)
        db_session.commit()
        
        # When: 統計を取得
        response = client.get("/api/v1/admin/database/stats")
        
        # Then: 正しい統計が返される
        assert response.status_code == 200
        data = response.json()
        assert "database_stats" in data
        assert "students" in data["database_stats"]
        assert data["database_stats"]["students"]["total_records"] >= 1
    
    def test_search_database_data(self, db: Session):
        """データベース検索のテスト"""
        # Given: テストデータを作成
        team = Team(team_name="Search Test Team")
        db_session.add(team)
        db_session.commit()
        
        student = Student(
            email="search@example.com",
            name="Search Test Student",
            team_id=team.id
        )
        db_session.add(student)
        db_session.commit()
        
        # When: 学生データを検索
        response = client.post("/api/v1/admin/database/search", json={
            "table_name": "students",
            "filters": {"email": "search@example.com"},
            "limit": 10,
            "offset": 0
        })
        
        # Then: 正しい検索結果が返される
        assert response.status_code == 200
        data = response.json()
        assert data["table_name"] == "students"
        assert len(data["data"]) >= 1
        assert data["data"][0]["email"] == "search@example.com"
    
    def test_search_with_filters(self, db: Session):
        """フィルタリング検索のテスト"""
        # Given: 複数のテストデータを作成
        team = Team(team_name="Filter Test Team")
        db_session.add(team)
        db_session.commit()
        
        # 異なる状態の学生を作成
        student1 = Student(
            email="filter1@example.com",
            name="Filter Student 1",
            team_id=team.id,
            is_requesting_help=True
        )
        student2 = Student(
            email="filter2@example.com",
            name="Filter Student 2",
            team_id=team.id,
            is_requesting_help=False
        )
        db_session.add_all([student1, student2])
        db_session.commit()
        
        # When: ヘルプ要求中の学生のみを検索
        response = client.post("/api/v1/admin/database/search", json={
            "table_name": "students",
            "filters": {"is_requesting_help": True},
            "limit": 10,
            "offset": 0
        })
        
        # Then: フィルタリングされた結果が返される
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) >= 1
        for record in data["data"]:
            assert record["is_requesting_help"] is True
    
    def test_delete_record(self, db: Session):
        """レコード削除のテスト"""
        # Given: 削除対象のテストデータを作成
        team = Team(team_name="Delete Test Team")
        db_session.add(team)
        db_session.commit()
        
        student = Student(
            email="delete@example.com",
            name="Delete Test Student",
            team_id=team.id
        )
        db_session.add(student)
        db_session.commit()
        student_id = student.id
        
        # When: レコードを削除
        response = client.delete(f"/api/v1/admin/database/students/{student_id}")
        
        # Then: 削除が成功
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert str(student_id) in data["message"]
        
        # 実際に削除されたか確認
        deleted_student = db_session.query(Student).filter(Student.id == student_id).first()
        assert deleted_student is None
    
    def test_cleanup_old_sessions(self, db: Session):
        """古いセッションクリーンアップのテスト"""
        # Given: 古いセッションデータを作成
        team = Team(team_name="Cleanup Test Team")
        db_session.add(team)
        db_session.commit()
        
        student = Student(
            email="cleanup@example.com",
            name="Cleanup Test Student",
            team_id=team.id
        )
        db_session.add(student)
        db_session.commit()
        
        # 古いセッション（45日前）
        old_session = SessionModel(
            session_id="old_session_123",
            student_id=student.id,
            start_time=datetime.utcnow() - timedelta(days=45),
            is_active=False
        )
        
        # 新しいセッション（5日前）
        new_session = SessionModel(
            session_id="new_session_456",
            student_id=student.id,
            start_time=datetime.utcnow() - timedelta(days=5),
            is_active=True
        )
        
        db_session.add_all([old_session, new_session])
        db_session.commit()
        
        # When: 30日以上古いセッションをクリーンアップ
        response = client.post("/api/v1/admin/database/cleanup/old-sessions?days_old=30")
        
        # Then: 古いセッションのみクリーンアップされる
        assert response.status_code == 200
        data = response.json()
        assert "cleaned_sessions" in data
        assert data["cleaned_sessions"] >= 1
    
    def test_database_health(self):
        """データベースヘルスチェックのテスト"""
        response = client.get("/api/v1/admin/database/health")
        
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "connection" in data
        assert "checked_at" in data
        assert data["status"] in ["healthy", "unhealthy"]
    
    def test_search_invalid_table(self):
        """存在しないテーブルの検索テスト"""
        response = client.post("/api/v1/admin/database/search", json={
            "table_name": "nonexistent_table",
            "limit": 10,
            "offset": 0
        })
        
        assert response.status_code == 404
        assert "が見つかりません" in response.json()["detail"]
    
    def test_delete_nonexistent_record(self):
        """存在しないレコードの削除テスト"""
        response = client.delete("/api/v1/admin/database/students/99999")
        
        assert response.status_code == 404
        assert "が見つかりません" in response.json()["detail"]


class TestSecurityAndValidation:
    """セキュリティと検証のテスト"""
    
    def test_large_offset_handling(self):
        """大きなオフセット値の処理テスト"""
        response = client.post("/api/v1/admin/database/search", json={
            "table_name": "students",
            "limit": 10,
            "offset": 1000000  # 非常に大きなオフセット
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["data"] == []  # データなしが正常
    
    def test_sql_injection_protection(self):
        """SQLインジェクション保護のテスト"""
        # 悪意のあるSQL文字列でテスト
        malicious_filter = {
            "email": "'; DROP TABLE students; --"
        }
        
        response = client.post("/api/v1/admin/database/search", json={
            "table_name": "students",
            "filters": malicious_filter,
            "limit": 10,
            "offset": 0
        })
        
        # SQLインジェクションが防がれているか確認
        assert response.status_code in [200, 400]  # エラーまたは空結果
        
        # テーブルが削除されていないか確認
        safe_response = client.get("/api/v1/admin/database/tables")
        assert safe_response.status_code == 200
        table_names = [t["table_name"] for t in safe_response.json()["tables"]]
        assert "students" in table_names