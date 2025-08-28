#!/bin/bash

# エラーが発生した場合に即座にスクリプトを停止する
set -e

echo "🚀 配布用JupyterLab拡張機能パッケージ (.whl) のビルドを開始します..."

# --- 準備 ---
# ホストマシンのユーザーIDとグループIDを環境変数に設定
# これにより、Dockerコンテナ内で生成されるファイルの所有者がホストユーザーと一致する
export HOST_UID=$(id -u)
export HOST_GID=$(id -g)

echo "- ホストユーザー情報: UID=${HOST_UID}, GID=${HOST_GID}"

# 古いビルド成果物ディレクトリを削除してクリーンな状態から開始
if [ -d "./cell-monitor-extension/dist" ]; then
  echo "- 古い 'dist' ディレクトリをクリーンアップします。"
  rm -rf ./cell-monitor-extension/dist
fi

# --- ビルド実行 ---
echo "- Dockerコンテナ (extension-builder) を使用してビルドを実行します..."
# --build: 実行前にイメージの再ビルドを強制
# --rm: 実行後にコンテナを自動で削除
# macOSではgtimeoutを使用、Linuxではtimeoutを使用
if command -v gtimeout >/dev/null 2>&1; then
  gtimeout 600 docker compose run --build --rm extension-builder
elif command -v timeout >/dev/null 2>&1; then
  timeout 600 docker compose run --build --rm extension-builder
else
  # timeoutコマンドが使用できない場合は通常実行
  docker compose run --build --rm extension-builder
fi

# --- 結果確認 ---
echo
echo "✅ ビルドが正常に完了しました！"
echo
echo "📦 生成されたパッケージ:"
ls -l ./cell-monitor-extension/dist/

# 最終チェック: distディレクトリに.whlファイルが存在するか確認
if ! ls ./cell-monitor-extension/dist/*.whl &> /dev/null; then
  echo
  echo "❌ エラー: .whl ファイルが 'dist' ディレクトリに見つかりません。ビルドプロセスに問題がある可能性があります。"
  exit 1
fi

echo
echo "🎉 これで、生成された .whl ファイルを他の環境に配布・インストールできます。"
echo "   インストールコマンドの例: pip install ./cell-monitor-extension/dist/cell_monitor-*.whl"
