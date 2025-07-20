from pydantic import ConfigDict
from schemas.event import EventData


class StudentProgress(EventData):
    """
    InfluxDBに書き込むための、より詳細な進捗イベントスキーマ。
    EventDataを継承し、DB永続化で得られたID情報を追加する。
    """

    studentId: int
    notebookId: int
    cellId_db: int

    # Pydantic V2では from_attributes = True を使用
    model_config = ConfigDict(from_attributes=True)
