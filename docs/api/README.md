# API仕様書

> **APIバージョン**: v1
> **最終更新日**: 2025-01-18
> **ベースURL**: `http://localhost:8000/api/v1`

## 🎯 API設計原則

### 統一エンドポイント設計
- **単一エンドポイント**: `/api/v1/events` ですべてのイベントを受信
- **イベント駆動**: サーバー側でイベントタイプに基づいて処理を振り分け
- **非同期処理**: クライアントへの即座の応答とバックグラウンド処理の分離

### RESTful設計
- **リソース指向**: 明確なリソース階層
- **HTTPメソッド**: 適切なHTTPメソッドの使用
- **ステータスコード**: 標準的なHTTPステータスコードの活用

## 📡 エンドポイント一覧

### イベント受信API

> **JupyterLab拡張機能からの呼び出しに関する注意**
> JupyterLab拡張機能は、ブラウザのセキュリティポリシー（CORS/CSP）を遵守するため、直接このFastAPIエンドポイントを呼び出しません。代わりに、Jupyter Server内に設置されたプロキシエンドポイント (`/cell-monitor`) にリクエストを送信します。
>
> Jupyter Serverのプロキシがリクエストを受け取り、FastAPIサーバーの `/api/v1/events` へ転送します。
>
> 以下のAPI仕様は、プロキシを介さずにFastAPIサーバーと直接通信する場合（例: サーバーサイドのスクリプト、テスト）のものです。

#### POST /api/v1/events
JupyterLab拡張機能からのすべてのイベントを受信する統一エンドポイント

**リクエスト**:
```json
{
  "eventType": "cell_execution",
  "userId": "user123",
  "userName": "田中太郎",
  "notebookPath": "/notebooks/lesson1.ipynb",
  "cellIndex": 5,
  "cellContent": "print('Hello, World!')",
  "executionCount": 3,
  "executionDurationMs": 150,
  "hasError": false,
  "errorMessage": null,
  "output": "Hello, World!",
  "timestamp": "2025-01-18T10:30:00Z"
}
```

**レスポンス**:
```json
{
  "status": "received",
  "eventId": "evt_123456789",
  "timestamp": "2025-01-18T10:30:00Z"
}
```

**イベントタイプ**:
- `cell_execution`: セル実行
- `notebook_opened`: ノートブック開始
- `notebook_saved`: ノートブック保存
- `notebook_closed`: ノートブック終了
- `session_started`: 学習セッション開始
- `session_ended`: 学習セッション終了

### 分析API

#### GET /api/v1/class/summary
クラス全体の進捗サマリーを取得

**クエリパラメータ**:
- `date`: 対象日付（YYYY-MM-DD形式、デフォルト: 今日）
- `notebook_path`: 特定ノートブックでのフィルタ（オプション）

**レスポンス**:
```json
{
  "summary": {
    "total_students": 25,
    "active_students": 23,
    "avg_progress": 0.75,
    "completion_rate": 0.68
  },
  "students": [
    {
      "user_id": "user123",
      "user_name": "田中太郎",
      "progress": 0.85,
      "last_activity": "2025-01-18T10:30:00Z",
      "status": "active",
      "current_cell": 8,
      "total_cells": 10
    }
  ]
}
```

#### GET /api/v1/student/{user_id}/progress
特定生徒の詳細進捗を取得

**パスパラメータ**:
- `user_id`: ユーザーID

**クエリパラメータ**:
- `notebook_path`: ノートブックパス（オプション）
- `start_date`: 開始日（YYYY-MM-DD形式）
- `end_date`: 終了日（YYYY-MM-DD形式）

**レスポンス**:
```json
{
  "user_info": {
    "user_id": "user123",
    "user_name": "田中太郎",
    "total_sessions": 15,
    "total_duration_ms": 3600000
  },
  "progress_data": [
    {
      "notebook_path": "/notebooks/lesson1.ipynb",
      "progress": 0.85,
      "completed_cells": 8,
      "total_cells": 10,
      "execution_count": 25,
      "error_count": 3,
      "last_activity": "2025-01-18T10:30:00Z"
    }
  ],
  "timeline": [
    {
      "timestamp": "2025-01-18T10:30:00Z",
      "event_type": "cell_execution",
      "cell_index": 5,
      "duration_ms": 150,
      "has_error": false
    }
  ]
}
```

#### GET /api/v1/notebook/{notebook_path}/hotspots
ノートブックのホットスポット分析（つまずきやすい箇所）

**パスパラメータ**:
- `notebook_path`: ノートブックパス（URLエンコード必須）

**レスポンス**:
```json
{
  "notebook_info": {
    "path": "/notebooks/lesson1.ipynb",
    "title": "Python基礎 - 変数と演算",
    "total_cells": 10,
    "analyzed_sessions": 45
  },
  "hotspots": [
    {
      "cell_index": 5,
      "difficulty_score": 0.85,
      "avg_execution_count": 4.2,
      "error_rate": 0.35,
      "avg_duration_ms": 2500,
      "common_errors": [
        "NameError: name 'x' is not defined",
        "SyntaxError: invalid syntax"
      ]
    }
  ]
}
```

