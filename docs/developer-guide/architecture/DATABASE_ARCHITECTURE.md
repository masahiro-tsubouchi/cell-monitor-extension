# データベースアーキテクチャ詳細設計

> **設計方針**: ハイブリッドデータベース構成によるスケーラブルなリアルタイム分析
> **最終更新日**: 2025-01-18

## 🎯 設計目標

### スケーラビリティ要件
- **同時接続数**: 200+ 生徒の同時学習活動
- **データ処理量**: 毎秒数百のイベント処理
- **応答時間**: API応答 < 100ms, リアルタイム通知 < 1秒

### データ特性の分析
- **マスターデータ**: 変更頻度低、関係性重要、ACID特性必須
- **時系列データ**: 大量、高頻度、時間軸での分析重要
- **リアルタイムデータ**: 一時的、高速アクセス、揮発性許容

## 🏗️ ハイブリッドデータベース構成

### PostgreSQL（マスターデータストア）

```sql
-- ユーザー管理
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(200),
    role VARCHAR(50) DEFAULT 'student',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ノートブック管理
CREATE TABLE notebooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path VARCHAR(500) UNIQUE NOT NULL,
    title VARCHAR(200),
    description TEXT,
    cell_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- セッション管理
CREATE TABLE learning_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    notebook_id UUID REFERENCES notebooks(id),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    total_duration_ms BIGINT,
    cell_executions INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0
);

-- インデックス設計
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_notebooks_path ON notebooks(path);
CREATE INDEX idx_sessions_user_notebook ON learning_sessions(user_id, notebook_id);
CREATE INDEX idx_sessions_started_at ON learning_sessions(started_at);
```

### InfluxDB（時系列データストア）

```sql
-- セル実行イベント
-- Measurement: cell_executions
-- Tags: user_id, notebook_path, cell_index, event_type
-- Fields: execution_duration_ms, has_error, error_message, execution_count
-- Time: event_timestamp

-- 学習進捗メトリクス
-- Measurement: learning_progress
-- Tags: user_id, notebook_path
-- Fields: completed_cells, total_cells, progress_percentage, session_duration_ms
-- Time: progress_timestamp

-- パフォーマンスメトリクス
-- Measurement: performance_metrics
-- Tags: user_id, notebook_path, cell_type
-- Fields: avg_execution_time, max_execution_time, error_rate
-- Time: metric_timestamp
```

### Redis（リアルタイム通信・キャッシュ）

```redis
# Pub/Sub チャネル設計
PUBLISH progress_events '{"event_type": "cell_execution", "user_id": "...", "data": {...}}'
PUBLISH error_events '{"event_type": "execution_error", "user_id": "...", "data": {...}}'
PUBLISH session_events '{"event_type": "session_start", "user_id": "...", "data": {...}}'

# WebSocket接続管理
HSET websocket_connections connection_id user_id
HSET websocket_connections connection_id last_activity

# セッションキャッシュ
SETEX session:user_123 3600 '{"current_notebook": "...", "last_activity": "..."}'

# 集計データキャッシュ
SETEX class_summary:notebook_abc 300 '{"total_students": 25, "avg_progress": 0.75}'
```

## 🔄 データフロー設計

### 1. イベント受信・振り分け

```python
# FastAPI エンドポイント
@app.post("/api/v1/events")
async def receive_event(event: EventData):
    # 1. 即座にクライアントに応答
    await redis_client.publish("progress_events", event.json())
    return {"status": "received", "event_id": event.id}

# 非同期ワーカー
async def process_events():
    async for message in redis_client.subscribe("progress_events"):
        event = EventData.parse_raw(message)
        await route_event(event)

async def route_event(event: EventData):
    if event.event_type == "cell_execution":
        await store_cell_execution(event)
    elif event.event_type == "session_start":
        await store_session_data(event)
    # ... その他のイベントタイプ
```

### 2. データ永続化戦略

```python
async def store_cell_execution(event: CellExecutionEvent):
    # PostgreSQL: セッション情報更新
    await update_session_stats(event.user_id, event.notebook_path)

    # InfluxDB: 時系列データ保存
    point = Point("cell_executions") \
        .tag("user_id", event.user_id) \
        .tag("notebook_path", event.notebook_path) \
        .tag("cell_index", event.cell_index) \
        .field("execution_duration_ms", event.duration) \
        .field("has_error", event.has_error) \
        .time(event.timestamp)

    await influx_client.write_api().write(point=point)

    # Redis: リアルタイム通知
    await notify_websocket_clients(event)
```

## 📊 クエリパターン最適化

### 高頻度クエリの最適化

