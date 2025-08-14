#!/bin/bash

# ==================================================
# Docker自動クリーンアップスクリプト
# ==================================================

set -e

echo "🧹 Docker容量最適化を開始します..."

# 現在のDocker使用量表示
echo "📊 クリーンアップ前のDocker使用量:"
docker system df

echo ""
echo "🗑️  未使用リソースをクリーンアップ中..."

# 停止中のコンテナを削除
echo "  - 停止中のコンテナを削除"
docker container prune -f

# 未使用のネットワークを削除
echo "  - 未使用のネットワークを削除"
docker network prune -f

# 未使用のボリュームを削除（注意：データ損失の可能性）
read -p "未使用のボリュームを削除しますか？ (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "  - 未使用のボリュームを削除"
    docker volume prune -f
fi

# danglingイメージ（<none>タグ）を削除
echo "  - danglingイメージを削除"
docker image prune -f

# ビルドキャッシュをクリーンアップ
echo "  - ビルドキャッシュをクリーンアップ"
docker builder prune -f

# 古いプロジェクトイメージを削除
echo "  - 古いプロジェクトイメージをクリーンアップ"
docker images | grep "jupyter-extensionver2-claude-code" | grep -v "latest" | awk '{print $3}' | xargs -r docker rmi -f

echo ""
echo "📊 クリーンアップ後のDocker使用量:"
docker system df

echo ""
echo "✅ Docker容量最適化が完了しました！"

# 使用量の削減を表示
echo ""
echo "💡 追加の最適化のヒント:"
echo "  - 定期的に 'docker system prune -a' を実行"
echo "  - 不要になったプロジェクトは docker-compose down -v で完全削除"
echo "  - .dockerignore ファイルで不要ファイルの除外を確認"
