# Backend実装ガイド - ログイン機能＆講師ステータス管理

## 📋 目次
1. [必要なパッケージ](#1-必要なパッケージ)
2. [データベース設計](#2-データベース設計)
3. [環境変数設定](#3-環境変数設定)
4. [モデル定義](#4-モデル定義)
5. [スキーマ定義](#5-スキーマ定義)
6. [セキュリティ実装](#6-セキュリティ実装)
7. [CRUD操作](#7-crud操作)
8. [API エンドポイント](#8-api-エンドポイント)
9. [WebSocket統合](#9-websocket統合)
10. [テストケース](#10-テストケース)

## 1. 必要なパッケージ

### requirements.txt に追加
```txt
# 認証関連
passlib[bcrypt]==1.7.4
python-jose[cryptography]==3.3.0
python-multipart==0.0.6

# 既存のパッケージに追加で必要なもの
# (FastAPI, SQLAlchemy等は既にインストール済みと想定)
```

## 2. データベース設計

### migrations/add_instructor_tables.sql
```sql
-- 講師テーブル
CREATE TABLE instructors (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'instructor',
    is_active BOOLEAN DEFAULT true,
    status VARCHAR(50) DEFAULT 'offline',
    current_session_id INTEGER REFERENCES sessions(id),
    status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_instructors_email ON instructors(email);
CREATE INDEX idx_instructors_status ON instructors(status);
CREATE INDEX idx_instructors_active ON instructors(is_active);

-- 既存のclassesテーブルに講師IDを追加
ALTER TABLE classes ADD COLUMN instructor_id INTEGER REFERENCES instructors(id);

-- 講師ステータス履歴テーブル（オプション）
CREATE TABLE instructor_status_history (
    id SERIAL PRIMARY KEY,
    instructor_id INTEGER REFERENCES instructors(id) NOT NULL,
    status VARCHAR(50) NOT NULL,
    session_id INTEGER REFERENCES sessions(id),
    student_id INTEGER REFERENCES users(id),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER GENERATED ALWAYS AS (
        CASE
            WHEN ended_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (ended_at - started_at)) / 60
            ELSE NULL
        END
    ) STORED
);

CREATE INDEX idx_status_history_instructor ON instructor_status_history(instructor_id, started_at);
```

## 3. 環境変数設定

### .env.example
```env
# 認証設定
SECRET_KEY=your-secret-key-here-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS設定（フロントエンドURL）
FRONTEND_URL=http://localhost:3000

# セキュリティ設定
BCRYPT_ROUNDS=12
```

### core/config.py に追加
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # 既存の設定...

    # 認証設定
    secret_key: str = "your-secret-key"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # セキュリティ設定
    bcrypt_rounds: int = 12

    class Config:
        env_file = ".env"

settings = Settings()
```

## 4. モデル定義

### db/models/instructor.py
```python
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from db.base_class import Base

class InstructorStatus(str, enum.Enum):
    AVAILABLE = "available"
    IN_SESSION = "in_session"
    BREAK = "break"
    OFFLINE = "offline"

class Instructor(Base):
    __tablename__ = "instructors"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(String(50), default="instructor")
    is_active = Column(Boolean, default=True)

    # ステータス管理
    status = Column(
        Enum(InstructorStatus),
        default=InstructorStatus.OFFLINE,
        nullable=False
    )
    current_session_id = Column(Integer, ForeignKey("sessions.id"), nullable=True)
    status_updated_at = Column(DateTime(timezone=True), server_default=func.now())

    # ログイン管理
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    # タイムスタンプ
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # リレーションシップ
    classes = relationship("Class", back_populates="instructor")
    status_history = relationship("InstructorStatusHistory", back_populates="instructor")

class InstructorStatusHistory(Base):
    __tablename__ = "instructor_status_history"

    id = Column(Integer, primary_key=True, index=True)
    instructor_id = Column(Integer, ForeignKey("instructors.id"), nullable=False)
    status = Column(String(50), nullable=False)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)

    # リレーションシップ
    instructor = relationship("Instructor", back_populates="status_history")
```

## 5. スキーマ定義

### schemas/auth.py
```python
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class LoginResponse(TokenResponse):
    instructor: dict

class InstructorCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class InstructorInfo(BaseModel):
    id: int
    email: str
    name: str
    role: str
    status: str
    last_login_at: Optional[datetime]

    class Config:
        from_attributes = True
```

### schemas/instructor_status.py
```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum

class InstructorStatus(str, Enum):
    AVAILABLE = "available"
    IN_SESSION = "in_session"
    BREAK = "break"
    OFFLINE = "offline"

class InstructorStatusUpdate(BaseModel):
    status: InstructorStatus
    session_id: Optional[int] = None
    student_id: Optional[int] = None

class InstructorStatusInfo(BaseModel):
    id: int
    name: str
    email: str
    status: InstructorStatus
    current_session_id: Optional[int]
    status_updated_at: datetime
    active_students_count: int = 0

    class Config:
        from_attributes = True

class InstructorWorkload(BaseModel):
    instructor_id: int
    active_sessions: int
    total_students: int
    status: InstructorStatus
```

## 6. セキュリティ実装

### core/security.py
```python
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """パスワード検証"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """パスワードハッシュ化"""
    return pwd_context.hash(password)

def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """アクセストークン生成"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)

    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt

def verify_token(token: str, token_type: str = "access") -> Dict[str, Any]:
    """トークン検証"""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("type") != token_type:
            raise JWTError("Invalid token type")
        return payload
    except JWTError:
        raise
```

### api/deps.py
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError

from db.session import get_db
from core.security import verify_token
from crud.instructor import crud_instructor
from db.models.instructor import Instructor

security = HTTPBearer()

async def get_current_instructor(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Instructor:
    """現在の認証済み講師を取得"""
    token = credentials.credentials

    try:
        payload = verify_token(token)
        instructor_id = int(payload.get("sub"))
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    instructor = crud_instructor.get(db, id=instructor_id)
    if not instructor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instructor not found"
        )

    if not instructor.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive instructor"
        )

    return instructor
```

## 7. CRUD操作

### crud/instructor.py
```python
from typing import Optional, List
from sqlalchemy.orm import Session
from datetime import datetime

from crud.base import CRUDBase
from db.models.instructor import Instructor, InstructorStatus, InstructorStatusHistory
from schemas.auth import InstructorCreate
from core.security import get_password_hash, verify_password

class CRUDInstructor(CRUDBase[Instructor, InstructorCreate, None]):
    def create(self, db: Session, *, obj_in: InstructorCreate) -> Instructor:
        """講師作成"""
        db_obj = Instructor(
            email=obj_in.email,
            password_hash=get_password_hash(obj_in.password),
            name=obj_in.name
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_by_email(self, db: Session, *, email: str) -> Optional[Instructor]:
        """メールアドレスで講師を取得"""
        return db.query(Instructor).filter(Instructor.email == email).first()

    def authenticate(self, db: Session, *, email: str, password: str) -> Optional[Instructor]:
        """講師認証"""
        instructor = self.get_by_email(db, email=email)
        if not instructor:
            return None
        if not verify_password(password, instructor.password_hash):
            return None
        return instructor

    def update_last_login(self, db: Session, *, instructor_id: int) -> None:
        """最終ログイン時刻を更新"""
        instructor = self.get(db, id=instructor_id)
        if instructor:
            instructor.last_login_at = datetime.utcnow()
            db.commit()

    def update_status(
        self,
        db: Session,
        *,
        instructor_id: int,
        status: InstructorStatus,
        session_id: Optional[int] = None,
        student_id: Optional[int] = None
    ) -> Optional[Instructor]:
        """講師ステータスを更新"""
        instructor = self.get(db, id=instructor_id)
        if not instructor:
            return None

        # 前のステータスがIN_SESSIONだった場合、履歴を終了
        if instructor.status == InstructorStatus.IN_SESSION:
            active_history = db.query(InstructorStatusHistory).filter(
                InstructorStatusHistory.instructor_id == instructor_id,
                InstructorStatusHistory.ended_at.is_(None)
            ).first()

            if active_history:
                active_history.ended_at = datetime.utcnow()

        # ステータス更新
        instructor.status = status
        instructor.current_session_id = session_id
        instructor.status_updated_at = datetime.utcnow()

        # 新しいステータスがIN_SESSIONの場合、履歴を開始
        if status == InstructorStatus.IN_SESSION:
            history = InstructorStatusHistory(
                instructor_id=instructor_id,
                status=status,
                session_id=session_id,
                student_id=student_id
            )
            db.add(history)

        db.commit()
        db.refresh(instructor)
        return instructor

    def get_available_instructors(self, db: Session) -> List[Instructor]:
        """対応可能な講師リストを取得"""
        return db.query(Instructor).filter(
            Instructor.is_active == True,
            Instructor.status == InstructorStatus.AVAILABLE
        ).all()

    def get_instructor_workload(self, db: Session, *, instructor_id: int) -> dict:
        """講師の作業負荷を取得"""
        from db.models import Session as StudentSession

        active_sessions = db.query(StudentSession).filter(
            StudentSession.instructor_id == instructor_id,
            StudentSession.is_active == True
        ).count()

        instructor = self.get(db, id=instructor_id)

        return {
            "instructor_id": instructor_id,
            "active_sessions": active_sessions,
            "status": instructor.status if instructor else None
        }

crud_instructor = CRUDInstructor(Instructor)
```

## 8. API エンドポイント

### api/v1/endpoints/auth.py
```python
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from datetime import timedelta

from api import deps
from core import security
from core.config import settings
from crud.instructor import crud_instructor
from schemas.auth import LoginRequest, LoginResponse, TokenResponse
from db.session import get_db

router = APIRouter()

@router.post("/login", response_model=LoginResponse)
async def login(
    form_data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    """講師ログイン"""
    instructor = crud_instructor.authenticate(
        db, email=form_data.email, password=form_data.password
    )
    if not instructor:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    elif not instructor.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive instructor"
        )

    # アクセストークン生成
    access_token = security.create_access_token(
        data={"sub": str(instructor.id), "email": instructor.email}
    )

    # リフレッシュトークン生成
    refresh_token = security.create_access_token(
        data={"sub": str(instructor.id), "type": "refresh"},
        expires_delta=timedelta(days=settings.refresh_token_expire_days)
    )

    # HTTPOnly Cookieにリフレッシュトークンを設定
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,  # HTTPSの場合
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60
    )

    # 最終ログイン時刻を更新
    crud_instructor.update_last_login(db, instructor_id=instructor.id)

    # オンラインステータスに変更
    crud_instructor.update_status(
        db,
        instructor_id=instructor.id,
        status="available"
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "instructor": {
            "id": instructor.id,
            "email": instructor.email,
            "name": instructor.name,
            "role": instructor.role
        }
    }

@router.post("/logout")
async def logout(
    response: Response,
    current_instructor = Depends(deps.get_current_instructor),
    db: Session = Depends(get_db)
):
    """講師ログアウト"""
    # オフラインステータスに変更
    crud_instructor.update_status(
        db,
        instructor_id=current_instructor.id,
        status="offline"
    )

    # Cookieを削除
    response.delete_cookie(key="refresh_token")

    return {"message": "Successfully logged out"}

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: Request,
    db: Session = Depends(get_db)
):
    """リフレッシュトークンを使用してアクセストークンを更新"""
    refresh_token = request.cookies.get("refresh_token")

    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found"
        )

    try:
        payload = security.verify_token(refresh_token, token_type="refresh")
        instructor_id = int(payload.get("sub"))

        instructor = crud_instructor.get(db, id=instructor_id)
        if not instructor or not instructor.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )

        # 新しいアクセストークンを生成
        access_token = security.create_access_token(
            data={"sub": str(instructor.id), "email": instructor.email}
        )

        return {"access_token": access_token, "token_type": "bearer"}

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

@router.get("/me")
async def read_current_instructor(
    current_instructor = Depends(deps.get_current_instructor)
):
    """現在の講師情報を取得"""
    return {
        "id": current_instructor.id,
        "email": current_instructor.email,
        "name": current_instructor.name,
        "role": current_instructor.role,
        "status": current_instructor.status,
        "last_login_at": current_instructor.last_login_at
    }
```

### api/v1/endpoints/instructor_status.py
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from api import deps
from crud.instructor import crud_instructor
from schemas.instructor_status import (
    InstructorStatusUpdate,
    InstructorStatusInfo,
    InstructorWorkload
)
from db.session import get_db
from db.models import Session as StudentSession

router = APIRouter()

@router.get("/status", response_model=List[InstructorStatusInfo])
async def get_all_instructor_status(
    db: Session = Depends(get_db),
    current_instructor = Depends(deps.get_current_instructor)
):
    """全講師のステータス一覧を取得"""
    instructors = db.query(Instructor).filter(
        Instructor.is_active == True
    ).all()

    result = []
    for instructor in instructors:
        # アクティブな学生数を計算
        active_students = db.query(StudentSession).filter(
            StudentSession.instructor_id == instructor.id,
            StudentSession.is_active == True
        ).count()

        result.append(InstructorStatusInfo(
            id=instructor.id,
            name=instructor.name,
            email=instructor.email,
            status=instructor.status,
            current_session_id=instructor.current_session_id,
            status_updated_at=instructor.status_updated_at,
            active_students_count=active_students
        ))

    return result

@router.put("/status")
async def update_my_status(
    status_update: InstructorStatusUpdate,
    db: Session = Depends(get_db),
    current_instructor = Depends(deps.get_current_instructor)
):
    """自分のステータスを更新"""
    updated = crud_instructor.update_status(
        db,
        instructor_id=current_instructor.id,
        status=status_update.status,
        session_id=status_update.session_id,
        student_id=status_update.student_id
    )

    if not updated:
        raise HTTPException(
            status_code=404,
            detail="Instructor not found"
        )

    # WebSocketで通知（実装済みの場合）
    await notify_status_change(updated)

    return {"message": "Status updated", "status": updated.status}

@router.get("/available", response_model=List[dict])
async def get_available_instructors(
    db: Session = Depends(get_db)
):
    """対応可能な講師リストを取得（学生用）"""
    available = crud_instructor.get_available_instructors(db)

    return [
        {
            "id": inst.id,
            "name": inst.name,
            "status": inst.status
        } for inst in available
    ]

@router.get("/workload/{instructor_id}", response_model=InstructorWorkload)
async def get_instructor_workload(
    instructor_id: int,
    db: Session = Depends(get_db),
    current_instructor = Depends(deps.get_current_instructor)
):
    """特定講師の作業負荷を取得"""
    workload = crud_instructor.get_instructor_workload(
        db, instructor_id=instructor_id
    )

    return workload
```

### api/v1/api.py の更新
```python
from fastapi import APIRouter

from api.v1.endpoints import (
    events,
    auth,
    instructor_status
)

api_router = APIRouter()

# 既存のルート
api_router.include_router(events.router, prefix="/events", tags=["events"])

# 新規追加
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(
    instructor_status.router,
    prefix="/instructors",
    tags=["instructor-status"]
)
```

## 9. WebSocket統合

### core/websocket_manager.py に追加
```python
from typing import Dict, List
import json
from fastapi import WebSocket

class InstructorStatusManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}

    async def connect(self, websocket: WebSocket, instructor_id: int):
        """講師のWebSocket接続"""
        await websocket.accept()
        self.active_connections[instructor_id] = websocket

        # 接続時にステータスをAVAILABLEに
        await self.update_instructor_status(
            instructor_id,
            InstructorStatus.AVAILABLE
        )

    async def disconnect(self, instructor_id: int):
        """講師のWebSocket切断"""
        if instructor_id in self.active_connections:
            # 切断時にステータスをOFFLINEに
            await self.update_instructor_status(
                instructor_id,
                InstructorStatus.OFFLINE
            )
            del self.active_connections[instructor_id]

    async def broadcast_status_update(self, instructor_data: dict):
        """全接続中のクライアントにステータス更新を通知"""
        message = json.dumps({
            "type": "instructor_status_update",
            "data": instructor_data
        })

        disconnected = []
        for instructor_id, connection in self.active_connections.items():
            try:
                await connection.send_text(message)
            except:
                disconnected.append(instructor_id)

        # 切断された接続を削除
        for instructor_id in disconnected:
            await self.disconnect(instructor_id)

instructor_manager = InstructorStatusManager()
```

### 既存のイベント処理に統合
```python
# services/event_processor.py に追加
async def process_event(event: dict, db: Session):
    """イベント処理時に講師ステータスを自動更新"""
    event_type = event.get("event_type")

    if event_type == "session_started":
        # セッション開始時
        instructor_id = event.get("instructor_id")
        if instructor_id:
            crud_instructor.update_status(
                db,
                instructor_id=instructor_id,
                status=InstructorStatus.IN_SESSION,
                session_id=event.get("session_id"),
                student_id=event.get("user_id")
            )

            # WebSocketで通知
            await instructor_manager.broadcast_status_update({
                "instructor_id": instructor_id,
                "status": "in_session"
            })

    elif event_type == "session_ended":
        # セッション終了時
        instructor_id = event.get("instructor_id")
        if instructor_id:
            # 他のアクティブセッションがあるかチェック
            active_sessions = db.query(Session).filter(
                Session.instructor_id == instructor_id,
                Session.is_active == True,
                Session.id != event.get("session_id")
            ).count()

            if active_sessions == 0:
                crud_instructor.update_status(
                    db,
                    instructor_id=instructor_id,
                    status=InstructorStatus.AVAILABLE
                )

                await instructor_manager.broadcast_status_update({
                    "instructor_id": instructor_id,
                    "status": "available"
                })
```

## 10. テストケース

### tests/test_auth.py
```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from core.security import get_password_hash
from crud.instructor import crud_instructor
from schemas.auth import InstructorCreate

def test_login_success(client: TestClient, db: Session):
    """正常なログイン"""
    # テスト用講師作成
    instructor_in = InstructorCreate(
        email="test@example.com",
        password="testpass123",
        name="Test Instructor"
    )
    instructor = crud_instructor.create(db, obj_in=instructor_in)

    # ログイン
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "testpass123"}
    )

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["instructor"]["email"] == "test@example.com"

def test_login_invalid_credentials(client: TestClient):
    """無効な認証情報でのログイン"""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "wrong@example.com", "password": "wrongpass"}
    )

    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]

def test_protected_endpoint(client: TestClient, db: Session):
    """保護されたエンドポイントへのアクセス"""
    # 認証なしでアクセス
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 403

    # ログインしてトークン取得
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "testpass123"}
    )
    token = login_response.json()["access_token"]

    # トークン付きでアクセス
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    assert response.json()["email"] == "test@example.com"

def test_logout(client: TestClient, authorized_headers: dict):
    """ログアウト"""
    response = client.post(
        "/api/v1/auth/logout",
        headers=authorized_headers
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Successfully logged out"

def test_refresh_token(client: TestClient, db: Session):
    """リフレッシュトークンでのアクセストークン更新"""
    # ログインしてリフレッシュトークンを取得
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "testpass123"}
    )

    # Cookieからリフレッシュトークンを取得
    cookies = login_response.cookies

    # リフレッシュエンドポイントを呼び出し
    response = client.post(
        "/api/v1/auth/refresh",
        cookies=cookies
    )

    assert response.status_code == 200
    assert "access_token" in response.json()
