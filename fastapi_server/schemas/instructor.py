from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from db.models import InstructorStatus


class InstructorBase(BaseModel):
    """講師の基本情報スキーマ"""

    email: EmailStr
    name: str
    role: Optional[str] = "instructor"


class InstructorCreate(InstructorBase):
    """講師作成用スキーマ"""

    password: str


class InstructorLogin(BaseModel):
    """講師ログイン用スキーマ"""

    email: EmailStr
    password: str


class InstructorUpdate(BaseModel):
    """講師情報更新用スキーマ"""

    name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class InstructorPasswordUpdate(BaseModel):
    """パスワード変更用スキーマ"""

    current_password: str
    new_password: str


class InstructorStatusUpdate(BaseModel):
    """講師ステータス更新用スキーマ"""

    status: InstructorStatus
    current_session_id: Optional[int] = None


class InstructorResponse(InstructorBase):
    """講師情報レスポンス用スキーマ"""

    id: int
    is_active: bool
    status: InstructorStatus
    current_session_id: Optional[int] = None
    status_updated_at: datetime
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InstructorStatusResponse(BaseModel):
    """講師ステータスレスポンス用スキーマ"""

    instructor_id: int
    status: InstructorStatus
    current_session_id: Optional[int] = None
    status_updated_at: datetime

    class Config:
        from_attributes = True


class InstructorStatusHistoryResponse(BaseModel):
    """講師ステータス履歴レスポンス用スキーマ"""

    id: int
    instructor_id: int
    status: InstructorStatus
    session_id: Optional[int] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """認証トークンレスポンス用スキーマ"""

    access_token: str
    token_type: str = "bearer"
    expires_in: int  # 秒単位


class LoginResponse(BaseModel):
    """ログインレスポンス用スキーマ"""

    instructor: InstructorResponse
    token: TokenResponse


# 後方互換性のためのエイリアス
Instructor = InstructorResponse
InstructorStatus = InstructorStatusResponse
InstructorStatusHistory = InstructorStatusHistoryResponse
