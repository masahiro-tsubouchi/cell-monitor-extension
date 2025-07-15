#!/bin/bash
set -e

# 作業ディレクトリに移動
cd /app

echo "=== JupyterLab 拡張機能ビルドプロセスの開始 ==="

# 1. 依存関係のインストール
echo "=== フロントエンド依存関係のインストール ==="
jlpm || yarn install

# 2. TypeScriptコードのビルド
echo "=== フロントエンドコードのビルド ==="
jlpm build || yarn build

# 3. Pythonパッケージのビルド
echo "=== Pythonパッケージのビルド ==="
python -m build

# ビルド結果を表示
echo "=== ビルド結果 ==="
ls -la ./dist/

echo "=== ビルドプロセス完了 ==="
echo "配布可能なパッケージが ./dist ディレクトリに生成されました"

# 権限の問題を解決するため、生成されたファイルの所有権をホストユーザーに変更
# Docker実行時に -e HOST_UID=$(id -u) -e HOST_GID=$(id -g) を指定する必要があります
if [ ! -z "$HOST_UID" ] && [ ! -z "$HOST_GID" ]; then
  echo "=== ファイル権限の修正 ==="
  chown -R $HOST_UID:$HOST_GID ./dist
fi

# コンテナが起動したままになるように、引数が渡された場合はそれを実行
exec "$@"
