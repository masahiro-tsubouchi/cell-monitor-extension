# パフォーマンス要件・検討資料

> **対象利用者数**: 200ユーザー
> **作成日**: 2025-01-19
> **対象**: システム設計・運用担当者

## 📊 利用者数に基づく要件定義

### 基本前提
- **同時利用者数**: 200名
- **ピーク時同時接続**: 150名（75%）
- **平均セッション時間**: 2時間
- **1セッションあたりセル実行数**: 50回
- **ノートブック保存頻度**: 10分に1回

## 🎯 パフォーマンス目標値

### レスポンス時間
| 機能 | 目標値 | 許容値 |
|------|--------|--------|
| イベント受信API | < 100ms | < 500ms |
| WebSocket通知 | < 50ms | < 200ms |
| ダッシュボード表示 | < 2秒 | < 5秒 |
| データ検索・集計 | < 3秒 | < 10秒 |

### スループット
| 指標 | 目標値 | ピーク値 |
|------|--------|----------|
| API リクエスト/秒 | 100 req/s | 300 req/s |
| イベント処理/秒 | 200 events/s | 500 events/s |
| 同時WebSocket接続 | 150接続 | 200接続 |
| データベース書き込み/秒 | 100 writes/s | 300 writes/s |

### 可用性
- **稼働率**: 99.5%以上
- **計画停止**: 月1回・2時間以内
- **障害復旧時間**: 15分以内

## 🏗️ システム構成設計

### 推奨ハードウェア仕様

#### FastAPIアプリケーションサーバー
```yaml
CPU: 4コア（8vCPU）
メモリ: 8GB
ストレージ: 50GB SSD
ネットワーク: 1Gbps
```

#### PostgreSQLデータベース
```yaml
CPU: 4コア（8vCPU）
メモリ: 16GB
ストレージ: 200GB SSD（IOPS 3000以上）
ネットワーク: 1Gbps
```

#### InfluxDBデータベース
```yaml
CPU: 2コア（4vCPU）
メモリ: 8GB
ストレージ: 500GB SSD（時系列データ保存）
ネットワーク: 1Gbps
```

#### Redis
```yaml
CPU: 2コア（4vCPU）
メモリ: 4GB
ストレージ: 20GB SSD
ネットワーク: 1Gbps
```

### Docker構成例
```yaml
# docker-compose.prod.yml
services:
  fastapi:
    image: cell-monitor-api:latest
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G

  postgres:
    image: postgres:15
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 16G
        reservations:
          cpus: '2.0'
          memory: 8G

  influxdb:
    image: influxdb:2.7
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 8G
        reservations:
          cpus: '1.0'
          memory: 4G

  redis:
    image: redis:7-alpine
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 4G
        reservations:
          cpus: '0.5'
          memory: 2G
```

## 📈 負荷分析・容量設計

### データ量見積もり

#### 1日あたりのデータ生成量
```
200ユーザー × 2時間/日 × 50セル実行/セッション = 20,000イベント/日
20,000イベント × 365日 = 7,300,000イベント/年
```

#### データベース容量見積もり

**PostgreSQL（構造化データ）**
```
学生データ: 200レコード × 1KB = 200KB
セッションデータ: 200セッション/日 × 365日 × 2KB = 146MB/年
セル実行履歴: 7,300,000レコード × 5KB = 36.5GB/年
その他テーブル: 5GB/年
合計: 約42GB/年
```

**InfluxDB（時系列データ）**
```
イベントデータ: 7,300,000レコード × 2KB = 14.6GB/年
圧縮率: 約30% → 4.4GB/年（実際の使用量）
```

**Redis（キャッシュ・Pub/Sub）**
```
アクティブセッション: 150セッション × 10KB = 1.5MB
Pub/Subバッファ: 10MB
合計: 約20MB
```

### ネットワーク帯域幅

#### ピーク時トラフィック
```
API リクエスト: 300 req/s × 5KB = 1.5MB/s
WebSocket通知: 150接続 × 1KB/s = 150KB/s
ダッシュボード: 20接続 × 100KB/s = 2MB/s
合計: 約4MB/s（32Mbps）
```

## ⚡ パフォーマンス最適化戦略

### アプリケーション層

