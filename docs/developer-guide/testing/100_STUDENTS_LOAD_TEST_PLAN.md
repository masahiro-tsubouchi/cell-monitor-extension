# 100人受講生データ格納テスト：包括的テスト計画書

> **プロジェクト**: Cell Monitor Extension
> **作成日**: 2025-01-19
> **基盤**: 186個テストケース成功の実績
> **目的**: 100人同時受講環境での安定したデータ格納・処理の品質保証

## 🎯 テスト戦略概要

### **基盤となる成功実績**
- **Environment API**: 19個全成功 ✅
- **Notebook Version API**: 22個全成功 ✅
- **LMS統合テスト**: 9個全成功 ✅
- **WebSocket統合**: 13個全成功 ✅
- **講師ログイン機能**: 123個全成功 ✅
- **合計**: **186個テストケース完全成功** 🎯

### **テスト目標**
1. **パフォーマンス**: 100人同時で1000イベント/秒以上
2. **レスポンス時間**: 95パーセンタイルで500ms以内
3. **エラー率**: 0.1%以下
4. **データ整合性**: PostgreSQL-InfluxDB間100%一致
5. **リソース使用量**: メモリ4GB以内、CPU80%以内

## 🔧 パフォーマンス監視ユーティリティ使用方法

### **監視ユーティリティ概要**

新たに実装された `tests/utils/performance_monitor.py` は、100人受講生テスト専用のリアルタイム監視機能を提供します。既存の186個テストケース成功パターンを活用し、システムリソース・パフォーマンス・データ整合性を包括的に監視します。

### **基本使用方法**

#### 1. 基本的な監視開始
```python
from tests.utils.performance_monitor import PerformanceMonitor

# 基本監視の開始
monitor = PerformanceMonitor()
await monitor.initialize_connections()

# 監視開始（1秒間隔）
await monitor.start_monitoring(interval_seconds=1.0)

# テスト実行...

# 監視停止
monitor.stop_monitoring()

# パフォーマンス要約取得
summary = monitor.get_performance_summary()
print(f"システム状態: {summary['health_status']}")
```

#### 2. 負荷テスト専用監視
```python
from tests.utils.performance_monitor import LoadTestMonitor

# 負荷テスト監視（高頻度0.5秒間隔）
monitor = LoadTestMonitor("100_students_phase_5", expected_load=100)
await monitor.initialize_connections()
await monitor.start_load_test_monitoring()

# 100人受講生シミュレーション実行
# ...

# 監視終了とレポート生成
monitor.finish_load_test_monitoring()
report = monitor.generate_load_test_report()

# 成功基準チェック
success_criteria = report["success_criteria"]
assert success_criteria["cpu_under_80_percent"], "CPU使用率が80%を超過"
assert success_criteria["response_time_under_500ms"], "レスポンス時間が500msを超過"
```

#### 3. テストケース統合例
```python
@pytest.mark.asyncio
async def test_100_students_with_monitoring():
    """100人受講生テスト（監視統合版）"""

    # 監視開始
    monitor = LoadTestMonitor("100_students_full_test", expected_load=100)
    await monitor.initialize_connections()
    await monitor.start_load_test_monitoring()

    try:
        # 100人分のイベントデータ生成
        from tests.utils.data_generator import StudentDataGenerator
        generator = StudentDataGenerator()

        # フェーズ1: 10人（ベースライン）
        events_10 = generator.generate_classroom_session(num_students=10)
        await send_events_batch(events_10)

        # フェーズ2-5: 段階的負荷増加
        for phase, num_students in [(2, 25), (3, 50), (4, 75), (5, 100)]:
            events = generator.generate_classroom_session(num_students=num_students)
            await send_events_batch(events)

            # 各フェーズでヘルスチェック
            current_metrics = await monitor.collect_current_metrics()
            health = monitor.analyze_system_health(current_metrics)
            assert health.overall_status != "critical", f"Phase {phase}: システム状態がクリティカル"

    finally:
        # 監視終了
        monitor.finish_load_test_monitoring()

        # 詳細レポート生成
        report = monitor.generate_load_test_report()

        # メトリクスをJSONで保存
        monitor.export_metrics_to_json(f"test_results/100_students_metrics_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")

        # 成功基準検証
        assert report["success_criteria"]["cpu_under_80_percent"]
        assert report["success_criteria"]["memory_under_4gb"]
        assert report["success_criteria"]["response_time_under_500ms"]
        assert report["success_criteria"]["error_rate_under_0_1_percent"]
```

### **監視メトリクス詳細**

