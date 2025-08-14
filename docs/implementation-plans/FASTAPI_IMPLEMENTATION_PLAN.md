# FastAPI実装計画

## 目的
このドキュメントは、AI駆動開発においてFastAPIバックエンドを実装するための詳細な手順書です。初級開発者でも理解でき、AIアシスタントがスムーズに実装を進められるよう構成されています。

## 🎯 実装目標

JupyterLabから送信されるセル実行イベントを受信し、データベースに永続化し、リアルタイムで講師ダッシュボードに配信するバックエンドシステムを構築する。

## 📋 前提条件

### 必要な知識
- Python 基礎
- FastAPI フレームワーク
- データベース操作（SQLAlchemy）
- 非同期プログラミング（async/await）

### 環境要件
- Python 3.11+
- PostgreSQL
- InfluxDB
- Redis
- Docker (開発環境)

## 🏗️ アーキテクチャ設計

### システム構成
```
JupyterLab Extension
    ↓ HTTP POST
FastAPI Server (/api/v1/events)
    ↓ Redis Pub/Sub
Background Worker
    ↓
PostgreSQL + InfluxDB
    ↓ WebSocket
Instructor Dashboard
```

### データフロー
1. **イベント受信**: `/api/v1/events` エンドポイントでバッチイベント受信
2. **バリデーション**: Pydanticスキーマでデータ検証
3. **キューイング**: Redis Pub/Subでメッセージ配信
4. **バックグラウンド処理**: 非同期ワーカーでデータ処理
5. **永続化**: PostgreSQL（関係データ）+ InfluxDB（時系列データ）
6. **リアルタイム配信**: WebSocketで講師ダッシュボードに通知

## 📁 ディレクトリ構造

```
fastapi_server/
├── main.py                 # アプリケーションエントリーポイント
├── api/
│   ├── api.py             # APIルーター統合
│   └── endpoints/         # エンドポイント実装
│       ├── events.py      # イベント受信
│       ├── websocket.py   # WebSocket通信
│       └── auth.py        # 認証
├── core/
│   ├── config.py          # 設定管理
│   └── security.py        # セキュリティ
├── db/
│   ├── models.py          # データベースモデル
│   ├── session.py         # DB接続管理
│   ├── influxdb_client.py # InfluxDB操作
│   └── redis_client.py    # Redis操作
├── schemas/
│   ├── event.py           # イベントスキーマ
│   └── progress.py        # 進捗スキーマ
├── crud/
│   └── crud_*.py          # データベース操作
├── worker/
│   ├── main.py            # ワーカーメイン
│   └── event_router.py    # イベント処理
└── tests/
    └── ...                # テストコード
```

## 🔧 実装手順

### Phase 1: 基盤実装

#### 1.1 プロジェクトセットアップ
```bash
# 依存関係インストール
pip install fastapi uvicorn sqlalchemy psycopg2-binary influxdb-client redis pydantic

# ディレクトリ作成
mkdir -p fastapi_server/{api/endpoints,core,db,schemas,crud,worker,tests}
```

#### 1.2 設定管理 (`core/config.py`)
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # アプリケーション設定
    PROJECT_NAME: str = "Student Progress Tracker API"
    API_V1_STR: str = "/api/v1"

    # データベース設定
    DATABASE_URL: str = "postgresql://user:password@localhost/db"
    INFLUXDB_URL: str = "http://localhost:8086"
    INFLUXDB_TOKEN: str = "your-token"
    INFLUXDB_ORG: str = "your-org"
    INFLUXDB_BUCKET: str = "progress_bucket"

    # Redis設定
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    class Config:
        case_sensitive = True

settings = Settings()
```

#### 1.3 データベースモデル (`db/models.py`)
```python
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

Base = declarative_base()

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # リレーションシップ
    cell_executions = relationship("CellExecution", back_populates="student")

class Notebook(Base):
    __tablename__ = "notebooks"

    id = Column(Integer, primary_key=True, index=True)
    path = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # リレーションシップ
    cells = relationship("Cell", back_populates="notebook")

class Cell(Base):
    __tablename__ = "cells"

    id = Column(Integer, primary_key=True, index=True)
    cell_id = Column(String, index=True, nullable=False)
    notebook_id = Column(Integer, ForeignKey("notebooks.id"), nullable=False)
    cell_type = Column(String, nullable=False)
    content = Column(Text, nullable=True)

    # リレーションシップ
    notebook = relationship("Notebook", back_populates="cells")
    executions = relationship("CellExecution", back_populates="cell")

