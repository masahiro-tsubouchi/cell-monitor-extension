# CLAUDE.md

このファイルは、このリポジトリでコードを操作する際のClaude Code (claude.ai/code)へのガイダンスを提供します。

## プロジェクト概要

これは、Jupyterノートブックを通じて生徒の学習進捗をリアルタイムで追跡・分析するJupyterLab Cell Monitor Extension システムです。教育データの収集、処理、可視化を行う複数のコンポーネントが連携して動作します。

## アーキテクチャ

システムはマイクロサービスアーキテクチャで構築されています：

- **JupyterLab Extension** (`cell-monitor-extension/`): JupyterLabでセル実行を監視するTypeScriptベースのフロントエンド拡張機能
- **FastAPI Server** (`fastapi_server/`): イベントを処理し、データを管理し、WebSocket通信を提供するPythonバックエンド
- **Instructor Dashboard** (`instructor-dashboard/`): リアルタイム監視と可視化のためのReactベースのフロントエンド
- **Databases**: PostgreSQL（リレーショナルデータ）、InfluxDB（時系列データ）、Redis（pub/subメッセージング）

## 開発コマンド

### Docker環境
```bash
# 全サービスを起動
docker compose up --build

# 特定のサービスを起動
docker compose up jupyterlab
docker compose up fastapi

# 全サービスを停止
docker compose down
```

### JupyterLab Extension (`cell-monitor-extension/`)
```bash
# 開発ビルド
npm run build

# 本番ビルド
npm run build:prod

# 開発用ウォッチモード
npm run watch

# テスト実行
npm test
npm run test:coverage

# コードリント
npm run eslint:check
npm run eslint  # 自動修正付き

# ビルド成果物のクリア
npm run clean
```

### FastAPI Server (`fastapi_server/`)
```bash
# テスト実行
pytest

# 統合テスト実行（外部サービス必要）
pytest -m integration

# 特定のテスト実行
pytest tests/api/test_events.py

# コード品質チェック
black .  # コードフォーマット
flake8   # リント

# データベースマイグレーション
alembic upgrade head
alembic revision --autogenerate -m "説明"

# ローカルサーバー起動
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Instructor Dashboard (`instructor-dashboard/`)
```bash
# 開発サーバー起動
npm start

# テスト実行
npm test

# 本番ビルド
npm run build
```

### 拡張機能配布
```bash
# 配布用.whlパッケージのビルド
./build-extension.sh
```

## 主要な設定

### JupyterLab Extension 設定
JupyterLab Settings → Advanced Settings Editor → Cell Monitor で設定:
```json
{
  "serverUrl": "http://fastapi:8000/api/v1/events",
  "userId": "",
  "userName": "Anonymous"
}
```

### 環境変数
- `JUPYTER_TOKEN=easy` (開発環境のみ)
- `POSTGRES_USER=admin`
- `POSTGRES_PASSWORD=secretpassword`
- `POSTGRES_DB=progress_db`

## データフローアーキテクチャ

1. **イベント収集**: JupyterLab拡張機能がセル実行イベントをキャプチャ
2. **API処理**: FastAPIサーバーが `/api/v1/events` エンドポイント経由でイベントを受信
3. **メッセージキュー**: イベントをRedis pub/subチャンネルに配信
4. **バックグラウンド処理**: 非同期ワーカーがデータを処理・永続化
5. **リアルタイム更新**: WebSocket接続でダッシュボードに更新を配信
6. **データストレージ**:
   - PostgreSQL: ユーザーデータ、ノートブック、課題
   - InfluxDB: 時系列実行メトリクス
   - Redis: セッションデータとメッセージキューイング

## テスト戦略

- **ユニットテスト**: 個別コンポーネントのテスト
- **統合テスト**: マルチサービス間の相互作用テスト
- **E2Eテスト**: Playwrightによる全ワークフローテスト
- **負荷テスト**: 100+の模擬生徒による性能テスト

### テストマーカー
- `pytest -m integration`: 外部サービスが必要なテスト
- `pytest -m asyncio`: 非同期テスト関数

## 重要なファイルの場所

### コアアプリケーションファイル
- `fastapi_server/main.py` - FastAPIアプリケーションのエントリーポイント
- `fastapi_server/api/endpoints/events.py` - メインイベント処理エンドポイント
- `fastapi_server/core/connection_manager.py` - WebSocket接続管理
- `fastapi_server/worker/main.py` - バックグラウンドイベント処理ワーカー

### 設定ファイル
- `docker-compose.yml` - マルチサービスオーケストレーション
- `cell-monitor-extension/package.json` - 拡張機能ビルド設定
- `fastapi_server/requirements.txt` - Python依存関係
- `fastapi_server/pytest.ini` - テスト設定

### データベースモデル
- `fastapi_server/db/models.py` - SQLAlchemyテーブル定義
- `fastapi_server/schemas/` - Pydanticバリデーションスキーマ
- `fastapi_server/crud/` - データベース操作の抽象化

## 開発ワークフロー

1. 一貫した開発環境のためDocker Composeを使用
2. JupyterLabは http://localhost:8888 で実行 (token: easy)
3. FastAPIサーバーは http://localhost:8000 で実行
4. 講師用ダッシュボードは http://localhost:3000 で実行
5. 開発モードでは全サービスがコード変更時に自動リロード

## AI駆動開発の注意事項

このプロジェクトは、段階的実装、テスト駆動開発、継続的ドキュメント更新のAI駆動開発原則に従っています。コードベースには包括的テスト、詳細なアーキテクチャドキュメント、AI支援開発を促進する明確な関心事の分離が含まれています。
