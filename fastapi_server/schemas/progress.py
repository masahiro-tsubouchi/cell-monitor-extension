from pydantic import BaseModel


class StudentProgress(BaseModel):
    """
    学生の進捗状況を表すスキーマ。
    """

    id: int  # 学生のID
    # 今後、課題IDや進捗率などのフィールドを追加予定
