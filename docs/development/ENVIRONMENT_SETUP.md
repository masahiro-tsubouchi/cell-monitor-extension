# 開発環境セットアップ

## 🎯 このガイドの目的

初級開発者でもJupyterLab Cell Monitor Extensionシステムの開発環境を確実に構築できるよう、詳細な手順を提供します。また、AI駆動開発において必要な環境設定も含まれています。

## 📋 前提条件チェック

開始前に以下の環境を確認してください：

### 必須ソフトウェア
```bash
# 1. Dockerの確認
docker --version
# 期待値: Docker version 20.0.0以上

# 2. Docker Composeの確認
docker-compose --version
# 期待値: docker-compose version 1.29.0以上

# 3. Node.jsの確認（ローカル開発用）
node --version
# 期待値: v18.0.0以上

# 4. Pythonの確認（ローカル開発用）
python --version
# 期待値: Python 3.11以上
```

### システム要件
- **メモリ**: 8GB以上推奨（Docker環境用）
- **ディスク**: 10GB以上の空き容量
- **OS**: Windows 10/11, macOS 10.15+, Linux (Ubuntu 20.04+)

## 🚀 クイックスタート（5分で動作確認）

### Step 1: プロジェクトクローンと起動

```bash
# 1. プロジェクトディレクトリに移動
cd /path/to/jupyter-extensionver2-claude-code

# 2. 全サービス起動
docker-compose up --build

# ⏱️ 初回ビルドは5-10分かかります
```

### Step 2: 動作確認

起動完了後、以下のURLにアクセス：

```bash
# JupyterLab
http://localhost:8888
# ログイントークン: easy

# FastAPI（API文書）
http://localhost:8000/docs

# 講師ダッシュボード（開発予定）
http://localhost:3000
```

### Step 3: 拡張機能設定

1. JupyterLabを開く
2. `Settings` > `Advanced Settings Editor` をクリック
3. `Cell Monitor` を選択
4. 以下のJSON設定を入力：

```json
{
  "serverUrl": "http://fastapi:8000/api/v1/events",
  "userId": "test-user",
  "userName": "テスト太郎"
}
```

### Step 4: 動作テスト

1. JupyterLabで新しいノートブックを作成
2. 簡単なPythonコードを実行：
   ```python
   print("Hello, Cell Monitor!")
   ```
3. FastAPIのログでイベント受信を確認

## 🔧 詳細セットアップ

### Docker環境の詳細設定

#### `docker-compose.yml` の主要サービス

```yaml
# 主要サービス構成
services:
  jupyterlab:    # JupyterLab + Cell Monitor Extension
  fastapi:       # FastAPIバックエンド
  worker:        # バックグラウンド処理ワーカー
  postgres:      # PostgreSQLデータベース
  influxdb:      # InfluxDB時系列データベース
  redis:         # Redis（キューイング・セッション管理）
```

#### 環境変数設定

プロジェクトルートに `.env` ファイルを作成：

```bash
# .env ファイル例
# データベース設定
POSTGRES_USER=admin
POSTGRES_PASSWORD=secretpassword
POSTGRES_DB=progress_db

# InfluxDB設定
INFLUXDB_TOKEN=my-super-secret-token
INFLUXDB_ORG=my-org
INFLUXDB_BUCKET=progress_bucket

# Redis設定
REDIS_HOST=redis
REDIS_PORT=6379

# JupyterLab設定
JUPYTER_TOKEN=easy

# 開発モード設定
DEBUG=true
ENVIRONMENT=development
```

## 🛠️ ローカル開発環境

Docker環境では開発効率が悪い場合のローカル開発手順：

### 1. Python環境準備

```bash
# 1. Python仮想環境作成
cd fastapi_server
python -m venv venv

# 2. 仮想環境アクティベート
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# 3. 依存関係インストール
pip install -r requirements.txt

# 4. 開発用追加パッケージ
pip install black flake8 pytest-cov
```

### 2. Node.js環境準備

```bash
# 1. JupyterLab拡張のビルド環境
cd cell-monitor-extension

# 2. 依存関係インストール
npm install

# 3. 開発用ビルド
npm run build

# 4. JupyterLabに拡張をインストール（開発モード）
jupyter labextension develop . --overwrite
```

### 3. データベース準備

```bash
# 1. データベースサービスのみ起動
docker-compose up postgres influxdb redis -d

# 2. データベースマイグレーション
cd fastapi_server
alembic upgrade head

# 3. InfluxDBセットアップ
# http://localhost:8086 にアクセスして初期設定
```

### 4. 開発サーバー起動

```bash
# Terminal 1: FastAPI開発サーバー
cd fastapi_server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: バックグラウンドワーカー
cd fastapi_server
python worker/main.py

# Terminal 3: JupyterLab（拡張機能付き）
jupyter lab --allow-root --ip=0.0.0.0 --port=8888 --no-browser --LabApp.token=easy

# Terminal 4: フロントエンド開発（拡張機能のウォッチモード）
cd cell-monitor-extension
npm run watch
```

## 🧪 開発環境の検証

### 1. サービス稼働確認

