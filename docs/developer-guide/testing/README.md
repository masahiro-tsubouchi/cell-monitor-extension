# テスト戦略：AI駆動開発によるテスト自動化

> **テスト手法**: TDD + AI支援テスト生成
> **最終更新日**: 2025-01-18
> **カバレッジ目標**: 90%以上

## 🎯 テスト戦略概要

### AI駆動テスト開発の原則
- **テスト先行**: AIによるテストケース生成を実装前に実施
- **自動化優先**: 手動テストを最小限に抑え、CI/CDパイプラインで自動実行
- **品質保証**: AIレビューと人間レビューの組み合わせによる品質確保

### テスト分類
1. **単体テスト**: 個別コンポーネントの機能検証
2. **統合テスト**: コンポーネント間の連携検証
3. **エンドツーエンドテスト**: 全体フローの動作検証
4. **パフォーマンステスト**: 負荷・性能の検証

## 🐳 Docker環境でのテスト実行

### 環境構築
```bash
# テスト環境の起動
docker-compose -f docker-compose.test.yml up -d

# テスト実行
docker-compose -f docker-compose.test.yml exec fastapi pytest

# 環境のクリーンアップ
docker-compose -f docker-compose.test.yml down -v
```

### テスト用Docker Compose設定
```yaml
# docker-compose.test.yml
version: '3.8'
services:
  postgres-test:
    image: postgres:15
    environment:
      POSTGRES_DB: cellmonitor_test
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_password
    ports:
      - "5433:5432"

  redis-test:
    image: redis:7-alpine
    ports:
      - "6380:6379"

  influxdb-test:
    image: influxdb:2.7
    environment:
      INFLUXDB_DB: cellmonitor_test
      INFLUXDB_HTTP_AUTH_ENABLED: false
    ports:
      - "8087:8086"

  fastapi-test:
    build: .
    environment:
      DATABASE_URL: postgresql://test_user:test_password@postgres-test:5432/cellmonitor_test
      REDIS_URL: redis://redis-test:6379
      INFLUXDB_URL: http://influxdb-test:8086
      TESTING: true
    depends_on:
      - postgres-test
      - redis-test
      - influxdb-test
    volumes:
      - ./tests:/app/tests
      - ./fastapi_server:/app/fastapi_server
```

## 🧪 単体テスト

### AI支援テスト生成戦略
```python
# AIに依頼するテストケース生成例
"""
以下の関数のテストケースを生成してください:

def process_event(event_data: dict) -> dict:
    '''イベントデータを処理し、適切なフォーマットで返す'''
    # 実装コード
    pass

テスト観点:
1. 正常系: 有効なイベントデータでの処理
2. 異常系: 無効なデータ、必須フィールド不足
3. 境界値: 最大・最小値での動作
4. エラーハンドリング: 例外発生時の適切な処理
"""
```

### テストファイル構成
```
tests/
├── unit/
│   ├── test_event_processor.py
│   ├── test_database_models.py
│   ├── test_redis_client.py
│   └── test_websocket_manager.py
├── integration/
│   ├── test_api_endpoints.py
│   ├── test_database_operations.py
│   └── test_event_flow.py
├── e2e/
│   ├── test_full_workflow.py
│   └── test_dashboard_integration.py
└── conftest.py
```

### 単体テスト実装例

#### イベント処理のテスト
```python
# tests/unit/test_event_processor.py
import pytest
from unittest.mock import Mock, patch
from fastapi_server.event_processor import EventProcessor

class TestEventProcessor:

    @pytest.fixture
    def event_processor(self):
        return EventProcessor()

    @pytest.fixture
    def valid_event_data(self):
        return {
            "eventType": "cell_execution",
            "userId": "user123",
            "userName": "田中太郎",
            "notebookPath": "/notebooks/lesson1.ipynb",
            "cellIndex": 5,
            "cellContent": "print('Hello')",
            "executionCount": 1,
            "executionDurationMs": 150,
            "hasError": False,
            "timestamp": "2025-01-18T10:30:00Z"
        }

    def test_process_valid_event(self, event_processor, valid_event_data):
        """正常なイベントデータの処理テスト"""
        result = event_processor.process(valid_event_data)

        assert result["status"] == "success"
        assert result["event_id"] is not None
        assert result["processed_at"] is not None

    def test_process_invalid_event_type(self, event_processor):
        """無効なイベントタイプのテスト"""
        invalid_data = {"eventType": "invalid_type"}

        with pytest.raises(ValueError, match="Invalid event type"):
            event_processor.process(invalid_data)

    def test_process_missing_required_fields(self, event_processor):
        """必須フィールド不足のテスト"""
        incomplete_data = {"eventType": "cell_execution"}

        with pytest.raises(ValueError, match="Missing required field"):
            event_processor.process(incomplete_data)

    @patch('fastapi_server.event_processor.redis_client')
    def test_redis_publish_success(self, mock_redis, event_processor, valid_event_data):
        """Redis発行成功のテスト"""
        mock_redis.publish.return_value = True

        result = event_processor.process(valid_event_data)

        mock_redis.publish.assert_called_once()
        assert result["redis_published"] is True

    @patch('fastapi_server.event_processor.redis_client')
    def test_redis_publish_failure(self, mock_redis, event_processor, valid_event_data):
        """Redis発行失敗のテスト"""
        mock_redis.publish.side_effect = Exception("Redis connection failed")

        with pytest.raises(Exception, match="Redis connection failed"):
            event_processor.process(valid_event_data)
```