#### 1. 非同期処理の活用
```python
# 現在の実装（最適化済み）
@app.post("/api/v1/events")
async def receive_events(events: List[EventData]):
    # 即座にレスポンス返却
    # バックグラウンドでRedis Pub/Sub経由処理
    for event in events:
        await redis_client.publish(CHANNEL, event.model_dump_json())
    return {"message": f"{len(events)} events queued"}
```

#### 2. 接続プール設定
```python
# PostgreSQL接続プール
engine = create_engine(
    DATABASE_URL,
    pool_size=20,          # 基本接続数
    max_overflow=30,       # 最大追加接続数
    pool_pre_ping=True,    # 接続確認
    pool_recycle=3600      # 1時間で接続リサイクル
)

# Redis接続プール
redis_pool = ConnectionPool(
    host=REDIS_HOST,
    port=REDIS_PORT,
    max_connections=50,
    retry_on_timeout=True
)
```

#### 3. バッチ処理の実装
```python
# InfluxDBバッチ書き込み
async def batch_write_events(events: List[EventData]):
    if len(events) >= BATCH_SIZE or time_since_last_write > MAX_WAIT:
        await influxdb_client.write_batch(events)
```

### データベース層

#### PostgreSQL最適化
```sql
-- インデックス設計
CREATE INDEX CONCURRENTLY idx_cell_executions_user_time
ON cell_executions (student_id, executed_at DESC);

CREATE INDEX CONCURRENTLY idx_sessions_active
ON sessions (is_active, start_time) WHERE is_active = true;

-- パーティショニング（大量データ対応）
CREATE TABLE cell_executions_y2025m01 PARTITION OF cell_executions
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

#### InfluxDB最適化
```python
# 適切なタグ設計（カーディナリティ制御）
point = Point("student_progress")
    .tag("userId", user_id)           # 200値
    .tag("event", event_type)         # 10値程度
    .tag("notebook", notebook_name)   # 100値程度
    .field("cellId", cell_id)         # 高カーディナリティはfield
```

### インフラ層

#### 1. ロードバランサー設定
```nginx
upstream fastapi_backend {
    server fastapi1:8000 weight=1;
    server fastapi2:8000 weight=1;
    keepalive 32;
}

server {
    location /api/ {
        proxy_pass http://fastapi_backend;
        proxy_set_header Connection "";
        proxy_http_version 1.1;
    }
}
```

#### 2. キャッシュ戦略
```python
# Redis キャッシュ活用
@cache(expire=300)  # 5分キャッシュ
async def get_user_dashboard_data(user_id: str):
    # 重い集計クエリをキャッシュ
    return await aggregate_user_progress(user_id)
```

## 📊 監視・メトリクス

### 必須監視項目

#### アプリケーションメトリクス
- **レスポンス時間**: P50, P95, P99
- **エラー率**: 4xx, 5xx エラー率
- **スループット**: RPS（Requests Per Second）
- **アクティブ接続数**: WebSocket接続数

#### システムメトリクス
- **CPU使用率**: 各コンテナ・ホスト
- **メモリ使用率**: 各コンテナ・ホスト
- **ディスクI/O**: IOPS, 使用率
- **ネットワーク**: 帯域幅使用率

#### データベースメトリクス
- **接続数**: アクティブ・アイドル接続
- **クエリ実行時間**: スロークエリ監視
- **ロック待機**: デッドロック検出
- **レプリケーション遅延**: 読み書き分離時

### 監視ツール構成例

#### Prometheus + Grafana
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'fastapi'
    static_configs:
      - targets: ['fastapi:8000']
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres_exporter:9187']
  - job_name: 'redis'
    static_configs:
      - targets: ['redis_exporter:9121']
```

#### アラート設定例
```yaml
# alerts.yml
groups:
  - name: cell_monitor_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
```

## 🔧 スケーリング戦略

### 水平スケーリング

#### 1. アプリケーション層
```bash
# FastAPIインスタンス追加
docker-compose scale fastapi=4
```

#### 2. データベース層
```yaml
# PostgreSQL読み書き分離
services:
  postgres_master:
    image: postgres:15
    environment:
      - POSTGRES_REPLICATION_MODE=master

  postgres_slave:
    image: postgres:15
    environment:
      - POSTGRES_REPLICATION_MODE=slave
      - POSTGRES_MASTER_SERVICE=postgres_master
```

