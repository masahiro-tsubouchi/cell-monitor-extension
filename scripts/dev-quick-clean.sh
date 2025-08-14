#!/bin/bash

# ==================================================
# 開発中の素早いDocker容量削減スクリプト
# ==================================================

echo "⚡ 開発中の素早い容量削減を開始..."

# 停止中のコンテナとdanglingイメージのみクリーンアップ
docker container prune -f > /dev/null 2>&1
docker image prune -f > /dev/null 2>&1
docker builder prune -f > /dev/null 2>&1

# 現在の使用量表示
echo "📊 現在のDocker使用量:"
docker system df

echo ""
echo "✅ 素早いクリーンアップ完了！"
echo "💡 さらに容量が必要な場合は: docker system prune -a"