#### システムリソース
- **CPU使用率**: リアルタイム監視、警告(70%)・クリティカル(85%)しきい値
- **メモリ使用量**: 使用率とMB単位での使用量
- **ディスクI/O**: 読み書きMB/秒
- **ネットワークI/O**: 送受信MB/秒

#### データベース接続
- **Redis接続数**: アクティブクライアント接続数
- **PostgreSQL接続数**: アクティブセッション数
- **InfluxDB**: データポイント数（設定時）

#### パフォーマンス指標
- **レスポンス時間**: API エンドポイントの応答時間（ms）
- **スループット**: イベント処理数/秒
- **エラー率**: 全リクエストに対するエラーの割合
- **WebSocket接続数**: アクティブなWebSocket接続数

### **アラート・しきい値設定**

```python
# カスタムしきい値設定例
monitor = PerformanceMonitor()
monitor.thresholds.update({
    "cpu_warning": 60.0,      # CPU警告レベルを60%に下げる
    "cpu_critical": 75.0,     # CPU危険レベルを75%に下げる
    "memory_warning": 60.0,   # メモリ警告レベル
    "response_time_warning": 800.0,  # レスポンス時間警告（800ms）
    "error_rate_critical": 0.02,     # エラー率危険レベル（2%）
})
```

### **レポート出力とデバッグ**

```python
# 詳細レポート例
report = monitor.generate_load_test_report()
print(json.dumps(report, indent=2, ensure_ascii=False))

# 出力例:
{
  "test_name": "100_students_phase_5",
  "expected_load": 100,
  "test_duration_seconds": 120.5,
  "performance_summary": {
    "latest_metrics": {...},
    "statistics": {
      "cpu": {"current": 45.2, "average": 38.7, "peak": 67.3},
      "memory": {"current": 52.1, "average": 48.9, "peak": 58.7}
    }
  },
  "success_criteria": {
    "cpu_under_80_percent": true,
    "memory_under_4gb": true,
    "response_time_under_500ms": true,
    "error_rate_under_0_1_percent": true
  }
}
```

## 🏗️ テスト実装戦略

### **Phase 1: 基盤テスト（既存パターン活用）**

#### 1.1 オフライン同期APIパターン適用
```python
# tests/load/test_offline_sync_pattern.py
# 既存の11個全成功パターンを100人規模に適用

async def test_100_students_offline_sync():
    """オフライン同期APIの成功パターンを100人規模で適用"""
    # 既存成功パターン: モック戻り値の実装整合性
    # 既存成功パターン: レスポンス形式の正確な把握
    # 既存成功パターン: 体系的なエラー解決

    students = generate_test_students(100)
    offline_events = []

    for student in students:
        events = simulate_offline_session(student, duration_minutes=30)
        offline_events.extend(events)

    # バッチ同期実行
    sync_results = await bulk_sync_offline_events(offline_events)

    # 成功パターン検証
    assert all(result.success for result in sync_results)
    assert len(sync_results) == len(offline_events)
```

#### 1.2 LMS統合テストパターン適用
```python
# tests/load/test_lms_integration_pattern.py
# 既存の9個全成功パターンを100人規模に適用

async def test_100_students_lms_integration():
    """LMS統合テストの成功パターンを100人規模で適用"""
    # 既存成功パターン: 外部キー制約エラー修正
    # 既存成功パターン: ユニーク制約エラー修正
    # 既存成功パターン: IntegrityError処理

    # 100人分のクラス・課題・提出データ生成
    classes = create_test_classes(5)  # 5クラス
    assignments = create_test_assignments(classes, 10)  # クラスあたり10課題
    students = create_test_students(100)

    # 大規模データ投入
    submissions = []
    for student in students:
        for assignment in assignments:
            submission = create_test_submission(student, assignment)
            submissions.append(submission)

    # バッチ処理実行
    results = await bulk_create_submissions(submissions)

    # データ整合性検証（既存成功パターン）
    assert_lms_data_integrity(results)
```

#### 1.3 WebSocket統合テストパターン適用
```python
# tests/load/test_websocket_integration_pattern.py
# 既存の13個全成功パターンを100人規模に適用

async def test_100_students_websocket_integration():
    """WebSocket統合テストの成功パターンを100人規模で適用"""
    # 既存成功パターン: ConnectionManager直接テスト
    # 既存成功パターン: 非同期処理対応
    # 既存成功パターン: エラーハンドリング

    # 100人同時WebSocket接続
    connections = []
    for i in range(100):
        connection = await create_websocket_connection(f"student_{i:03d}")
        connections.append(connection)

    # 大量ブロードキャストテスト
    test_messages = generate_test_messages(1000)

    start_time = time.time()
    for message in test_messages:
        await manager.broadcast(message)
    execution_time = time.time() - start_time

    # パフォーマンス検証
    assert execution_time < 10.0  # 10秒以内
    assert all(conn.is_alive for conn in connections)
```

