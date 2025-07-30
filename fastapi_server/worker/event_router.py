"""
イベントルーティングモジュール

このモジュールは、受信したイベントデータを適切な処理関数にルーティングする機能を提供します。
イベントタイプ（eventType）に基づいて、適切なハンドラー関数を呼び出します。
"""

import logging
from typing import Any, Callable, Dict
from functools import wraps

from schemas.event import EventData
from schemas.progress import StudentProgress
from db.influxdb_client import write_progress_event
from crud import crud_student, crud_notebook, crud_execution
from sqlalchemy.orm import Session
from worker.error_handler import handle_event_error

# ロガーの設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# エラー発生時のリトライ回数とバックオフの設定
MAX_RETRIES = 3
BACKOFF_FACTOR = 2  # 指数バックオフ用の係数


def with_retry(func):
    """
    関数の実行に失敗した場合に指数バックオフでリトライするデコレータ
    """

    @wraps(func)
    async def wrapper(*args, **kwargs):
        retries = 0
        last_exception = None

        while retries < MAX_RETRIES:
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                last_exception = e
                wait_time = BACKOFF_FACTOR**retries
                logger.warning(
                    f"処理に失敗しました。{wait_time}秒後にリトライします。エラー: {e}"
                )
                import asyncio

                await asyncio.sleep(wait_time)
                retries += 1

        # 最大リトライ回数を超えた場合
        logger.error(
            f"最大リトライ回数({MAX_RETRIES})を超えました。処理を中止します。最終エラー: {last_exception}"
        )
        # エラーログチャネルにエラーを報告する処理をここに追加予定
        raise last_exception

    return wrapper


class EventRouter:
    """
    イベントルーティングを行うクラス
    各イベントタイプに対応するハンドラー関数を登録・実行する
    """

    def __init__(self):
        # イベントタイプとハンドラー関数のマッピング
        self.handlers = {}

    def register_handler(self, event_type: str, handler_func: Callable):
        """
        イベントタイプに対応するハンドラー関数を登録

        Args:
            event_type: イベントの種類を表す文字列
            handler_func: イベントを処理するコールバック関数
        """
        self.handlers[event_type] = handler_func
        logger.info(f"ハンドラー登録: {event_type} -> {handler_func.__name__}")

    async def route_event(self, event_data: Dict[str, Any], db: Session) -> bool:
        """
        イベントデータを受け取り、適切なハンドラー関数にルーティングする

        Args:
            event_data: イベントデータを含む辞書
            db: SQLAlchemy DBセッション

        Returns:
            bool: 処理が成功したかどうか
        """
        try:
            # イベントタイプを抽出
            event_type = event_data.get("event")
            if not event_type:
                logger.error("イベントデータにeventフィールドがありません")
                return False

            # 対応するハンドラーを探す
            handler = self.handlers.get(event_type)
            if not handler:
                logger.warning(
                    f"イベントタイプ '{event_type}' に対応するハンドラーが見つかりません"
                )
                # デフォルトハンドラーで処理
                return await self._default_handler(event_data, db)

            # ハンドラー関数を実行
            logger.info(f"イベント '{event_type}' を処理中...")
            return await handler(event_data, db)

        except Exception as e:
            logger.error(f"イベント処理中にエラーが発生しました: {e}")
            # エラーハンドラーを呼び出し
            await handle_event_error(
                error=e, event_data=event_data, context={"method": "route_event"}
            )
            return False

    @with_retry
    async def _default_handler(self, event_data: Dict[str, Any], db: Session) -> bool:
        """
        どのハンドラーにも一致しないイベントのデフォルト処理
        基本的な進捗イベントとして処理する

        Args:
            event_data: イベントデータを含む辞書
            db: SQLAlchemy DBセッション

        Returns:
            bool: 処理が成功したかどうか
        """
        logger.info("デフォルトハンドラーでイベントを処理します")

        try:
            event = EventData.model_validate(event_data)

            if not event.userId:
                logger.error(
                    "userIdがありません。デフォルトハンドラーをスキップします。"
                )
                return False

            # ユーザー情報をPostgreSQLに保存/取得
            student = crud_student.get_or_create_student(db, user_id=event.userId)
            logger.info(
                f"PostgreSQL処理完了: ユーザーID {student.user_id} (DB ID: {student.id})"
            )

            # 時系列データをInfluxDBに書き込み
            write_progress_event(event)
            logger.info(f"InfluxDB書き込み完了: {event.userId}, {event.eventType}")

            return True
        except Exception as e:
            logger.error(f"デフォルト処理中にエラー: {e}")
            # エラーハンドラーを呼び出し
            await handle_event_error(
                error=e, event_data=event_data, context={"method": "_default_handler"}
            )
            return False