#### データベースモデルのテスト
```python
# tests/unit/test_database_models.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi_server.database.models import Base, User, Notebook, LearningSession

@pytest.fixture
def db_session():
    """テスト用データベースセッション"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    yield session
    session.close()

class TestUserModel:

    def test_create_user(self, db_session):
        """ユーザー作成テスト"""
        user = User(
            user_id="user123",
            user_name="田中太郎",
            email="tanaka@example.com"
        )

        db_session.add(user)
        db_session.commit()

        retrieved_user = db_session.query(User).filter_by(user_id="user123").first()
        assert retrieved_user.user_name == "田中太郎"
        assert retrieved_user.email == "tanaka@example.com"

    def test_user_unique_constraint(self, db_session):
        """ユーザーID重複制約テスト"""
        user1 = User(user_id="user123", user_name="田中太郎")
        user2 = User(user_id="user123", user_name="佐藤花子")

        db_session.add(user1)
        db_session.commit()

        db_session.add(user2)
        with pytest.raises(Exception):  # IntegrityError
            db_session.commit()
```

## 🔗 統合テスト

### API統合テスト
```python
# tests/integration/test_api_endpoints.py
import pytest
from fastapi.testclient import TestClient
from fastapi_server.main import app

@pytest.fixture
def client():
    return TestClient(app)

class TestEventAPI:

    def test_post_event_success(self, client):
        """イベント送信成功テスト"""
        event_data = {
            "eventType": "cell_execution",
            "userId": "user123",
            "userName": "田中太郎",
            "notebookPath": "/notebooks/lesson1.ipynb",
            "cellIndex": 5,
            "cellContent": "print('Hello')",
            "executionCount": 1,
            "executionDurationMs": 150,
            "hasError": False
        }

        response = client.post("/api/v1/events", json=event_data)

        assert response.status_code == 200
        assert response.json()["status"] == "received"
        assert "event_id" in response.json()

    def test_post_event_validation_error(self, client):
        """イベント送信バリデーションエラーテスト"""
        invalid_data = {"eventType": "invalid_type"}

        response = client.post("/api/v1/events", json=invalid_data)

        assert response.status_code == 400
        assert "error" in response.json()

    def test_get_class_summary(self, client):
        """クラスサマリー取得テスト"""
        response = client.get("/api/v1/class/summary")

        assert response.status_code == 200
        assert "summary" in response.json()
        assert "students" in response.json()
```

### データベース統合テスト
```python
# tests/integration/test_database_operations.py
import pytest
from fastapi_server.database.operations import DatabaseOperations

class TestDatabaseOperations:

    @pytest.fixture
    def db_ops(self):
        return DatabaseOperations(test_mode=True)

    def test_save_event_to_postgres(self, db_ops):
        """PostgreSQLへのイベント保存テスト"""
        event_data = {
            "eventType": "cell_execution",
            "userId": "user123",
            "notebookPath": "/notebooks/lesson1.ipynb",
            "cellIndex": 5,
            "timestamp": "2025-01-18T10:30:00Z"
        }

        result = db_ops.save_event(event_data)

        assert result["success"] is True
        assert result["event_id"] is not None

    def test_save_metrics_to_influxdb(self, db_ops):
        """InfluxDBへのメトリクス保存テスト"""
        metrics_data = {
            "measurement": "cell_execution",
            "tags": {"user_id": "user123", "notebook": "lesson1"},
            "fields": {"duration_ms": 150, "has_error": False},
            "time": "2025-01-18T10:30:00Z"
        }

        result = db_ops.save_metrics(metrics_data)

        assert result["success"] is True
```

## 🌐 エンドツーエンドテスト

### 全体フローテスト
```python
# tests/e2e/test_full_workflow.py
import pytest
import asyncio
import websockets
from fastapi.testclient import TestClient
from fastapi_server.main import app

class TestFullWorkflow:

    @pytest.fixture
    def client(self):
        return TestClient(app)

    @pytest.mark.asyncio
    async def test_event_to_websocket_flow(self, client):
        """イベント送信からWebSocket通知までのフローテスト"""
        # WebSocket接続
        uri = "ws://localhost:8000/ws/dashboard"
        async with websockets.connect(uri) as websocket:

            # イベント送信
            event_data = {
                "eventType": "cell_execution",
                "userId": "user123",
                "userName": "田中太郎",
                "notebookPath": "/notebooks/lesson1.ipynb",
                "cellIndex": 5,
                "cellContent": "print('Hello')",
                "executionCount": 1,
                "executionDurationMs": 150,
                "hasError": False
            }

            response = client.post("/api/v1/events", json=event_data)
            assert response.status_code == 200

            # WebSocket通知の受信確認
            message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            notification = json.loads(message)

            assert notification["type"] == "event_notification"
            assert notification["event"]["userId"] == "user123"
            assert notification["event"]["eventType"] == "cell_execution"
```

