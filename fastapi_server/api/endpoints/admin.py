"""
管理者用API

連続エラー検出システムの設定管理を提供
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any, List, Dict, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import inspect

from db.session import get_db
from db import models
from crud.crud_settings import (
    get_setting_value,
    update_setting_value,
    get_all_settings,
    create_setting
)

router = APIRouter()


class UpdateSettingRequest(BaseModel):
    """設定更新リクエスト"""
    new_value: Any


class CreateSettingRequest(BaseModel):
    """設定作成リクエスト"""
    setting_key: str
    setting_value: str
    setting_type: str
    description: str = None


class DatabaseSearchRequest(BaseModel):
    """データベース検索リクエスト"""
    table_name: str
    filters: Optional[Dict[str, Any]] = None
    limit: int = 100
    offset: int = 0
    order_by: Optional[str] = None


class BulkDeleteRequest(BaseModel):
    """一括削除リクエスト"""
    table_name: str
    filters: Dict[str, Any]
    confirm_count: int


@router.get("/settings")
async def get_all_system_settings(db: Session = Depends(get_db)):
    """全設定値を取得"""
    settings = get_all_settings(db)
    return {
        "settings": [
            {
                "setting_key": setting.setting_key,
                "setting_value": setting.setting_value,
                "setting_type": setting.setting_type,
                "description": setting.description,
                "is_active": setting.is_active,
                "updated_at": setting.updated_at
            }
            for setting in settings
        ]
    }


@router.get("/settings/{setting_key}")
async def get_setting_by_key(
    setting_key: str,
    db: Session = Depends(get_db)
):
    """特定の設定値を取得"""
    value = get_setting_value(db, setting_key)
    if value is None:
        raise HTTPException(status_code=404, detail=f"設定キー '{setting_key}' が見つかりません")
    
    return {
        "setting_key": setting_key, 
        "value": value,
        "type": type(value).__name__
    }


@router.put("/settings/{setting_key}")
async def update_setting(
    setting_key: str,
    request: UpdateSettingRequest,
    db: Session = Depends(get_db)
):
    """設定値を更新"""
    try:
        updated_setting = update_setting_value(db, setting_key, request.new_value)
        return {
            "message": f"設定 '{setting_key}' が更新されました",
            "setting": {
                "setting_key": updated_setting.setting_key,
                "setting_value": updated_setting.setting_value,
                "setting_type": updated_setting.setting_type,
                "updated_at": updated_setting.updated_at
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/settings")
async def create_new_setting(
    request: CreateSettingRequest,
    db: Session = Depends(get_db)
):
    """新しい設定を作成"""
    try:
        setting = create_setting(
            db=db,
            setting_key=request.setting_key,
            setting_value=request.setting_value,
            setting_type=request.setting_type,
            description=request.description
        )
        return {
            "message": f"設定 '{request.setting_key}' が作成されました",
            "setting": {
                "setting_key": setting.setting_key,
                "setting_value": setting.setting_value,
                "setting_type": setting.setting_type,
                "description": setting.description
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"設定作成に失敗しました: {str(e)}")


@router.get("/consecutive-error-status")
async def get_consecutive_error_status(db: Session = Depends(get_db)):
    """連続エラー検出システムの状態を取得"""
    threshold = get_setting_value(db, "consecutive_error_threshold", default_value=3)
    enabled = get_setting_value(db, "error_detection_enabled", default_value=True)
    cache_ttl = get_setting_value(db, "cache_ttl_seconds", default_value=300)
    
    return {
        "consecutive_error_threshold": threshold,
        "error_detection_enabled": enabled,
        "cache_ttl_seconds": cache_ttl,
        "status": "active" if enabled else "disabled"
    }


# ===== データベース管理機能 =====

@router.get("/database/tables")
async def get_database_tables():
    """利用可能なテーブル一覧を取得"""
    # SQLAlchemyモデルから自動的にテーブル情報を取得
    table_info = []
    
    for name, obj in inspect.getmembers(models):
        if inspect.isclass(obj) and hasattr(obj, '__tablename__'):
            # テーブルの列情報を取得
            columns = []
            if hasattr(obj, '__table__'):
                for column in obj.__table__.columns:
                    columns.append({
                        "name": column.name,
                        "type": str(column.type),
                        "nullable": column.nullable,
                        "primary_key": column.primary_key
                    })
            
            table_info.append({
                "table_name": obj.__tablename__,
                "class_name": name,
                "columns": columns
            })
    
    return {"tables": table_info}


@router.post("/database/search")
async def search_database_data(
    request: DatabaseSearchRequest,
    db: Session = Depends(get_db)
):
    """データベーステーブルからデータを検索"""
    try:
        # テーブル名からモデルクラスを取得
        model_class = None
        for name, obj in inspect.getmembers(models):
            if (inspect.isclass(obj) and 
                hasattr(obj, '__tablename__') and 
                obj.__tablename__ == request.table_name):
                model_class = obj
                break
        
        if not model_class:
            raise HTTPException(status_code=404, detail=f"テーブル '{request.table_name}' が見つかりません")
        
        # クエリ構築
        query = db.query(model_class)
        
        # フィルタリング適用
        if request.filters:
            for key, value in request.filters.items():
                if hasattr(model_class, key):
                    column = getattr(model_class, key)
                    if isinstance(value, dict):
                        # 範囲検索等の複雑な条件
                        if 'gte' in value:
                            query = query.filter(column >= value['gte'])
                        if 'lte' in value:
                            query = query.filter(column <= value['lte'])
                        if 'like' in value:
                            query = query.filter(column.like(f"%{value['like']}%"))
                    else:
                        # 等価条件
                        query = query.filter(column == value)
        
        # ソート
        if request.order_by and hasattr(model_class, request.order_by):
            query = query.order_by(getattr(model_class, request.order_by))
        else:
            # デフォルトは作成日時降順
            if hasattr(model_class, 'created_at'):
                query = query.order_by(model_class.created_at.desc())
        
        # 総件数取得
        total_count = query.count()
        
        # ページネーション
        records = query.offset(request.offset).limit(request.limit).all()
        
        # レスポンス構築
        data = []
        for record in records:
            record_dict = {}
            for column in model_class.__table__.columns:
                value = getattr(record, column.name, None)
                if isinstance(value, datetime):
                    record_dict[column.name] = value.isoformat()
                else:
                    record_dict[column.name] = value
            data.append(record_dict)
        
        return {
            "table_name": request.table_name,
            "total_count": total_count,
            "data": data,
            "offset": request.offset,
            "limit": request.limit
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"データ検索エラー: {str(e)}")


@router.delete("/database/{table_name}/{record_id}")
async def delete_record(
    table_name: str,
    record_id: int,
    db: Session = Depends(get_db)
):
    """個別レコードを安全に削除（ソフトデリート）"""
    try:
        # テーブル名からモデルクラスを取得
        model_class = None
        for name, obj in inspect.getmembers(models):
            if (inspect.isclass(obj) and 
                hasattr(obj, '__tablename__') and 
                obj.__tablename__ == table_name):
                model_class = obj
                break
        
        if not model_class:
            raise HTTPException(status_code=404, detail=f"テーブル '{table_name}' が見つかりません")
        
        # レコード取得
        record = db.query(model_class).filter(model_class.id == record_id).first()
        if not record:
            raise HTTPException(status_code=404, detail=f"レコードID {record_id} が見つかりません")
        
        # 関連データの確認と処理（外部キー制約対応）
        if table_name == "students":
            # 学生削除の場合、関連するセッションと実行履歴も削除
            from sqlalchemy import text
            
            # 外部キー制約の順序で削除（子テーブル → 親テーブル）
            
            # 1. セル実行履歴を削除（sessions に依存）
            db.execute(text("DELETE FROM cell_executions WHERE student_id = :student_id"), {"student_id": record_id})
            
            # 2. ノートブックアクセスを削除
            db.execute(text("DELETE FROM notebook_accesses WHERE student_id = :student_id"), {"student_id": record_id})
            
            # 3. 学生クラス参加情報を削除
            db.execute(text("DELETE FROM student_classes WHERE student_id = :student_id"), {"student_id": record_id})
            
            # 4. セッションを削除
            db.execute(text("DELETE FROM sessions WHERE student_id = :student_id"), {"student_id": record_id})
        
        # ソフトデリートまたは物理削除
        if hasattr(model_class, 'deleted_at'):
            # ソフトデリート
            record.deleted_at = datetime.utcnow()
            db.commit()
            return {"message": f"レコードID {record_id} をソフトデリートしました", "type": "soft_delete"}
        else:
            # 物理削除
            db.delete(record)
            db.commit()
            return {"message": f"レコードID {record_id} と関連データを削除しました", "type": "hard_delete"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"削除エラー: {str(e)}")


@router.post("/database/cleanup/old-sessions")
async def cleanup_old_sessions(
    days_old: int = 30,
    db: Session = Depends(get_db)
):
    """古いセッションデータをクリーンアップ"""
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days_old)
        
        # 古いセッションを検索
        old_sessions = db.query(models.Session).filter(
            models.Session.created_at < cutoff_date
        ).all()
        
        cleanup_count = len(old_sessions)
        
        # 関連データも含めてソフトデリート
        for session in old_sessions:
            if hasattr(session, 'deleted_at'):
                session.deleted_at = datetime.utcnow()
        
        db.commit()
        
        return {
            "message": f"{days_old}日以上前のセッション {cleanup_count} 件をクリーンアップしました",
            "cleaned_sessions": cleanup_count,
            "cutoff_date": cutoff_date.isoformat()
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"クリーンアップエラー: {str(e)}")


@router.get("/database/stats")
async def get_database_statistics(db: Session = Depends(get_db)):
    """データベース統計情報を取得"""
    try:
        stats = {}
        
        # 各テーブルの行数を取得
        for name, obj in inspect.getmembers(models):
            if inspect.isclass(obj) and hasattr(obj, '__tablename__'):
                try:
                    count = db.query(obj).count()
                    stats[obj.__tablename__] = {
                        "total_records": count,
                        "table_name": obj.__tablename__,
                        "model_class": name
                    }
                except Exception:
                    # テーブルアクセスエラーは無視
                    pass
        
        return {
            "database_stats": stats,
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"統計取得エラー: {str(e)}")


@router.get("/database/health")
async def get_database_health(db: Session = Depends(get_db)):
    """データベース接続状況を確認"""
    try:
        from sqlalchemy import text
        # 簡単なクエリでDB接続をテスト
        result = db.execute(text("SELECT 1"))
        result.fetchone()
        
        return {
            "status": "healthy",
            "connection": "active",
            "checked_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "connection": "failed",
            "error": str(e),
            "checked_at": datetime.utcnow().isoformat()
        }