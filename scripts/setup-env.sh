#!/bin/bash
# =======================================================
# JupyterLab Cell Monitor Extension - 環境切り替えスクリプト
# =======================================================
# 使用方法:
#   ./scripts/setup-env.sh development  # 開発環境
#   ./scripts/setup-env.sh production   # 本番環境
#   ./scripts/setup-env.sh status       # 現在の環境確認
#   ./scripts/setup-env.sh set-server 192.168.1.100  # サーバーIPを直接指定
# =======================================================

set -e  # エラー時にスクリプトを終了

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ログ関数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# プロジェクトルートディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 環境ファイルのパス
ENV_FILE="$PROJECT_ROOT/.env"
DEV_ENV_FILE="$PROJECT_ROOT/.env.development"
PROD_ENV_FILE="$PROJECT_ROOT/.env.production"
IMPROVED_ENV_FILE="$PROJECT_ROOT/.env.example.improved"
BACKUP_DIR="$PROJECT_ROOT/.env-backups"

# バックアップディレクトリを作成
mkdir -p "$BACKUP_DIR"

# 使用方法を表示
show_usage() {
    echo "🚀 JupyterLab Cell Monitor Extension - 環境切り替えツール"
    echo ""
    echo "使用方法:"
    echo "  $0 development              # 開発環境に切り替え (localhost)"
    echo "  $0 production               # 本番環境テンプレートに切り替え"
    echo "  $0 set-server <IP>          # サーバーIPを指定して本番環境設定"
    echo "  $0 status                   # 現在の環境を確認"
    echo "  $0 backup                   # 現在の.envをバックアップ"
    echo "  $0 help                     # このヘルプを表示"
    echo ""
    echo "例:"
    echo "  $0 development              # ローカル開発用設定 (localhost)"
    echo "  $0 set-server 192.168.1.100 # サーバーIP 192.168.1.100 で本番環境設定"
    echo "  $0 production               # 本番環境テンプレート（手動でIP設定が必要）"
    echo ""
}