class CellExecution(Base):
    __tablename__ = "cell_executions"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    cell_id = Column(Integer, ForeignKey("cells.id"), nullable=False)
    executed_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, nullable=False)  # success, error
    duration = Column(Float, nullable=True)
    output = Column(Text, nullable=True)

    # リレーションシップ
    student = relationship("Student", back_populates="cell_executions")
    cell = relationship("Cell", back_populates="executions")
```

#### 1.4 データスキーマ (`schemas/event.py`)
```python
from pydantic import BaseModel
from typing import Optional, Any, Dict
from datetime import datetime

class EventData(BaseModel):
    """セル実行イベントのスキーマ"""

    # 必須フィールド
    eventId: str
    eventType: str  # "cell_executed", "notebook_save", etc.
    eventTime: str
    userId: str

    # ノートブック情報
    notebookPath: Optional[str] = None

    # セル情報
    cellId: Optional[str] = None
    cellIndex: Optional[int] = None
    cellType: Optional[str] = None
    code: Optional[str] = None

    # 実行情報
    executionCount: Optional[int] = None
    hasError: Optional[bool] = None
    errorMessage: Optional[str] = None
    result: Optional[str] = None
    executionDurationMs: Optional[float] = None

    # 追加メタデータ
    metadata: Optional[Dict[str, Any]] = None
```

### Phase 2: API エンドポイント実装

#### 2.1 メインアプリケーション (`main.py`)
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.api import api_router
from core.config import settings
from db.base import Base
from db.session import engine

# データベーステーブル作成
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 開発用（本番では制限）
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# APIルーター登録
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.PROJECT_NAME}"}
```

#### 2.2 イベント受信エンドポイント (`api/endpoints/events.py`)
```python
from fastapi import APIRouter, Depends, HTTPException
from typing import List
from schemas.event import EventData
from db.redis_client import get_redis_client, PROGRESS_CHANNEL
import json

router = APIRouter()

@router.post("/events", status_code=202)
async def receive_events(
    events: List[EventData],
    redis_client=Depends(get_redis_client)
):
    """
    バッチイベント受信エンドポイント

    JupyterLab拡張から送信される複数のイベントを受信し、
    Redis Pub/Subで処理キューに送信する
    """
    if not events:
        raise HTTPException(status_code=400, detail="No events provided")

    if len(events) > 100:  # バッチサイズ制限
        raise HTTPException(status_code=413, detail="Too many events")

    try:
        # 各イベントをRedisに発行
        for event in events:
            event_data = event.model_dump_json()
            await redis_client.publish(PROGRESS_CHANNEL, event_data)

        return {
            "message": f"{len(events)} events received and queued",
            "processed_count": len(events)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")
```

#### 2.3 WebSocket エンドポイント (`api/endpoints/websocket.py`)
```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List
import json

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                # 切断されたコネクションを除去
                self.active_connections.remove(connection)

manager = ConnectionManager()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # クライアントからのメッセージを待機
            data = await websocket.receive_text()
            # ここで必要に応じて処理

    except WebSocketDisconnect:
        manager.disconnect(websocket)
```

### Phase 3: バックグラウンド処理実装

#### 3.1 イベントルーター (`worker/event_router.py`)
```python
from typing import Dict, Any, Callable
from schemas.event import EventData
from sqlalchemy.orm import Session
from db.influxdb_client import write_progress_event
from crud import crud_student, crud_notebook, crud_execution
import logging

logger = logging.getLogger(__name__)

class EventRouter:
    def __init__(self):
        self.handlers = {}

    def register_handler(self, event_type: str, handler: Callable):
        self.handlers[event_type] = handler

    async def route_event(self, event_data: Dict[str, Any], db: Session) -> bool:
        event_type = event_data.get("eventType")
        handler = self.handlers.get(event_type)

        if handler:
            return await handler(event_data, db)
        else:
            # デフォルトハンドラー
            return await self.default_handler(event_data, db)

    async def default_handler(self, event_data: Dict[str, Any], db: Session) -> bool:
        """デフォルトイベント処理"""
        try:
            event = EventData.model_validate(event_data)

            # PostgreSQLに基本情報を保存
            student = crud_student.get_or_create_student(db, user_id=event.userId)

            # InfluxDBに時系列データを保存
            write_progress_event(event)

            return True
        except Exception as e:
            logger.error(f"Event processing error: {e}")
            return False

# セル実行イベント専用ハンドラー
async def handle_cell_execution(event_data: Dict[str, Any], db: Session) -> bool:
    """セル実行イベントの詳細処理"""
    try:
        event = EventData.model_validate(event_data)

        # 関連エンティティの取得・作成
        student = crud_student.get_or_create_student(db, user_id=event.userId)
        notebook = crud_notebook.get_or_create_notebook(db, path=event.notebookPath)
        cell = crud_notebook.get_or_create_cell(db, notebook_id=notebook.id, event=event)

        # 実行履歴を記録
        execution = crud_execution.create_cell_execution(
            db=db,
            event=event,
            student_id=student.id,
            notebook_id=notebook.id,
            cell_id=cell.id
        )

        # 時系列データをInfluxDBに記録
        write_progress_event(event)

        logger.info(f"Cell execution processed: {event.cellId}")
        return True

    except Exception as e:
        logger.error(f"Cell execution processing error: {e}")
        return False

# ルーターインスタンスの作成とハンドラー登録
event_router = EventRouter()
event_router.register_handler("cell_executed", handle_cell_execution)
```

