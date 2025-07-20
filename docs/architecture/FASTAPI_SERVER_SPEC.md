# FastAPI Server 詳細仕様書

> **バージョン**: 1.0.0
> **最終更新日**: 2025-01-19
> **対象**: 開発者・運用担当者

## 📋 概要

JupyterLab Cell Monitor Extension のバックエンドサーバーは、学習進捗管理システム（LMS）として設計された本格的なFastAPIアプリケーションです。セル実行イベントの収集、リアルタイム通知、学習データの永続化、クラス・課題管理機能を提供します。

## 🏗️ アーキテクチャ概要

### システム構成
```
JupyterLab Extension → FastAPI Server → データベース群
                    ↓
               WebSocket通知
                    ↓
            リアルタイムダッシュボード
```

### 主要コンポーネント
- **API層**: RESTful API エンドポイント
- **イベント処理層**: 非同期イベントルーティング・処理
- **データ永続化層**: PostgreSQL（構造化データ）+ InfluxDB（時系列データ）
- **通信層**: Redis Pub/Sub + WebSocket
- **テスト層**: E2Eテスト自動化機能

## 📁 ディレクトリ構造

```
fastapi_server/
├── main.py                    # FastAPIアプリケーション起動
├── requirements.txt           # 依存関係定義
├── Dockerfile                 # コンテナ定義
├── pytest.ini               # テスト設定
├── api/                      # API定義
│   ├── api.py               # ルーター統合
│   └── endpoints/           # 各エンドポイント実装
│       ├── events.py        # メインイベント受信API
│       ├── test_events.py   # テスト用イベントAPI
│       ├── websocket.py     # WebSocket通信
│       ├── cell_monitor.py  # セル監視機能
│       ├── progress.py      # 進捗管理
│       ├── classes.py       # クラス管理API (LMS)
│       ├── assignments.py   # 課題管理API (LMS)
│       └── submissions.py   # 提出管理API (LMS)
├── core/                    # 共通機能・設定
│   ├── config.py           # 環境設定
│   ├── connection_manager.py # WebSocket接続管理
│   └── error_logger.py     # エラーログ処理
├── schemas/                 # データモデル定義
│   ├── event.py            # EventDataスキーマ
│   ├── cell_monitor.py     # セル監視データ
│   ├── progress.py         # 進捗データ
│   └── student.py          # 学生データ
├── db/                     # データベース関連
│   ├── models.py           # SQLAlchemyモデル定義
│   ├── base.py             # DB基底クラス
│   ├── session.py          # DB接続セッション
│   ├── influxdb_client.py  # InfluxDB接続・操作
│   └── redis_client.py     # Redis接続・Pub/Sub
├── crud/                   # データベース操作
│   └── crud_student.py     # 学生データCRUD
├── worker/                 # バックグラウンド処理
│   ├── main.py            # ワーカーメイン処理
│   ├── event_router.py    # イベントルーティング
│   └── error_handler.py   # エラーハンドリング
├── tests/                 # テストコード
└── static/               # 静的ファイル
```

## 🔌 API エンドポイント仕様

### メインAPI

#### POST `/api/v1/events`
**概要**: JupyterLabからのイベントデータ受信
**リクエスト**: `List[EventData]`
**レスポンス**: `{"message": "N events received and queued for processing."}`
**処理フロー**:
1. イベントデータバリデーション
2. Redis Pub/Subチャンネルへ配信
3. バックグラウンドワーカーによる非同期処理

#### WebSocket `/ws`
**概要**: リアルタイム通知配信
**用途**: ダッシュボード・監視画面への即座の状況通知
**データ形式**: JSON形式のイベントデータ

### テスト用API

#### POST `/api/v1/test/events/{test_id}`
**概要**: E2Eテスト用イベント保存
**用途**: 自動テストでのイベント受信確認
**保持期間**: 10分間（自動クリーンアップ）

#### GET `/api/v1/test/events/{test_id}`
**概要**: テストイベント取得・検証

