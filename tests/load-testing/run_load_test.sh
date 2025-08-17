#!/bin/bash
# =======================================================
# JupyterLab Cell Monitor Extension - 負荷テスト実行スクリプト
# =======================================================
# 使用例:
#   ./tests/load-testing/run_load_test.sh          # デフォルト設定で実行
#   ./tests/load-testing/run_load_test.sh 50       # 50名で実行
#   ./tests/load-testing/run_load_test.sh 200 15   # 200名で15分実行

set -e

# =======================================================
# 設定
# =======================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

# デフォルト値
DEFAULT_STUDENT_COUNT=100
DEFAULT_DURATION=10
DEFAULT_TEAM_SIZE=5

# 引数取得
STUDENT_COUNT=${1:-$DEFAULT_STUDENT_COUNT}
DURATION=${2:-$DEFAULT_DURATION}
TEAM_SIZE=${3:-$DEFAULT_TEAM_SIZE}

echo "🧪 JupyterLab Cell Monitor Extension - 負荷テスト実行"
echo "=================================================="
echo "📊 テスト設定:"
echo "   受講生数: ${STUDENT_COUNT}名"
echo "   実行時間: ${DURATION}分"
echo "   チームサイズ: ${TEAM_SIZE}名"
echo "=================================================="

# =======================================================
# 環境チェック
# =======================================================
echo "🔍 環境チェック中..."

# .envファイル存在確認
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ エラー: .envファイルが見つかりません: $ENV_FILE"
    exit 1
fi

# Pythonライブラリチェック
MISSING_LIBS=()

if ! python3 -c "import aiohttp" 2>/dev/null; then
    MISSING_LIBS+=("aiohttp")
fi

if ! python3 -c "import psutil" 2>/dev/null; then
    MISSING_LIBS+=("psutil")
fi

if ! python3 -c "import dotenv" 2>/dev/null; then
    MISSING_LIBS+=("python-dotenv")
fi

if [ ${#MISSING_LIBS[@]} -ne 0 ]; then
    echo "❌ エラー: 必要なPythonライブラリが不足しています:"
    printf '   %s\n' "${MISSING_LIBS[@]}"
    echo "💡 インストールコマンド: pip install ${MISSING_LIBS[*]}"
    exit 1
fi

# Docker サービス確認
echo "🐳 Docker サービス確認中..."
if ! docker compose ps | grep -q "Up"; then
    echo "⚠️  警告: Dockerサービスが起動していません"
    echo "💡 起動コマンド: docker compose up -d"
    read -p "Dockerサービスを起動しますか? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🚀 Dockerサービスを起動中..."
        cd "$PROJECT_ROOT"
        docker compose up -d
        sleep 10  # サービス起動待機
    else
        echo "❌ テストを中止します"
        exit 1
    fi
fi

# =======================================================
# .env設定更新
# =======================================================
echo "⚙️  .env設定を更新中..."

# バックアップ作成
cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"

# 一時的に.envファイルを更新
sed -i.tmp "s/^LOAD_TEST_STUDENT_COUNT=.*/LOAD_TEST_STUDENT_COUNT=${STUDENT_COUNT}/" "$ENV_FILE"
sed -i.tmp "s/^LOAD_TEST_DURATION_MINUTES=.*/LOAD_TEST_DURATION_MINUTES=${DURATION}/" "$ENV_FILE"
sed -i.tmp "s/^LOAD_TEST_TEAM_SIZE=.*/LOAD_TEST_TEAM_SIZE=${TEAM_SIZE}/" "$ENV_FILE"

# tmpファイル削除
rm -f "$ENV_FILE.tmp"

echo "✅ 設定更新完了"

# =======================================================
# 負荷テスト実行前チェック
# =======================================================
echo "🔍 システム状態チェック中..."

# FastAPI ヘルスチェック
if ! curl -s -f http://localhost:8000/api/v1/health >/dev/null; then
    echo "❌ エラー: FastAPIサーバーが応答しません"
    echo "💡 確認コマンド: curl http://localhost:8000/api/v1/health"
    exit 1
fi

# Redis接続チェック
if ! curl -s -f http://localhost:8000/api/v1/health/redis >/dev/null; then
    echo "⚠️  警告: Redis接続に問題がある可能性があります"
    echo "💡 確認コマンド: docker compose exec redis redis-cli ping"
fi

echo "✅ システム状態: 正常"

# =======================================================
# 負荷テスト実行
# =======================================================
echo ""
echo "🚀 負荷テスト開始!"
echo "=================================================="

# 結果出力ディレクトリ作成
RESULTS_DIR="$PROJECT_ROOT/test_results"
mkdir -p "$RESULTS_DIR"

# テスト実行
cd "$PROJECT_ROOT"
python3 tests/load-testing/enhanced_100_student_simulator.py \
    --url "http://localhost:8000" \
    --duration "$DURATION" \
    --output-dir "$RESULTS_DIR"

TEST_EXIT_CODE=$?

# =======================================================
# 結果表示
# =======================================================
echo ""
echo "=================================================="
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ 負荷テスト完了!"
    
    # 最新の結果ファイルを探す
    LATEST_REPORT=$(find "$RESULTS_DIR" -name "*_student_report_*.md" -type f -exec ls -t {} + | head -n 1)
    LATEST_JSON=$(find "$RESULTS_DIR" -name "*_student_test_*.json" -type f -exec ls -t {} + | head -n 1)
    
    if [ -n "$LATEST_REPORT" ]; then
        echo "📊 結果レポート: $LATEST_REPORT"
        echo "📈 JSON結果: $LATEST_JSON"
        echo ""
        echo "📋 テスト結果サマリー:"
        # レポートの重要部分を表示
        grep -A 20 "## 📈 パフォーマンス結果" "$LATEST_REPORT" | head -n 15
    fi
else
    echo "❌ 負荷テスト失敗 (終了コード: $TEST_EXIT_CODE)"
fi

# =======================================================
# 後処理
# =======================================================
echo ""
echo "🧹 後処理中..."

# .envファイルを元に戻す
BACKUP_FILE=$(ls -t "$ENV_FILE".backup.* | head -n 1)
if [ -n "$BACKUP_FILE" ]; then
    cp "$BACKUP_FILE" "$ENV_FILE"
    echo "✅ .env設定を元に戻しました"
fi

# システム状態表示
echo ""
echo "🔍 テスト後のシステム状態:"
echo "   CPU使用率: $(top -l 1 | grep "CPU usage" | awk '{print $3}' | sed 's/%//')"
echo "   メモリ使用率: $(top -l 1 | grep "PhysMem" | awk '{print $2}' | sed 's/M/MB/')"

# Docker リソース使用量
if command -v docker &> /dev/null; then
    echo "   Docker状態:"
    docker compose ps --format "table {{.Name}}\t{{.State}}\t{{.Status}}" | head -n 8
fi

echo ""
echo "🎉 負荷テスト処理完了!"

# 結果ファイルパスを返す（後続処理用）
if [ $TEST_EXIT_CODE -eq 0 ] && [ -n "$LATEST_JSON" ]; then
    echo "RESULT_FILE=$LATEST_JSON"
fi

exit $TEST_EXIT_CODE