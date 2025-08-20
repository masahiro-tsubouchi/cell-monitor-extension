"""
設定値管理CRUD機能

このモジュールは、SystemSettingテーブルに対するCRUD操作を提供し、
Redis キャッシュ機能を統合した高速な設定値管理を実現します。
"""

from typing import Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from db.models import SystemSetting
from db.redis_client import get_redis_client_sync


def parse_setting_value(value: str, setting_type: str) -> Any:
    """
    設定値の文字列を適切な型に変換する
    
    Args:
        value: 設定値（文字列）
        setting_type: 設定の型（'int', 'bool', 'str', 'json'）
    
    Returns:
        変換された設定値
    """
    if setting_type == "int":
        return int(value)
    elif setting_type == "bool":
        return value.lower() in ('true', '1', 'yes', 'on')
    elif setting_type == "json":
        import json
        return json.loads(value)
    else:  # str or default
        return value


def get_setting_value(
    db: Session, 
    setting_key: str, 
    default_value: Any = None
) -> Any:
    """
    設定値を取得（Redis キャッシュ付き）
    
    Args:
        db: SQLAlchemyセッション
        setting_key: 設定キー
        default_value: デフォルト値（設定が見つからない場合）
    
    Returns:
        設定値（適切な型に変換済み）
    """
    redis = get_redis_client_sync()
    cache_key = f"setting:{setting_key}"
    
    # Redis キャッシュから取得試行
    try:
        cached_value = redis.get(cache_key)
        if cached_value:
            # キャッシュにタイプ情報も保存しているかチェック
            cache_type_key = f"setting_type:{setting_key}"
            cached_type = redis.get(cache_type_key)
            if cached_type:
                return parse_setting_value(cached_value.decode('utf-8'), cached_type.decode('utf-8'))
    except Exception:
        # Redis エラーの場合はDBから直接取得
        pass
    
    # DB から取得
    setting = db.query(SystemSetting)\
        .filter(SystemSetting.setting_key == setting_key,
                SystemSetting.is_active == True)\
        .first()
    
    if setting:
        # Redis にキャッシュ（TTL: 300秒）
        try:
            redis.setex(cache_key, 300, setting.setting_value)
            redis.setex(f"setting_type:{setting_key}", 300, setting.setting_type)
        except Exception:
            # Redis エラーは無視（DBから取得できているため）
            pass
        
        return parse_setting_value(setting.setting_value, setting.setting_type)
    
    return default_value


def update_setting_value(
    db: Session, 
    setting_key: str, 
    new_value: Any
) -> SystemSetting:
    """
    設定値を更新（Redis キャッシュクリア付き）
    
    Args:
        db: SQLAlchemyセッション
        setting_key: 設定キー
        new_value: 新しい設定値
    
    Returns:
        更新されたSystemSettingオブジェクト
    
    Raises:
        ValueError: 設定値が妥当でない場合
        RuntimeError: 設定が見つからない場合
    """
    # 設定値妥当性チェック
    if setting_key == "consecutive_error_threshold":
        try:
            threshold_value = int(new_value)
            if not (1 <= threshold_value <= 10):
                raise ValueError("連続エラー閾値は1-10の範囲で指定してください")
        except (ValueError, TypeError):
            raise ValueError("連続エラー閾値は整数で指定してください")
    
    # DB 更新
    setting = db.query(SystemSetting)\
        .filter(SystemSetting.setting_key == setting_key)\
        .first()
    
    if not setting:
        raise RuntimeError(f"設定キー '{setting_key}' が見つかりません")
    
    setting.setting_value = str(new_value)
    setting.updated_at = func.now()
    db.commit()
    db.refresh(setting)
    
    # Redis キャッシュクリア
    try:
        redis = get_redis_client_sync()
        redis.delete(f"setting:{setting_key}")
        redis.delete(f"setting_type:{setting_key}")
    except Exception:
        # Redis エラーは無視（DB更新は成功している）
        pass
    
    return setting


def get_all_settings(db: Session) -> list[SystemSetting]:
    """
    全ての有効な設定を取得
    
    Args:
        db: SQLAlchemyセッション
    
    Returns:
        SystemSettingのリスト
    """
    return db.query(SystemSetting)\
        .filter(SystemSetting.is_active == True)\
        .order_by(SystemSetting.setting_key)\
        .all()


def create_setting(
    db: Session,
    setting_key: str,
    setting_value: str,
    setting_type: str,
    description: Optional[str] = None
) -> SystemSetting:
    """
    新しい設定を作成
    
    Args:
        db: SQLAlchemyセッション
        setting_key: 設定キー
        setting_value: 設定値
        setting_type: 設定の型
        description: 設定の説明
    
    Returns:
        作成されたSystemSettingオブジェクト
    """
    setting = SystemSetting(
        setting_key=setting_key,
        setting_value=setting_value,
        setting_type=setting_type,
        description=description
    )
    
    db.add(setting)
    db.commit()
    db.refresh(setting)
    
    return setting