"""
統合後のセル実行機能のテスト

連続エラー検出機能が統合された create_cell_execution 関数のテスト
"""

import pytest
import uuid
from sqlalchemy.orm import Session
from datetime import datetime

from db.session import SessionLocal
from db.models import CellExecution, Student, Notebook, Cell, Session as DBSession, SystemSetting
from schemas.event import EventData
from crud.crud_execution import create_cell_execution


class TestEnhancedCellExecution:
    """連続エラー検出機能統合後のセル実行テスト"""
    
    def test_create_cell_execution_success_resets_consecutive_count(self, db: Session):
        """成功実行で連続エラーカウントがリセットされることをテスト"""
        # Given: テストデータ
        student = Student(email=f"test_{uuid.uuid4().hex[:8]}@example.com", name="Test Student")
        unique_id = uuid.uuid4().hex[:8]
        notebook = Notebook(path=f"/test/notebook_{unique_id}.ipynb", name=f"notebook_{unique_id}")
        cell = Cell(notebook_id=1, cell_id="cell-1", cell_type="code")
        session = DBSession(student_id=1)
        
        db.add_all([student, notebook, cell, session])
        db.commit()
        
        # 成功実行のイベントデータ
        success_event = EventData(
            eventType="cell_execution",
            emailAddress="test@example.com",
            notebookPath="/test/notebook.ipynb",
            cellId="cell-1",
            hasError=False,
            code="print('success')",
            result="success",
            executionCount=1
        )
        
        # When: 成功実行を記録
        execution = create_cell_execution(
            db=db,
            event=success_event,
            student_id=student.id,
            notebook_id=notebook.id,
            cell_id=cell.id,
            session_id=session.id
        )
        
        # Then: 連続エラーカウントは0、有意なエラーではない
        assert execution.status == "success"
        assert execution.consecutive_error_count == 0
        assert execution.is_significant_error is False
    
    def test_create_cell_execution_first_error_not_significant(self, db: Session):
        """初回エラーは有意でないことをテスト"""
        # Given: テストデータ
        student = Student(email=f"test_{uuid.uuid4().hex[:8]}@example.com", name="Test Student")
        unique_id = uuid.uuid4().hex[:8]
        notebook = Notebook(path=f"/test/notebook_{unique_id}.ipynb", name=f"notebook_{unique_id}")
        cell = Cell(notebook_id=1, cell_id="cell-1", cell_type="code")
        session = DBSession(student_id=1)
        
        db.add_all([student, notebook, cell, session])
        db.commit()
        
        # エラー実行のイベントデータ
        error_event = EventData(
            eventType="cell_execution",
            emailAddress="test@example.com",
            notebookPath="/test/notebook.ipynb",
            cellId="cell-1",
            hasError=True,
            errorMessage="Test error",
            code="raise Exception('test')",
            executionCount=1
        )
        
        # When: 初回エラー実行を記録
        execution = create_cell_execution(
            db=db,
            event=error_event,
            student_id=student.id,
            notebook_id=notebook.id,
            cell_id=cell.id,
            session_id=session.id
        )
        
        # Then: 連続エラーカウントは1、まだ有意ではない（デフォルト閾値3）
        assert execution.status == "error"
        assert execution.consecutive_error_count == 1
        assert execution.is_significant_error is False
    
    def test_create_cell_execution_third_consecutive_error_becomes_significant(self, db: Session):
        """3回連続エラーで有意になることをテスト"""
        # Given: テストデータ
        student = Student(email=f"test_{uuid.uuid4().hex[:8]}@example.com", name="Test Student")
        unique_id = uuid.uuid4().hex[:8]
        notebook = Notebook(path=f"/test/notebook_{unique_id}.ipynb", name=f"notebook_{unique_id}")
        cell = Cell(notebook_id=1, cell_id="cell-1", cell_type="code")
        session = DBSession(student_id=1)
        
        db.add_all([student, notebook, cell, session])
        db.commit()
        
        # エラー実行のイベントデータ
        error_event = EventData(
            eventType="cell_execution",
            emailAddress="test@example.com",
            notebookPath="/test/notebook.ipynb",
            cellId="cell-1",
            hasError=True,
            errorMessage="Test error",
            code="raise Exception('test')",
            executionCount=1
        )
        
        # When: 3回連続でエラー実行を記録
        # 1回目のエラー
        execution1 = create_cell_execution(
            db=db,
            event=error_event,
            student_id=student.id,
            notebook_id=notebook.id,
            cell_id=cell.id,
            session_id=session.id
        )
        
        # 2回目のエラー
        execution2 = create_cell_execution(
            db=db,
            event=error_event,
            student_id=student.id,
            notebook_id=notebook.id,
            cell_id=cell.id,
            session_id=session.id
        )
        
        # 3回目のエラー
        execution3 = create_cell_execution(
            db=db,
            event=error_event,
            student_id=student.id,
            notebook_id=notebook.id,
            cell_id=cell.id,
            session_id=session.id
        )
        
        # Then: 連続エラーの進行を確認
        assert execution1.consecutive_error_count == 1
        assert execution1.is_significant_error is False
        
        assert execution2.consecutive_error_count == 2
        assert execution2.is_significant_error is False
        
        assert execution3.consecutive_error_count == 3
        assert execution3.is_significant_error is True  # 閾値3に達して有意
    
    def test_create_cell_execution_success_after_errors_resets_count(self, db: Session):
        """エラー後の成功で連続カウントがリセットされることをテスト"""
        # Given: テストデータ
        student = Student(email=f"test_{uuid.uuid4().hex[:8]}@example.com", name="Test Student")
        unique_id = uuid.uuid4().hex[:8]
        notebook = Notebook(path=f"/test/notebook_{unique_id}.ipynb", name=f"notebook_{unique_id}")
        cell = Cell(notebook_id=1, cell_id="cell-1", cell_type="code")
        session = DBSession(student_id=1)
        
        db.add_all([student, notebook, cell, session])
        db.commit()
        
        # エラー実行のイベントデータ
        error_event = EventData(
            eventType="cell_execution",
            emailAddress="test@example.com",
            notebookPath="/test/notebook.ipynb",
            cellId="cell-1",
            hasError=True,
            errorMessage="Test error",
            code="raise Exception('test')",
            executionCount=1
        )
        
        # 成功実行のイベントデータ
        success_event = EventData(
            eventType="cell_execution",
            emailAddress="test@example.com",
            notebookPath="/test/notebook.ipynb",
            cellId="cell-1",
            hasError=False,
            code="print('success')",
            result="success",
            executionCount=2
        )
        
        # When: エラー → エラー → 成功 → エラー のパターン
        # 2回連続エラー
        create_cell_execution(db, error_event, student.id, notebook.id, cell.id, session.id)
        create_cell_execution(db, error_event, student.id, notebook.id, cell.id, session.id)
        
        # 成功でリセット
        success_execution = create_cell_execution(
            db, success_event, student.id, notebook.id, cell.id, session.id
        )
        
        # 再度エラー（新しい連続の開始）
        new_error_execution = create_cell_execution(
            db, error_event, student.id, notebook.id, cell.id, session.id
        )
        
        # Then: 成功でリセット、新しいエラーは再び1からカウント
        assert success_execution.consecutive_error_count == 0
        assert success_execution.is_significant_error is False
        
        assert new_error_execution.consecutive_error_count == 1
        assert new_error_execution.is_significant_error is False


# Pytest fixtures
@pytest.fixture
def db():
    """テスト用データベースセッション"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()