# インストールガイド

JupyterLab Cell Monitor拡張機能システムの本格的な環境へのインストール方法を説明します。

## 🎯 インストール方式の選択

### 1. Docker Compose（推奨）
- 最も簡単で確実
- 開発・検証環境に最適
- 全サービスが統合されている

### 2. 個別インストール
- カスタマイズ性が高い
- 既存システムとの統合が可能
- 本番環境での詳細な制御が必要な場合

### 3. Kubernetes
- 大規模展開に適している
- 高可用性が必要な場合
- コンテナオーケストレーションの経験が必要

## 🐳 Docker Compose インストール

### システム要件

#### 最小要件
- CPU: 2コア以上
- メモリ: 4GB以上
- ディスク: 10GB以上の空き容量
- Docker: 20.10以上
- Docker Compose: 2.0以上

#### 推奨要件
- CPU: 4コア以上
- メモリ: 8GB以上
- ディスク: 50GB以上の空き容量
- SSD推奨

### インストール手順

#### 1. リポジトリのクローン
```bash
git clone <repository-url>
cd jupyter-extensionver2-claude-code
```

#### 2. 環境変数の設定
```bash
# .env ファイルの作成
cp .env.example .env

# 必要に応じて設定を編集
nano .env
```

#### 3. サービスの起動
```bash
# 初回起動（ビルド含む）
docker-compose up --build -d

# 状態確認
docker-compose ps

# ログ確認
docker-compose logs -f
```

#### 4. 動作確認
- JupyterLab: http://localhost:8888
- FastAPI: http://localhost:8000
- Dashboard: http://localhost:3000

### カスタマイズ設定

#### docker-compose.override.yml
```yaml
# 本番環境用の設定例
services:
  jupyterlab:
    environment:
      - JUPYTER_TOKEN=${JUPYTER_TOKEN}
    volumes:
      - /data/notebooks:/notebooks

  fastapi:
    environment:
      - DATABASE_URL=postgresql://user:pass@external-db:5432/dbname

  postgres:
    environment:
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - /data/postgres:/var/lib/postgresql/data
```

## 🔧 個別コンポーネントインストール

### JupyterLab拡張機能

#### 事前準備
```bash
# Node.js環境の確認
node --version  # v18以上が必要
npm --version

# Python環境の確認
python --version  # 3.8以上が必要
pip --version
```

#### 拡張機能のビルドとインストール
```bash
cd cell-monitor-extension

# 依存関係のインストール
npm install

# 拡張機能のビルド
npm run build:prod

# Python パッケージのビルド
pip install build
python -m build

# インストール
pip install dist/cell_monitor-*.whl
```

#### JupyterLab環境での有効化
```bash
# 拡張機能の有効化
jupyter labextension enable cell-monitor

# JupyterLabの再起動
jupyter lab --ip=0.0.0.0 --port=8888 --no-browser
```

### FastAPIサーバー

#### 依存関係のインストール
```bash
cd fastapi_server

# 仮想環境の作成（推奨）
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# パッケージのインストール
pip install -r requirements.txt
```

#### データベースセットアップ
```bash
# PostgreSQLの準備（別途インストール必要）
createdb progress_db

# マイグレーション実行
alembic upgrade head
```

#### サーバー起動
```bash
# 開発モード
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 本番モード
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Instructor Dashboard

#### 依存関係のインストール
```bash
cd instructor-dashboard

# Node.js パッケージのインストール
npm install
```

#### ビルドと起動
```bash
# 開発モード
npm start

# 本番ビルド
npm run build

# 本番サーバー（例：nginx）
# buildフォルダの内容を静的ファイルとして配信
```

## 🗄️ データベース設定

### PostgreSQL

#### インストール（Ubuntu/Debian）
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### データベース・ユーザー作成
```bash
sudo -u postgres psql

