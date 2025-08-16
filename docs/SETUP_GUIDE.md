# 🚀 JupyterLab Cell Monitor Extension セットアップガイド

## 📋 システム要件

### 最小要件
- **OS**: Ubuntu 18.04+ / CentOS 7+ / macOS 10.15+ / Windows 10+
- **CPU**: 2コア以上
- **RAM**: 4GB以上
- **ストレージ**: 20GB以上の空き容量
- **Docker**: 20.10+ & Docker Compose 2.0+
- **Node.js**: 18.0+ (開発時のみ)
- **Python**: 3.9+ (開発時のみ)

### 推奨要件
- **CPU**: 4コア以上
- **RAM**: 8GB以上
- **ストレージ**: 100GB以上（SSD推奨）
- **ネットワーク**: 1Gbps以上

## 🎯 クイックスタート（5分でセットアップ）

### 1. リポジトリクローン
```bash
git clone https://github.com/your-org/jupyter-extensionver2-claude-code.git
cd jupyter-extensionver2-claude-code
```

### 2. 環境設定
```bash
# 環境変数設定ファイル作成
cp .env.example .env

# Docker環境の構築・起動
docker compose up --build
```

### 3. アクセス確認
- **JupyterLab**: http://localhost:8888 (token: `easy`)
- **講師ダッシュボード**: http://localhost:3000
- **管理画面**: http://localhost:3000/admin
- **API**: http://localhost:8000

### 4. 初期セットアップ
```bash
# JupyterLabで拡張機能が有効か確認
# Settings → Advanced Settings Editor → Cell Monitor
```

## 🔧 詳細セットアップ手順

### Docker環境セットアップ

#### 1. 前提条件確認
```bash
# Docker & Docker Compose バージョン確認
docker --version          # 20.10+ 必要
docker compose version    # 2.0+ 必要

# 利用可能リソース確認
docker system info | grep -E 'CPUs|Total Memory'
```

#### 2. 環境変数設定
```bash
# .env ファイル編集
cat > .env << EOF
# Database
POSTGRES_USER=admin
POSTGRES_PASSWORD=secretpassword
POSTGRES_DB=progress_db

# JupyterLab
JUPYTER_TOKEN=easy

# Development
NODE_ENV=development
PYTHONPATH=/app

# Optional: Production settings
# COMPOSE_PROFILES=production
EOF
```

#### 3. サービス起動
```bash
# 全サービス一括起動
docker compose up --build

# バックグラウンド起動
docker compose up --build -d

# 特定サービスのみ起動
docker compose up jupyterlab fastapi instructor-dashboard
```

#### 4. サービス状態確認
```bash
# 起動状況確認
docker compose ps

# ログ確認
docker compose logs -f

# 特定サービスのログ
docker compose logs -f instructor-dashboard
```

### 開発環境セットアップ

#### 1. Node.js環境（講師ダッシュボード）
```bash
cd instructor-dashboard

# 依存パッケージインストール
npm install

# 開発サーバー起動
npm start

# ビルド
npm run build

# テスト実行
npm test
```

#### 2. Python環境（FastAPIサーバー）
```bash
cd fastapi_server

# 仮想環境作成・有効化
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 依存パッケージインストール
pip install -r requirements.txt

# 開発サーバー起動
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# テスト実行
pytest
pytest -m integration  # 統合テスト
```

#### 3. JupyterLab拡張機能
```bash
cd cell-monitor-extension

# 依存パッケージインストール
npm install

# 開発ビルド
npm run build

# ウォッチモード
npm run watch

# 配布用ビルド
./build-extension.sh
```

## ⚙️ 設定詳細

### JupyterLab設定

#### 1. 拡張機能設定
```bash
# JupyterLabアクセス
http://localhost:8888?token=easy

# Settings → Advanced Settings Editor → Cell Monitor
```

#### 2. 設定JSON例
```json
{
  "serverUrl": "http://localhost:8000/api/v1/events",
  "userId": "student_001",
  "userName": "学生太郎",
  "enableLogging": true,
  "batchSize": 10,
  "flushInterval": 5000
}
```

### FastAPI設定

#### 1. データベース設定
```python
# fastapi_server/core/config.py
DATABASE_URL = "postgresql://admin:secretpassword@postgres:5432/progress_db"
INFLUXDB_URL = "http://influxdb:8086"
REDIS_URL = "redis://redis:6379"
```

#### 2. CORS設定
```python
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8888",
    "http://instructor-dashboard:3000"
]
```

### 講師ダッシュボード設定

#### 1. API接続設定
```typescript
// instructor-dashboard/src/config/api.ts
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
export const WEBSOCKET_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws';
```

