# 🛠️ 開発者ガイド

## 📝 開発環境構築

### 前提条件
- **Node.js**: 18.0+
- **Python**: 3.9+
- **Docker**: 20.10+ & Docker Compose 2.0+
- **Git**: 2.30+

### 開発環境セットアップ
```bash
# リポジトリクローン
git clone https://github.com/your-org/jupyter-extensionver2-claude-code.git
cd jupyter-extensionver2-claude-code

# Docker環境起動
docker compose up --build

# 開発用サービス起動確認
curl http://localhost:8000/health
```

## 🏗️ プロジェクト構造

```
jupyter-extensionver2-claude-code/
├── cell-monitor-extension/     # JupyterLab拡張機能
│   ├── src/                   # TypeScript ソースコード
│   │   ├── index.ts          # エントリーポイント
│   │   ├── core/             # コア機能
│   │   ├── services/         # サービス層
│   │   ├── types/            # 型定義
│   │   └── utils/            # ユーティリティ
│   ├── package.json          # 依存パッケージ
│   ├── tsconfig.json         # TypeScript設定
│   └── build-extension.sh    # ビルドスクリプト
├── fastapi_server/           # バックエンドAPI
│   ├── api/                  # API エンドポイント
│   ├── core/                 # コア設定
│   ├── crud/                 # データベース操作
│   ├── db/                   # データベース設定
│   ├── schemas/              # Pydantic スキーマ
│   ├── worker/               # バックグラウンド処理
│   └── main.py              # FastAPI アプリケーション
├── instructor-dashboard/     # 講師用フロントエンド
│   ├── src/                  # React ソースコード
│   │   ├── components/       # React コンポーネント
│   │   ├── pages/           # ページコンポーネント
│   │   ├── services/        # API・WebSocket サービス
│   │   ├── stores/          # Zustand 状態管理
│   │   ├── types/           # TypeScript 型定義
│   │   └── utils/           # ユーティリティ
│   └── package.json         # 依存パッケージ
├── docker-compose.yml        # Docker Compose 設定
├── docs/                     # ドキュメント
└── README.md                # プロジェクト概要
```

## 🔧 コンポーネント別開発ガイド

### JupyterLab Extension 開発

#### 1. 開発環境準備
```bash
cd cell-monitor-extension

# 依存パッケージインストール
npm install

# 開発ビルド
npm run build

# ウォッチモード（自動ビルド）
npm run watch
```

#### 2. 拡張機能の構造
```typescript
// src/index.ts - エントリーポイント
import { JupyterFrontEndPlugin } from '@jupyterlab/application';

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'cell-monitor:plugin',
  autoStart: true,
  activate: (app) => {
    // 拡張機能の初期化
  }
};

export default plugin;
```

#### 3. セル監視の実装
```typescript
// src/core/cellMonitor.ts
export class CellMonitor {
  constructor(private notebook: INotebookTracker) {
    this.setupCellExecutionListener();
  }

  private setupCellExecutionListener() {
    this.notebook.currentChanged.connect((_, notebook) => {
      if (notebook) {
        notebook.context.model.cells.changed.connect(this.handleCellChange);
      }
    });
  }

  private handleCellChange = (cells: any, changes: any) => {
    // セル変更の処理
    this.sendEventToServer(changes);
  };
}
```

#### 4. テスト実行
```bash
# ユニットテスト
npm test

# カバレッジ付きテスト
npm run test:coverage

# E2Eテスト
npm run test:e2e
```

### FastAPI Backend 開発

#### 1. 開発環境準備
```bash
cd fastapi_server

# 仮想環境作成
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 依存パッケージインストール
pip install -r requirements.txt

# 開発サーバー起動
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### 2. API エンドポイント作成
```python
# api/endpoints/example.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..schemas.example import ExampleCreate, ExampleResponse

router = APIRouter()