CREATE DATABASE progress_db;
CREATE USER dbuser WITH ENCRYPTED PASSWORD 'dbpass';
GRANT ALL PRIVILEGES ON DATABASE progress_db TO dbuser;
\q
```

### InfluxDB

#### インストール
```bash
# InfluxDB 2.x のインストール
wget https://dl.influxdata.com/influxdb/releases/influxdb2-2.7.0-linux-amd64.tar.gz
tar xvfz influxdb2-2.7.0-linux-amd64.tar.gz
sudo cp influxdb2-2.7.0-linux-amd64/influxd /usr/local/bin/
```

#### 初期設定
```bash
# InfluxDB起動
influxd

# 別ターミナルで設定
influx setup \
  --username admin \
  --password secretpassword \
  --org my-org \
  --bucket progress_bucket \
  --force
```

### Redis

#### インストール（Ubuntu/Debian）
```bash
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

#### 設定確認
```bash
redis-cli ping
# 応答: PONG
```

## 🔐 セキュリティ設定

### SSL/TLS証明書の設定

#### Let's Encryptの使用
```bash
# certbotのインストール
sudo apt install certbot

# 証明書の取得
sudo certbot certonly --standalone -d your-domain.com

# nginx設定例
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 認証・認可の設定

#### JWT秘密鍵の生成
```bash
# 強力な秘密鍵を生成
openssl rand -hex 32

# 環境変数に設定
echo "JWT_SECRET_KEY=<generated-key>" >> .env
```

#### データベース認証情報
```bash
# 強力なパスワードの使用
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" >> .env
echo "INFLUXDB_TOKEN=$(openssl rand -hex 32)" >> .env
```

## 📊 監視・ログ設定

### ログ設定

#### アプリケーションログ
```bash
# ログディレクトリの作成
sudo mkdir -p /var/log/jupyter-monitor
sudo chown $USER:$USER /var/log/jupyter-monitor
```

#### ログローテーション
```bash
# /etc/logrotate.d/jupyter-monitor
/var/log/jupyter-monitor/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 www-data www-data
}
```

### システム監視

#### Systemdサービス化
```bash
# /etc/systemd/system/fastapi-server.service
[Unit]
Description=FastAPI Server for Jupyter Monitor
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/jupyter-monitor/fastapi_server
Environment=PATH=/opt/jupyter-monitor/venv/bin
ExecStart=/opt/jupyter-monitor/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

## 🧪 動作確認とテスト

### ヘルスチェック

#### 各サービスの確認
```bash
# FastAPI
curl http://localhost:8000/health

# PostgreSQL
psql -h localhost -U dbuser -d progress_db -c "SELECT 1;"

# InfluxDB
curl http://localhost:8086/health

# Redis
redis-cli ping
```

#### 統合テスト
```bash
cd fastapi_server
pytest tests/integration/
```

### 負荷テスト

#### 基本的な負荷テスト
```bash
# Apache Benchを使用
ab -n 1000 -c 10 http://localhost:8000/api/v1/events
```

## 🚨 トラブルシューティング

### よくある問題

#### ポート衝突
```bash
# 使用中のポートを確認
sudo netstat -tulpn | grep :8000

# プロセスの停止
sudo kill -9 <PID>
```

#### ディスク容量不足
```bash
# ディスク使用量確認
df -h

# Dockerイメージの清理
docker system prune -a
```

#### メモリ不足
```bash
# メモリ使用量確認
free -h

# スワップファイルの追加
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## 📋 本番環境チェックリスト

### セキュリティ
- [ ] SSL/TLS証明書の設定
- [ ] 強力なパスワードの設定
- [ ] ファイアウォールの設定
- [ ] 不要なサービスの無効化

### パフォーマンス
- [ ] データベースのインデックス最適化
- [ ] アプリケーションキャッシュの設定
- [ ] ログローテーションの設定
- [ ] 監視システムの構築

### 可用性
- [ ] 自動起動サービスの設定
- [ ] バックアップ戦略の実装
- [ ] 障害監視の設定
- [ ] 復旧手順の文書化

---

**注意**: 本番環境では、セキュリティとパフォーマンスの観点から、適切な設定とメンテナンスが重要です。定期的なアップデートとセキュリティパッチの適用を忘れずに行ってください。
