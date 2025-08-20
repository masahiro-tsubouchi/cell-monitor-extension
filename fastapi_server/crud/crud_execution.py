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
    """
    セル実行履歴を作成してデータベースに保存する
    
    連続エラー検出機能が統合されており、同一セルでの連続エラー回数を
    自動的に計算し、設定閾値以上の場合は is_significant_error フラグを設定します。
    """
    
    # 1. 現在のステータスを判定
    current_status = "success" if not event.hasError else "error"
    
    # 2. 連続エラー回数を計算
    consecutive_count = 0
    is_significant = False
    
    if current_status == "error":
        # 過去の連続エラー回数を取得
        consecutive_count = calculate_consecutive_errors(db, student_id, cell_id)
        # 現在のエラーを含めて+1
        consecutive_count += 1
        # 設定閾値以上かチェック
        is_significant = is_error_significant(db, consecutive_count)
    # 成功の場合、連続エラーはリセットされるので 0
    
    # 3. セル実行履歴レコードを作成
    db_execution = models.CellExecution(
        student_id=student_id,
        notebook_id=notebook_id,
        cell_id=cell_id,
        session_id=session_id,
        execution_count=event.executionCount,
        status=current_status,
        duration=(
            event.executionDurationMs / 1000 if event.executionDurationMs else None
        ),  # 秒に変換
        error_message=event.errorMessage,
        output=event.result,
        code_content=event.code,  # セルのコード内容を保存
        cell_index=event.cellIndex,  # セルの位置を保存
        cell_type=event.cellType,  # セルの種類を保存
        # 新フィールド: 連続エラー検出データ
        consecutive_error_count=consecutive_count,
        is_significant_error=is_significant,
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


def calculate_consecutive_errors(db: Session, student_id: int, cell_id: int) -> int:
    """
    同一セル（student_id + cell_id）の連続エラー回数を計算
    
    最新の実行から遡って、成功実行に達するまでの連続エラー回数をカウントします。
    パフォーマンスのため最新10件のみを検索対象とします。
    
    Args:
        db: SQLAlchemyセッション
        student_id: 学生ID
        cell_id: セルID
    
    Returns:
        連続エラー回数（0以上の整数）
    """
    # 直近10件の実行履歴を時系列順（新しい順）で取得
    recent_executions = db.query(models.CellExecution)\
        .filter(models.CellExecution.student_id == student_id,
                models.CellExecution.cell_id == cell_id)\
        .order_by(models.CellExecution.executed_at.desc())\
        .limit(10)\
        .all()
    
    # 実行履歴がない場合
    if not recent_executions:
        return 0
    
    # 最新から遡って連続エラーをカウント
    consecutive_count = 0
    for execution in recent_executions:
        if execution.status == 'error':
            consecutive_count += 1
        else:
            # 成功があった時点でカウント終了
            break
    
    return consecutive_count


def is_error_significant(db: Session, consecutive_count: int) -> bool:
    """
    連続エラー回数が設定閾値を超えているかチェック
    
    Args:
        db: SQLAlchemyセッション
        consecutive_count: 連続エラー回数
    
    Returns:
        設定閾値以上の場合 True、未満の場合 False
    """
    from crud.crud_settings import get_setting_value
    
    threshold = get_setting_value(
        db, 
        "consecutive_error_threshold", 
        default_value=3
    )
    return consecutive_count >= threshold


def get_student_consecutive_error_info(db: Session, student_id: int) -> dict:
    """
    学生の現在の連続エラー状況を取得
    
    Args:
        db: SQLAlchemyセッション
        student_id: 学生ID
    
    Returns:
        連続エラー情報辞書
    """
    try:
        # 最新の有意なエラーがあるセルを取得
        significant_error_executions = db.query(models.CellExecution)\
            .filter(models.CellExecution.student_id == student_id,
                    models.CellExecution.is_significant_error == True)\
            .order_by(models.CellExecution.executed_at.desc())\
            .limit(10)\
            .all()
        
        if not significant_error_executions:
            return {
                "has_significant_error": False,
                "consecutive_count": 0,
                "error_cells": []
            }
        
        # 各セルの最新の連続エラー状況を確認
        error_cells = []
        max_consecutive_count = 0
        has_significant_error = False
        
        # セル毎にグループ化して最新の連続エラー状況を確認
        cell_groups = {}
        for execution in significant_error_executions:
            cell_id = execution.cell_id
            if cell_id not in cell_groups:
                cell_groups[cell_id] = execution
            elif execution.executed_at > cell_groups[cell_id].executed_at:
                cell_groups[cell_id] = execution
        
        for cell_id, execution in cell_groups.items():
            if execution.is_significant_error and execution.consecutive_error_count >= 3:
                has_significant_error = True
                max_consecutive_count = max(max_consecutive_count, execution.consecutive_error_count)
                error_cells.append({
                    "cell_id": cell_id,
                    "consecutive_count": execution.consecutive_error_count,
                    "last_error_time": execution.executed_at.isoformat()
                })
        
        return {
            "has_significant_error": has_significant_error,
            "consecutive_count": max_consecutive_count,
            "error_cells": error_cells
        }
        
    except Exception as e:
        print(f"Error getting consecutive error info: {e}")
        return {
            "has_significant_error": False,
            "consecutive_count": 0,
            "error_cells": []
        }


def resolve_consecutive_errors(db: Session, student_id: int) -> bool:
    """
    指定学生の連続エラーカウントをリセット
    
    Args:
        db: データベースセッション
        student_id: 学生ID
        
    Returns:
        bool: リセット成功時True、失敗時False
    """
    try:
        from datetime import datetime
        
        # 該当学生の全CellExecutionでis_significant_errorフラグを持つレコードを更新
        updated_rows = db.query(models.CellExecution).filter(
            models.CellExecution.student_id == student_id,
            models.CellExecution.is_significant_error == True
        ).update({
            "consecutive_error_count": 0,
            "is_significant_error": False
        })
        
        db.commit()
        print(f"Resolved consecutive errors for student {student_id}: {updated_rows} rows updated")
        return True
        
    except Exception as e:
        db.rollback()
        print(f"Failed to resolve consecutive errors for student {student_id}: {e}")
        return False


def log_error_resolution(db: Session, student_id: int, resolved_by: str = "instructor") -> bool:
    """
    エラー解除操作のログ記録
    
    Args:
        db: データベースセッション
        student_id: 学生ID
        resolved_by: 解除実行者（デフォルト: "instructor"）
        
    Returns:
        bool: ログ記録成功時True、失敗時False
    """
    try:
        from datetime import datetime
        
        # 将来的にResolutionLogテーブルを作成する場合のための準備
        # 現在はprintログのみ
        timestamp = datetime.utcnow().isoformat()
        print(f"ERROR_RESOLUTION_LOG: student_id={student_id}, resolved_by={resolved_by}, timestamp={timestamp}")
        
        return True
        
    except Exception as e:
        print(f"Failed to log error resolution: {e}")
        return False