#### DELETE `/api/v1/test/events/{test_id}`
**概要**: テストイベントクリア

#### GET `/api/v1/test/events`
**概要**: 現在のテストID一覧取得

### LMS機能API

#### Classes API (`/api/v1/classes`)
**概要**: クラス・授業管理機能

- **POST `/api/v1/classes`**: 新規クラス作成
  - リクエスト: `ClassCreate` (name, class_code, description)
  - レスポンス: `ClassResponse` (id, name, class_code, description, created_at, updated_at)
  - バリデーション: class_code重複チェック

- **GET `/api/v1/classes`**: クラス一覧取得
  - クエリパラメータ: skip, limit (ページネーション)
  - レスポンス: `List[ClassResponse]`

- **GET `/api/v1/classes/{class_id}`**: 特定クラス取得
  - レスポンス: `ClassResponse` または 404エラー

- **PUT `/api/v1/classes/{class_id}`**: クラス情報更新
  - リクエスト: `ClassUpdate` (部分更新対応)
  - レスポンス: `ClassResponse` または 404エラー

- **DELETE `/api/v1/classes/{class_id}`**: クラス削除
  - レスポンス: `ClassResponse` または 404エラー

#### Assignments API (`/api/v1/assignments`)
**概要**: 課題管理機能

- **POST `/api/v1/assignments`**: 新規課題作成
  - リクエスト: `ClassAssignmentCreate` (class_id, notebook_id, title, description, due_date)
  - レスポンス: `ClassAssignmentResponse`
  - 外部キー制約: class_id, notebook_id の存在確認

- **GET `/api/v1/assignments`**: 課題一覧取得
  - クエリパラメータ: skip, limit, class_id (クラス別フィルタリング)
  - レスポンス: `List[ClassAssignmentResponse]`

- **GET `/api/v1/assignments/{assignment_id}`**: 特定課題取得
  - レスポンス: `ClassAssignmentResponse` または 404エラー

- **PUT `/api/v1/assignments/{assignment_id}`**: 課題情報更新
  - リクエスト: `ClassAssignmentUpdate` (部分更新対応)
  - レスポンス: `ClassAssignmentResponse` または 404エラー

- **DELETE `/api/v1/assignments/{assignment_id}`**: 課題削除
  - レスポンス: `ClassAssignmentResponse` または 404エラー

#### Submissions API (`/api/v1/submissions`)
**概要**: 課題提出管理機能

- **POST `/api/v1/submissions`**: 新規提出作成
  - リクエスト: `AssignmentSubmissionCreate` (assignment_id, student_id, notebook_content, submitted_at)
  - レスポンス: `AssignmentSubmissionResponse`
  - 外部キー制約: assignment_id, student_id の存在確認

- **GET `/api/v1/submissions`**: 提出一覧取得
  - クエリパラメータ: skip, limit, assignment_id, student_id (フィルタリング)
  - レスポンス: `List[AssignmentSubmissionResponse]`

- **GET `/api/v1/submissions/{submission_id}`**: 特定提出取得
  - レスポンス: `AssignmentSubmissionResponse` または 404エラー

- **PUT `/api/v1/submissions/{submission_id}`**: 提出情報更新
  - リクエスト: `AssignmentSubmissionUpdate` (部分更新対応)
  - レスポンス: `AssignmentSubmissionResponse` または 404エラー

- **DELETE `/api/v1/submissions/{submission_id}`**: 提出削除
  - レスポンス: `AssignmentSubmissionResponse` または 404エラー

## 🔗 JupyterLab拡張機能との連携

### データ連携フロー
```
JupyterLab拡張機能 → FastAPIサーバー → データベース群
        ↑                     ↓
        └── WebSocket ← リアルタイム更新
```