@router.post("/examples", response_model=ExampleResponse)
async def create_example(
    example: ExampleCreate,
    db: Session = Depends(get_db)
):
    # ビジネスロジック実装
    return {"success": True, "data": example}
```

#### 3. データベースモデル定義
```python
# db/models.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from .database import Base

class Student(Base):
    __tablename__ = "students"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    team_name = Column(String)
    created_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
```

#### 4. WebSocket実装
```python
# core/connection_manager.py
from fastapi import WebSocket
from typing import Dict, List

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket

    async def broadcast(self, message: dict):
        for connection in self.active_connections.values():
            await connection.send_json(message)
```

#### 5. テスト実行
```bash
# ユニットテスト
pytest

# 統合テスト（外部サービス必要）
pytest -m integration

# 特定のテスト実行
pytest tests/api/test_events.py -v

# カバレッジ付きテスト
pytest --cov=. --cov-report=html
```

### React Dashboard 開発

#### 1. 開発環境準備
```bash
cd instructor-dashboard

# 依存パッケージインストール
npm install

# 開発サーバー起動
npm start
```

#### 2. コンポーネント作成
```typescript
// src/components/example/ExampleComponent.tsx
import React, { useState, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';

interface ExampleComponentProps {
  data: any[];
  onUpdate: (data: any) => void;
}

export const ExampleComponent: React.FC<ExampleComponentProps> = ({
  data,
  onUpdate
}) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 初期化処理
  }, []);

  return (
    <Box>
      <Typography variant="h6">Example Component</Typography>
      {/* コンポーネント実装 */}
    </Box>
  );
};
```

#### 3. 状態管理（Zustand）
```typescript
// src/stores/exampleStore.ts
import { create } from 'zustand';

interface ExampleState {
  data: any[];
  loading: boolean;
  error: string | null;
  
  // アクション
  fetchData: () => Promise<void>;
  updateData: (data: any) => void;
  clearError: () => void;
}

