#!/bin/bash

# E2Eテスト実行スクリプト
# JupyterLab → FastAPI のデータフロー自動検証

set -e

echo "🚀 Starting E2E Tests for JupyterLab → FastAPI Integration"
echo "=================================================="

# 色付きの出力用関数
print_success() {
    echo -e "\033[32m✅ $1\033[0m"
}

print_error() {
    echo -e "\033[31m❌ $1\033[0m"
}

print_info() {
    echo -e "\033[34mℹ️  $1\033[0m"
}

# 必要な依存関係のインストール
print_info "Installing test dependencies..."
pip install playwright requests

# Playwrightブラウザのインストール
print_info "Installing Playwright browsers..."
playwright install chromium

# サービスの健康チェック
print_info "Checking service availability..."

# FastAPI健康チェック
if ! curl -s http://localhost:8000 > /dev/null; then
    print_error "FastAPI server is not running at http://localhost:8000"
    print_info "Please start the services with: docker compose up -d"
    exit 1
fi

# JupyterLab健康チェック
if ! curl -s http://localhost:8888/api/status > /dev/null; then
    print_error "JupyterLab server is not running at http://localhost:8888"
    print_info "Please start the services with: docker compose up -d"
    exit 1
fi

print_success "All services are running"

# E2Eテストの実行
print_info "Running E2E tests..."
echo ""

# テスト実行 (Dockerコンテナ内)
# コンテナ内からホストのJupyterLabに接続するため、JUPYTER_URLをhost.docker.internalに設定
export JUPYTER_URL="http://host.docker.internal:8888"

echo "🚀 Running E2E tests inside the docker container..."
docker compose exec -e JUPYTER_URL -T fastapi pytest tests/integration/test_e2e_jupyter_to_fastapi.py -s -v

# テスト結果の確認
if [ $? -eq 0 ]; then
    echo "✅ All E2E tests passed"
else
    echo "❌ Some E2E tests failed"
    echo "🔍 Check the test output above for details"
    exit 1
fi

echo ""
echo "=================================================="
echo "E2E Test Summary:"
echo "- ✅ JupyterLab cell execution detection"
echo "- ✅ Jupyter server proxy forwarding"
echo "- ✅ FastAPI event reception and processing"
echo "- ✅ End-to-end data flow verification"
echo "=================================================="