#### 3.2 ワーカーメイン (`worker/main.py`)
```python
import asyncio
import json
import sys
import os

# プロジェクトルートをパスに追加
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from db.redis_client import get_redis_client, PROGRESS_CHANNEL
from db.session import SessionLocal
from worker.event_router import event_router
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def listen_to_redis():
    """Redis Pub/Subリスナー"""
    redis_client = await get_redis_client()
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(PROGRESS_CHANNEL)

    logger.info("Worker started, listening for events...")

    while True:
        try:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message:
                # イベントデータをパース
                event_data = json.loads(message["data"])

                # データベースセッションを作成
                db = SessionLocal()
                try:
                    # イベントを処理
                    success = await event_router.route_event(event_data, db)
                    if success:
                        logger.info(f"Event processed: {event_data.get('eventType')}")
                    else:
                        logger.error(f"Event processing failed: {event_data}")
                finally:
                    db.close()

        except Exception as e:
            logger.error(f"Worker error: {e}")
            await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(listen_to_redis())
```

### Phase 4: データベース操作実装

#### 4.1 学生CRUD操作 (`crud/crud_student.py`)
```python
from sqlalchemy.orm import Session
from db.models import Student

def get_student_by_user_id(db: Session, user_id: str) -> Student:
    return db.query(Student).filter(Student.user_id == user_id).first()

def create_student(db: Session, user_id: str, name: str = None) -> Student:
    db_student = Student(user_id=user_id, name=name)
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    return db_student

def get_or_create_student(db: Session, user_id: str, name: str = None) -> Student:
    student = get_student_by_user_id(db, user_id)
    if not student:
        student = create_student(db, user_id, name)
    return student
```

### Phase 5: テスト実装

#### 5.1 APIテスト (`tests/test_events.py`)
```python
import pytest
from fastapi.testclient import TestClient
from main import app
from schemas.event import EventData

client = TestClient(app)

def test_receive_events():
    """イベント受信エンドポイントのテスト"""
    test_events = [
        {
            "eventId": "test-001",
            "eventType": "cell_executed",
            "eventTime": "2024-01-01T12:00:00Z",
            "userId": "test-user",
            "notebookPath": "/test.ipynb",
            "cellId": "cell-001",
            "code": "print('hello')"
        }
    ]

    response = client.post("/api/v1/events", json=test_events)
    assert response.status_code == 202
    assert "events received" in response.json()["message"]
```

## 🔍 動作確認手順

### 1. 環境起動
```bash
# Docker環境起動
docker-compose up --build

# または個別起動
uvicorn main:app --reload --port 8000
python worker/main.py
```

### 2. API動作確認
```bash
# ヘルスチェック
curl http://localhost:8000/

# イベント送信テスト
curl -X POST http://localhost:8000/api/v1/events \
  -H "Content-Type: application/json" \
  -d '[{"eventId":"test","eventType":"cell_executed","eventTime":"2024-01-01T00:00:00Z","userId":"test-user"}]'
```

### 3. データベース確認
```sql
-- PostgreSQL
SELECT * FROM students;
SELECT * FROM cell_executions;

-- InfluxDB
SELECT * FROM student_progress WHERE userId = 'test-user'
```

## 🚨 注意事項

### セキュリティ
- 本番環境では適切なCORS設定を行う
- 認証・認可機能を追加する
- 入力値のサニタイゼーションを実装する

### パフォーマンス
- バッチサイズの適切な制限（推奨: 100イベント以下）
- Redis接続プールの設定
- データベース接続プールの最適化

### エラーハンドリング
- イベント処理失敗時のリトライ機能
- デッドレターキューの実装
- ログ出力の標準化

## 🔄 次のステップ

1. **認証機能**: JWT認証の実装
2. **監視機能**: メトリクス収集とログ集約
3. **スケーリング**: 負荷分散とキュー管理
4. **高度な分析**: 学習パターン分析機能

---

**このドキュメントは実装進捗に応じて継続的に更新されます。**