```bash
# 全サービスの状態確認
docker-compose ps

# 期待される出力例
#      Name                     Command               State           Ports
# --------------------------------------------------------------------------
# project_fastapi_1    uvicorn main:app --reload      Up      0.0.0.0:8000->8000/tcp
# project_jupyterlab_1 jupyter lab --allow-root       Up      0.0.0.0:8888->8888/tcp
# project_postgres_1   docker-entrypoint.sh postgres  Up      5432/tcp
# project_redis_1      docker-entrypoint.sh redis     Up      6379/tcp
```

### 2. API動作確認

```bash
# 1. API ヘルスチェック
curl http://localhost:8000/

# 期待値: {"message": "Welcome to Student Progress Tracker API"}

# 2. イベント送信テスト
curl -X POST http://localhost:8000/api/v1/events \
  -H "Content-Type: application/json" \
  -d '[{
    "eventId": "test-001",
    "eventType": "cell_executed",
    "eventTime": "2024-01-01T12:00:00Z",
    "userId": "test-user"
  }]'

# 期待値: {"message": "1 events received and queued for processing"}
```

### 3. データベース接続確認

```bash
# PostgreSQL接続テスト
docker-compose exec postgres psql -U admin -d progress_db -c "SELECT version();"

# InfluxDB接続テスト（ブラウザで確認）
# http://localhost:8086

# Redis接続テスト
docker-compose exec redis redis-cli ping
# 期待値: PONG
```

### 4. JupyterLab拡張機能確認

1. http://localhost:8888 にアクセス（token: easy）
2. 新しいノートブックを作成
3. Pythonセルでコードを実行
4. ブラウザ開発者ツールのConsoleタブを確認
5. Cell Monitor拡張からのログメッセージを確認

## 🔍 トラブルシューティング

### よくある問題と解決方法

#### 1. Docker起動エラー
```bash
# エラー: "port already in use"
# 解決: 使用中のポートを確認・停止
lsof -i :8000  # ポート8000を使用しているプロセスを確認
docker-compose down  # 既存のコンテナを停止
```

#### 2. JupyterLab拡張が読み込まれない
```bash
# 解決手順
cd cell-monitor-extension
npm run build  # 拡張機能を再ビルド
jupyter lab clean  # JupyterLabのキャッシュクリア
jupyter lab build  # JupyterLabを再ビルド
```

#### 3. データベース接続エラー
```bash
# PostgreSQL接続エラーの確認
docker-compose logs postgres

# よくある原因: データベース初期化中
# 解決: 数分待ってから再試行
```

#### 4. 拡張機能からイベントが送信されない
```bash
# 確認手順
# 1. ブラウザ開発者ツールのNetworkタブを確認
# 2. FastAPIサーバーのログを確認
docker-compose logs fastapi

# 3. 拡張機能の設定を確認（Settings > Cell Monitor）
```

## 🎯 開発ワークフロー

### 日常的な開発手順

#### 1. 開発開始時
```bash
# プロジェクトディレクトリに移動
cd /path/to/project

# 最新コードを取得
git pull origin main

# 開発環境起動
docker-compose up --build -d
```

#### 2. 機能開発時
```bash
# 新しい機能ブランチ作成
git checkout -b feature/new-feature

# 開発用サーバー起動（ホットリロード有効）
# FastAPI: 自動リロード有効
# JupyterLab Extension: npm run watch でファイル監視
```

#### 3. テスト実行
```bash
# バックエンドテスト
cd fastapi_server
pytest

# フロントエンドテスト
cd cell-monitor-extension
npm test

# 統合テスト
pytest tests/integration/
```

#### 4. コード品質チェック
```bash
# Python
black .                    # フォーマット
flake8                     # リント
mypy                       # 型チェック

# TypeScript
npm run lint               # ESLint
npm run type-check         # TypeScript型チェック
```

## 🤖 AI駆動開発向け設定

### VS Code設定（推奨）

`.vscode/settings.json`:
```json
{
  "python.defaultInterpreterPath": "./fastapi_server/venv/bin/python",
  "python.testing.pytestEnabled": true,
  "python.testing.pytestArgs": ["fastapi_server/tests"],
  "typescript.preferences.includePackageJsonAutoImports": "auto",
  "eslint.workingDirectories": ["cell-monitor-extension"],
  "files.exclude": {
    "**/__pycache__": true,
    "**/node_modules": true,
    "**/.pytest_cache": true
  }
}
```

### 開発用拡張機能

```json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.pylint",
    "ms-vscode.vscode-typescript-next",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-vscode-remote.remote-containers"
  ]
}
```

## 📚 次のステップ

環境構築完了後の学習パス：

1. **[システム概要](../overview/SYSTEM_OVERVIEW.md)** - システム全体の理解
2. **[実装計画](../implementation-plans/)** - 具体的な実装手順
3. **[API仕様](../api/)** - API インターフェースの理解
4. **[コーディング規約](CODING_STANDARDS.md)** - 開発ルールの習得

---

**開発環境に関する質問や問題がある場合は、プロジェクトのIssueで報告してください。**
