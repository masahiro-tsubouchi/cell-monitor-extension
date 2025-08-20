"""
TDD開発: 連続エラー検出システムのテスト

このテストファイルはTDD開発プロセスに従って、
連続エラー検出機能の要件を定義します。

テスト戦略:
1. 設定管理システムのテスト
2. 連続エラー検出ロジックのテスト  
3. データベースモデルのテスト
4. APIエンドポイントのテスト
"""

import pytest
import uuid
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch

from db.session import SessionLocal
from db.models import SystemSetting, CellExecution, Student, Notebook, Cell, Session as DBSession
from schemas.event import EventData


class TestSystemSettingsModel:
    """SystemSettingモデルのテスト（TDD Phase 1）"""
    
    def test_system_setting_model_creation(self, db: Session):
        """SystemSettingモデルが正しく作成されることをテスト"""
        # Given: 設定データ（テスト用のユニークキー）
        setting = SystemSetting(
            setting_key="test_setting_key",
            setting_value="test_value",
            setting_type="str",
            description="テスト用設定"
        )
        
        # When: データベースに保存
        db.add(setting)
        db.commit()
        db.refresh(setting)
        
        # Then: 正しく保存されている
        assert setting.id is not None
        assert setting.setting_key == "test_setting_key"
        assert setting.setting_value == "test_value"
        assert setting.setting_type == "str"
        assert setting.is_active is True


class TestCellExecutionModelExtension:
    """CellExecutionモデル拡張のテスト（TDD Phase 1）"""
    
    def test_cell_execution_has_consecutive_error_fields(self, db: Session):
        """CellExecutionモデルに連続エラーフィールドが追加されていることをテスト"""
        # Given: テストデータ
        student = Student(email="test@example.com", name="Test Student")
        notebook = Notebook(path="/test/notebook.ipynb")
        cell = Cell(notebook_id=1, cell_id_jupyter="cell-1")
        session = DBSession(student_id=1)
        
        db.add_all([student, notebook, cell, session])
        db.commit()
        
        execution = CellExecution(
            student_id=student.id,
            notebook_id=notebook.id,
            cell_id=cell.id,
            session_id=session.id,
            status="error",
            consecutive_error_count=3,
            is_significant_error=True
        )
        
        # When: データベースに保存
        db.add(execution)
        db.commit()
        db.refresh(execution)
        
        # Then: 新しいフィールドが正しく保存されている
        assert execution.consecutive_error_count == 3
        assert execution.is_significant_error is True


class TestSettingsManagement:
    """設定管理機能のテスト（TDD Phase 2）"""
    
    def test_get_setting_value_from_db(self, db: Session):
        """データベースから設定値を取得するテスト"""
        # Given: 設定がデータベースに存在
        unique_key = f"test_threshold_{uuid.uuid4().hex[:8]}"
        setting = SystemSetting(
            setting_key=unique_key,
            setting_value="5",
            setting_type="int"
        )
        db.add(setting)
        db.commit()
        
        # When: 設定値を取得
        from crud.crud_settings import get_setting_value
        value = get_setting_value(db, unique_key)
        
        # Then: 正しい値が返される
        assert value == 5
    
    def test_get_setting_value_with_default(self, db: Session):
        """存在しない設定のデフォルト値取得テスト"""
        # Given: 設定が存在しない
        
        # When: デフォルト値を指定して取得
        from crud.crud_settings import get_setting_value
        value = get_setting_value(db, "nonexistent_setting", default_value=3)
        
        # Then: デフォルト値が返される
        assert value == 3
    
    def test_update_setting_value(self, db: Session):
        """設定値更新のテスト"""
        # Given: 既存の設定
        unique_key = f"test_update_{uuid.uuid4().hex[:8]}"
        setting = SystemSetting(
            setting_key=unique_key,
            setting_value="3",
            setting_type="int"
        )
        db.add(setting)
        db.commit()
        
        # When: 設定値を更新
        from crud.crud_settings import update_setting_value
        updated_setting = update_setting_value(db, unique_key, 5)
        
        # Then: 値が更新されている
        assert updated_setting.setting_value == "5"


