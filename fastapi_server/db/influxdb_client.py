import logging
import time
from functools import wraps
from core.config import settings
from typing import Any, Dict, Union

from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
from influxdb_client.rest import ApiException


from schemas.progress import StudentProgress
from schemas.event import EventData

# ロガーの設定
logger = logging.getLogger(__name__)

# リトライ回数と待機時間の定義
MAX_RETRIES = 3
BACKOFF_FACTOR = 2  # 指数バックオフ用の係数

# InfluxDBクライアントの初期化
try:
    influx_client = InfluxDBClient(
        url=settings.INFLUXDB_URL,
        token=settings.INFLUXDB_TOKEN,
        org=settings.INFLUXDB_ORG,
    )

    # 同期書き込み用のWriteApiを取得
    write_api = influx_client.write_api(write_options=SYNCHRONOUS)
    logger.info(f"InfluxDBクライアントを初期化しました: {settings.INFLUXDB_URL}")
except Exception as e:
    logger.error(f"InfluxDBクライアントの初期化に失敗しました: {e}")
    raise


def with_influxdb_retry(func):
    """InfluxDB操作用のリトライデコレータ"""

    @wraps(func)
    def wrapper(*args, **kwargs):
        retries = 0
        last_exception = None

        while retries < MAX_RETRIES:
            try:
                return func(*args, **kwargs)
            except ApiException as e:
                # APIエラー（429=レート制限、5xx=サーバーエラー）の場合はリトライ
                if e.status in (429, 500, 502, 503, 504):
                    wait_time = BACKOFF_FACTOR**retries
                    logger.warning(
                        f"InfluxDB APIエラー（{e.status}）: {wait_time}秒後にリトライします"
                    )
                    time.sleep(wait_time)
                    retries += 1
                    last_exception = e
                else:
                    # その他のAPIエラーはそのまま上げる
                    logger.error(f"InfluxDB APIエラー（{e.status}）: {e}")
                    raise
            except Exception as e:
                # その他の例外（接続エラーなど）
                wait_time = BACKOFF_FACTOR**retries
                logger.warning(
                    f"InfluxDB接続エラー: {e}, {wait_time}秒後にリトライします"
                )
                time.sleep(wait_time)
                retries += 1
                last_exception = e

        # 最大リトライ回数を超えた場合
        logger.error(
            f"InfluxDBへの書き込みに失敗しました（{MAX_RETRIES}回リトライ後）: {last_exception}"
        )
        raise last_exception

    return wrapper


@with_influxdb_retry
def write_progress_event(progress: Union[StudentProgress, EventData]):
    """
    学生の進捗イベントをInfluxDBに書き込む
    詳細なタグ付けを行い、検索と集計の最適化を図る
    """
    # notebookPathから有益なタグを抽出
    notebook_name = (
        progress.notebookPath.split("/")[-1] if progress.notebookPath else "unknown"
    )
    notebook_dir = (
        "/".join(progress.notebookPath.split("/")[:-1])
        if progress.notebookPath and "/" in progress.notebookPath
        else "root"
    )

    # イベントタイプによって追加フィールドを決定
    additional_fields = {}
    if progress.event == "cell_execution":
        # セル実行イベントの場合は実行結果や実行時間を保存
        additional_fields["success"] = (
            progress.success if hasattr(progress, "success") else True
        )
        additional_fields["duration"] = (
            progress.duration if hasattr(progress, "duration") else 0
        )
    elif progress.event == "notebook_save":
        # ノートブック保存イベントの場合は保存されたセル数などを保存
        additional_fields["cell_count"] = (
            progress.cellCount if hasattr(progress, "cellCount") else 0
        )

    # 基本ポイント定義
    point = (
        Point("student_progress")
        # 基本タグ（クエリの一般的な絞り込みに使用）
        .tag("userId", progress.userId)
        .tag(
            "event",
            progress.eventType if isinstance(progress, EventData) else progress.event,
        )
        .tag("notebook", notebook_name)
        .tag("directory", notebook_dir)
        # セルタイプがある場合はタグとして追加（コード/マークダウン等）
        .tag(
            "cellType",
            progress.cellType if hasattr(progress, "cellType") else "unknown",
        )
        # セッションIDがある場合はタグとして追加
        .tag(
            "sessionId",
            progress.sessionId if hasattr(progress, "sessionId") else "unknown",
        )
        # 以下はフィールドとして保存（数値や文字列データ）
        .field("notebookPath", progress.notebookPath)
        .field("cellId", progress.cellId or "")
        .field(
            "cellIndex", progress.cellIndex if progress.cellIndex is not None else -1
        )
        # セルコンテンツは長すぎる場合は切り詰める
        .field(
            "cellContent",
            (
                (progress.cellContent or "")[:1000]
                if hasattr(progress, "cellContent")
                else ""
            ),
        )
        .field(
            "executionCount",
            progress.executionCount if progress.executionCount is not None else -1,
        )
        .time(progress.timestamp)
    )

    # 追加フィールドがあれば追加
    for key, value in additional_fields.items():
        if isinstance(value, bool):
            point = point.field(key, value)
        elif isinstance(value, (int, float)):
            point = point.field(key, value)
        else:
            point = point.field(key, str(value))

    try:
        write_api.write(
            bucket=settings.INFLUXDB_BUCKET, org=settings.INFLUXDB_ORG, record=point
        )
        logger.info(
            f"InfluxDBへのイベント書き込み成功: ユーザー={progress.userId}, イベント={progress.event}"
        )
        return True
    except Exception as e:
        # 例外はデコレータでキャッチされリトライされるが、ここには到達しないはず
        # （最後のリトライ失敗時は例外が上がる）
        logger.error(f"InfluxDBへの書き込みエラー: {e}")
        raise