```sql
-- 1. クラス全体の進捗サマリー（キャッシュ活用）
SELECT
    u.username,
    ls.notebook_id,
    ls.cell_executions,
    ls.error_count,
    ls.total_duration_ms
FROM learning_sessions ls
JOIN users u ON ls.user_id = u.id
WHERE ls.started_at >= NOW() - INTERVAL '1 day'
ORDER BY ls.started_at DESC;

-- 2. 個別生徒の詳細進捗（インデックス活用）
SELECT * FROM learning_sessions
WHERE user_id = $1 AND notebook_id = $2
ORDER BY started_at DESC LIMIT 10;
```

### InfluxDB集計クエリ

```sql
-- 時間別の学習活動量
SELECT mean("execution_duration_ms") as avg_duration,
       count("execution_duration_ms") as execution_count
FROM "cell_executions"
WHERE time >= now() - 1h
GROUP BY time(10m), "user_id"

-- エラー率の推移
SELECT count("has_error") as error_count,
       count(*) as total_executions
FROM "cell_executions"
WHERE time >= now() - 24h
GROUP BY time(1h), "notebook_path"
```

## 🚀 パフォーマンス最適化

### データベース最適化

```sql
-- パーティショニング（PostgreSQL）
CREATE TABLE learning_sessions_2025_01 PARTITION OF learning_sessions
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- インデックス最適化
CREATE INDEX CONCURRENTLY idx_sessions_composite
ON learning_sessions (user_id, started_at DESC, notebook_id);

-- 統計情報更新
ANALYZE learning_sessions;
```

### Redis最適化

```redis
# 接続プール設定
redis_pool = aioredis.ConnectionPool.from_url(
    "redis://localhost:6379",
    max_connections=20,
    retry_on_timeout=True
)

# パイプライン処理
pipe = redis_client.pipeline()
pipe.hset("session:123", "last_activity", timestamp)
pipe.expire("session:123", 3600)
await pipe.execute()
```

## 🔧 運用・監視

### データベースヘルスチェック

```python
async def check_database_health():
    checks = {
        "postgresql": await check_postgres_connection(),
        "influxdb": await check_influx_connection(),
        "redis": await check_redis_connection()
    }
    return checks

async def check_postgres_connection():
    try:
        result = await db.execute("SELECT 1")
        return {"status": "healthy", "response_time": "..."}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}
```

### メトリクス収集

```python
# Prometheus メトリクス
database_query_duration = Histogram(
    'database_query_duration_seconds',
    'Database query duration',
    ['database', 'query_type']
)

database_connection_pool = Gauge(
    'database_connection_pool_size',
    'Database connection pool size',
    ['database']
)
```

## 🔒 セキュリティ考慮

### データ暗号化

```python
# 機密データの暗号化
from cryptography.fernet import Fernet

class EncryptedField:
    def __init__(self, key: bytes):
        self.cipher = Fernet(key)

    def encrypt(self, data: str) -> str:
        return self.cipher.encrypt(data.encode()).decode()

    def decrypt(self, encrypted_data: str) -> str:
        return self.cipher.decrypt(encrypted_data.encode()).decode()
```

### アクセス制御

```sql
-- データベースロール設計
CREATE ROLE app_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_reader;

CREATE ROLE app_writer;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_writer;

-- 行レベルセキュリティ
ALTER TABLE learning_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_data_policy ON learning_sessions
    FOR ALL TO app_user
    USING (user_id = current_setting('app.current_user_id')::uuid);
```

## 📈 スケーリング戦略

### 読み取り専用レプリカ

```yaml
# docker-compose.yml
services:
  postgres-primary:
    image: postgres:15
    environment:
      POSTGRES_REPLICATION_MODE: master

  postgres-replica:
    image: postgres:15
    environment:
      POSTGRES_REPLICATION_MODE: slave
      POSTGRES_MASTER_SERVICE: postgres-primary
```

### シャーディング戦略

```python
# ユーザーIDベースのシャーディング
def get_shard_key(user_id: str) -> str:
    hash_value = hashlib.md5(user_id.encode()).hexdigest()
    shard_num = int(hash_value[:8], 16) % SHARD_COUNT
    return f"shard_{shard_num}"

async def get_user_database(user_id: str):
    shard_key = get_shard_key(user_id)
    return database_connections[shard_key]
```

---

## 📚 関連ドキュメント

- [システムアーキテクチャ概要](./README.md)
- [データベース比較分析](./DATABASE_COMPARISON.md)
- [パフォーマンス最適化ガイド](./PERFORMANCE.md)
- [セキュリティ設計](./SECURITY.md)