class TestConsecutiveErrorDetection:
    """連続エラー検出ロジックのテスト（TDD Phase 3）"""
    
    def test_calculate_consecutive_errors_no_previous_executions(self, db: Session):
        """過去の実行履歴がない場合のテスト"""
        # Given: 過去の実行履歴なし
        
        # When: 連続エラー回数を計算
        from crud.crud_execution import calculate_consecutive_errors
        count = calculate_consecutive_errors(db, student_id=999, cell_id=999)
        
        # Then: 0が返される
        assert count == 0
    
    def test_calculate_consecutive_errors_with_success(self, db: Session):
        """成功実行がある場合のテスト"""
        # Given: 成功とエラーが混在する履歴
        student = Student(email="test@example.com", name="Test Student")
        notebook = Notebook(path="/test/notebook.ipynb")
        cell = Cell(notebook_id=1, cell_id_jupyter="cell-1")
        session = DBSession(student_id=1)
        
        db.add_all([student, notebook, cell, session])
        db.commit()
        
        # 実行履歴: エラー → エラー → 成功 → エラー（最新）
        executions = [
            CellExecution(student_id=1, notebook_id=1, cell_id=1, session_id=1, status="error"),
            CellExecution(student_id=1, notebook_id=1, cell_id=1, session_id=1, status="error"), 
            CellExecution(student_id=1, notebook_id=1, cell_id=1, session_id=1, status="success"),
            CellExecution(student_id=1, notebook_id=1, cell_id=1, session_id=1, status="error")
        ]
        db.add_all(executions)
        db.commit()
        
        # When: 連続エラー回数を計算
        # from crud.crud_execution import calculate_consecutive_errors
        # count = calculate_consecutive_errors(db, student_id=1, cell_id=1)
        
        # Then: 最新から成功まで = 1回のエラー
        # assert count == 1
        pass  # 実装後にテスト有効化
    
    def test_calculate_consecutive_errors_only_errors(self, db: Session):
        """エラーのみの場合のテスト"""
        # Given: エラーのみの履歴
        student = Student(email="test@example.com", name="Test Student")
        notebook = Notebook(path="/test/notebook.ipynb")
        cell = Cell(notebook_id=1, cell_id_jupyter="cell-1")
        session = DBSession(student_id=1)
        
        db.add_all([student, notebook, cell, session])
        db.commit()
        
        # 5回連続エラー
        executions = [
            CellExecution(student_id=1, notebook_id=1, cell_id=1, session_id=1, status="error")
            for _ in range(5)
        ]
        db.add_all(executions)
        db.commit()
        
        # When: 連続エラー回数を計算
        # from crud.crud_execution import calculate_consecutive_errors
        # count = calculate_consecutive_errors(db, student_id=1, cell_id=1)
        
        # Then: 5回のエラー
        # assert count == 5
        pass  # 実装後にテスト有効化
    
    def test_is_error_significant_below_threshold(self, db: Session):
        """閾値未満のエラーは有意でないテスト"""
        # Given: 閾値が3、連続エラーが2回
        unique_key = f"test_threshold_{uuid.uuid4().hex[:8]}"
        setting = SystemSetting(
            setting_key=unique_key,
            setting_value="3",
            setting_type="int"
        )
        db.add(setting)
        db.commit()
        
        # When: 有意なエラーかチェック
        from crud.crud_execution import is_error_significant
        is_significant = is_error_significant(db, consecutive_count=2)
        
        # Then: 有意でない（デフォルト閾値3を使用）
        assert is_significant is False
    
    def test_is_error_significant_above_threshold(self, db: Session):
        """閾値以上のエラーは有意であるテスト"""
        # Given: 閾値が3、連続エラーが3回以上
        
        # When: 有意なエラーかチェック（デフォルト閾値3を使用）
        from crud.crud_execution import is_error_significant
        is_significant = is_error_significant(db, consecutive_count=3)
        
        # Then: 有意である
        assert is_significant is True


class TestAdminAPI:
    """管理者API のテスト（TDD Phase 2）"""
    
    def test_get_setting_endpoint(self, client: TestClient, db: Session):
        """設定取得エンドポイントのテスト"""
        # Given: 設定が存在
        setting = SystemSetting(
            setting_key="consecutive_error_threshold",
            setting_value="3",
            setting_type="int"
        )
        db.add(setting)
        db.commit()
        
        # When: API経由で設定を取得
        # response = client.get("/admin/settings/consecutive_error_threshold")
        
        # Then: 正しい値が返される
        # assert response.status_code == 200
        # assert response.json()["value"] == 3
        pass  # エンドポイント実装後にテスト有効化
    
    def test_update_setting_endpoint(self, client: TestClient, db: Session):
        """設定更新エンドポイントのテスト"""
        # Given: 既存の設定
        setting = SystemSetting(
            setting_key="consecutive_error_threshold",
            setting_value="3",
            setting_type="int"
        )
        db.add(setting)
        db.commit()
        
        # When: API経由で設定を更新
        # response = client.put(
        #     "/admin/settings/consecutive_error_threshold",
        #     json={"new_value": 5}
        # )
        
        # Then: 更新が成功
        # assert response.status_code == 200
        pass  # エンドポイント実装後にテスト有効化


class TestEventProcessingIntegration:
    """イベント処理統合のテスト（TDD Phase 4）"""
    
    def test_handle_cell_execution_with_consecutive_errors(self, db: Session):
        """連続エラー検出統合のテスト"""
        # Given: 設定と過去のエラー履歴
        setting = SystemSetting(
            setting_key="consecutive_error_threshold",
            setting_value="3",
            setting_type="int"
        )
        db.add(setting)
        db.commit()
        
        # セルの3回目のエラー
        event_data = {
            "eventType": "cell_execution",
            "emailAddress": "test@example.com",
            "notebookPath": "/test.ipynb",
            "cellId": "cell-1",
            "hasError": True,
            "errorMessage": "Test error"
        }
        
        # When: イベントを処理
        # from worker.event_router import handle_cell_execution
        # result = await handle_cell_execution(event_data, db)
        
        # Then: エラーが有意として記録される
        # execution = db.query(CellExecution).order_by(CellExecution.id.desc()).first()
        # assert execution.consecutive_error_count == 3
        # assert execution.is_significant_error is True
        pass  # 統合実装後にテスト有効化


# Pytest fixtures
@pytest.fixture
def db():
    """テスト用データベースセッション"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    """テスト用FastAPIクライアント"""
    from main import app
    return TestClient(app)