# セル実行イベントのハンドラー
@with_retry
async def handle_cell_execution(event_data: Dict[str, Any], db: Session):
    """
    セル実行イベントを処理し、LMS関連テーブルにデータを永続化する

    Args:
        event_data: イベントデータを含む辞書
        db: SQLAlchemy DBセッション
    """
    logger.info(f"セル実行イベントを処理中: {event_data.get('cellId', 'unknown')}")

    # 1. Pydanticモデルでイベントデータを検証・変換
    event = EventData.model_validate(event_data)

    if not all([event.userId, event.notebookPath, event.cellId]):
        logger.error("必須フィールド (userId, notebookPath, cellId) が不足しています。")
        return

    # 2. 関連エンティティの取得または作成
    if not event.userId or not event.notebookPath:
        logger.error("userId または notebookPath が None です")
        return
    student, _ = crud_student.get_or_create_student(db, user_id=event.userId)
    notebook, _ = crud_notebook.get_or_create_notebook(db, path=event.notebookPath)
    cell, _ = crud_notebook.get_or_create_cell(db, notebook_id=notebook.id, event=event)

    # 3. セル実行履歴を作成
    crud_execution.create_cell_execution(
        db=db,
        event=event,
        student_id=student.id,
        notebook_id=notebook.id,
        cell_id=cell.id,
    )
    logger.info(
        f"PostgreSQLへの実行履歴保存完了: student_id={student.id}, notebook_id={notebook.id}, cell_id={cell.id}"
    )

    # 4. InfluxDBに書き込むためのイベントデータを作成
    #    Pydantic V2の推奨に従い、`model_validate` を使用してバリデーションとモデル作成を行う
    progress_data_dict = event.model_dump()
    progress_data_dict.update(
        {
            "studentId": student.id,
            "notebookId": notebook.id,
            "cellId_db": cell.id,  # `cellId`はJupyterのID, `cellId_db`はDBのID
        }
    )
    progress_event = StudentProgress.model_validate(progress_data_dict)

    # 5. 時系列データをInfluxDBに書き込み
    await write_progress_event(progress_event)
    logger.info(f"InfluxDBへの書き込み完了: {event.userId}, {event.eventType}")
    return True


# ノートブック保存イベントのハンドラー
@with_retry
async def handle_notebook_save(event_data: Dict[str, Any], db: Session):
    """
    ノートブック保存イベントの処理

    Args:
        event_data: イベントデータを含む辞書
        db: SQLAlchemy DBセッション
    """
    logger.info(
        f"ノートブック保存イベントを処理中: {event_data.get('notebookPath', 'unknown')}"
    )

    try:
        event = EventData.model_validate(event_data)

        if not event.userId:
            logger.error(
                "userIdがありません。ノートブック保存ハンドラーをスキップします。"
            )
            return

        # ユーザー情報をPostgreSQLに保存/取得
        student = crud_student.get_or_create_student(db, user_id=event.userId)
        logger.info(f"PostgreSQL処理完了: ユーザーID {student.user_id}")

        # 時系列データをInfluxDBに書き込み
        write_progress_event(event)
        logger.info(f"InfluxDB書き込み完了: ノートブックパス {event.notebookPath}")
        return True
    except Exception as e:
        logger.error(f"ノートブック保存処理中にエラー: {e}")
        await handle_event_error(
            error=e, event_data=event_data, context={"method": "handle_notebook_save"}
        )
        raise


# 講師セッション開始イベントのハンドラー
async def handle_student_session_start(event_data: Dict[str, Any], db: Session) -> bool:
    """
    学生セッション開始時の講師ステータス自動更新

    Args:
        event_data: イベントデータを含む辞書
        db: SQLAlchemy DBセッション

    Returns:
        bool: 処理が成功したかどうか
    """
    try:
        instructor_id = event_data.get("instructor_id")
        student_id = event_data.get("student_id")

        if not instructor_id:
            logger.warning("instructor_idが指定されていません")
            return False

        # 講師ステータスをIN_SESSIONに更新
        from crud.crud_instructor import get_instructor, update_instructor_status
        from schemas.instructor import InstructorStatusUpdate
        from db.models import InstructorStatus

        instructor = get_instructor(db, instructor_id)
        if not instructor:
            logger.error(f"講師が見つかりません: {instructor_id}")
            return False

        # セッション情報は別途管理し、current_session_idはNullに設定
        # （外部キー制約を回避するため）
        status_update = InstructorStatusUpdate(
            status=InstructorStatus.IN_SESSION, current_session_id=None
        )

        updated_instructor = update_instructor_status(db, instructor_id, status_update)
        if updated_instructor:
            logger.info(f"講師ステータスを更新しました: {instructor_id} -> IN_SESSION")

            # WebSocket通知を送信
            session_info = f"session_{student_id}_{instructor_id}"
            await _notify_instructor_status_change(
                instructor_id, "in_session", session_info
            )

            return True
        else:
            logger.error(f"講師ステータス更新に失敗しました: {instructor_id}")
            return False

    except Exception as e:
        logger.error(f"学生セッション開始処理でエラーが発生しました: {e}")
        return False


