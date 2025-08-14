# トラブルシューティングガイド

> **対象**: 開発者・運用担当者
> **最終更新日**: 2025-01-18
> **緊急度**: 高・中・低で分類

## 🚨 緊急度別問題分類

### 🔴 高緊急度（即座に対応が必要）
- システム全体の停止
- データ損失の可能性
- セキュリティインシデント
- 大量のエラー発生

### 🟡 中緊急度（24時間以内に対応）
- 一部機能の停止
- パフォーマンス劣化
- 接続エラーの頻発
- ログの異常

### 🟢 低緊急度（計画的に対応）
- 軽微な機能不具合
- UI/UXの改善
- ドキュメントの更新
- 最適化の提案

## 🔧 一般的な問題と解決方法

### 1. Docker環境の問題

#### 問題: コンテナが起動しない
```bash
# 症状
docker-compose up -d
# エラー: container failed to start

# 診断手順
docker-compose logs [service_name]
docker ps -a
docker system df

# 解決方法
# 1. ログの確認
docker-compose logs --tail=50 postgres
docker-compose logs --tail=50 redis
docker-compose logs --tail=50 influxdb

# 2. ポート競合の確認
sudo lsof -i :5432  # PostgreSQL
sudo lsof -i :6379  # Redis
sudo lsof -i :8086  # InfluxDB

# 3. 環境のクリーンアップ
docker-compose down -v
docker system prune -f
docker-compose up -d
```

#### 問題: データベース接続エラー
```bash
# 症状
sqlalchemy.exc.OperationalError: could not connect to server

# 診断手順
# 1. コンテナの状態確認
docker-compose ps

# 2. ネットワーク確認
docker network ls
docker network inspect jupyter-extensionver2_default

# 3. 接続テスト
docker-compose exec postgres psql -U cellmonitor_user -d cellmonitor_db

# 解決方法
# 1. 環境変数の確認
echo $DATABASE_URL
echo $POSTGRES_USER
echo $POSTGRES_PASSWORD

# 2. 接続文字列の修正
# 正しい形式: postgresql://user:password@host:port/database
DATABASE_URL=postgresql://cellmonitor_user:cellmonitor_password@postgres:5432/cellmonitor_db

# 3. コンテナの再起動
docker-compose restart postgres
docker-compose restart fastapi
```

### 2. FastAPI サーバーの問題

#### 問題: API エンドポイントが応答しない
```bash
# 症状
curl: (7) Failed to connect to localhost port 8000

# 診断手順
# 1. サーバーの状態確認
docker-compose logs fastapi

# 2. ポート確認
docker-compose ps
netstat -tlnp | grep 8000

# 3. ヘルスチェック
curl http://localhost:8000/health
curl http://localhost:8000/docs

# 解決方法
# 1. サーバーの再起動
docker-compose restart fastapi

# 2. ログレベルの調整
# main.py で DEBUG レベルに設定
import logging
logging.basicConfig(level=logging.DEBUG)

# 3. 依存関係の確認
pip list | grep fastapi
pip list | grep uvicorn
```

#### 問題: Redis 接続エラー
```python
# 症状
redis.exceptions.ConnectionError: Error 111 connecting to redis:6379

# 診断手順
# 1. Redis サーバーの状態確認
docker-compose exec redis redis-cli ping

# 2. 接続設定の確認
import redis
r = redis.Redis(host='localhost', port=6379, db=0)
r.ping()

# 解決方法
# 1. Redis コンテナの再起動
docker-compose restart redis

# 2. 接続プールの設定
import redis
pool = redis.ConnectionPool(
    host='redis',
    port=6379,
    db=0,
    max_connections=20,
    retry_on_timeout=True
)
r = redis.Redis(connection_pool=pool)

# 3. 接続タイムアウトの調整
r = redis.Redis(
    host='redis',
    port=6379,
    socket_timeout=5,
    socket_connect_timeout=5
)
```

### 3. JupyterLab 拡張機能の問題

#### 問題: 拡張機能が読み込まれない
```bash
# 症状
JupyterLab に拡張機能が表示されない

# 診断手順
# 1. 拡張機能の状態確認
jupyter labextension list

# 2. ビルド状況の確認
jupyter lab build --dev-build=False --minimize=False

# 3. ログの確認
jupyter lab --debug

# 解決方法
# 1. 拡張機能の再インストール
cd cell-monitor-extension
npm install
npm run build
jupyter labextension install .

# 2. JupyterLab の再ビルド
jupyter lab clean
jupyter lab build

# 3. キャッシュのクリア
jupyter lab --dev-mode=False
```

#### 問題: イベントが送信されない
```javascript
// 症状
console.log に "Event sent" が表示されない

// 診断手順
// 1. ブラウザの開発者ツールでネットワークタブを確認
// 2. コンソールエラーの確認
// 3. FastAPI サーバーのログ確認

// 解決方法
// 1. CORS 設定の確認
// FastAPI main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8888"],  // JupyterLab のURL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

// 2. エンドポイント URL の確認
// extension/src/index.ts
const API_BASE_URL = 'http://localhost:8000/api/v1';

// 3. エラーハンドリングの追加
try {
    const response = await fetch(`${API_BASE_URL}/events`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('Event sent successfully');
} catch (error) {
    console.error('Failed to send event:', error);
}
```

