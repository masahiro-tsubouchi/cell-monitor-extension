"""
ワーカーのエラーハンドリング機能

このモジュールは、ワーカー処理中に発生するエラーを捕捉し、適切に処理するための
機能を提供します。エラーロギング、リトライロジック、バックオフ戦略などを実装しています。
"""

import asyncio
import functools
import logging
import time
from typing import Any, Callable, Dict, TypeVar, cast

from core.error_logger import log_error

# ロガーの設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# リトライ設定
DEFAULT_MAX_RETRIES = 3
DEFAULT_BACKOFF_FACTOR = 2  # 指数バックオフ用の係数
DEFAULT_INITIAL_DELAY = 1.0  # 初期遅延（秒）

# ジェネリック型変数の定義
F = TypeVar("F", bound=Callable[..., Any])


def with_retry(
    max_retries: int = DEFAULT_MAX_RETRIES,
    backoff_factor: float = DEFAULT_BACKOFF_FACTOR,
    initial_delay: float = DEFAULT_INITIAL_DELAY,
    error_types: tuple = (Exception,),
) -> Callable[[F], F]:
    """
    関数の実行に失敗した場合に指数バックオフでリトライするデコレータ

    Args:
        max_retries: 最大リトライ回数
        backoff_factor: 指数バックオフの係数
        initial_delay: 初期遅延（秒）
        error_types: リトライするエラータイプのタプル
    """

    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            retries = 0
            last_exception = None

            while retries <= max_retries:  # <=で最初の実行も含める
                try:
                    if retries > 0:
                        wait_time = initial_delay * (backoff_factor ** (retries - 1))
                        logger.warning(
                            f"{retries}回目のリトライ: {func.__name__}、{wait_time:.2f}秒後に実行"
                        )
                        await asyncio.sleep(wait_time)

                    return await func(*args, **kwargs)
                except error_types as e:
                    last_exception = e
                    retries += 1

                    # 最大リトライ回数に達したかチェック
                    if retries > max_retries:
                        logger.error(
                            f"最大リトライ回数({max_retries})を超えました: {func.__name__}, エラー: {e}"
                        )
                        # エラーログを記録
                        context = {
                            "function": func.__name__,
                            "retries": retries - 1,
                            "args": str(args),
                            "kwargs": str(kwargs),
                        }
                        await log_error(
                            error_type="RETRY_EXHAUSTED",
                            message=f"最大リトライ回数を超えました: {func.__name__}",
                            details=context,
                            severity="ERROR",
                            exception=last_exception,
                        )
                        break
                    else:
                        logger.warning(
                            f"処理に失敗しました: {func.__name__}, エラー: {e}, リトライ: {retries}/{max_retries}"
                        )

            # 最大リトライ回数を超えた場合
            if last_exception:
                raise last_exception
            return None

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            retries = 0
            last_exception = None

            while retries <= max_retries:  # <=で最初の実行も含める
                try:
                    if retries > 0:
                        wait_time = initial_delay * (backoff_factor ** (retries - 1))
                        logger.warning(
                            f"{retries}回目のリトライ: {func.__name__}、{wait_time:.2f}秒後に実行"
                        )
                        time.sleep(wait_time)

                    return func(*args, **kwargs)
                except error_types as e:
                    last_exception = e
                    retries += 1

                    # 最大リトライ回数に達したかチェック
                    if retries > max_retries:
                        logger.error(
                            f"最大リトライ回数({max_retries})を超えました: {func.__name__}, エラー: {e}"
                        )
                        # 非同期関数のため、エラーログは記録せずにログだけ残す
                        break
                    else:
                        logger.warning(
                            f"処理に失敗しました: {func.__name__}, エラー: {e}, リトライ: {retries}/{max_retries}"
                        )

            # 最大リトライ回数を超えた場合
            if last_exception:
                raise last_exception
            return None

        # 関数が非同期かどうかでラッパーを選択
        if asyncio.iscoroutinefunction(func):
            return cast(F, async_wrapper)
        return cast(F, sync_wrapper)

    return decorator


async def handle_event_error(
    error: Exception, event_data: Dict[str, Any], context: Dict[str, Any]
) -> None:
    """
    イベント処理中のエラーを処理する関数

    Args:
        error: 発生した例外
        event_data: イベントデータ
        context: エラーコンテキスト情報
    """
    error_type = error.__class__.__name__
    user_id = event_data.get("userId", "unknown")
    event_type = event_data.get("event", "unknown")

    # エラーの重大度を判断
    severity = "ERROR"
    if isinstance(error, (ConnectionError, TimeoutError)):
        severity = "WARNING"  # 接続エラーは一時的な可能性が高い

    # 詳細情報を構築
    details = {
        "event_type": event_type,
        "notebook_path": event_data.get("notebookPath", "unknown"),
        "cell_id": event_data.get("cellId", "unknown"),
        "timestamp": event_data.get("timestamp", "unknown"),
        **context,
    }

    # エラーログを記録
    await log_error(
        error_type=f"EVENT_PROCESSING_{error_type}",
        message=f"イベント処理中にエラーが発生しました: {str(error)}",
        details=details,
        user_id=user_id,
        severity=severity,
        exception=error,
    )

    logger.error(
        f"イベント処理エラー: {error_type}, ユーザー: {user_id}, イベント: {event_type}"
    )


class CircuitBreaker:
    """
    サーキットブレーカーパターンの実装
    短時間に多数のエラーが発生した場合、一時的に処理を停止する
    """

    def __init__(
        self,
        failure_threshold: int = 5,  # 障害カウントのしきい値
        reset_timeout: float = 60.0,  # リセットタイムアウト（秒）
        half_open_timeout: float = 5.0,  # 半開状態でのタイムアウト（秒）
    ):
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.half_open_timeout = half_open_timeout

        self.failure_count = 0
        self.last_failure_time = 0.0
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN

    def record_success(self) -> None:
        """成功を記録し、必要に応じて状態を更新する"""
        if self.state == "HALF_OPEN":
            self.state = "CLOSED"
            self.failure_count = 0
            logger.info("サーキットブレーカー: 成功を記録。状態を CLOSEDに変更しました")

    def record_failure(self) -> None:
        """障害を記録し、必要に応じて状態を更新する"""
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.state == "CLOSED" and self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            logger.warning(
                f"サーキットブレーカー: 障害しきい値({self.failure_threshold})に達しました。状態を OPENに変更します"
            )

    def is_allowed(self) -> bool:
        """現在の操作が許可されるかどうかを確認する"""
        now = time.time()

        if self.state == "OPEN":
            # OPENの場合、リセットタイムアウトが経過したら半開状態に移行
            if now - self.last_failure_time >= self.reset_timeout:
                self.state = "HALF_OPEN"
                logger.info(
                    f"サーキットブレーカー: リセットタイムアウト({self.reset_timeout}s)経過。状態を HALF_OPENに変更します"
                )
                return True
            return False

        elif self.state == "HALF_OPEN":
            # HALF_OPENの場合、半開タイムアウト内のリクエスト数を制限
            # 単純化のため、最後の障害から一定時間が経過していれば許可
            return now - self.last_failure_time >= self.half_open_timeout

        # CLOSEDの場合は常に許可
        return True


# サーキットブレーカーのグローバルインスタンス
circuit_breaker = CircuitBreaker()
