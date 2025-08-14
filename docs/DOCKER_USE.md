# Docker容量管理ガイド

## 📊 概要

JupyterLab Cell Monitor Extension システムでは、複数のDockerコンテナを使用するため、適切な容量管理が重要です。このガイドでは、Docker容量問題の原因と解決策を詳しく説明します。

## 🚨 Docker容量問題の現状

### 典型的な容量使用状況
```
サービス名                     容量使用量    主な要因
JupyterLab                   1.06GB       Python + Node.js + 拡張機能ビルド
Instructor Dashboard         765MB        React + 開発依存関係
FastAPI Server              603MB        Python + 依存関係
Worker                      603MB        FastAPI Serverと同じベース
データベース群               ~700MB       PostgreSQL + InfluxDB + Redis
─────────────────────────────────────────────────────
合計                        約3.7GB
```

## 🔍 容量が大きくなる主な原因

### 1. `.dockerignore`ファイルの未使用
- **問題**: `node_modules`、`.git`、テストファイルがコンテナに含まれる
- **影響**: 1つのサービスで+300MB以上
- **解決策**: 適切な`.dockerignore`ファイルの配置

### 2. Single-stage buildの使用
- **問題**: 開発依存関係とビルドツールが本番コンテナに残る
- **影響**: 不要なパッケージで+200MB程度
- **解決策**: Multi-stage buildの採用

### 3. キャッシュの蓄積
- **問題**: apt、pip、npmキャッシュが削除されない
- **影響**: ビルドキャッシュで+500MB程度
- **解決策**: 定期的なキャッシュクリーンアップ

### 4. 古いイメージの蓄積
- **問題**: ビルド毎に新しいイメージが作成され、古いものが残る
- **影響**: 開発中に+2GB以上蓄積
- **解決策**: 定期的な未使用イメージの削除

## ⚡ 緊急対応（今すぐできる解決策）

### 即座に容量を削減する方法

```bash
# 🚀 素早いクリーンアップ（開発中でも安全）
./scripts/dev-quick-clean.sh

# 🧹 より徹底的なクリーンアップ
./scripts/docker-cleanup.sh

# ⚠️  最後の手段（全てのDockerリソースを削除）
docker system prune -a -f
```

### 各コマンドの効果

| コマンド | 削除対象 | 安全性 | 予想削減量 |
|---------|----------|--------|------------|
| `dev-quick-clean.sh` | 停止コンテナ、danglingイメージ、ビルドキャッシュ | 高 | 200-500MB |
| `docker-cleanup.sh` | 上記 + 未使用ネットワーク/ボリューム | 中 | 500MB-1GB |
| `docker system prune -a` | 使用中以外の全Dockerリソース | 低 | 1-2GB |

## 🛠️ 恒久的な解決策

### 1. .dockerignoreファイルの活用

各サービスディレクトリに配置済み：

```
📁 プロジェクトルート/
├── .dockerignore              # グローバル除外設定
├── 📁 instructor-dashboard/
│   └── .dockerignore          # React固有の除外設定
├── 📁 cell-monitor-extension/
│   └── .dockerignore          # JupyterLab拡張機能固有
├── 📁 fastapi_server/
│   └── .dockerignore          # Python API固有
└── 📁 scripts/
    ├── docker-cleanup.sh      # 定期メンテナンス用
    └── dev-quick-clean.sh     # 開発中の素早いクリーンアップ
```

### 2. Multi-stage buildの導入

**本番環境向けに最適化された例**：

```dockerfile
# Stage 1: Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Stage 2: Production stage
FROM nginx:alpine AS production
COPY --from=builder /app/build /usr/share/nginx/html
EXPOSE 80
```

**容量削減効果**：
- React Dashboard: 765MB → 約150MB（80%削減）
- 全体で約1.2GB削減予想

### 3. 効率的な開発ワークフロー

```bash
# 📦 プロジェクト管理用コマンド（package.jsonで定義済み）
npm run dev          # 開発環境起動
npm run stop         # 停止
npm run clean        # 完全クリーンアップ
npm run rebuild      # キャッシュなし完全再ビルド
npm run status       # 現在の状態確認
npm run logs         # ログ表示
```

## 📋 日常的な運用方法

### 開発中の効率的なパターン

#### 🔄 軽微な変更時
```bash
# コードの小さな修正後
docker compose restart instructor-dashboard
```

#### 🛠️ 依存関係変更時
```bash
./scripts/dev-quick-clean.sh
docker compose up -d --build
```

#### 💾 容量警告が出た時
```bash
./scripts/dev-quick-clean.sh     # 軽微なクリーンアップ
# まだ足りない場合
docker system prune -a -f       # 強力なクリーンアップ
```

### 定期メンテナンススケジュール

| 頻度 | 実行内容 | コマンド |
|------|----------|----------|
| 毎日 | 開発終了時 | `docker compose down` |
| 週1回 | 軽いクリーンアップ | `./scripts/dev-quick-clean.sh` |
| 月1回 | 徹底的なクリーンアップ | `./scripts/docker-cleanup.sh` |
| 必要時 | 緊急容量削減 | `docker system prune -a -f` |

## 📈 容量使用量の監視

### 使用量確認コマンド

```bash
# 📊 現在の使用量確認
docker system df

# 📋 詳細な使用量確認
docker system df -v

# 🔍 イメージ毎のサイズ確認
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
```

### 警告しきい値の目安

| 使用量 | 状態 | 推奨アクション |
|-------|------|---------------|
| < 5GB | 正常 | - |
| 5-8GB | 注意 | `dev-quick-clean.sh`実行 |
| 8-12GB | 警告 | `docker-cleanup.sh`実行 |
| > 12GB | 危険 | `docker system prune -a`実行 |

## 🚀 最適化の効果

### Before（最適化前）
```
Images:     8個, 3.5GB
Containers: 多数の停止コンテナが蓄積
Volumes:    37個, 8.2GB（多数の未使用ボリューム）
Cache:      500MB以上のビルドキャッシュ
```

### After（最適化後）
```
Images:     必要なもののみ, 約2.5GB
Containers: 稼働中のもののみ
Volumes:    必要なもののみ, 約2GB
Cache:      定期的にクリーンアップされた状態
```

**総削減効果**: 約3-4GB削減

## ⚠️ 注意事項

### データ損失のリスクがあるコマンド

```bash
# ⚠️  注意：全ての未使用ボリュームを削除（データベースデータも削除される可能性）
docker volume prune -f

# ⚠️  注意：全てのDockerリソースを削除
docker system prune -a -f
```

### 安全な運用のために

1. **重要なデータのバックアップ**
   ```bash
   # データベースボリュームのバックアップ
   docker run --rm -v jupyter-extensionver2-claude-code_postgres_data:/source:ro busybox tar -czf - -C /source . > postgres_backup.tar.gz
   ```

2. **段階的なクリーンアップ**
   - まずは安全な`dev-quick-clean.sh`から開始
   - 容量が足りない場合のみより強力なコマンドを使用

3. **定期的な確認**
   ```bash
   # 週1回、使用量チェック
   docker system df
   ```

## 🎯 まとめ

Docker容量問題は適切な管理により解決できます：

✅ **即効性**: `dev-quick-clean.sh`で500MB程度削減
✅ **根本解決**: `.dockerignore`とMuti-stage buildで1.2GB削減予想
✅ **継続管理**: 定期メンテナンスで問題再発防止
✅ **開発効率**: 効率的なワークフローで生産性維持

適切な運用により、`docker system prune`を手動実行する必要がない、持続可能な開発環境を構築できます。