# 現在の環境を確認
check_current_env() {
    if [[ ! -f "$ENV_FILE" ]]; then
        log_warning ".envファイルが見つかりません"
        return 1
    fi
    
    local node_env=$(grep "^NODE_ENV=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 || echo "unknown")
    local server_host=$(grep "^SERVER_HOST=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 || echo "unknown")
    local use_https=$(grep "^USE_HTTPS=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 || echo "false")
    
    echo "📊 現在の環境設定:"
    echo "  NODE_ENV: $node_env"
    echo "  SERVER_HOST: $server_host"
    echo "  USE_HTTPS: $use_https"
    
    if [[ "$node_env" == "development" ]]; then
        log_info "現在は開発環境に設定されています"
    elif [[ "$node_env" == "production" ]]; then
        log_info "現在は本番環境に設定されています"
    else
        log_warning "環境が不明です"
    fi
    
    # 動的に生成されるURLを表示
    if [[ "$server_host" != "unknown" && "$server_host" != "YOUR_SERVER_IP" ]]; then
        local protocol="http"
        if [[ "$use_https" == "true" ]]; then
            protocol="https"
        fi
        echo ""
        echo "🌐 アクセスURL（動的生成）:"
        echo "  講師ダッシュボード: $protocol://$server_host:3000"
        echo "  JupyterLab: $protocol://$server_host:8888"
        echo "  FastAPI: $protocol://$server_host:8000"
    fi
}

# .envファイルをバックアップ
backup_env() {
    if [[ -f "$ENV_FILE" ]]; then
        local backup_file="$BACKUP_DIR/.env.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$ENV_FILE" "$backup_file"
        log_success ".envファイルをバックアップしました: $backup_file"
    else
        log_warning ".envファイルが存在しないため、バックアップをスキップします"
    fi
}

# 環境ファイルの存在確認
check_env_files() {
    local missing_files=()
    
    if [[ ! -f "$DEV_ENV_FILE" ]]; then
        missing_files+=(".env.development")
    fi
    
    if [[ ! -f "$PROD_ENV_FILE" ]]; then
        missing_files+=(".env.production")
    fi
    
    if [[ ! -f "$IMPROVED_ENV_FILE" ]]; then
        missing_files+=(".env.example.improved")
    fi
    
    if [[ ${#missing_files[@]} -gt 0 ]]; then
        log_error "必要な環境ファイルが見つかりません:"
        for file in "${missing_files[@]}"; do
            echo "  - $file"
        done
        echo ""
        echo "これらのファイルを作成してから再実行してください。"
        exit 1
    fi
}

# 開発環境に切り替え
switch_to_development() {
    log_info "開発環境に切り替えています..."
    
    # バックアップ作成
    backup_env
    
    # 開発環境ファイルをコピー
    cp "$DEV_ENV_FILE" "$ENV_FILE"
    
    log_success "✅ 開発環境に切り替えました"
    echo ""
    echo "🔧 開発環境設定:"
    echo "  - ホスト: localhost (Docker内部通信: コンテナ名)"
    echo "  - プロトコル: HTTP"
    echo "  - フロントエンド: localhost:3000"
    echo "  - JupyterLab: localhost:8888"
    echo "  - FastAPI: localhost:8000"
    echo "  - デバッグモード: 有効"
    echo ""
    echo "🚀 次のステップ:"
    echo "  docker compose down && docker compose up --build"
}

# 本番環境に切り替え（テンプレート）
switch_to_production() {
    log_info "本番環境テンプレートに切り替えています..."
    
    # バックアップ作成
    backup_env
    
    # 本番環境ファイルをコピー
    cp "$PROD_ENV_FILE" "$ENV_FILE"
    
    log_success "✅ 本番環境テンプレートに切り替えました"
    echo ""
    log_warning "⚠️  重要: サーバーIPの設定が必要です"
    echo ""
    echo "📝 次のいずれかの方法でサーバーIPを設定してください:"
    echo ""
    echo "  方法1: スクリプトで自動設定"
    echo "    ./scripts/setup-env.sh set-server 192.168.1.100"
    echo ""
    echo "  方法2: 手動で.envファイルを編集"
    echo "    vim .env  # SERVER_HOST=YOUR_SERVER_IP を実際のIPに変更"
    echo ""
    echo "🔐 セキュリティ設定も忘れずに変更してください:"
    echo "  SECRET_KEY, POSTGRES_PASSWORD, JUPYTER_TOKEN など"
}

# サーバーIPを指定して本番環境を設定
set_server_ip() {
    local server_ip="$1"
    
    if [[ -z "$server_ip" ]]; then
        log_error "サーバーIPが指定されていません"
        echo "使用方法: $0 set-server <IP_ADDRESS>"
        exit 1
    fi
    
    # IPアドレスの簡単な検証
    if [[ ! "$server_ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        log_warning "IPアドレスの形式が正しくない可能性があります: $server_ip"
        echo "続行しますか? (y/N)"
        read -r confirm
        if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
            log_info "キャンセルしました"
            exit 0
        fi
    fi
    
    log_info "サーバーIP $server_ip で本番環境を設定しています..."
    
    # バックアップ作成
    backup_env
    
    # 本番環境ファイルをコピー
    cp "$PROD_ENV_FILE" "$ENV_FILE"
    
    # サーバーIPを置換
    if command -v sed >/dev/null 2>&1; then
        # macOSとLinuxの互換性を考慮
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/YOUR_SERVER_IP/$server_ip/g" "$ENV_FILE"
        else
            sed -i "s/YOUR_SERVER_IP/$server_ip/g" "$ENV_FILE"
        fi
    else
        log_error "sedコマンドが見つかりません。手動で SERVER_HOST を設定してください。"
        exit 1
    fi
    
    log_success "✅ サーバーIP $server_ip で本番環境を設定しました"
    echo ""
    echo "🌐 設定されたアクセスURL:"
    echo "  講師ダッシュボード: http://$server_ip:3000"
    echo "  JupyterLab: http://$server_ip:8888"
    echo "  FastAPI: http://$server_ip:8000"
    echo ""
    log_warning "⚠️  セキュリティ設定の確認を忘れずに："
    echo "  - SECRET_KEY: 強力なランダムキーに変更"
    echo "  - POSTGRES_PASSWORD: セキュアなパスワードに変更"
    echo "  - JUPYTER_TOKEN: 強力なトークンに変更"
    echo "  - USE_HTTPS=true （SSL証明書がある場合）"
    echo ""
    echo "🚀 次のステップ:"
    echo "  docker compose down && docker compose up --build"
}

# Docker Composeのステータス確認
check_docker_status() {
    log_info "Docker Composeサービスの状況を確認しています..."
    if command -v docker compose >/dev/null 2>&1; then
        docker compose ps
    elif command -v docker-compose >/dev/null 2>&1; then
        docker-compose ps
    else
        log_warning "Docker Composeが見つかりません"
    fi
}

# メイン処理
main() {
    # プロジェクトルートに移動
    cd "$PROJECT_ROOT"
    
    case "${1:-help}" in
        "development"|"dev")
            check_env_files
            switch_to_development
            check_current_env
            ;;
        "production"|"prod")
            check_env_files
            switch_to_production
            check_current_env
            ;;
        "set-server")
            check_env_files
            set_server_ip "$2"
            check_current_env
            ;;
        "status")
            check_current_env
            echo ""
            check_docker_status
            ;;
        "backup")
            backup_env
            ;;
        "help"|"--help"|"-h")
            show_usage
            ;;
        *)
            log_error "不明なコマンド: $1"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# スクリプト実行
main "$@"