### 主要イベント送信パターン
| **拡張機能イベント** | **送信先API** | **用途** | **頻度** |
|---------------------|--------------|----------|----------|
| `cell_execution_start` | `POST /api/v1/events` | セル実行開始通知 | セル実行時 |
| `cell_execution_complete` | `POST /api/v1/events` | セル実行完了・結果記録 | セル実行完了時 |
| `cell_execution_error` | `POST /api/v1/events` | エラー発生記録 | エラー発生時 |
| `notebook_save` | `POST /api/v1/events` | ノートブック保存記録 | 保存時 |
| `session_start` | `POST /api/v1/events` | セッション開始記録 | JupyterLab起動時 |
| `session_end` | `POST /api/v1/events` | セッション終了記録 | JupyterLab終了時 |

### LMS機能連携
| **拡張機能操作** | **API呼び出し** | **データ交換** |
|-----------------|----------------|----------------|
| 課題一覧表示 | `GET /api/v1/assignments?class_id={id}` | 課題リスト取得 |
| 課題提出 | `POST /api/v1/submissions` | ノートブック内容送信 |
| 提出履歴確認 | `GET /api/v1/submissions?student_id={id}` | 提出状況取得 |
| 進捗確認 | WebSocket `progress:{student_id}` | リアルタイム進捗受信 |

### WebSocketイベント
| **イベント種別** | **チャンネル** | **データ形式** | **用途** |
|----------------|----------------|---------------|----------|
| `execution_update` | `progress:{student_id}` | 実行状態情報 | リアルタイム進捗表示 |
| `assignment_graded` | `notifications:{student_id}` | 採点結果通知 | 成績通知 |
| `system_message` | `broadcast` | システムメッセージ | 全体通知 |

### データ送信最適化
- **バッチ処理**: 最大100件のイベントをまとめて送信
- **圧縮**: gzip圧縮によるデータサイズ削減
- **オフライン対応**: IndexedDBでのローカルキューイング
- **リトライ機能**: ネットワークエラー時の自動再送

**詳細仕様**: `docs/architecture/EVENT_FLOW.md` を参照

## 💾 データベース設計

### PostgreSQL（構造化データ）

#### 主要テーブル構成
1. **students**: 学生・ユーザー情報
2. **sessions**: JupyterLabセッション管理
3. **notebooks**: ノートブック情報
4. **cells**: セル情報
5. **cell_executions**: セル実行履歴
6. **classes**: クラス・授業管理
7. **student_classes**: 学生-クラス関連付け
8. **class_assignments**: クラス課題管理
9. **assignment_submissions**: 課題提出管理
10. **notebook_accesses**: ノートブックアクセス履歴

#### 主要リレーション
```
Student 1:N Session 1:N CellExecution N:1 Cell N:1 Notebook
Student N:M Class (via StudentClass)
Class 1:N ClassAssignment N:1 Notebook
Student 1:N AssignmentSubmission N:1 ClassAssignment
```

### InfluxDB（時系列データ）

#### Measurement: `student_progress`
**タグ（インデックス化）**:
- `userId`: ユーザーID
- `event`: イベントタイプ
- `notebook`: ノートブック名
- `cellType`: セルタイプ
- `sessionId`: セッションID

**フィールド（メトリクス）**:
- `cellId`: セルID
- `notebookPath`: ノートブックパス
- `executionCount`: 実行回数
- `success`: 実行成功フラグ
- `duration`: 実行時間

### Redis（Pub/Sub・キャッシュ）

#### チャンネル
- `student_progress_notifications`: イベント通知配信

## ⚙️ イベント処理フロー

### 1. イベント受信
```
JupyterLab → POST /api/v1/events → FastAPI → Redis Pub/Sub
```

### 2. バックグラウンド処理
```
Redis Subscriber → Event Router → Handler Functions
                                ↓
                    PostgreSQL + InfluxDB 書き込み
```

### 3. リアルタイム通知
```
Redis Pub/Sub → WebSocket Manager → 接続中クライアント
```

### 4. イベントタイプ別処理

#### `cell_execution`
- セル実行履歴をPostgreSQLに記録
- 実行メトリクスをInfluxDBに保存
- リアルタイム進捗通知

#### `notebook_save`
- ノートブック保存履歴を記録
- 保存イベントをInfluxDBに保存