## 📊 パフォーマンステスト

### 負荷テスト
```python
# tests/performance/test_load.py
import pytest
import asyncio
import aiohttp
from concurrent.futures import ThreadPoolExecutor

class TestPerformance:

    @pytest.mark.asyncio
    async def test_concurrent_event_processing(self):
        """同時イベント処理の負荷テスト"""
        async def send_event(session, event_data):
            async with session.post(
                "http://localhost:8000/api/v1/events",
                json=event_data
            ) as response:
                return await response.json()

        event_data = {
            "eventType": "cell_execution",
            "userId": "user123",
            "userName": "田中太郎",
            "notebookPath": "/notebooks/lesson1.ipynb",
            "cellIndex": 5,
            "cellContent": "print('Hello')",
            "executionCount": 1,
            "executionDurationMs": 150,
            "hasError": False
        }

        async with aiohttp.ClientSession() as session:
            tasks = [send_event(session, event_data) for _ in range(100)]
            results = await asyncio.gather(*tasks)

            # 全てのリクエストが成功することを確認
            success_count = sum(1 for r in results if r.get("status") == "received")
            assert success_count == 100

    def test_websocket_connection_limit(self):
        """WebSocket接続数制限テスト"""
        # 最大接続数のテスト実装
        pass
```

## 🔧 テスト設定とユーティリティ

### pytest設定
```python
# conftest.py
import pytest
import asyncio
from fastapi.testclient import TestClient
from fastapi_server.main import app
from fastapi_server.database.connection import get_db_session

@pytest.fixture(scope="session")
def event_loop():
    """イベントループの設定"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def test_client():
    """テスト用FastAPIクライアント"""
    return TestClient(app)

@pytest.fixture
def mock_db_session():
    """モックデータベースセッション"""
    # テスト用のモックセッション実装
    pass

# テスト用の環境変数設定
@pytest.fixture(autouse=True)
def setup_test_environment(monkeypatch):
    """テスト環境の設定"""
    monkeypatch.setenv("TESTING", "true")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///:memory:")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6380")
```

### テストデータファクトリー
```python
# tests/factories.py
import factory
from datetime import datetime
from fastapi_server.database.models import User, Notebook, LearningSession

class UserFactory(factory.Factory):
    class Meta:
        model = User

    user_id = factory.Sequence(lambda n: f"user{n}")
    user_name = factory.Faker("name", locale="ja_JP")
    email = factory.LazyAttribute(lambda obj: f"{obj.user_id}@example.com")
    created_at = factory.LazyFunction(datetime.now)

class NotebookFactory(factory.Factory):
    class Meta:
        model = Notebook

    notebook_path = factory.Sequence(lambda n: f"/notebooks/lesson{n}.ipynb")
    title = factory.Faker("sentence", nb_words=3)
    total_cells = factory.Faker("random_int", min=5, max=20)
    created_at = factory.LazyFunction(datetime.now)

class EventDataFactory(factory.DictFactory):
    eventType = "cell_execution"
    userId = factory.Sequence(lambda n: f"user{n}")
    userName = factory.Faker("name", locale="ja_JP")
    notebookPath = "/notebooks/lesson1.ipynb"
    cellIndex = factory.Faker("random_int", min=0, max=10)
    cellContent = "print('Hello, World!')"
    executionCount = 1
    executionDurationMs = factory.Faker("random_int", min=50, max=5000)
    hasError = False
    timestamp = factory.LazyFunction(lambda: datetime.now().isoformat())
```

## 🚀 CI/CD統合

### GitHub Actions設定
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: cellmonitor_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v3

    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'

    - name: Install dependencies
      run: |
        pip install -r requirements.txt
        pip install -r requirements-test.txt

    - name: Run tests
      run: |
        pytest --cov=fastapi_server --cov-report=xml
      env:
        DATABASE_URL: postgresql://postgres:test_password@localhost:5432/cellmonitor_test
        REDIS_URL: redis://localhost:6379
        TESTING: true

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.xml
```

## 📈 テストメトリクス

### カバレッジ目標
- **単体テスト**: 95%以上
- **統合テスト**: 85%以上
- **全体カバレッジ**: 90%以上

### 品質ゲート
- **テスト成功率**: 100%
- **パフォーマンス**: API応答時間 < 100ms
- **セキュリティ**: 脆弱性スキャン通過

---

## 📚 関連ドキュメント

- [AI駆動開発ガイド](../ai-driven/README.md)
- [開発計画](../development/DEVELOPMENT_PLAN.md)
- [API仕様書](../api/README.md)
- [トラブルシューティング](../troubleshooting/README.md)
