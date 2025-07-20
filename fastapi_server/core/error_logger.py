"""
エラーログ機能モジュール

このモジュールは、アプリケーション全体で使用するエラーログ機能を提供します。
エラーが発生した場合、このモジュールを通じてRedisのエラーログチャネルに
エラーメッセージを発行し、監視システムやダッシュボードで表示・分析できるようにします。
"""

import json
import logging
import traceback
from typing import Any, Dict, Optional
import time
import uuid
from datetime import datetime

from db.redis_client import get_redis_client, ERROR_CHANNEL

# ロガーの設定
logger = logging.getLogger(__name__)

# エラー重大度
ERROR_SEVERITY = {
    "INFO": 0,  # 情報提供のみ
    "WARNING": 1,  # 注意は必要だが直ちに対応不要
    "ERROR": 2,  # エラーが発生、対応が必要
    "CRITICAL": 3,  # 致命的なエラー、即時対応が必要
}


async def log_error(
    error_type: str,
    message: str,
    details: Optional[Dict[str, Any]] = None,
    user_id: Optional[str] = None,
    severity: str = "ERROR",
    exception: Optional[Exception] = None,
):
    """
    エラーをRedisのエラーログチャネルに記録する

    Args:
        error_type: エラーの種類（DB_ERROR, API_ERROR, VALIDATION_ERROR など）
        message: エラーメッセージ
        details: エラーに関する追加情報
        user_id: 関連するユーザーID（該当する場合）
        severity: エラーの重大度
        exception: 発生した例外オブジェクト
    """
    try:
        # タイムスタンプとエラーIDを生成
        timestamp = datetime.utcnow().isoformat() + "Z"
        error_id = str(uuid.uuid4())

        # エラーログのベース情報
        error_log = {
            "error_id": error_id,
            "timestamp": timestamp,
            "error_type": error_type,
            "message": message,
            "severity": severity,
            "severity_level": ERROR_SEVERITY.get(severity, 2),  # デフォルトはERROR
        }

        # 関連するユーザーIDがある場合は追加
        if user_id:
            error_log["user_id"] = user_id

        # 追加の詳細情報がある場合は追加
        if details:
            error_log["details"] = details

        # 例外オブジェクトがある場合はスタックトレースを追加
        if exception:
            error_log["exception_type"] = exception.__class__.__name__
            error_log["stack_trace"] = traceback.format_exception(
                type(exception), exception, exception.__traceback__
            )

        # Redisにエラーログを発行
        redis_client = await get_redis_client()
        await redis_client.publish(ERROR_CHANNEL, json.dumps(error_log))

        # ローカルログにも記録（冗長化のため）
        log_level = getattr(logging, severity, logging.ERROR)
        logger.log(log_level, f"エラーログ発行: {error_log}")

        return error_id

    except Exception as e:
        # エラーログ発行時の例外は標準ロギングに記録
        logger.critical(f"エラーログの発行に失敗しました: {e}")
        return None


class ErrorLogContext:
    """
    エラーロギングのコンテキストマネージャ
    with文で囲うことで、ブロック内のエラーを自動でログに記録する
    """

    def __init__(
        self,
        error_type: str,
        context_info: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
        severity: str = "ERROR",
    ):
        self.error_type = error_type
        self.context_info = context_info or {}
        self.user_id = user_id
        self.severity = severity
        self.start_time = time.time()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            # エラーが発生した場合のみログに記録
            duration = time.time() - self.start_time
            self.context_info["operation_duration"] = f"{duration:.2f}s"

            await log_error(
                error_type=self.error_type,
                message=str(exc_val),
                details=self.context_info,
                user_id=self.user_id,
                severity=self.severity,
                exception=exc_val,
            )

            # エラーを伝播させる（re-raise しない）
            return False  # False を返すと例外が再度スローされる


# エラーロガーのシングルトンインスタンスを提供する関数
async def get_error_logger():
    """
    エラーロガーを取得する
    シングルトンパターンではなく、関数ベースのインターフェースを提供
    """
    return {"log_error": log_error, "ErrorLogContext": ErrorLogContext}