export const useExampleStore = create<ExampleState>((set, get) => ({
  data: [],
  loading: false,
  error: null,

  fetchData: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/v1/example');
      const data = await response.json();
      set({ data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  updateData: (newData) => {
    set({ data: newData });
  },

  clearError: () => {
    set({ error: null });
  }
}));
```

#### 4. WebSocket統合
```typescript
// src/services/websocket.ts
class WebSocketService {
  private ws: WebSocket | null = null;
  private eventHandlers: { [key: string]: Function } = {};

  connect(url: string) {
    this.ws = new WebSocket(url);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const handler = this.eventHandlers[message.type];
      if (handler) {
        handler(message.data);
      }
    };
  }

  setEventHandlers(handlers: { [key: string]: Function }) {
    this.eventHandlers = handlers;
  }
}

export const webSocketService = new WebSocketService();
```

## 🧪 テスト戦略

### テストレベル

#### 1. ユニットテスト
各コンポーネント・関数の個別テスト

```typescript
// Example: React コンポーネントテスト
import { render, screen, fireEvent } from '@testing-library/react';
import { ExampleComponent } from './ExampleComponent';

describe('ExampleComponent', () => {
  it('should render correctly', () => {
    render(<ExampleComponent data={[]} onUpdate={() => {}} />);
    expect(screen.getByText('Example Component')).toBeInTheDocument();
  });

  it('should handle click events', () => {
    const mockOnUpdate = jest.fn();
    render(<ExampleComponent data={[]} onUpdate={mockOnUpdate} />);
    
    fireEvent.click(screen.getByText('Update'));
    expect(mockOnUpdate).toHaveBeenCalled();
  });
});
```

```python
# Example: FastAPI テスト
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_create_student():
    response = client.post(
        "/api/v1/students",
        json={
            "email": "test@example.com",
            "name": "Test Student",
            "team_name": "A"
        }
    )
    assert response.status_code == 201
    assert response.json()["email"] == "test@example.com"
```

#### 2. 統合テスト
複数コンポーネント間の連携テスト

```python
# Example: データベース統合テスト
import pytest
from sqlalchemy.orm import Session
from db.database import get_test_db
from crud.crud_student import create_student
from schemas.student import StudentCreate

@pytest.mark.integration
def test_student_crud_operations():
    db = next(get_test_db())
    
    # 作成
    student_data = StudentCreate(
        email="integration@example.com",
        name="Integration Test",
        team_name="A"
    )
    student = create_student(db, student_data)
    assert student.email == student_data.email
```

#### 3. E2Eテスト
全システム統合テスト

```typescript
// Example: Playwright E2Eテスト
import { test, expect } from '@playwright/test';

test('instructor can monitor student progress', async ({ page }) => {
  // JupyterLabでセル実行
  await page.goto('http://localhost:8888');
  await page.fill('[data-testid="token-input"]', 'easy');
  await page.click('[data-testid="login-button"]');
  
  // セル実行
  await page.click('[data-testid="code-cell"]');
  await page.keyboard.type('print("Hello World")');
  await page.keyboard.press('Shift+Enter');
  
  // ダッシュボードで確認
  await page.goto('http://localhost:3000');
  await expect(page.locator('[data-testid="student-activity"]')).toBeVisible();
});
```

## 📊 パフォーマンス最適化

### フロントエンド最適化

#### 1. React最適化
```typescript
// メモ化によるレンダリング最適化
import React, { memo, useMemo, useCallback } from 'react';

export const OptimizedComponent = memo<Props>(({ data, onUpdate }) => {
  const processedData = useMemo(() => {
    return data.map(item => processItem(item));
  }, [data]);

  const handleUpdate = useCallback((id: string) => {
    onUpdate(id);
  }, [onUpdate]);

  return (
    // コンポーネント実装
  );
});
```

#### 2. バンドルサイズ最適化
```typescript
// 動的インポートによるコード分割
const LazyComponent = React.lazy(() => import('./LazyComponent'));

// Tree shakingのための適切なインポート
import { Button } from '@mui/material/Button';  // ❌
import Button from '@mui/material/Button';     // ✅
```

### バックエンド最適化

#### 1. データベースクエリ最適化
```python
# N+1問題の解決
from sqlalchemy.orm import joinedload

def get_students_with_executions(db: Session):
    return db.query(Student)\
        .options(joinedload(Student.executions))\
        .all()

# インデックス作成
# CREATE INDEX idx_students_team ON students(team_name);
# CREATE INDEX idx_executions_timestamp ON executions(timestamp);
```

#### 2. キャッシュ戦略
```python
from functools import lru_cache
import redis

# メモリキャッシュ
@lru_cache(maxsize=1000)
def expensive_calculation(param: str) -> str:
    # 重い計算処理
    return result

# Redisキャッシュ
class CacheService:
    def __init__(self):
        self.redis = redis.Redis(host='redis', port=6379)
    
    def get_cached_data(self, key: str):
        return self.redis.get(key)
    
    def set_cached_data(self, key: str, data: str, ttl: int = 300):
        self.redis.setex(key, ttl, data)
```

## 🔐 セキュリティ考慮事項

### 1. 入力値検証
```python
# Pydantic による厳密なバリデーション
from pydantic import BaseModel, validator, EmailStr
from typing import Literal

class StudentCreate(BaseModel):
    email: EmailStr
    name: str
    team_name: str
    
    @validator('name')
    def validate_name(cls, v):
        if len(v) < 1 or len(v) > 100:
            raise ValueError('Name must be 1-100 characters')
        return v
    
    @validator('team_name')
    def validate_team_name(cls, v):
        if not re.match(r'^[A-Z]$|^[1-9][0-9]?$', v):
            raise ValueError('Team name must be A-Z or 1-99')
        return v
```

### 2. SQLインジェクション対策
```python
# SQLAlchemy ORM使用（推奨）
def get_student_by_email(db: Session, email: str):
    return db.query(Student).filter(Student.email == email).first()

# 生SQLを使用する場合はパラメータ化
def custom_query(db: Session, email: str):
    result = db.execute(
        text("SELECT * FROM students WHERE email = :email"),
        {"email": email}
    )
    return result.fetchall()
```

### 3. CORS設定
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # 本番では具体的なドメイン指定
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
```

## 📝 コーディング規約

### TypeScript/JavaScript

#### 1. 命名規約
```typescript
// PascalCase: クラス、インターフェース、型
class StudentManager {}
interface StudentData {}
type StudentStatus = 'active' | 'inactive';

// camelCase: 変数、関数、メソッド
const studentCount = 10;
function calculateProgress() {}

// SNAKE_CASE: 定数
const MAX_STUDENTS = 100;
const API_BASE_URL = 'http://localhost:8000';
```

#### 2. 型定義
```typescript
// 明示的な型定義
interface StudentActivity {
  emailAddress: string;
  userName: string;
  status: 'active' | 'inactive' | 'error' | 'help';
}

// Generic使用
function processData<T>(data: T[]): T[] {
  return data.filter(Boolean);
}

// Union Types
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
```

### Python

#### 1. PEP 8準拠
```python
# 関数・変数: snake_case
def calculate_student_progress():
    student_count = 10
    return student_count

# クラス: PascalCase
class StudentManager:
    def __init__(self):
        self.active_students = []

# 定数: UPPER_SNAKE_CASE
MAX_STUDENTS = 100
DATABASE_URL = "postgresql://..."
```

#### 2. 型ヒント使用
```python
from typing import List, Dict, Optional, Union

def process_students(
    students: List[Dict[str, str]], 
    team_filter: Optional[str] = None
) -> List[Dict[str, Union[str, int]]]:
    """Process student data with optional team filtering."""
    result = []
    for student in students:
        if team_filter and student.get('team') != team_filter:
            continue
        result.append({
            'name': student['name'],
            'execution_count': int(student.get('executions', 0))
        })
    return result
```

## 🚀 デプロイメント

### 1. Docker イメージビルド
```bash
# 各サービスのイメージビルド
docker build -t instructor-dashboard:latest ./instructor-dashboard
docker build -t fastapi-server:latest ./fastapi_server
docker build -t jupyter-extension:latest ./cell-monitor-extension
```

### 2. 本番環境用設定
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  fastapi:
    build: ./fastapi_server
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${PRODUCTION_DATABASE_URL}
    restart: always
    
  instructor-dashboard:
    build: 
      context: ./instructor-dashboard
      dockerfile: Dockerfile.prod
    environment:
      - REACT_APP_API_URL=${PRODUCTION_API_URL}
    restart: always
```

### 3. CI/CDパイプライン例
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Tests
        run: |
          npm test
          pytest
          
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        run: |
          docker-compose -f docker-compose.prod.yml up -d --build
```

## 📚 開発者向けリソース

### ドキュメント
- [システム概要](./SYSTEM_OVERVIEW.md)
- [API仕様書](./API_SPECIFICATION.md)
- [セットアップガイド](./SETUP_GUIDE.md)

### 外部リソース
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [JupyterLab Extension Guide](https://jupyterlab.readthedocs.io/en/stable/extension/extension_dev.html)
- [Material-UI Documentation](https://mui.com/)

### 開発ツール推奨設定

#### VSCode設定
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "python.defaultInterpreterPath": "./fastapi_server/venv/bin/python",
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": true,
  "editor.formatOnSave": true
}
```

#### ESLint設定
```json
{
  "extends": [
    "react-app",
    "@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/explicit-function-return-type": "warn",
    "react-hooks/exhaustive-deps": "error"
  }
}
```

---

**最終更新**: ${new Date().toISOString().slice(0, 10)}  
**対象バージョン**: v2.0.0