### 垂直スケーリング

#### リソース増強指標
| 指標 | CPU増強 | メモリ増強 | ストレージ増強 |
|------|---------|------------|----------------|
| CPU使用率 > 80% | ✓ | | |
| メモリ使用率 > 85% | | ✓ | |
| ディスクI/O > 80% | | | ✓ |
| レスポンス時間悪化 | ✓ | ✓ | |

## 🚨 障害対応・復旧計画

### 障害レベル定義

#### レベル1（軽微）
- **影響**: 一部機能の性能劣化
- **対応時間**: 4時間以内
- **例**: レスポンス時間の軽微な悪化

#### レベル2（中程度）
- **影響**: 主要機能の利用困難
- **対応時間**: 1時間以内
- **例**: データベース接続エラー

#### レベル3（重大）
- **影響**: サービス全体停止
- **対応時間**: 15分以内
- **例**: アプリケーション全体クラッシュ

### 復旧手順

#### 1. 自動復旧機能
```yaml
# docker-compose.yml
services:
  fastapi:
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/"]
      interval: 30s
      timeout: 10s
      retries: 3
```

#### 2. データバックアップ・復旧
```bash
# PostgreSQL バックアップ
pg_dump -h postgres -U admin progress_db > backup_$(date +%Y%m%d).sql

# InfluxDB バックアップ
influx backup /backup/influxdb_$(date +%Y%m%d)

# 復旧
psql -h postgres -U admin progress_db < backup_20250119.sql
influx restore /backup/influxdb_20250119
```

## 💰 コスト見積もり

### クラウド環境（AWS想定）

#### 月額コスト見積もり
| リソース | スペック | 月額コスト |
|----------|----------|------------|
| EC2 (FastAPI) | t3.large × 2 | $120 |
| RDS (PostgreSQL) | db.t3.large | $180 |
| EC2 (InfluxDB) | t3.medium | $60 |
| ElastiCache (Redis) | cache.t3.micro | $25 |
| ALB | Application Load Balancer | $25 |
| EBS | 1TB SSD | $100 |
| データ転送 | 500GB/月 | $45 |
| **合計** | | **約$555/月** |

### オンプレミス環境

#### 初期投資
| 項目 | スペック | 概算コスト |
|------|----------|------------|
| サーバー | 16コア/64GB/2TB SSD | $8,000 |
| ネットワーク機器 | L3スイッチ・FW | $3,000 |
| UPS・ラック | 冗長化対応 | $2,000 |
| **合計** | | **約$13,000** |

#### 運用コスト（月額）
- 電気代: $100
- 保守費用: $200
- 人件費: $500
- **合計**: 約$800/月

## 📋 実装チェックリスト

### パフォーマンス対応
- [x] 非同期処理実装
- [x] Redis Pub/Sub実装
- [x] バックグラウンドワーカー実装
- [x] 接続プール設定
- [ ] バッチ処理最適化
- [ ] インデックス最適化
- [ ] キャッシュ戦略実装

### 監視・運用
- [ ] Prometheus/Grafana導入
- [ ] アラート設定
- [ ] ログ集約システム
- [ ] バックアップ自動化
- [ ] 復旧手順書作成

### スケーラビリティ
- [ ] ロードバランサー設定
- [ ] 読み書き分離対応
- [ ] 水平スケーリング検証
- [ ] 負荷テスト実施

## 🔮 将来の拡張計画

### フェーズ2（500ユーザー対応）
- マイクロサービス化
- Kubernetes導入
- CDN活用
- 地理的分散

### フェーズ3（1000ユーザー対応）
- イベントストリーミング（Apache Kafka）
- 機械学習基盤連携
- リアルタイム分析強化
- グローバル展開対応

## 📚 参考資料

- [FastAPI Performance Best Practices](https://fastapi.tiangolo.com/deployment/)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [InfluxDB Performance Guide](https://docs.influxdata.com/influxdb/v2.7/write-data/best-practices/)
- [Redis Performance Optimization](https://redis.io/docs/management/optimization/)