```

### tests/test_instructor_status.py
```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from db.models.instructor import InstructorStatus
from crud.instructor import crud_instructor

def test_get_all_instructor_status(
    client: TestClient,
    db: Session,
    authorized_headers: dict
):
    """全講師のステータス取得"""
    response = client.get(
        "/api/v1/instructors/status",
        headers=authorized_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

    if data:
        instructor = data[0]
        assert "id" in instructor
        assert "status" in instructor
        assert "active_students_count" in instructor

def test_update_instructor_status(
    client: TestClient,
    db: Session,
    authorized_headers: dict,
    test_instructor_id: int
):
    """講師ステータスの更新"""
    # ステータスを IN_SESSION に更新
    response = client.put(
        "/api/v1/instructors/status",
        json={
            "status": "in_session",
            "session_id": 123
        },
        headers=authorized_headers
    )

    assert response.status_code == 200
    assert response.json()["status"] == "in_session"

    # DBで確認
    instructor = crud_instructor.get(db, id=test_instructor_id)
    assert instructor.status == InstructorStatus.IN_SESSION
    assert instructor.current_session_id == 123

def test_get_available_instructors(client: TestClient, db: Session):
    """対応可能な講師リストの取得"""
    # テスト用に複数の講師を作成
    available_instructor = crud_instructor.create(
        db,
        obj_in={
            "email": "available@example.com",
            "password": "pass123",
            "name": "Available Instructor"
        }
    )
    crud_instructor.update_status(
        db,
        instructor_id=available_instructor.id,
        status=InstructorStatus.AVAILABLE
    )

    busy_instructor = crud_instructor.create(
        db,
        obj_in={
            "email": "busy@example.com",
            "password": "pass123",
            "name": "Busy Instructor"
        }
    )
    crud_instructor.update_status(
        db,
        instructor_id=busy_instructor.id,
        status=InstructorStatus.IN_SESSION
    )

    # 対応可能な講師のみ取得
    response = client.get("/api/v1/instructors/available")

    assert response.status_code == 200
    data = response.json()

    # AVAILABLEステータスの講師のみが含まれることを確認
    instructor_emails = [inst["name"] for inst in data]
    assert "Available Instructor" in instructor_emails
    assert "Busy Instructor" not in instructor_emails

def test_instructor_workload(
    client: TestClient,
    db: Session,
    authorized_headers: dict,
    test_instructor_id: int
):
    """講師の作業負荷取得"""
    response = client.get(
        f"/api/v1/instructors/workload/{test_instructor_id}",
        headers=authorized_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert "instructor_id" in data
    assert "active_sessions" in data
    assert "status" in data

def test_status_history_tracking(db: Session):
    """ステータス履歴の追跡"""
    instructor = crud_instructor.create(
        db,
        obj_in={
            "email": "history@example.com",
            "password": "pass123",
            "name": "History Test"
        }
    )

    # ステータスを IN_SESSION に変更
    crud_instructor.update_status(
        db,
        instructor_id=instructor.id,
        status=InstructorStatus.IN_SESSION,
        session_id=100,
        student_id=200
    )

    # 履歴が作成されたことを確認
    from db.models.instructor import InstructorStatusHistory
    history = db.query(InstructorStatusHistory).filter(
        InstructorStatusHistory.instructor_id == instructor.id
    ).first()

    assert history is not None
    assert history.status == "in_session"
    assert history.session_id == 100
    assert history.student_id == 200
    assert history.ended_at is None

    # ステータスを AVAILABLE に変更
    crud_instructor.update_status(
        db,
        instructor_id=instructor.id,
        status=InstructorStatus.AVAILABLE
    )

    # 履歴が終了したことを確認
    db.refresh(history)
    assert history.ended_at is not None
```

### tests/conftest.py
```python
import pytest
from typing import Generator, Dict
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from main import app
from db.base import Base
from db.session import get_db
from crud.instructor import crud_instructor
from schemas.auth import InstructorCreate

# テスト用データベース
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db() -> Generator:
    """テスト用DBセッション"""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db: Session) -> Generator:
    """テストクライアント"""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c

@pytest.fixture
def test_instructor(db: Session):
    """テスト用講師"""
    instructor_in = InstructorCreate(
        email="test@example.com",
        password="testpass123",
        name="Test Instructor"
    )
    return crud_instructor.create(db, obj_in=instructor_in)

@pytest.fixture
def test_instructor_id(test_instructor):
    """テスト用講師ID"""
    return test_instructor.id

@pytest.fixture
def authorized_headers(client: TestClient, test_instructor) -> Dict[str, str]:
    """認証済みヘッダー"""
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": test_instructor.email,
            "password": "testpass123"
        }
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
```

## 📝 実装チェックリスト

### データベース
- [ ] マイグレーションファイルの作成
- [ ] instructorsテーブルの作成
- [ ] instructor_status_historyテーブルの作成
- [ ] 既存テーブルへのinstructor_id追加

### 環境設定
- [ ] .envファイルの設定
- [ ] core/config.pyの更新

### モデル・スキーマ
- [ ] Instructorモデルの作成
- [ ] 認証スキーマの作成
- [ ] ステータススキーマの作成

### セキュリティ
- [ ] パスワードハッシュ化の実装
- [ ] JWT トークン生成・検証
- [ ] 認証デコレーターの実装

### CRUD操作
- [ ] 講師のCRUD実装
- [ ] 認証メソッドの実装
- [ ] ステータス管理メソッドの実装

### APIエンドポイント
- [ ] ログイン/ログアウトAPI
- [ ] トークンリフレッシュAPI
- [ ] ステータス管理API
- [ ] ルーターへの登録

### WebSocket統合
- [ ] 講師用WebSocketマネージャー
- [ ] ステータス変更通知
- [ ] 既存イベント処理への統合

### テスト
- [ ] 認証テストの作成
- [ ] ステータス管理テストの作成
- [ ] E2Eテストの作成

## 🚀 実装順序の推奨

1. **データベース準備** (30分)
   - マイグレーションの実行
   - テーブル作成の確認

2. **基本認証機能** (2-3時間)
   - モデル・スキーマ作成
   - セキュリティ実装
   - ログインAPIの実装

3. **ステータス管理** (2時間)
   - CRUD拡張
   - ステータスAPI実装
   - WebSocket統合

4. **テスト実装** (2時間)
   - 単体テスト
   - 統合テスト

5. **既存システムとの統合** (1時間)
   - イベント処理への組み込み
   - WebSocketの拡張

## 🔧 トラブルシューティング

### よくある問題と解決方法

1. **CORS エラー**
```python
# main.py に追加
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

2. **JWT トークンエラー**
- SECRET_KEYが設定されているか確認
- トークンの有効期限を確認
- Bearerスキームが正しく設定されているか確認

3. **データベース接続エラー**
- PostgreSQLが起動しているか確認
- 接続文字列が正しいか確認
- マイグレーションが実行されているか確認

## 📚 参考リンク

- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [SQLAlchemy ORM](https://docs.sqlalchemy.org/en/14/orm/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [WebSocket in FastAPI](https://fastapi.tiangolo.com/advanced/websockets/)
