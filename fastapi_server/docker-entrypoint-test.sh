#!/bin/bash
set -e

echo "テスト環境を初期化中..."

# サービスの準備完了を待機する関数
wait_for_service() {
    local host=$1
    local port=$2
    local service_name=$3
    local max_retries=30
    local retry_count=0

    echo "サービスの準備を待機中: $service_name ($host:$port)"
    while ! nc -z $host $port; do
        retry_count=$((retry_count+1))
        if [ $retry_count -gt $max_retries ]; then
            echo "エラー: $service_name ($host:$port) への接続がタイムアウトしました"
            exit 1
        fi
        echo "  $service_name はまだ準備できていません。5秒後に再試行します..."
        sleep 5
    done
    echo "  $service_name の準備ができました！"
}

# 依存サービスが起動するまで待機
wait_for_service postgres 5432 "PostgreSQL"
wait_for_service redis 6379 "Redis"
wait_for_service influxdb 8086 "InfluxDB"

# Pythonパスを設定
export PYTHONPATH=/app

echo "全てのサービスの準備が完了しました。テストコンテナは実行中です。"
echo "テストを実行するには: docker exec -it <container_id> pytest <test_path>"
echo "例: docker exec -it jupyter-extensionver2-test-1 pytest tests/worker/test_event_router.py -v"
echo ""
echo "または、シェルにアクセスして手動でコマンドを実行:"
echo "docker exec -it <container_id> bash"
echo ""
echo "テストコンテナを維持しています..."

# コンテナを維持
exec "$@"