### 4. データベース関連の問題

#### 問題: PostgreSQL のパフォーマンス劣化
```sql
-- 症状
-- クエリの実行時間が異常に長い

-- 診断手順
-- 1. 実行中のクエリの確認
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';

-- 2. インデックスの使用状況確認
SELECT
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE tablename = 'learning_sessions';

-- 3. テーブルサイズの確認
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 解決方法
-- 1. インデックスの追加
CREATE INDEX idx_learning_sessions_user_id ON learning_sessions(user_id);
CREATE INDEX idx_learning_sessions_timestamp ON learning_sessions(created_at);
CREATE INDEX idx_learning_sessions_notebook ON learning_sessions(notebook_path);

-- 2. 統計情報の更新
ANALYZE learning_sessions;
ANALYZE users;
ANALYZE notebooks;

-- 3. 不要なデータの削除
DELETE FROM learning_sessions
WHERE created_at < NOW() - INTERVAL '6 months';

-- 4. VACUUM の実行
VACUUM ANALYZE learning_sessions;
```

#### 問題: InfluxDB の書き込みエラー
```python
# 症状
influxdb_client.rest.ApiException: (400) Bad Request

# 診断手順
# 1. InfluxDB の状態確認
docker-compose exec influxdb influx ping

# 2. バケットの確認
docker-compose exec influxdb influx bucket list

# 3. 書き込み権限の確認
docker-compose exec influxdb influx auth list

# 解決方法
# 1. バケットの作成
from influxdb_client import InfluxDBClient

client = InfluxDBClient(
    url="http://localhost:8086",
    token="your-token",
    org="your-org"
)

# バケットの作成
buckets_api = client.buckets_api()
bucket = buckets_api.create_bucket(
    bucket_name="cellmonitor",
    org="your-org"
)

# 2. データフォーマットの確認
from influxdb_client import Point

point = Point("cell_execution") \
    .tag("user_id", "user123") \
    .tag("notebook", "lesson1") \
    .field("duration_ms", 150) \
    .field("has_error", False) \
    .time(datetime.utcnow(), WritePrecision.NS)

# 3. バッチ書き込みの実装
write_api = client.write_api(write_options=SYNCHRONOUS)
points = []
for event in events:
    point = Point("cell_execution") \
        .tag("user_id", event["userId"]) \
        .field("duration_ms", event["executionDurationMs"])
    points.append(point)

write_api.write(bucket="cellmonitor", record=points)
```

### 5. WebSocket 接続の問題

#### 問題: WebSocket 接続が頻繁に切断される
```javascript
// 症状
WebSocket connection closed unexpectedly

// 診断手順
// 1. ブラウザの開発者ツールでWebSocketログを確認
// 2. サーバーサイドのWebSocketログを確認
// 3. ネットワーク状況の確認

// 解決方法
// 1. 再接続機能の実装
class WebSocketManager {
    constructor(url) {
        this.url = url;
        this.reconnectInterval = 5000;
        this.maxReconnectAttempts = 10;
        this.reconnectAttempts = 0;
        this.connect();
    }

    connect() {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.reconnectAttempts = 0;
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.reconnect();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    reconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
                console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                this.connect();
            }, this.reconnectInterval);
        }
    }
}

// 2. ハートビート機能の実装
// サーバーサイド (FastAPI)
@app.websocket("/ws/dashboard")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # ハートビート送信
            await websocket.send_json({"type": "heartbeat"})
            await asyncio.sleep(30)  # 30秒間隔
    except WebSocketDisconnect:
        print("WebSocket disconnected")

// クライアントサイド
this.ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'heartbeat') {
        // ハートビートの応答
        this.ws.send(JSON.stringify({type: 'heartbeat_response'}));
    }
};
```

## 🔍 デバッグ手法

### 1. ログレベルの調整
```python
# FastAPI サーバーのログ設定
import logging

# 開発環境
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# 本番環境
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# 特定のモジュールのログレベル調整
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
logging.getLogger('redis').setLevel(logging.WARNING)
```

### 2. パフォーマンス監視
```python
# 実行時間の測定
import time
import functools

def measure_time(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        end_time = time.time()
        print(f"{func.__name__} took {end_time - start_time:.4f} seconds")
        return result
    return wrapper

@measure_time
def process_event(event_data):
    # 処理の実装
    pass

# メモリ使用量の監視
import psutil
import os

def log_memory_usage():
    process = psutil.Process(os.getpid())
    memory_info = process.memory_info()
    print(f"Memory usage: {memory_info.rss / 1024 / 1024:.2f} MB")

# CPU使用率の監視
def log_cpu_usage():
    cpu_percent = psutil.cpu_percent(interval=1)
    print(f"CPU usage: {cpu_percent}%")
```