### **Phase 2: 大規模負荷テスト**

#### 2.1 段階的負荷テスト
```python
# tests/load/test_phased_load.py

@pytest.mark.parametrize("student_count", [10, 25, 50, 75, 100])
async def test_phased_student_load(student_count):
    """段階的負荷テスト：10→25→50→75→100人"""

    # 既存成功パターンの適用
    students = generate_realistic_students(student_count)

    # 実教室環境シミュレーション
    classroom = ClassroomSimulator(
        students=students,
        session_duration_minutes=90,
        cell_execution_pattern="realistic",
        error_injection_rate=0.15  # 15%のエラー率
    )

    # パフォーマンス測定
    metrics = await classroom.run_with_monitoring()

    # 段階別成功基準
    expected_throughput = student_count * 10  # 学生あたり10イベント/秒
    assert metrics.throughput >= expected_throughput
    assert metrics.error_rate <= 0.001  # 0.1%以下
```

#### 2.2 リアルタイム監視テスト
```python
# tests/load/test_realtime_monitoring.py

class RealtimeMonitor:
    """リアルタイムシステム監視"""

    async def test_resource_monitoring_under_load(self):
        """100人負荷時のリソース監視"""

        # ベースライン測定
        baseline = await self.collect_system_metrics()

        # 100人同時負荷実行
        load_task = asyncio.create_task(
            self.simulate_100_students_concurrent()
        )

        # リアルタイム監視
        metrics_history = []
        while not load_task.done():
            current_metrics = await self.collect_system_metrics()
            metrics_history.append(current_metrics)
            await asyncio.sleep(1.0)

        # 結果分析
        peak_metrics = max(metrics_history, key=lambda m: m.memory_usage)

        # 既存成功パターンの基準適用
        assert peak_metrics.memory_usage - baseline.memory_usage < 2048  # 2GB以内
        assert peak_metrics.cpu_usage < 80  # 80%以内
        assert peak_metrics.redis_connections < 200  # 200接続以内
```

### **Phase 3: データ整合性テスト**

#### 3.1 PostgreSQL-InfluxDB整合性テスト
```python
# tests/integration/test_database_consistency.py

async def test_postgresql_influxdb_consistency_100_students():
    """100人分データのPostgreSQL-InfluxDB整合性検証"""

    # 既存成功パターン: 外部キー制約処理
    # 既存成功パターン: データ同期確保

    # 100人分の大規模テストデータ生成
    test_events = []
    for student_id in range(1, 101):
        student_events = generate_student_session_events(
            student_id=f"student_{student_id:03d}",
            session_duration_minutes=90,
            notebooks_count=3,
            cells_per_notebook=25
        )
        test_events.extend(student_events)

    # バッチデータ投入
    await bulk_insert_events(test_events)

    # PostgreSQL検証
    pg_stats = await get_postgresql_statistics()

    # InfluxDB検証
    influx_stats = await get_influxdb_statistics()

    # 整合性検証（既存成功パターン）
    assert pg_stats.student_count == 100
    assert pg_stats.student_count == influx_stats.unique_students
    assert pg_stats.total_executions == influx_stats.total_events
    assert abs(pg_stats.total_duration - influx_stats.total_duration) < 1000  # 1秒以内の誤差
```

#### 3.2 トランザクション整合性テスト
```python
# tests/integration/test_transaction_consistency.py

async def test_transaction_consistency_under_load():
    """高負荷時のトランザクション整合性"""

    # 既存成功パターン: 外部キー制約エラー処理
    # 既存成功パターン: 同時実行制御

    # 同時トランザクション実行
    tasks = []
    for i in range(100):
        task = asyncio.create_task(
            execute_student_transaction(f"student_{i:03d}")
        )
        tasks.append(task)

    # 全トランザクション完了待機
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # 整合性検証
    successful_results = [r for r in results if not isinstance(r, Exception)]
    failed_results = [r for r in results if isinstance(r, Exception)]

    # 成功率検証
    success_rate = len(successful_results) / len(results)
    assert success_rate >= 0.95  # 95%以上の成功率

    # データ整合性検証
    await verify_database_consistency()
```

### **Phase 4: エラーハンドリング・復旧テスト**

