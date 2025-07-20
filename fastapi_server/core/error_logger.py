"""
エラーログ機能モジュール

このモジュールは、アプリケーション全体で使用するエラーログ機能を提供します。
エラーが発生した場合、このモジュールを通じてRedisのエラーログチャネルに
エラーメッセージを発行し、監視システムやダッシュボードで表示・分析できるようにします。
"""

import json
import logging
import traceback
from typing import Any, Dict, Optional, List
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
    
    エラー詳細記録強化:
    - スタックトレース全体の保存
    - 実行環境情報の記録
    - エラー発生コンテキストの詳細化
    - デバッグ情報の自動収集

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

        # 実行環境情報の収集
        runtime_info = _collect_runtime_info()

        # エラーログのベース情報
        error_log = {
            "error_id": error_id,
            "timestamp": timestamp,
            "error_type": error_type,
            "message": message,
            "severity": severity,
            "severity_level": ERROR_SEVERITY.get(severity, 2),  # デフォルトはERROR
            "runtime_info": runtime_info,
        }

        # 関連するユーザーIDがある場合は追加
        if user_id:
            error_log["user_id"] = user_id

        # 追加の詳細情報がある場合は追加
        if details:
            error_log["details"] = details

        # 例外オブジェクトがある場合は詳細情報を追加
        if exception:
            error_log.update(_extract_exception_details(exception))

        # Redisにエラーログを発行
        redis_client = await get_redis_client()
        await redis_client.publish(ERROR_CHANNEL, json.dumps(error_log, default=str))

        # ローカルログにも記録（冗長化のため）
        log_level = getattr(logging, severity, logging.ERROR)
        logger.log(log_level, f"エラーログ発行: {error_id} - {error_type}: {message}")

        return error_id

    except Exception as e:
        # エラーログ発行時の例外は標準ロギングに記録
        logger.critical(f"エラーログの発行に失敗しました: {e}")
        return None


def _collect_runtime_info() -> Dict[str, Any]:
    """
    実行環境情報を収集する
    
    Returns:
        実行環境の詳細情報を含む辞書
    """
    import platform
    import sys
    import os
    
    try:
        import psutil
    except ImportError:
        psutil = None
    
    try:
        return {
            # Python環境情報
            "python_version": sys.version,
            "python_executable": sys.executable,
            "platform": platform.platform(),
            "architecture": platform.architecture(),
            
            # システムリソース情報
            "memory_usage": {
                "available_mb": round(psutil.virtual_memory().available / 1024 / 1024, 2) if psutil else "N/A",
                "percent_used": psutil.virtual_memory().percent if psutil else "N/A",
            },
            "cpu_usage_percent": psutil.cpu_percent(interval=0.1) if psutil else "N/A",
            "disk_usage_percent": psutil.disk_usage('/').percent if psutil else "N/A",
            
            # プロセス情報
            "process_id": os.getpid(),
            "process_memory_mb": round(psutil.Process().memory_info().rss / 1024 / 1024, 2) if psutil else "N/A",
            
            # 環境変数（重要なもののみ）
            "environment": {
                "ENVIRONMENT": os.getenv("ENVIRONMENT", "unknown"),
                "DEBUG": os.getenv("DEBUG", "false"),
                "LOG_LEVEL": os.getenv("LOG_LEVEL", "INFO"),
            },
            
            # タイムスタンプ
            "collected_at": datetime.utcnow().isoformat() + "Z",
        }
    except Exception as e:
        # 情報収集に失敗してもエラーログ自体は継続
        logger.warning(f"実行環境情報の収集に失敗: {e}")
        return {"collection_error": str(e)}


def _extract_exception_details(exception: Exception) -> Dict[str, Any]:
    """
    例外オブジェクトから詳細情報を抽出する
    
    Args:
        exception: 例外オブジェクト
        
    Returns:
        例外の詳細情報を含む辞書
    """
    import inspect
    
    try:
        # 基本的な例外情報
        exception_details = {
            "exception_type": exception.__class__.__name__,
            "exception_module": exception.__class__.__module__,
            "exception_message": str(exception),
        }
        
        # スタックトレース全体を文字列として保存
        if exception.__traceback__:
            exception_details["stack_trace_full"] = traceback.format_exception(
                type(exception), exception, exception.__traceback__
            )
            
            # スタックトレースの詳細分析
            tb_details = []
            tb = exception.__traceback__
            
            while tb is not None:
                frame = tb.tb_frame
                tb_info = {
                    "filename": frame.f_code.co_filename,
                    "function_name": frame.f_code.co_name,
                    "line_number": tb.tb_lineno,
                    "code_context": _get_code_context(frame.f_code.co_filename, tb.tb_lineno),
                }
                
                # ローカル変数の状態（機密情報を除く）
                local_vars = {}
                for var_name, var_value in frame.f_locals.items():
                    if not var_name.startswith('_') and len(str(var_value)) < 200:
                        try:
                            # JSONシリアライズ可能な値のみ保存
                            json.dumps(var_value, default=str)
                            local_vars[var_name] = var_value
                        except (TypeError, ValueError):
                            local_vars[var_name] = f"<{type(var_value).__name__}: {str(var_value)[:100]}>"
                
                tb_info["local_variables"] = local_vars
                tb_details.append(tb_info)
                tb = tb.tb_next
            
            exception_details["stack_trace_details"] = tb_details
        
        # 例外の原因チェーン
        if hasattr(exception, '__cause__') and exception.__cause__:
            exception_details["caused_by"] = _extract_exception_details(exception.__cause__)
        
        # 例外のコンテキスト
        if hasattr(exception, '__context__') and exception.__context__:
            exception_details["context"] = _extract_exception_details(exception.__context__)
        
        return exception_details
        
    except Exception as e:
        # 例外詳細抽出に失敗しても基本情報は返す
        logger.warning(f"例外詳細の抽出に失敗: {e}")
        return {
            "exception_type": exception.__class__.__name__,
            "exception_message": str(exception),
            "extraction_error": str(e)
        }


def _get_code_context(filename: str, line_number: int, context_lines: int = 3) -> Optional[List[str]]:
    """
    指定されたファイルの指定行周辺のコードを取得する
    
    Args:
        filename: ファイルパス
        line_number: 行番号
        context_lines: 前後の行数
        
    Returns:
        コードのコンテキスト行のリスト
    """
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        start_line = max(0, line_number - context_lines - 1)
        end_line = min(len(lines), line_number + context_lines)
        
        context = []
        for i in range(start_line, end_line):
            prefix = ">>> " if i == line_number - 1 else "    "
            context.append(f"{prefix}{i + 1:4d}: {lines[i].rstrip()}")
        
        return context
        
    except Exception:
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