#### 2. 管理画面設定
```typescript
// 管理画面アクセス
http://localhost:3000/admin

// 差分更新設定
- 差分モード: 有効
- 圧縮閾値: 10%
- バッチサイズ: 50
```

## 🗄️ データベースセットアップ

### PostgreSQL初期化
```bash
# データベースコンテナ接続
docker compose exec postgres psql -U admin -d progress_db

# テーブル確認
\dt

# サンプルデータ投入
INSERT INTO students (email, name, team_name) VALUES 
('student1@example.com', '学生1', 'A'),
('student2@example.com', '学生2', 'B');
```

### InfluxDB初期化
```bash
# InfluxDBコンテナ接続
docker compose exec influxdb influx

# バケット作成
CREATE DATABASE metrics;
SHOW DATABASES;
```

### Redis確認
```bash
# Redisコンテナ接続
docker compose exec redis redis-cli

# 接続テスト
ping
keys *
```

## 🔍 トラブルシューティング

### 一般的な問題

#### 1. ポート競合エラー
```bash
# 使用中ポート確認
netstat -tulpn | grep :3000
lsof -i :3000

# ポート変更（docker-compose.yml）
ports:
  - "3001:3000"  # 3000 → 3001に変更
```

#### 2. Docker容量不足
```bash
# 不要なコンテナ・イメージ削除
docker system prune -a

# ボリューム削除
docker volume prune

# 容量確認
docker system df
```

#### 3. 拡張機能が表示されない
```bash
# JupyterLab拡張機能確認
jupyter labextension list

# 拡張機能再インストール
cd cell-monitor-extension
npm run build
jupyter labextension install .
jupyter lab clean
jupyter lab build
```

#### 4. WebSocket接続エラー
```bash
# FastAPIログ確認
docker compose logs -f fastapi

# ネットワーク接続確認
curl -f http://localhost:8000/health

# WebSocket接続テスト
wscat -c ws://localhost:8000/ws/dashboard
```

### パフォーマンス最適化

#### 1. メモリ使用量削減
```bash
# Docker設定調整
echo '{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}' > /etc/docker/daemon.json

sudo systemctl restart docker
```

#### 2. データベース最適化
```sql
-- PostgreSQL設定最適化
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
SELECT pg_reload_conf();
```

## 🧪 テスト実行

### 自動テストスイート
```bash
# 全体テスト実行
npm run test:all

# コンポーネント別テスト
cd instructor-dashboard && npm test
cd fastapi_server && pytest
cd cell-monitor-extension && npm test
```

### 手動テスト手順
```bash
# 1. JupyterLabでセル実行
# 2. ダッシュボードで更新確認
# 3. 管理画面で統計確認
# 4. WebSocket接続状態確認
```

## 🚢 本番環境デプロイ

### Docker Compose（本番用）
```bash
# 本番環境用設定
cp docker-compose.yml docker-compose.prod.yml

# 本番用環境変数
cp .env.prod.example .env.prod

# SSL証明書設定
mkdir -p ssl/
# SSL証明書をssl/ディレクトリに配置

# 本番環境起動
docker compose -f docker-compose.prod.yml up -d
```

### 環境変数（本番用）
```bash
# .env.prod
NODE_ENV=production
POSTGRES_PASSWORD=<強力なパスワード>
JUPYTER_TOKEN=<ランダムトークン>
SSL_CERT_PATH=/ssl/cert.pem
SSL_KEY_PATH=/ssl/key.pem
```

### セキュリティ設定
```bash
# ファイアウォール設定
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# SSL証明書更新（Let's Encrypt）
certbot renew --dry-run
```

## 📊 監視・ログ

### ログ確認
```bash
# アプリケーションログ
docker compose logs -f --tail=100

# システムログ
journalctl -u docker -f

# ログローテーション設定
logrotate -f /etc/logrotate.d/docker
```

### ヘルスチェック
```bash
# API ヘルスチェック
curl -f http://localhost:8000/health

# データベース接続確認
docker compose exec postgres pg_isready -U admin

# 自動ヘルスチェック設定
# docker-compose.ymlのhealthcheck設定参照
```

## 📚 追加リソース

- [API仕様書](./API_SPECIFICATION.md)
- [開発者ガイド](./DEVELOPER_GUIDE.md)
- [運用ガイド](./OPERATIONS_GUIDE.md)
- [トラブルシューティング](./reference/troubleshooting.md)

---

**サポート**: 問題が発生した場合は [Issues](https://github.com/your-org/jupyter-extensionver2-claude-code/issues) に報告してください。  
**最終更新**: ${new Date().toISOString().slice(0, 10)}