### 3. データベースクエリの最適化
```python
# SQLAlchemy クエリの実行計画確認
from sqlalchemy import text

# EXPLAIN の実行
result = session.execute(
    text("EXPLAIN ANALYZE SELECT * FROM learning_sessions WHERE user_id = :user_id"),
    {"user_id": "user123"}
)
for row in result:
    print(row)

# スロークエリの特定
import time
from sqlalchemy import event
from sqlalchemy.engine import Engine

@event.listens_for(Engine, "before_cursor_execute")
def receive_before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    context._query_start_time = time.time()

@event.listens_for(Engine, "after_cursor_execute")
def receive_after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    total = time.time() - context._query_start_time
    if total > 0.1:  # 100ms以上のクエリをログ出力
        print(f"Slow query: {total:.4f}s - {statement[:100]}...")
```

## 📊 監視とアラート

### 1. ヘルスチェックエンドポイント
```python
# FastAPI ヘルスチェック
@app.get("/health")
async def health_check():
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {}
    }

    # PostgreSQL の確認
    try:
        db_session.execute(text("SELECT 1"))
        health_status["services"]["postgresql"] = "healthy"
    except Exception as e:
        health_status["services"]["postgresql"] = f"unhealthy: {str(e)}"
        health_status["status"] = "unhealthy"

    # Redis の確認
    try:
        redis_client.ping()
        health_status["services"]["redis"] = "healthy"
    except Exception as e:
        health_status["services"]["redis"] = f"unhealthy: {str(e)}"
        health_status["status"] = "unhealthy"

    # InfluxDB の確認
    try:
        influx_client.ping()
        health_status["services"]["influxdb"] = "healthy"
    except Exception as e:
        health_status["services"]["influxdb"] = f"unhealthy: {str(e)}"
        health_status["status"] = "unhealthy"

    return health_status
```

### 2. メトリクス収集
```python
# Prometheus メトリクス
from prometheus_client import Counter, Histogram, Gauge

# カウンター
event_counter = Counter('events_total', 'Total number of events', ['event_type'])
error_counter = Counter('errors_total', 'Total number of errors', ['error_type'])

# ヒストグラム
request_duration = Histogram('request_duration_seconds', 'Request duration')
db_query_duration = Histogram('db_query_duration_seconds', 'Database query duration')

# ゲージ
active_connections = Gauge('active_connections', 'Number of active connections')

# 使用例
@app.post("/api/v1/events")
async def receive_event(event_data: dict):
    with request_duration.time():
        event_counter.labels(event_type=event_data['eventType']).inc()

        try:
            # イベント処理
            result = process_event(event_data)
            return result
        except Exception as e:
            error_counter.labels(error_type=type(e).__name__).inc()
            raise
```

## 🚀 パフォーマンス最適化

### 1. データベース最適化
```sql
-- インデックス戦略
CREATE INDEX CONCURRENTLY idx_learning_sessions_user_timestamp
ON learning_sessions(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_learning_sessions_notebook_timestamp
ON learning_sessions(notebook_path, created_at DESC);

-- パーティショニング（大量データ対応）
CREATE TABLE learning_sessions_2025_01 PARTITION OF learning_sessions
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- 統計情報の自動更新
ALTER TABLE learning_sessions SET (autovacuum_analyze_scale_factor = 0.02);
```

### 2. Redis 最適化
```python
# 接続プールの設定
import redis

pool = redis.ConnectionPool(
    host='redis',
    port=6379,
    db=0,
    max_connections=50,
    retry_on_timeout=True,
    health_check_interval=30
)

redis_client = redis.Redis(connection_pool=pool)

# パイプライン処理
pipe = redis_client.pipeline()
for event in events:
    pipe.publish('events', json.dumps(event))
pipe.execute()
```

### 3. FastAPI 最適化
```python
# 非同期処理の活用
import asyncio
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=10)

@app.post("/api/v1/events")
async def receive_event(event_data: dict):
    # 即座にレスポンスを返す
    event_id = generate_event_id()

    # バックグラウンドで処理
    asyncio.create_task(process_event_async(event_data, event_id))

    return {"status": "received", "event_id": event_id}

async def process_event_async(event_data: dict, event_id: str):
    # 重い処理を別スレッドで実行
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(executor, heavy_processing, event_data)
```

---

## 📞 サポート情報

### 開発チーム連絡先
- **メインメンテナー**: [連絡先情報]
- **緊急時連絡**: [緊急連絡先]
- **Issue報告**: [GitHubリポジトリURL]

### 関連リソース
- [システム監視ダッシュボード](http://monitoring.example.com)
- [ログ集約システム](http://logs.example.com)
- [API ドキュメント](http://localhost:8000/docs)

---

## 📚 関連ドキュメント

- [システムアーキテクチャ](../architecture/README.md)
- [API仕様書](../api/README.md)
- [テスト戦略](../testing/README.md)
- [開発計画](../development/DEVELOPMENT_PLAN.md)
