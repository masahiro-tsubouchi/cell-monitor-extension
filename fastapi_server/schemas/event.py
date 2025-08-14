from pydantic import BaseModel
from typing import Optional, Any, Dict


class EventData(BaseModel):
    """
    Generic event data schema to match the client's IStudentProgressData.
    All fields are optional to ensure initial compatibility.
    """

    eventId: Optional[str] = None
    eventType: Optional[str] = None
    eventTime: Optional[str] = None
    emailAddress: Optional[str] = None  # メールアドレス（ユーザー識別子）
    userName: Optional[str] = None
    teamName: Optional[str] = None  # チーム名
    sessionId: Optional[str] = None
    notebookPath: Optional[str] = None
    cellId: Optional[str] = None
    cellIndex: Optional[int] = None
    cellType: Optional[str] = None
    code: Optional[str] = None
    executionCount: Optional[int] = None
    hasError: Optional[bool] = None
    errorMessage: Optional[str] = None
    result: Optional[str] = None
    executionDurationMs: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None
