# テスト実行手順書

> **バージョン**: 1.0.0
> **最終更新日**: 2025-01-19
> **対象**: 開発者・QA担当者

## 📋 概要

JupyterLab Cell Monitor Extension のテスト実行手順を体系化したドキュメントです。AI駆動TDD（テスト駆動開発）により実装された63個のテストケースの実行方法と、CI/CDパイプラインでの自動テスト実行について説明します。

## 🧪 テスト種別と構成

### テスト全体構成
- **Environment API**: 19個のテストケース（包括的API機能テスト）
- **Notebook Version API**: 22個のテストケース（バージョン管理機能テスト）
- **LMS統合テスト**: 9個のテストケース（Classes/Assignments/Submissions連携テスト）
- **WebSocket統合テスト**: 13個のテストケース（リアルタイム通信テスト）
- **合計**: **63個のテストケース**

### テスト対象機能
1. **Environment API** (`/api/v1/v1/environment`) - 19個のテストケース
   - Current環境取得、スナップショット作成、パッケージ情報、ヘルスチェック、差分分析、統合テスト
2. **Notebook Version API** (`/api/v1/v1/notebook-version`) - 22個のテストケース
   - スナップショット、バージョンコミット、履歴管理、ブランチ管理、比較機能、統計情報
3. **LMS統合テスト** (`/api/v1/classes`, `/api/v1/assignments`, `/api/v1/submissions`) - 9個のテストケース
   - 完全LMSワークフロー、複数学生管理、データ整合性、エラーハンドリング
4. **WebSocket統合テスト** (`/api/v1/v1/websocket`) - 13個のテストケース
   - 接続管理、ブロードキャスト、統合ワークフロー、エラーハンドリング、パフォーマンス

## 🐳 Docker環境でのテスト実行

### 前提条件
- Docker及びDocker Composeがインストール済み
- プロジェクトルートディレクトリに移動済み

### 1. テスト環境の起動
```bash
# テスト用Docker Composeでサービス起動
docker compose -f docker-compose.test.yml up -d

# サービス起動確認
docker compose -f docker-compose.test.yml ps
```

### 2. 全テストの実行
```bash
# 全テストを実行
docker compose -f docker-compose.test.yml exec fastapi pytest -v

# テスト結果の詳細表示
docker compose -f docker-compose.test.yml exec fastapi pytest -v --tb=short
```

### 3. 種別別テスト実行

#### Environment APIテスト実行（19個）
```bash
# Environment API包括テスト実行
docker compose exec fastapi pytest tests/api/endpoints/test_environment_comprehensive.py -v

# 特定のテストクラスのみ実行
docker compose exec fastapi pytest tests/api/endpoints/test_environment_comprehensive.py::TestEnvironmentCurrentAPI -v
docker compose exec fastapi pytest tests/api/endpoints/test_environment_comprehensive.py::TestEnvironmentSnapshotAPI -v
docker compose exec fastapi pytest tests/api/endpoints/test_environment_comprehensive.py::TestEnvironmentPackageAPI -v
docker compose exec fastapi pytest tests/api/endpoints/test_environment_comprehensive.py::TestEnvironmentHealthAPI -v
docker compose exec fastapi pytest tests/api/endpoints/test_environment_comprehensive.py::TestEnvironmentDiffAPI -v
docker compose exec fastapi pytest tests/api/endpoints/test_environment_comprehensive.py::TestEnvironmentAnalysisAPI -v
docker compose exec fastapi pytest tests/api/endpoints/test_environment_comprehensive.py::TestEnvironmentIntegration -v
```

#### Notebook Version APIテスト実行（22個）
```bash
# Notebook Version API包括テスト実行
docker compose exec fastapi pytest tests/api/endpoints/test_notebook_version_comprehensive.py -v

# 特定のテストクラスのみ実行
docker compose exec fastapi pytest tests/api/endpoints/test_notebook_version_comprehensive.py::TestNotebookVersionSnapshotAPI -v
docker compose exec fastapi pytest tests/api/endpoints/test_notebook_version_comprehensive.py::TestNotebookVersionAPI -v
docker compose exec fastapi pytest tests/api/endpoints/test_notebook_version_comprehensive.py::TestNotebookVersionHistoryAPI -v
docker compose exec fastapi pytest tests/api/endpoints/test_notebook_version_comprehensive.py::TestNotebookVersionBranchAPI -v
docker compose exec fastapi pytest tests/api/endpoints/test_notebook_version_comprehensive.py::TestNotebookVersionComparisonAPI -v
docker compose exec fastapi pytest tests/api/endpoints/test_notebook_version_comprehensive.py::TestNotebookVersionSnapshotDetailAPI -v
docker compose exec fastapi pytest tests/api/endpoints/test_notebook_version_comprehensive.py::TestNotebookVersionSystemAPI -v
docker compose exec fastapi pytest tests/api/endpoints/test_notebook_version_comprehensive.py::TestNotebookVersionIntegration -v
```

#### LMS統合テスト実行（9個）
```bash
# LMS統合テスト実行
docker compose exec fastapi pytest tests/api/endpoints/test_lms_comprehensive.py -v

# 特定のテストクラスのみ実行
docker compose exec fastapi pytest tests/api/endpoints/test_lms_comprehensive.py::TestLMSIntegrationWorkflow -v
docker compose exec fastapi pytest tests/api/endpoints/test_lms_comprehensive.py::TestLMSDataIntegrity -v
docker compose exec fastapi pytest tests/api/endpoints/test_lms_comprehensive.py::TestLMSErrorHandling -v
```

