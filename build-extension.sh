#!/bin/bash

set -e # エラーがあった場合に即座に停止

# 現在のユーザーのUID/GIDを環境変数にエクスポート
# これにより、コンテナ内で生成されるファイルの所有者がホストユーザーと一致する
export HOST_UID=$(id -u)
export HOST_GID=$(id -g)

# 0. 古いdistディレクトリがあれば削除
echo "=== 古いdistディレクトリをクリーンアップします ==="
rm -rf ./cell-monitor-extension/dist

# 1. 'extension-builder'サービスを実行してビルドを行う
# --build: 実行前にイメージを強制的に再ビルド
# --rm: 実行後にコンテナを自動で削除
echo "=== JupyterLab拡張機能のビルドを開始します ==="
docker compose run --build --rm extension-builder

echo "
✅ ビルドが正常に完了しました！
"
echo "cell-monitor-extension/dist/ ディレクトリに生成されたパッケージを確認してください:"
ls -la ./cell-monitor-extension/dist/

# 中身が空でないか最終チェック
if [ -z "$(ls -A ./cell-monitor-extension/dist/)" ]; then
  echo "
❌ エラー: distディレクトリが空です。ビルドプロセスに問題がある可能性があります。"
  exit 1
fi

echo ""
echo "📦 拡張機能のインストール方法:"
echo "   pip install ./cell-monitor-extension/dist/*.whl"
echo "   jupyter labextension list   # インストール確認"
