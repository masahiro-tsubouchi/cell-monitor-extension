from sqlalchemy.orm import Session
from db import models
from schemas.event import EventData


def create_cell_execution(
    db: Session, event: EventData, student_id: int, notebook_id: int, cell_id: int
) -> models.CellExecution:
    """セル実行履歴を作成してデータベースに保存する"""

    # セッションIDはイベントデータから取得するか、なければNone
    # 実際の運用ではセッション管理機能との連携が必要
    # ここでは仮に student_id から紐づく最新のものを探すなどのロジックも考えられる
    # session = db.query(models.Session).filter(models.Session.student_id == student_id, models.Session.is_active == True).order_by(models.Session.start_time.desc()).first()
    # session_db_id = session.id if session else None

    db_execution = models.CellExecution(
        student_id=student_id,
        notebook_id=notebook_id,  # notebook_idを追加
        cell_id=cell_id,
        # session_id=session_db_id, # 将来的にセッションIDを関連付ける
        execution_count=event.executionCount,
        status="success" if not event.hasError else "error",
        duration=(
            event.executionDurationMs / 1000 if event.executionDurationMs else None
        ),  # 秒に変換
        error_message=event.errorMessage,
        output=event.result,
    )
    db.add(db_execution)
    db.commit()
    db.refresh(db_execution)
    return db_execution