#### WebSocket統合テスト実行（13個）
```bash
# WebSocket統合テスト実行
docker compose exec fastapi pytest tests/api/endpoints/test_websocket_comprehensive.py -v

# 特定のテストクラスのみ実行
docker compose exec fastapi pytest tests/api/endpoints/test_websocket_comprehensive.py::TestWebSocketConnectionManagement -v
docker compose exec fastapi pytest tests/api/endpoints/test_websocket_comprehensive.py::TestWebSocketEndpoint -v
docker compose exec fastapi pytest tests/api/endpoints/test_websocket_comprehensive.py::TestWebSocketIntegrationWorkflow -v
docker compose exec fastapi pytest tests/api/endpoints/test_websocket_comprehensive.py::TestWebSocketErrorHandling -v
docker compose exec fastapi pytest tests/api/endpoints/test_websocket_comprehensive.py::TestWebSocketPerformance -v
```

#### レガシーCRUDテストのみ実行
```bash
docker compose -f docker-compose.test.yml exec fastapi pytest -v tests/crud/
```

#### APIテストのみ実行
```bash
docker compose -f docker-compose.test.yml exec fastapi pytest -v tests/api/
```

#### 特定のAPIテスト実行
```bash
# Classes APIテスト
docker compose -f docker-compose.test.yml exec fastapi pytest -v tests/api/test_classes_api.py

# Assignments APIテスト
docker compose -f docker-compose.test.yml exec fastapi pytest -v tests/api/test_assignments_api.py

# Submissions APIテスト
docker compose -f docker-compose.test.yml exec fastapi pytest -v tests/api/test_submissions_api.py
```

### 4. テスト環境のクリーンアップ
```bash
# テスト用コンテナ停止・削除
docker compose -f docker-compose.test.yml down -v

# テスト用ボリューム削除（データベース初期化）
docker compose -f docker-compose.test.yml down -v --remove-orphans
```

## 🏃‍♂️ ローカル環境でのテスト実行

### 前提条件
- Python 3.12以上
- PostgreSQL, Redis, InfluxDBが起動済み
- 必要な環境変数が設定済み

### 1. 依存関係のインストール
```bash
cd fastapi_server
pip install -r requirements.txt
```

### 2. 環境変数の設定
```bash
export POSTGRES_DB=progress_db_test
export POSTGRES_USER=admin
export POSTGRES_PASSWORD=secretpassword
export POSTGRES_SERVER=localhost
export POSTGRES_PORT=5432
```

### 3. テスト実行
```bash
# 全テスト実行
pytest -v

# カバレッジレポート付き実行
pytest -v --cov=. --cov-report=html
```

## 🤖 CI/CDパイプライン（GitHub Actions）

### 自動テスト実行タイミング
- **プッシュ時**: `main`, `develop` ブランチへのプッシュ
- **プルリクエスト時**: `main`, `develop` ブランチへのPR作成・更新

### ワークフロー構成
1. **サービス起動**: PostgreSQL, Redis, InfluxDB
2. **依存関係インストール**: Python環境構築
3. **サービス待機**: 各サービスの起動完了確認
4. **テスト実行**: CRUD → API → 統合テストの順序実行
5. **レポート生成**: JUnit XML形式のテスト結果出力

### CI/CDでのテスト確認方法
```bash
# GitHub ActionsのワークフローファイルはGitHub上で確認
.github/workflows/test.yml

# ローカルでCI/CDと同等のテスト実行
pytest --tb=short --junit-xml=test-results.xml tests/
```

## 📊 テスト結果の解釈

### 成功パターン
```
============================= test session starts ==============================
collected 57 items

tests/crud/test_crud_class.py::test_create_class PASSED                   [  1%]
...
tests/api/test_submissions_api.py::test_list_submissions_by_student_api PASSED [100%]

======================= 57 passed, XX warnings in X.XXs ========================
```

### 失敗時の対応
1. **テスト失敗**: エラーメッセージを確認し、該当コードを修正
2. **サービス接続エラー**: Docker Composeサービスの起動状態確認
3. **データベースエラー**: テスト用DBの初期化実行

## 🔧 トラブルシューティング

### よくある問題と解決方法

#### 1. PostgreSQL接続エラー
```bash
# サービス起動確認
docker compose -f docker-compose.test.yml logs postgres

# 手動接続テスト
docker compose -f docker-compose.test.yml exec postgres psql -U admin -d progress_db_test
```

#### 2. テストデータの競合
```bash
# データベースリセット
docker compose -f docker-compose.test.yml down -v
docker compose -f docker-compose.test.yml up -d
```

#### 3. 外部キー制約エラー
- テスト内のヘルパー関数で前提データが正しく作成されているか確認
- `create_test_class()`, `create_test_notebook()`, `create_test_student()` の動作確認

## 📈 テスト品質メトリクス

### 現在の実績
- **テスト成功率**: 100% (57/57)
- **カバレッジ**: CRUD操作・API操作の完全カバー
- **エラーハンドリング**: 404エラー・バリデーションエラーの網羅
- **外部キー制約**: 複雑な関連データの適切な処理

### AI駆動TDDの効果
- **要件明確化**: テストファーストによる仕様の明確化
- **品質向上**: 境界条件・異常系の体系的なテスト
- **開発効率**: 実装の方向性安定化とデバッグ時間短縮

## 📝 テスト追加ガイドライン

### 新機能追加時の手順
1. **テストファースト**: 機能実装前にテストコードを作成
2. **ヘルパー関数**: 外部キー制約のあるテストデータセットアップ
3. **標準パターン**: CRUD操作で7-8個の標準テストケース実装
4. **エラーハンドリング**: 存在しないID等の境界条件テスト
5. **ドキュメント更新**: 本手順書とAPI仕様書の同期更新

---

**このテスト手順書により、開発チーム全体で一貫したテスト実行と品質保証を実現します。**