def write_event_batch(events: list, measurement: str = "student_progress"):
    """
    複数のイベントをバッチで書き込む
    大量のデータを効率的に書き込むために使用

    Args:
        events: イベントデータのリスト（辞書形式）
        measurement: 書き込み先のmeasurement名
    """
    if not events:
        logger.warning("書き込むイベントがありません")
        return

    points = []
    for event in events:
        try:
            # イベントからPointオブジェクトを作成
            point = Point(measurement)

            # タグを追加（絞り込み・インデックス用）
            for tag_key in ["userId", "event", "notebook", "cellType", "sessionId"]:
                if tag_key in event:
                    point = point.tag(tag_key, str(event[tag_key]))

            # フィールドを追加（メトリクス・詳細データ用）
            for field_key, field_value in event.items():
                # タグ以外のフィールドを追加
                if field_key not in [
                    "userId",
                    "event",
                    "notebook",
                    "cellType",
                    "sessionId",
                    "timestamp",
                ]:
                    if isinstance(field_value, (int, float, bool)):
                        point = point.field(field_key, field_value)
                    else:
                        point = point.field(field_key, str(field_value))

            # タイムスタンプを設定
            if "timestamp" in event:
                point = point.time(event["timestamp"])

            points.append(point)
        except Exception as e:
            logger.error(f"イベントからPointへの変換エラー: {e}, event={event}")

    if points:
        try:
            write_api.write(
                bucket=settings.INFLUXDB_BUCKET,
                org=settings.INFLUXDB_ORG,
                record=points,
            )
            logger.info(f"{len(points)}件のイベントをバッチ書き込みしました")
            return True
        except Exception as e:
            logger.error(f"バッチ書き込みエラー: {e}")
            raise


@with_influxdb_retry
def query_progress_data(query: str) -> Dict[str, Any]:
    """
    InfluxDBからデータをクエリする

    Args:
        query: Flux言語のクエリ文字列

    Returns:
        クエリ結果の辞書
    """
    query_api = influx_client.query_api()
    try:
        result = query_api.query(org=settings.INFLUXDB_ORG, query=query)
        return result
    except Exception as e:
        logger.error(f"InfluxDBクエリエラー: {e}, query={query}")
        raise


# アプリケーション終了時にクライアントを閉じるための関数
def close_influx_client():
    try:
        influx_client.close()
        logger.info("InfluxDBクライアントを正常に閉じました")
    except Exception as e:
        logger.error(f"InfluxDBクライアント終了エラー: {e}")
