# 🧪 負荷テストシステム

JupyterLab Cell Monitor Extension の負荷テストシステムです。.envファイルで受講生数やテスト条件を簡単に変更できます。

## 📋 概要

### ✨ 主な機能
- **環境変数対応**: .envファイルで全ての設定を変更可能
- **段階的負荷増加**: 本番環境を模擬した段階的な負荷テスト
- **リアルタイム監視**: システムリソースとRedis接続状況の監視
- **詳細レポート**: テスト結果のMarkdown/JSON出力
- **自動復旧**: テスト後の設定自動復元

### 🎯 テスト対象
- 受講生のセル実行イベント
- ヘルプ要請システム
- Redis Pub/Sub通信
- WebSocket接続
- FastAPI バッチ処理

## 🚀 使用方法

### 1. 基本的な実行

```bash
# デフォルト設定（100名、10分）で実行
./tests/load-testing/run_load_test.sh

# 50名で実行
./tests/load-testing/run_load_test.sh 50

# 200名で15分実行
./tests/load-testing/run_load_test.sh 200 15

# 25名、5分、チームサイズ3名で実行
./tests/load-testing/run_load_test.sh 25 5 3
```

### 2. Python直接実行

```bash
# 環境変数設定をそのまま使用
python3 tests/load-testing/enhanced_100_student_simulator.py

# オプション指定
python3 tests/load-testing/enhanced_100_student_simulator.py \
    --url "http://localhost:8000" \
    --duration 15 \
    --output-dir "custom_results"
```

### 3. Docker環境での実行

```bash
# 事前にDockerサービス起動
docker compose up -d

# テスト実行
./tests/load-testing/run_load_test.sh 100 10
```

## ⚙️ 設定

### .env設定項目

```bash
# 基本設定
LOAD_TEST_STUDENT_COUNT=100      # 受講生数
LOAD_TEST_TEAM_SIZE=5            # チームサイズ
LOAD_TEST_DURATION_MINUTES=10    # テスト時間（分）
LOAD_TEST_INSTRUCTOR_COUNT=5     # 講師数

# 行動間隔設定
LOAD_TEST_CELL_INTERVAL_MIN=12   # セル実行間隔（最小秒）
LOAD_TEST_CELL_INTERVAL_MAX=18   # セル実行間隔（最大秒）
LOAD_TEST_HELP_INTERVAL_MIN=90   # ヘルプ要請間隔（最小秒）
LOAD_TEST_HELP_INTERVAL_MAX=150  # ヘルプ要請間隔（最大秒）

# 詳細設定
LOAD_TEST_BATCH_SIZE=20          # バッチサイズ
LOAD_TEST_GRADUAL_MODE=true      # 段階的負荷増加
```

### 設定例

#### 小規模テスト（開発用）
```bash
LOAD_TEST_STUDENT_COUNT=10
LOAD_TEST_DURATION_MINUTES=3
LOAD_TEST_GRADUAL_MODE=false
```

#### 中規模テスト
```bash
LOAD_TEST_STUDENT_COUNT=50
LOAD_TEST_DURATION_MINUTES=10
LOAD_TEST_GRADUAL_MODE=true
```

#### 大規模テスト（本番検証）
```bash
LOAD_TEST_STUDENT_COUNT=200
LOAD_TEST_DURATION_MINUTES=15
LOAD_TEST_GRADUAL_MODE=true
```

## 📊 出力結果

### ファイル構成
```
test_results/
├── 100_student_test_20250817_143022.json    # JSON詳細結果
├── 100_student_report_20250817_143022.md    # Markdownレポート
└── ...
```

### レポート内容
- **テスト概要**: 受講生数、チーム数、実行時間
- **パフォーマンス指標**: 成功率、応答時間、処理能力
- **システムメトリクス**: CPU、メモリ、Redis接続数
- **エラー詳細**: 発生したエラーの分析
- **目標達成度**: 性能目標との比較