#### 4.1 障害注入テスト
```python
# tests/resilience/test_fault_injection.py

class FaultInjectionTest:
    """障害注入テスト"""

    async def test_redis_failure_recovery(self):
        """Redis障害時の復旧テスト"""

        # 正常状態で100人負荷開始
        load_task = asyncio.create_task(
            self.simulate_100_students_load()
        )

        # 30秒後にRedis障害注入
        await asyncio.sleep(30)
        await self.inject_redis_failure()

        # 30秒後にRedis復旧
        await asyncio.sleep(30)
        await self.recover_redis()

        # 負荷テスト完了待機
        results = await load_task

        # 復旧後の整合性検証
        assert results.data_loss_count == 0  # データ損失なし
        assert results.recovery_time < 60  # 60秒以内の復旧
```

#### 4.2 メモリリークテスト
```python
# tests/resilience/test_memory_leak.py

async def test_long_running_memory_stability():
    """長時間実行時のメモリ安定性テスト"""

    initial_memory = psutil.Process().memory_info().rss

    # 4時間の連続負荷テスト
    for hour in range(4):
        await self.simulate_100_students_hour_session()

        current_memory = psutil.Process().memory_info().rss
        memory_growth = current_memory - initial_memory

        # メモリ増加量チェック
        assert memory_growth < 512 * 1024 * 1024  # 512MB以内

        # ガベージコレクション実行
        import gc
        gc.collect()
```

## 🔧 実行環境・ツール

### **Docker環境設定**
```yaml
# docker-compose.test.yml
version: '3.8'
services:
  test-runner:
    build:
      context: ./fastapi_server
      dockerfile: Dockerfile.test
    environment:
      - POSTGRES_URL=postgresql://test:test@postgres:5432/test_db
      - REDIS_URL=redis://redis:6379
      - INFLUXDB_URL=http://influxdb:8086
    depends_on:
      - postgres
      - redis
      - influxdb
    volumes:
      - ./test_results:/app/test_results
```

### **監視ツール統合**
```python
# tests/utils/monitoring.py

class TestMonitoring:
    """テスト実行監視"""

    def __init__(self):
        self.prometheus_client = PrometheusClient()
        self.grafana_client = GrafanaClient()

    async def start_monitoring(self):
        """監視開始"""
        await self.prometheus_client.start_scraping()
        await self.grafana_client.create_test_dashboard()

    async def collect_metrics(self):
        """メトリクス収集"""
        return {
            "cpu_usage": psutil.cpu_percent(),
            "memory_usage": psutil.virtual_memory().percent,
            "redis_connections": await self.get_redis_connections(),
            "postgres_connections": await self.get_postgres_connections(),
            "response_times": await self.get_response_times()
        }
```

## 📊 成功基準・KPI

### **パフォーマンス基準**
| 指標 | 目標値 | 測定方法 |
|------|--------|----------|
| スループット | 1000イベント/秒以上 | Redis Pub/Sub監視 |
| レスポンス時間 | 95%ile 500ms以内 | APIレスポンス測定 |
| エラー率 | 0.1%以下 | 失敗イベント/総イベント |
| CPU使用率 | 80%以下 | psutil監視 |
| メモリ使用量 | 4GB以下 | psutil監視 |

### **データ整合性基準**
| 指標 | 目標値 | 検証方法 |
|------|--------|----------|
| データ損失 | 0件 | PostgreSQL-InfluxDB比較 |
| 重複データ | 0件 | ユニーク制約検証 |
| 整合性一致率 | 100% | クロスデータベース検証 |

### **可用性基準**
| 指標 | 目標値 | 測定方法 |
|------|--------|----------|
| 稼働率 | 99.9%以上 | ヘルスチェック監視 |
| 復旧時間 | 60秒以内 | 障害注入テスト |
| データ復旧率 | 100% | バックアップ復旧テスト |

## 🚀 実行計画

### **Week 1: 基盤テスト実装**
- [ ] Phase 1テスト実装（既存パターン適用）
- [ ] Docker環境構築
- [ ] 監視ツール統合

### **Week 2: 負荷テスト実装**
- [ ] Phase 2テスト実装（段階的負荷）
- [ ] パフォーマンス監視実装
- [ ] 自動化スクリプト作成

### **Week 3: 整合性・復旧テスト実装**
- [ ] Phase 3テスト実装（データ整合性）
- [ ] Phase 4テスト実装（障害復旧）
- [ ] 総合テスト実行

### **Week 4: 最適化・ドキュメント化**
- [ ] パフォーマンス最適化
- [ ] テスト結果分析・レポート作成
- [ ] 運用ガイドライン作成

## 🎯 期待される成果

1. **品質保証**: 100人同時環境での安定動作保証
2. **パフォーマンス最適化**: ボトルネック特定と改善
3. **運用指針**: 本番環境運用のベストプラクティス確立
4. **継続的改善**: 監視・アラート体制の構築

この包括的なテスト計画により、既存の186個テストケース成功の実績を基盤として、100人規模の実教室環境でも安定したシステム運用が保証されます。