#### デフォルト処理
- 基本的な進捗イベントとして処理
- 学生情報の自動作成・更新

## 🔧 設定項目

### 環境変数（`core/config.py`）

#### プロジェクト設定
- `PROJECT_NAME`: "Student Progress Tracker API"
- `PROJECT_VERSION`: "1.0.0"
- `API_V1_STR`: "/api/v1"

#### CORS設定
- `BACKEND_CORS_ORIGINS`: 許可オリジン（開発時は["*"]）

#### PostgreSQL設定
- `POSTGRES_USER`: "admin"
- `POSTGRES_PASSWORD`: "secretpassword"
- `POSTGRES_SERVER`: "postgres"
- `POSTGRES_PORT`: 5432
- `POSTGRES_DB`: "progress_db"

#### InfluxDB設定
- `INFLUXDB_URL`: "http://influxdb:8086"
- `INFLUXDB_TOKEN`: "my-super-secret-token"
- `INFLUXDB_ORG`: "my-org"
- `INFLUXDB_BUCKET`: "progress_bucket"

#### Redis設定
- `REDIS_HOST`: "redis"
- `REDIS_PORT`: 6379

## 🛡️ エラーハンドリング・信頼性

### リトライ機能
- **InfluxDB書き込み**: 指数バックオフで最大3回リトライ
- **イベント処理**: 失敗時の自動リトライ機能
- **Redis接続**: 接続失敗時の再接続処理

### エラーログ
- 構造化ログ出力
- エラーレベル別の詳細ログ
- デバッグ情報の包括的記録

### 監視・ヘルスチェック
- アプリケーション起動・終了ログ
- データベース接続状態監視
- Redis Pub/Sub接続状態監視

## 🧪 テスト機能

### E2Eテスト自動化
- **Playwright**: JupyterLab自動操作
- **pytest**: テストケース実行
- **Docker**: 統合テスト環境
- **テスト用API**: イベント受信確認機能

### テスト実行方法
```bash
# E2Eテスト実行
./run_e2e_tests.sh

# 単体テスト実行
./run_tests_in_docker.sh

# スタンドアロンE2Eテスト
python test_e2e_standalone.py
```

## 📈 パフォーマンス特性

### 設計目標
- **同時接続**: 200ユーザー対応
- **イベント処理**: 非同期・バックグラウンド処理
- **データベース**: 読み書き分離対応
- **スケーラビリティ**: コンテナベース水平スケール対応

### 最適化要素
- **バッチ書き込み**: InfluxDBへの効率的なデータ投入
- **接続プール**: データベース接続の効率化
- **非同期処理**: イベント処理の並列化
- **インデックス**: 検索クエリの最適化

## 🚀 デプロイメント

### Docker構成
- **FastAPI**: アプリケーションサーバー
- **PostgreSQL**: 構造化データストレージ
- **InfluxDB**: 時系列データストレージ
- **Redis**: Pub/Sub・キャッシュ

### 起動コマンド
```bash
# 開発環境
docker compose up -d

# 本番環境
docker compose -f docker-compose.prod.yml up -d
```

## 🔮 拡張可能性

### 追加可能な機能
- **認証・認可**: JWT/OAuth2対応
- **API制限**: レート制限・クォータ管理
- **メトリクス**: Prometheus/Grafana連携
- **ログ集約**: ELKスタック連携
- **通知**: Slack/Teams連携
- **AI分析**: 学習パターン分析機能

### カスタムイベントハンドラー追加
```python
# worker/event_router.py
@with_retry
async def handle_custom_event(event_data: Dict[str, Any], db: Session):
    # カスタム処理実装
    pass

# ハンドラー登録
event_router.register_handler("custom_event", handle_custom_event)
```

## 📚 関連ドキュメント

- [API データ仕様書](./API_DATA_SPEC.md)
- [ビルド・配布ガイド](../development/BUILD_AND_DISTRIBUTION.md)
- [開発計画書](../development/DEVELOPMENT_PLAN.md)
- [プロジェクトロードマップ](../ROADMAP.md)
