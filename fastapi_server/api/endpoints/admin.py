"""
管理者用API

連続エラー検出システムの設定管理を提供
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any
from pydantic import BaseModel

from db.session import get_db
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