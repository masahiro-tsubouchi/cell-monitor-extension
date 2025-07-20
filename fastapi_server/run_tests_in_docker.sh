#!/bin/bash

# -e: スクリプト内のコマンドが失敗した場合、直ちにスクリプトを終了する
set -e
# Docker環境内でテストを実行するためのスクリプト

# スクリプトの場所からプロジェクトルートディレクトリに移動
cd "$(dirname "$0")/.."
# 引数パース
RUN_TEST=0
CLEAN=0

# コマンドライン引数の処理
while [[ $# -gt 0 ]]; do
  case $1 in
    --run)
      RUN_TEST=1
      shift
      ;;
    --clean)
      CLEAN=1
      shift
      ;;
    *)
      # テスト引数として残りの引数を渡す
      PYTEST_ARGS="$PYTEST_ARGS $1"
      shift
      ;;
  esac
done

# ドックアップ
echo "テスト環境を起動しています..."
docker compose -f docker-compose.test.yml up -d

echo "テスト環境のセットアップを待っています..."
# PostgreSQLが準備完了するまで待機
until docker compose -f docker-compose.test.yml exec postgres pg_isready -U admin -d progress_db_test -h localhost -p 5432; do
  echo "PostgreSQLの起動を待っています..."
  sleep 2
done
echo "PostgreSQLの準備が完了しました。"

# テストの実行
# --run フラグが付いている場合はすぐにテストを実行
if [ "$RUN_TEST" -eq 1 ]; then
  echo "テストを実行しています: pytest $PYTEST_ARGS"
  docker compose -f docker-compose.test.yml exec fastapi pytest -v $PYTEST_ARGS
else
  echo "テスト環境が準備完了しました。"
  echo "手動でテストを実行するには以下のコマンドを使用してください:"
  echo "  docker compose -f docker-compose.test.yml exec fastapi pytest -v [テストパス]"
  echo "例: docker compose -f docker-compose.test.yml exec fastapi pytest -v tests/worker/test_event_router.py"
  echo "または再度スクリプトを実行する際に --run オプションを付けてください"
fi

# 全てのテストが完了したら、環境をクリーンアップするかユーザーに確認
if [ "$CLEAN" -eq 1 ]; then
  echo "テスト環境を停止しています..."
  docker compose -f docker-compose.test.yml down
else
  read -p "テスト環境を停止しますか？ (y/n): " answer
  if [ "$answer" = "y" ]; then
    echo "テスト環境を停止しています..."
    docker compose -f docker-compose.test.yml down
  fi
fi
echo "テスト環境を停止しました"
