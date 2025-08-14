# 環境変数でPythonバージョンを指定可能
ARG PYTHON_VERSION=3.12-slim
FROM python:${PYTHON_VERSION}

# 作業ディレクトリの設定
WORKDIR /app

# Pythonバッファリング無効化（ログの即座表示）
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# pipの最適化設定
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

# 依存関係のコピーとインストール（Docker層キャッシュの活用）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 開発環境用のビルド引数
ARG BUILD_ENV=production

# アプリケーションソースコードのコピー
COPY . .

# 条件付きテスト依存関係のインストール（開発環境のみ）
RUN if [ "$BUILD_ENV" = "development" ] && [ -f "tests/requirements.txt" ]; then \
        pip install --no-cache-dir -r tests/requirements.txt; \
    fi

# 非rootユーザーでの実行（セキュリティ強化）
RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app
USER app

# ポート公開（環境変数で制御可能）
ARG FASTAPI_PORT=8000
EXPOSE ${FASTAPI_PORT}

# ヘルスチェック設定
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${FASTAPI_PORT}/health || exit 1

# FastAPI本番サーバーの起動
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