### WebSocket API

#### WS /ws/dashboard
リアルタイムダッシュボード用WebSocket接続

**接続時メッセージ**:
```json
{
  "type": "connection_established",
  "connection_id": "conn_123456789",
  "timestamp": "2025-01-18T10:30:00Z"
}
```

**イベント通知メッセージ**:
```json
{
  "type": "event_notification",
  "event": {
    "eventType": "cell_execution",
    "userId": "user123",
    "userName": "田中太郎",
    "notebookPath": "/notebooks/lesson1.ipynb",
    "cellIndex": 5,
    "hasError": false,
    "timestamp": "2025-01-18T10:30:00Z"
  }
}
```

## 🔒 認証・認可

### APIキー認証（現在実装中）
```http
Authorization: Bearer your-api-key-here
```

### JWT認証（将来実装予定）
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 📊 レート制限

### 制限値
- **イベント送信**: 100リクエスト/分/ユーザー
- **分析API**: 60リクエスト/分/ユーザー
- **WebSocket接続**: 10接続/ユーザー

### レート制限ヘッダー
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642521600
```

## ❌ エラーレスポンス

### 標準エラー形式
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid event type specified",
    "details": {
      "field": "eventType",
      "value": "invalid_type",
      "allowed_values": ["cell_execution", "notebook_opened", ...]
    },
    "timestamp": "2025-01-18T10:30:00Z",
    "request_id": "req_123456789"
  }
}
```

### エラーコード一覧

| HTTPステータス | エラーコード | 説明 |
|---------------|-------------|------|
| 400 | `VALIDATION_ERROR` | リクエストデータの検証エラー |
| 401 | `UNAUTHORIZED` | 認証情報が無効または不足 |
| 403 | `FORBIDDEN` | アクセス権限なし |
| 404 | `NOT_FOUND` | リソースが見つからない |
| 429 | `RATE_LIMIT_EXCEEDED` | レート制限に達した |
| 500 | `INTERNAL_SERVER_ERROR` | サーバー内部エラー |
| 503 | `SERVICE_UNAVAILABLE` | サービス一時停止中 |

## 🧪 APIテスト

### cURLを使用したテスト例

#### イベント送信テスト
```bash
curl -X POST http://localhost:8000/api/v1/events \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "cell_execution",
    "userId": "test_user",
    "userName": "テストユーザー",
    "notebookPath": "/notebooks/test.ipynb",
    "cellIndex": 1,
    "cellContent": "print(\"Hello\")",
    "executionCount": 1,
    "executionDurationMs": 100,
    "hasError": false
  }'
```

#### 進捗取得テスト
```bash
curl -X GET "http://localhost:8000/api/v1/class/summary?date=2025-01-18" \
  -H "Accept: application/json"
```

### Pythonクライアント例

```python
import requests
import json

# イベント送信
event_data = {
    "eventType": "cell_execution",
    "userId": "user123",
    "userName": "田中太郎",
    "notebookPath": "/notebooks/lesson1.ipynb",
    "cellIndex": 5,
    "cellContent": "print('Hello, World!')",
    "executionCount": 1,
    "executionDurationMs": 150,
    "hasError": False
}

response = requests.post(
    "http://localhost:8000/api/v1/events",
    json=event_data,
    headers={"Content-Type": "application/json"}
)

print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")
```

### WebSocketクライアント例

```javascript
const socket = new WebSocket('ws://localhost:8000/ws/dashboard');

socket.onopen = function(event) {
    console.log('WebSocket接続が確立されました');
};

socket.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log('受信データ:', data);

    if (data.type === 'event_notification') {
        // リアルタイムイベントの処理
        updateDashboard(data.event);
    }
};

socket.onclose = function(event) {
    console.log('WebSocket接続が閉じられました');
};
```

## 📈 パフォーマンス指標

### 応答時間目標
- **イベント受信API**: < 100ms
- **分析API**: < 500ms
- **WebSocket通知**: < 1秒

### スループット目標
- **イベント処理**: 1000リクエスト/秒
- **同時WebSocket接続**: 500接続

## 🔄 バージョニング

### APIバージョン管理
- **現在**: v1
- **下位互換性**: 最低6ヶ月間保証
- **非推奨通知**: ヘッダーで通知

```http
X-API-Version: v1
X-API-Deprecated: false
X-API-Sunset: 2025-12-31
```

---

## 📚 関連ドキュメント

- [システムアーキテクチャ](../architecture/README.md)
- [開発計画](../development/DEVELOPMENT_PLAN.md)
- [テスト戦略](../testing/README.md)
- [トラブルシューティング](../troubleshooting/README.md)
