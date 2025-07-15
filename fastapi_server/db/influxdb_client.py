from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS

from core.config import settings
from schemas.progress import StudentProgress

# InfluxDBクライアントの初期化
influx_client = InfluxDBClient(
    url=settings.INFLUXDB_URL,
    token=settings.INFLUXDB_TOKEN,
    org=settings.INFLUXDB_ORG
)

# 同期書き込み用のWriteApiを取得
write_api = influx_client.write_api(write_options=SYNCHRONOUS)

def write_progress_event(progress: StudentProgress):
    """
    学生の進捗イベントをInfluxDBに書き込む
    """
    point = (
        Point("student_progress")
        .tag("userId", progress.userId)
        .tag("event", progress.event)
        .field("notebookPath", progress.notebookPath)
        .field("cellId", progress.cellId or "")
        .field("cellIndex", progress.cellIndex if progress.cellIndex is not None else -1)
        .field("cellContent", progress.cellContent or "")
        .field("executionCount", progress.executionCount if progress.executionCount is not None else -1)
        .time(progress.timestamp)
    )

    try:
        write_api.write(bucket=settings.INFLUXDB_BUCKET, org=settings.INFLUXDB_ORG, record=point)
        print(f"Successfully wrote event to InfluxDB for user: {progress.userId}")
    except Exception as e:
        print(f"Error writing to InfluxDB: {e}")

# アプリケーション終了時にクライアントを閉じるための関数
def close_influx_client():
    influx_client.close()
