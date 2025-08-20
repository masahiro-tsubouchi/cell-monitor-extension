# 環境変数でPythonバージョンを指定可能
ARG PYTHON_VERSION=3.12-slim
FROM python:${PYTHON_VERSION}

# 作業ディレクトリの設定
WORKDIR /app

# 環境変数でNodeバージョンを指定可能
ARG NODE_MAJOR_VERSION=20

# システム依存関係のインストール（Node.js、npm、curlなど）
RUN apt-get update && apt-get install -y curl git && \
    curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR_VERSION}.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# corepackを有効化してyarnを管理
RUN corepack enable

# Python環境の最適化
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

# 依存関係のコピーとインストール（Docker層キャッシュの活用）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 非rootユーザーでの実行（セキュリティ強化）
RUN useradd --create-home --shell /bin/bash jupyter && \
    chown -R jupyter:jupyter /app
USER jupyter

# アプリケーションソースコードのコピー
COPY --chown=jupyter:jupyter . .

# Node.js依存関係の事前インストール（jupyterユーザーとして）
RUN yarn install

# デバッグ: ファイル構造とtsconfig.json内容を確認
RUN pwd && ls -la && ls -la src/ && cat tsconfig.json

# TypeScriptコンパイルを事前に実行（権限問題を回避）
RUN npm run build:lib

# 拡張機能のインストール（フロントエンドも自動ビルド）
USER root
RUN pip install --no-cache-dir .
USER jupyter

# Jupyter設定ディレクトリの作成
USER root
RUN mkdir -p /etc/jupyter

# CSP設定をコピー（FastAPIサーバー接続許可）
COPY jupyter_server_config.py /etc/jupyter/

# ポート公開（環境変数で制御可能）
ARG JUPYTERLAB_PORT=8888
EXPOSE ${JUPYTERLAB_PORT}

# 拡張機能のスキーマファイルが正しくインストールされているかチェック
RUN ls -la /usr/local/share/jupyter/lab/schemas/ || echo "No schemas directory" && \
    ls -la /usr/local/share/jupyter/lab/schemas/cell-monitor/ || echo "No cell-monitor schema directory"

# ヘルスチェック設定
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${JUPYTERLAB_PORT}/lab || exit 1

# 環境変数でJupyterトークンを制御可能
ARG JUPYTER_TOKEN=easy
ENV JUPYTER_TOKEN=${JUPYTER_TOKEN}

# JupyterLabの起動（環境変数でトークンを制御）
USER jupyter
CMD ["sh", "-c", "if [ -z \"$JUPYTER_TOKEN\" ]; then jupyter lab --ip=0.0.0.0 --no-browser --ServerApp.token=''; else jupyter lab --ip=0.0.0.0 --no-browser --ServerApp.token=\"$JUPYTER_TOKEN\"; fi"]
