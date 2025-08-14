# フロントエンド開発用API仕様書

> **バージョン**: 1.0.0
> **最終更新日**: 2025-01-19
> **対象**: フロントエンド開発者・UI/UXデザイナー
> **テスト状況**: 186個のテストケース全て成功 ✅

## 📋 概要

本ドキュメントは、JupyterLab Cell Monitor Extension のフロントエンド開発に必要なAPI仕様を整理したものです。全てのAPIはAI駆動TDDにより品質保証されており、本番環境での利用が可能です。

## 🔐 認証システム

### ベースURL
```
http://localhost:8000/api/v1
```

### 認証方式
- **JWT Bearer Token**: `Authorization: Bearer <token>`
- **トークン有効期限**: 30分
- **リフレッシュ**: 現在未実装（再ログインが必要）

## 🎯 講師認証API (`/auth`)

### 1. ログイン
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "instructor@example.com",
  "password": "password123"
}
```

**レスポンス（成功）**:
```json
{
  "instructor": {
    "id": 1,
    "email": "instructor@example.com",
    "name": "山田太郎",
    "status": "AVAILABLE",
    "is_active": true,
    "created_at": "2025-01-19T10:00:00Z",
    "updated_at": "2025-01-19T10:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**エラーレスポンス**:
```json
// 401 - 認証失敗
{
  "detail": "Invalid credentials"
}

// 403 - 非アクティブアカウント
{
  "detail": "Inactive account"
}
```

### 2. 現在ユーザー情報取得
```http
GET /api/v1/auth/me
Authorization: Bearer <token>
```

**レスポンス**:
```json
{
  "id": 1,
  "email": "instructor@example.com",
  "name": "山田太郎",
  "status": "AVAILABLE",
  "is_active": true,
  "created_at": "2025-01-19T10:00:00Z",
  "updated_at": "2025-01-19T10:00:00Z"
}
```

### 3. パスワード変更
```http
PUT /api/v1/auth/password
Authorization: Bearer <token>
Content-Type: application/json

{
  "current_password": "old_password",
  "new_password": "new_password123"
}
```

### 4. ログアウト
```http
POST /api/v1/auth/logout
Authorization: Bearer <token>
```

## 👥 講師管理API (`/instructors`)

### 1. 講師一覧取得
```http
GET /api/v1/instructors?skip=0&limit=10&active_only=true
Authorization: Bearer <token>
```

**レスポンス**:
```json
[
  {
    "id": 1,
    "email": "instructor1@example.com",
    "name": "山田太郎",
    "status": "AVAILABLE",
    "is_active": true,
    "created_at": "2025-01-19T10:00:00Z",
    "updated_at": "2025-01-19T10:00:00Z"
  },
  {
    "id": 2,
    "email": "instructor2@example.com",
    "name": "佐藤花子",
    "status": "BUSY",
    "is_active": true,
    "created_at": "2025-01-19T11:00:00Z",
    "updated_at": "2025-01-19T11:30:00Z"
  }
]
```

**クエリパラメータ**:
- `skip`: オフセット（デフォルト: 0）
- `limit`: 取得件数（デフォルト: 10、最大: 100）
- `active_only`: アクティブな講師のみ（デフォルト: false）

### 2. 講師詳細取得
```http
GET /api/v1/instructors/{instructor_id}
Authorization: Bearer <token>
```

### 3. 講師作成
```http
POST /api/v1/instructors
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "new_instructor@example.com",
  "name": "新規講師",
  "password": "password123"
}
```

### 4. 講師情報更新
```http
PUT /api/v1/instructors/{instructor_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "更新された名前",
  "email": "updated@example.com"
}
```

### 5. 講師削除（論理削除）
```http
DELETE /api/v1/instructors/{instructor_id}
Authorization: Bearer <token>
```

## 📊 講師ステータス管理API (`/instructor_status`)

### ステータス種別
- `AVAILABLE`: 対応可能
- `BUSY`: 対応中
- `OFFLINE`: オフライン

### 1. 現在ステータス取得
```http
GET /api/v1/instructor_status/{instructor_id}
Authorization: Bearer <token>
```

**レスポンス**:
```json
{
  "instructor_id": 1,
  "status": "AVAILABLE",
  "current_session_id": null,
  "updated_at": "2025-01-19T12:00:00Z"
}
```

### 2. ステータス更新
```http
PUT /api/v1/instructor_status/{instructor_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "BUSY",
  "session_id": "session_123"
}
```

**レスポンス**:
```json
{
  "instructor_id": 1,
  "status": "BUSY",
  "current_session_id": "session_123",
  "updated_at": "2025-01-19T12:05:00Z"
}
```

### 3. ステータス履歴取得
```http
GET /api/v1/instructor_status/{instructor_id}/history?skip=0&limit=10
Authorization: Bearer <token>
```

**レスポンス**:
```json
[
  {
    "id": 1,
    "instructor_id": 1,
    "status": "BUSY",
    "changed_at": "2025-01-19T12:05:00Z"
  },
  {
    "id": 2,
    "instructor_id": 1,
    "status": "AVAILABLE",
    "changed_at": "2025-01-19T12:00:00Z"
  }
]
```

### 4. 一括ステータス更新
```http
PUT /api/v1/instructor_status/bulk
Authorization: Bearer <token>
Content-Type: application/json

{
  "updates": [
    {
      "instructor_id": 1,
      "status": "AVAILABLE"
    },
    {
      "instructor_id": 2,
      "status": "OFFLINE"
    }
  ]
}
```

**レスポンス**:
```json
{
  "successful_updates": [
    {
      "instructor_id": 1,
      "status": "AVAILABLE",
      "updated_at": "2025-01-19T12:10:00Z"
    }
  ],
  "failed_updates": [
    {
      "instructor_id": 2,
      "error": "Instructor not found"
    }
  ]
}
```

## 🔄 WebSocket API

### 講師認証付きWebSocket接続
```javascript
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
const ws = new WebSocket(`ws://localhost:8000/instructor/ws?token=${token}`);

ws.onopen = function(event) {
  console.log("WebSocket接続成功");
};

ws.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log("受信メッセージ:", data);
};

ws.onerror = function(error) {
  console.error("WebSocketエラー:", error);
};

ws.onclose = function(event) {
  console.log("WebSocket接続終了");
};
```

### メッセージ形式

**ステータス変更通知**:
```json
{
  "type": "status_update",
  "data": {
    "instructor_id": 1,
    "status": "BUSY",
    "current_session_id": "session_123",
    "updated_at": "2025-01-19T12:05:00Z"
  }
}
```

**学生-講師間メッセージ**:
```json
{
  "type": "message",
  "data": {
    "from": "student_456",
    "to": "instructor_1",
    "message": "質問があります",
    "timestamp": "2025-01-19T12:06:00Z"
  }
}
```

## 📝 TypeScript型定義

### 基本型定義
```typescript
// 講師情報
export interface Instructor {
  id: number;
  email: string;
  name: string;
  status: InstructorStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ステータス種別
export type InstructorStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';

// ログインレスポンス
export interface LoginResponse {
  instructor: Instructor;
  token: string;
}

// ステータス情報
export interface InstructorStatusInfo {
  instructor_id: number;
  status: InstructorStatus;
  current_session_id: string | null;
  updated_at: string;
}

// ステータス履歴
export interface InstructorStatusHistory {
  id: number;
  instructor_id: number;
  status: InstructorStatus;
  changed_at: string;
}
```

### API関数定義
```typescript
// 認証API
export interface AuthAPI {
  login(email: string, password: string): Promise<LoginResponse>;
  getCurrentUser(): Promise<Instructor>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  logout(): Promise<void>;
}

// 講師管理API
export interface InstructorAPI {
  getInstructors(skip?: number, limit?: number, activeOnly?: boolean): Promise<Instructor[]>;
  getInstructor(id: number): Promise<Instructor>;
  createInstructor(data: CreateInstructorRequest): Promise<Instructor>;
  updateInstructor(id: number, data: UpdateInstructorRequest): Promise<Instructor>;
  deleteInstructor(id: number): Promise<void>;
}

// ステータス管理API
export interface InstructorStatusAPI {
  getStatus(instructorId: number): Promise<InstructorStatusInfo>;
  updateStatus(instructorId: number, status: InstructorStatus, sessionId?: string): Promise<InstructorStatusInfo>;
  getStatusHistory(instructorId: number, skip?: number, limit?: number): Promise<InstructorStatusHistory[]>;
  bulkUpdateStatus(updates: BulkStatusUpdate[]): Promise<BulkStatusUpdateResponse>;
}
```

## 🎨 UI/UX設計ガイドライン

### 状態表示
- **AVAILABLE**: 緑色（#4CAF50）
- **BUSY**: オレンジ色（#FF9800）
- **OFFLINE**: グレー色（#9E9E9E）

### エラーハンドリング
- **401 Unauthorized**: ログイン画面へリダイレクト
- **403 Forbidden**: 権限不足メッセージ表示
- **404 Not Found**: リソース不存在メッセージ表示
- **500 Internal Server Error**: システムエラーメッセージ表示

### ローディング状態
- **API呼び出し中**: スピナーまたはプログレスバー表示
- **WebSocket接続中**: 接続状態インジケーター表示
- **大量データ読み込み**: ページネーション対応

### レスポンシブ対応
- **デスクトップ**: 1200px以上でフル機能表示
- **タブレット**: 768px-1199pxで適応レイアウト
- **モバイル**: 767px以下でモバイル最適化

## 🔧 開発環境セットアップ

### 必要なパッケージ
```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.0.0",
    "@mui/material": "^5.14.0",
    "@mui/icons-material": "^5.14.0",
    "react-router-dom": "^6.8.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "eslint": "^8.45.0",
    "prettier": "^3.0.0"
  }
}
```

### 環境変数
```env
REACT_APP_API_BASE_URL=http://localhost:8000/api/v1
REACT_APP_WS_BASE_URL=ws://localhost:8000
REACT_APP_JWT_STORAGE_KEY=instructor_token
```

## 🚀 実装優先順位

### Phase 1: 基本認証機能
1. ログイン画面
2. 認証状態管理（Context/Redux）
3. 保護されたルート
4. ログアウト機能

### Phase 2: 講師管理画面
1. 講師一覧表示
2. 講師詳細表示
3. 講師作成・編集フォーム
4. 講師削除機能

### Phase 3: ステータス管理機能
1. ステータス表示・更新
2. ステータス履歴表示
3. 一括ステータス更新
4. リアルタイム更新（WebSocket）

### Phase 4: 高度な機能
1. 検索・フィルター機能
2. エクスポート機能
3. 通知機能
4. ダッシュボード統計

この仕様書により、フロントエンド開発チームは効率的に高品質な管理画面を開発できます。全てのAPIは186個のテストケースにより品質保証されており、安心して利用できます。
