from sqlalchemy.orm import Session
from typing import List, Optional
from db import models
from schemas.event import EventData


def create_cell_execution(
    db: Session,
    event: EventData,
    student_id: int,
    notebook_id: int,
    cell_id: int,
    session_id: int,
) -> models.CellExecution:
    """セル実行履歴を作成してデータベースに保存する"""

    db_execution = models.CellExecution(
        student_id=student_id,
        notebook_id=notebook_id,
        cell_id=cell_id,
        session_id=session_id,
        execution_count=event.executionCount,
        status="success" if not event.hasError else "error",
        duration=(
            event.executionDurationMs / 1000 if event.executionDurationMs else None
        ),  # 秒に変換
        error_message=event.errorMessage,
        output=event.result,
        code_content=event.code,  # セルのコード内容を保存
        cell_index=event.cellIndex,  # セルの位置を保存
        cell_type=event.cellType,  # セルの種類を保存
    )
    db.add(db_execution)
    db.commit()
    db.refresh(db_execution)
    return db_execution


def get_recent_executions(
    db: Session, student_id: int, limit: int = 50
) -> List[models.CellExecution]:
    """指定された学生の最近の実行履歴を取得する"""
    return (
        db.query(models.CellExecution)
        .filter(models.CellExecution.student_id == student_id)
        .order_by(models.CellExecution.executed_at.desc())
        .limit(limit)
        .all()
    )