# 講師割り当てイベントのハンドラー
async def handle_instructor_assignment(event_data: Dict[str, Any], db: Session) -> bool:
    """
    講師-学生マッチング機能

    Args:
        event_data: イベントデータを含む辞書
        db: SQLAlchemy DBセッション

    Returns:
        bool: 処理が成功したかどうか
    """
    try:
        student_id = event_data.get("student_id")
        class_id = event_data.get("class_id")
        subject = event_data.get("subject", "")
        priority = event_data.get("priority", "normal")

        # 利用可能な講師を検索
        from crud.crud_instructor import get_instructors
        from db.models import InstructorStatus

        available_instructors = get_instructors(db, skip=0, limit=10, is_active=True)

        # AVAILABLE状態の講師を優先的に選択
        selected_instructor = None
        for instructor in available_instructors:
            if instructor.status == InstructorStatus.AVAILABLE:
                selected_instructor = instructor
                break

        if not selected_instructor:
            logger.warning(f"利用可能な講師が見つかりません: student_id={student_id}")
            return False

        # 講師をIN_SESSIONに更新
        from crud.crud_instructor import update_instructor_status
        from schemas.instructor import InstructorStatusUpdate

        # セッション情報は別途管理し、current_session_idはNullに設定
        # （外部キー制約を回避するため）
        status_update = InstructorStatusUpdate(
            status=InstructorStatus.IN_SESSION, current_session_id=None
        )

        updated_instructor = update_instructor_status(
            db, selected_instructor.id, status_update
        )
        if updated_instructor:
            logger.info(
                f"講師を割り当てました: {selected_instructor.id} -> student: {student_id}"
            )

            # WebSocket通知を送信
            await _notify_instructor_assignment(
                selected_instructor.id, student_id, class_id
            )

            return True
        else:
            logger.error(f"講師割り当てに失敗しました: {selected_instructor.id}")
            return False

    except Exception as e:
        logger.error(f"講師割り当て処理でエラーが発生しました: {e}")
        return False


# WebSocket通知ヘルパー関数
async def _notify_instructor_status_change(
    instructor_id: int, status: str, session_info: str
):
    """
    講師ステータス変更のWebSocket通知
    """
    try:
        from api.endpoints.instructor_websocket import instructor_manager
        from datetime import datetime, timezone

        message = {
            "type": "status_updated",
            "instructor_id": instructor_id,
            "status": status,
            "session_info": session_info,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        await instructor_manager.send_to_instructor(instructor_id, message)
        logger.info(f"講師ステータス変更通知を送信しました: {instructor_id}")

    except Exception as e:
        logger.warning(f"WebSocket通知の送信に失敗しました: {e}")


async def _notify_instructor_assignment(
    instructor_id: int, student_id: str, class_id: str
):
    """
    講師割り当てのWebSocket通知
    """
    try:
        from api.endpoints.instructor_websocket import instructor_manager
        from datetime import datetime, timezone

        message = {
            "type": "instructor_assigned",
            "instructor_id": instructor_id,
            "student_id": student_id,
            "class_id": class_id,
            "assigned_at": datetime.now(timezone.utc).isoformat(),
        }

        await instructor_manager.send_to_instructor(instructor_id, message)
        logger.info(
            f"講師割り当て通知を送信しました: {instructor_id} -> student: {student_id}"
        )

    except Exception as e:
        logger.warning(f"WebSocket通知の送信に失敗しました: {e}")


# ルーター・インスタンスの作成（シングルトン）
event_router = EventRouter()

# イベントタイプとハンドラー関数の登録
event_router.register_handler(
    "cell_execution", handle_cell_execution
)  # フロントエンドのイベント名に合わせる
event_router.register_handler("notebook_save", handle_notebook_save)

# 講師関連ハンドラーの登録
event_router.register_handler("student_session_start", handle_student_session_start)
event_router.register_handler("instructor_assignment", handle_instructor_assignment)

# ログ出力
logger.info("イベントルーターが初期化されました")
