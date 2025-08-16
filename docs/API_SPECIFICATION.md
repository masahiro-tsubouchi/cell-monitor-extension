# 📡 API仕様書

## 概要

JupyterLab Cell Monitor Extension のRESTful API およびWebSocket API の詳細仕様書です。

**Base URL**: `http://localhost:8000` (開発環境)  
**API Version**: `v1`  
**Authentication**: Bearer Token (将来実装)

## 🔗 RESTful API エンドポイント

### 認証・ヘルスチェック

#### `GET /health`
システムヘルスチェック

**レスポンス:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "2.0.0",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "influxdb": "healthy"
  }
}
```

#### `GET /api/v1/auth/status`
認証状態確認

**レスポンス:**
```json
{
  "authenticated": true,
  "user": {
    "id": "user123",
    "email": "instructor@example.com",
    "role": "instructor"
  },
  "expires_at": "2024-01-15T18:00:00Z"
}
```

### イベントAPI

#### `POST /api/v1/events`
セル実行イベント送信

**リクエスト:**
```json
{
  "user_id": "student123",
  "user_name": "田中太郎",
  "email": "tanaka@example.com",
  "notebook_path": "/notebooks/lesson1.ipynb",
  "cell_id": "cell-123",
  "cell_type": "code",
  "execution_count": 5,
  "code": "print('Hello World')",
  "output": "Hello World\n",
  "status": "success",
  "error_type": null,
  "error_message": null,
  "execution_time": 0.123,
  "timestamp": "2024-01-15T10:30:00Z",
  "team_name": "A"
}
```

**レスポンス:**
```json
{
  "success": true,
  "message": "Event recorded successfully",
  "event_id": "evt_123456"
}
```

**エラーレスポンス:**
```json
{
  "success": false,
  "error": "validation_error",
  "message": "Invalid cell_type",
  "details": {
    "field": "cell_type",
    "allowed_values": ["code", "markdown", "raw"]
  }
}
```

#### `GET /api/v1/events`
イベント履歴取得

**クエリパラメータ:**
- `user_id`: ユーザーID（オプション）
- `notebook_path`: ノートブックパス（オプション）
- `start_time`: 開始時刻（ISO8601）
- `end_time`: 終了時刻（ISO8601）
- `limit`: 取得件数（デフォルト: 100, 最大: 1000）
- `offset`: オフセット（デフォルト: 0）

**レスポンス:**
```json
{
  "events": [
    {
      "event_id": "evt_123456",
      "user_id": "student123",
      "user_name": "田中太郎",
      "email": "tanaka@example.com",
      "notebook_path": "/notebooks/lesson1.ipynb",
      "cell_id": "cell-123",
      "execution_count": 5,
      "status": "success",
      "execution_time": 0.123,
      "timestamp": "2024-01-15T10:30:00Z",
      "team_name": "A"
    }
  ],
  "total": 150,
  "limit": 100,
  "offset": 0,
  "has_more": true
}
```

### ダッシュボードAPI

#### `GET /api/v1/dashboard/overview`
ダッシュボード概要データ取得

**レスポンス:**
```json
{
  "students": [
    {
      "emailAddress": "tanaka@example.com",
      "userName": "田中太郎",
      "currentNotebook": "/notebooks/lesson1.ipynb",
      "lastActivity": "2分前",
      "status": "active",
      "cellExecutions": 15,
      "errorCount": 2,
      "isRequestingHelp": false,
      "teamName": "A",
      "progressPercentage": 75,
      "lastSeen": "2024-01-15T10:30:00Z"
    }
  ],
  "metrics": {
    "totalStudents": 25,
    "totalActive": 18,
    "errorCount": 5,
    "totalExecutions": 1250,
    "helpCount": 2
  },
  "activityChart": [
    {
      "time": "2024-01-15T10:00:00Z",
      "activeStudents": 15,
      "totalExecutions": 45,
      "errorRate": 0.08
    }
  ]
}
```

#### `GET /api/v1/dashboard/student/{email}`
個別学生詳細情報

**レスポンス:**
```json
{
  "student": {
    "emailAddress": "tanaka@example.com",
    "userName": "田中太郎",
    "teamName": "A",
    "currentNotebook": "/notebooks/lesson1.ipynb",
    "status": "active",
    "lastActivity": "2024-01-15T10:30:00Z",
    "totalExecutions": 15,
    "successfulExecutions": 13,
    "errorCount": 2,
    "averageExecutionTime": 1.25,
    "progressPercentage": 75
  },
  "recentActivity": [
    {
      "timestamp": "2024-01-15T10:29:00Z",
      "cell_id": "cell-5",
      "status": "success",
      "execution_time": 0.89
    }
  ],
  "errors": [
    {
      "timestamp": "2024-01-15T10:25:00Z",
      "cell_id": "cell-3",
      "error_type": "NameError",
      "error_message": "name 'variable' is not defined"
    }
  ],
  "notebooks": [
    {
      "path": "/notebooks/lesson1.ipynb",
      "last_accessed": "2024-01-15T10:30:00Z",
      "execution_count": 15,
      "completion_rate": 0.75
    }
  ]
}
```

### 学生管理API

#### `GET /api/v1/students`
学生一覧取得

**クエリパラメータ:**
- `team`: チーム名フィルター
- `status`: ステータスフィルター（active, inactive, error, help）
- `search`: 名前・メール検索
- `limit`: 取得件数（デフォルト: 50）
- `offset`: オフセット

**レスポンス:**
```json
{
  "students": [
    {
      "id": "student123",
      "email": "tanaka@example.com",
      "name": "田中太郎",
      "team_name": "A",
      "status": "active",
      "last_activity": "2024-01-15T10:30:00Z",
      "total_executions": 15,
      "error_count": 2
    }
  ],
  "total": 25,
  "teams": ["A", "B", "C", "1", "2", "3"]
}
```

#### `POST /api/v1/students`
学生登録

**リクエスト:**
```json
{
  "email": "new.student@example.com",
  "name": "新規学生",
  "team_name": "A"
}
```

#### `PUT /api/v1/students/{student_id}`
学生情報更新

**リクエスト:**
```json
{
  "name": "更新された名前",
  "team_name": "B"
}
```

#### `DELETE /api/v1/students/{student_id}`
学生削除

### ヘルプ要求API

#### `POST /api/v1/help/request`
ヘルプ要求送信

**リクエスト:**
```json
{
  "user_id": "student123",
  "message": "エラーが解決できません",
  "cell_id": "cell-5",
  "notebook_path": "/notebooks/lesson1.ipynb",
  "priority": "medium"
}
```

#### `GET /api/v1/help/requests`
ヘルプ要求一覧取得

**レスポンス:**
```json
{
  "requests": [
    {
      "id": "help_123",
      "user_id": "student123",
      "user_name": "田中太郎",
      "team_name": "A",
      "message": "エラーが解決できません",
      "status": "pending",
      "priority": "medium",
      "created_at": "2024-01-15T10:30:00Z",
      "notebook_path": "/notebooks/lesson1.ipynb",
      "cell_id": "cell-5"
    }
  ]
}
```

#### `PUT /api/v1/help/requests/{request_id}`
ヘルプ要求ステータス更新

**リクエスト:**
```json
{
  "status": "resolved",
  "response": "解決方法を説明しました",
  "instructor_id": "instructor123"
}
```

## 🔌 WebSocket API

### 接続エンドポイント

#### `/ws/dashboard`
講師ダッシュボード用WebSocket

**接続例:**
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/dashboard');

ws.onopen = (event) => {
  console.log('Connected to dashboard WebSocket');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

### WebSocketイベント種別

#### `student_progress_update`
学生進捗更新

**ペイロード:**
```json
{
  "type": "student_progress_update",
  "data": {
    "emailAddress": "tanaka@example.com",
    "userName": "田中太郎",
    "currentNotebook": "/notebooks/lesson1.ipynb",
    "lastActivity": "今",
    "status": "active",
    "cellExecutions": 16,
    "errorCount": 2
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `cell_execution`
セル実行イベント

**ペイロード:**
```json
{
  "type": "cell_execution",
  "data": {
    "emailAddress": "tanaka@example.com",
    "cellExecutions": 16,
    "lastActivity": "今",
    "status": "active",
    "cell_id": "cell-6",
    "execution_time": 1.23
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `help_request`
ヘルプ要求

**ペイロード:**
```json
{
  "type": "help_request",
  "data": {
    "emailAddress": "tanaka@example.com",
    "userName": "田中太郎",
    "teamName": "A",
    "isRequestingHelp": true,
    "message": "エラーが解決できません",
    "lastActivity": "今",
    "status": "help"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `help_resolved`
ヘルプ解決

**ペイロード:**
```json
{
  "type": "help_resolved",
  "data": {
    "emailAddress": "tanaka@example.com",
    "isRequestingHelp": false,
    "lastActivity": "今"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `delta_update`
差分更新（高性能モード）

**ペイロード:**
```json
{
  "type": "delta_update",
  "data": {
    "updateId": "delta_123456",
    "changes": [
      {
        "operation": "update",
        "target": "student",
        "identifier": "tanaka@example.com",
        "field": "cellExecutions",
        "oldValue": 15,
        "newValue": 16
      }
    ],
    "metadata": {
      "compressionRatio": 0.92,
      "totalChanges": 1,
      "priority": "normal"
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### WebSocketクライアント実装例

#### React/TypeScript実装
```typescript
import { useEffect, useState } from 'react';

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export const useWebSocket = (url: string) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setSocket(ws);
    };

    ws.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data);
      setLastMessage(message);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      setSocket(null);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, [url]);

  return { socket, isConnected, lastMessage };
};
```

## 📊 データモデル

### Student Activity
```typescript
interface StudentActivity {
  emailAddress: string;         // 主キー
  userName: string;            // 学生名
  currentNotebook: string;     // 現在のノートブック
  lastActivity: string;        // 最終活動時刻（相対時間）
  status: 'active' | 'inactive' | 'error' | 'help';
  cellExecutions: number;      // セル実行回数
  errorCount: number;          // エラー発生回数
  isRequestingHelp: boolean;   // ヘルプ要求中
  teamName?: string;           // チーム名
  progressPercentage?: number; // 進捗率
  lastSeen: string;           // 最終確認時刻（ISO8601）
}
```

### Dashboard Metrics
```typescript
interface DashboardMetrics {
  totalStudents: number;       // 総学生数
  totalActive: number;         // アクティブ学生数
  errorCount: number;          // エラー発生中学生数
  totalExecutions: number;     // 総セル実行数
  helpCount: number;          // ヘルプ要求中学生数
}
```

### Cell Execution Event
```typescript
interface CellExecutionEvent {
  user_id: string;
  user_name: string;
  email: string;
  notebook_path: string;
  cell_id: string;
  cell_type: 'code' | 'markdown' | 'raw';
  execution_count: number;
  code: string;
  output: string;
  status: 'success' | 'error';
  error_type?: string;
  error_message?: string;
  execution_time: number;      // 秒
  timestamp: string;           // ISO8601
  team_name?: string;
}
```

## ⚠️ エラーハンドリング

### HTTPステータスコード

| コード | 説明 | 例 |
|--------|------|-----|
| 200 | 成功 | データ取得成功 |
| 201 | 作成成功 | 学生登録成功 |
| 400 | バッドリクエスト | バリデーションエラー |
| 401 | 認証エラー | トークン無効 |
| 403 | 権限エラー | アクセス権限なし |
| 404 | 見つからない | 学生が存在しない |
| 429 | レート制限 | 要求過多 |
| 500 | サーバーエラー | 内部エラー |

### エラーレスポンス形式
```json
{
  "success": false,
  "error": "error_code",
  "message": "Human readable error message",
  "details": {
    "field": "validation_field",
    "code": "specific_error_code"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "request_id": "req_123456"
}
```

### バリデーションエラー
```json
{
  "success": false,
  "error": "validation_error",
  "message": "Input validation failed",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format",
      "code": "invalid_format"
    },
    {
      "field": "team_name",
      "message": "Must be A-Z or 1-99",
      "code": "invalid_team_format"
    }
  ]
}
```

## 🔐 認証・認可（実装予定）

### Bearer Token認証
```bash
# リクエストヘッダー
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

### ロールベース権限

| ロール | 権限 | アクセス可能エンドポイント |
|--------|------|---------------------------|
| `student` | 基本 | 自分のデータのみ |
| `instructor` | 監視 | 全学生データ、ダッシュボード |
| `admin` | 管理 | システム設定、ユーザー管理 |

## 📈 レート制限

### 制限値

| エンドポイント | 制限 | 説明 |
|---------------|------|------|
| `/api/v1/events` | 100req/min | イベント送信 |
| `/api/v1/dashboard/*` | 60req/min | ダッシュボード |
| `/api/v1/students` | 30req/min | 学生管理 |
| その他 | 1000req/hour | 一般API |

### レート制限レスポンス
```json
{
  "success": false,
  "error": "rate_limit_exceeded",
  "message": "Too many requests",
  "retry_after": 60,
  "limit": 100,
  "remaining": 0,
  "reset": "2024-01-15T10:31:00Z"
}
```

---

**最終更新**: ${new Date().toISOString().slice(0, 10)}  
**API Version**: v1  
**OpenAPI仕様書**: [swagger.json](./swagger.json)