### JSON結果構造
```json
{
  "test_info": {
    "students": 100,
    "teams": 20,
    "duration_minutes": 10.2
  },
  "performance_metrics": {
    "events_sent": 1847,
    "success_rate": 99.2,
    "events_per_second": 180.5,
    "avg_response_time": 0.045
  },
  "system_metrics": {
    "total_cells_executed": 1623,
    "total_errors": 87
  }
}
```

## 🔍 監視機能

### リアルタイム監視項目
- **システムリソース**: CPU使用率、メモリ使用率
- **Redis接続**: 接続数、プール使用率
- **応答時間**: 最小/最大/平均応答時間
- **エラー率**: リアルタイムエラー率追跡

### アラート機能
- メモリ使用率 > 80%で警告
- Redis接続数上限近接で警告
- 応答時間スパイク検出

## 🎯 性能目標

### 目標指標
| 項目 | 目標値 | 評価基準 |
|------|--------|----------|
| 成功率 | > 99% | 必須 |
| 平均応答時間 | < 100ms | 推奨 |
| 処理能力 | > 400イベント/秒 | 100名時 |
| エラー率 | < 1% | 必須 |

### 本番環境想定
- **200名同時利用**: 35チーム構成
- **毎秒800+イベント**: ピーク時処理能力
- **99.9%稼働率**: システム安定性

## 🛠️ トラブルシューティング

### よくある問題

#### 1. Docker サービス未起動
```bash
❌ エラー: FastAPIサーバーが応答しません

# 解決方法
docker compose up -d
```

#### 2. Python ライブラリ不足
```bash
❌ エラー: 必要なPythonライブラリが不足しています

# 解決方法
pip install aiohttp psutil python-dotenv
```

#### 3. Redis 接続エラー
```bash
⚠️ 警告: Redis接続に問題がある可能性があります

# 確認方法
docker compose exec redis redis-cli ping
```

#### 4. メモリ不足
```bash
🚨 高メモリ使用率: 85.2%

# 対処方法
1. 受講生数を減らす
2. Docker メモリ制限を確認
3. システムリソースを増強
```

### ログ確認
```bash
# FastAPI ログ
docker compose logs fastapi

# Worker ログ
docker compose logs worker

# Redis ログ
docker compose logs redis
```

## 📈 パフォーマンス最適化

### 推奨設定

#### 小規模環境（10-50名）
```bash
LOAD_TEST_CELL_INTERVAL_MIN=15
LOAD_TEST_CELL_INTERVAL_MAX=25
LOAD_TEST_GRADUAL_MODE=false
```

#### 大規模環境（100-200名）
```bash
LOAD_TEST_CELL_INTERVAL_MIN=10
LOAD_TEST_CELL_INTERVAL_MAX=15
LOAD_TEST_GRADUAL_MODE=true
```

### システム要件
- **CPU**: 4コア以上推奨
- **メモリ**: 8GB以上推奨
- **ネットワーク**: 1Gbps推奨
- **ディスク**: SSD推奨

## 🔄 継続的テスト

### 自動化例
```bash
#!/bin/bash
# 毎日異なる規模でテスト実行
for count in 25 50 100; do
    ./tests/load-testing/run_load_test.sh $count 5
    sleep 300  # 5分間隔
done
```

### CI/CD統合
```yaml
# GitHub Actions例
- name: Load Test
  run: |
    ./tests/load-testing/run_load_test.sh 50 3
    # 結果をアーティファクトとして保存
```

## 📚 参考情報

### 関連ドキュメント
- [Redis パフォーマンス最適化計画](../../2025-08-17-redis-performance-optimization-plan.md)
- [CLAUDE.md](../../CLAUDE.md) - プロジェクト全体の説明

### 技術仕様
- **Python**: 3.12+
- **aiohttp**: 非同期HTTP通信
- **psutil**: システム監視
- **python-dotenv**: 環境変数管理

### 開発者向け情報
- シミュレータファイル: `enhanced_100_student_simulator.py`
- 実行スクリプト: `run_load_test.sh`
- 設定ファイル: `../../.env`