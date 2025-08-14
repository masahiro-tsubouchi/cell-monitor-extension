# JupyterLab Cell Monitor Extension システムドキュメント

このドキュメントは、JupyterLabを通じて生徒の学習進捗をリアルタイムで追跡・分析するシステムの包括的なガイドです。

## 📚 ドキュメント構成

### 🚀 はじめに
- **[クイックスタート](QUICKSTART.md)** - システムの最速セットアップ手順
- **[システム概要](overview/SYSTEM_OVERVIEW.md)** - アーキテクチャと主要機能の理解

### 🎯 実装計画（Implementation Plans）
> **AI駆動開発向け**: これらのドキュメントを参照して実装を進めてください

- **[システム実装計画](implementation-plans/SYSTEM_IMPLEMENTATION_PLAN.md)** - システム全体の実装戦略
- **[FastAPI実装計画](implementation-plans/FASTAPI_IMPLEMENTATION_PLAN.md)** - バックエンドAPI実装手順
- **[フロントエンド実装計画](implementation-plans/FRONTEND_IMPLEMENTATION_PLAN.md)** - React/JupyterLab拡張実装手順
- **[データベース実装計画](implementation-plans/DATABASE_IMPLEMENTATION_PLAN.md)** - データモデル実装手順

### 📊 実装状況（Implementation Status）
> **開発チーム向け**: 現在の実装状況と問題点を把握してください

- **[システム実装状況](implementation-status/SYSTEM_STATUS.md)** - システム全体の完成度
- **[FastAPI実装状況](implementation-status/FASTAPI_STATUS.md)** - バックエンドの実装状況
- **[フロントエンド実装状況](implementation-status/FRONTEND_STATUS.md)** - フロントエンドの実装状況
- **[既知の問題](implementation-status/KNOWN_ISSUES.md)** - 修正が必要な問題一覧

### 🔧 開発ガイド
- **[開発環境セットアップ](development/ENVIRONMENT_SETUP.md)** - ローカル開発環境の構築
- **[コーディング規約](development/CODING_STANDARDS.md)** - コードスタイルとベストプラクティス
- **[テスト戦略](development/TESTING_GUIDE.md)** - テストの書き方と実行方法
- **[デバッグガイド](development/DEBUGGING_GUIDE.md)** - 問題解決の手順

### 📖 API仕様
- **[API仕様書](api/API_SPECIFICATION.md)** - RESTful API エンドポイント一覧
- **[WebSocket仕様](api/WEBSOCKET_SPECIFICATION.md)** - リアルタイム通信仕様
- **[データモデル](api/DATA_MODELS.md)** - データベーススキーマとAPI契約

### 🚢 デプロイメント
- **[本番デプロイ](deployment/PRODUCTION_DEPLOYMENT.md)** - 本番環境への展開手順
- **[Docker構成](deployment/DOCKER_GUIDE.md)** - コンテナ環境での実行
- **[インフラ要件](deployment/INFRASTRUCTURE_REQUIREMENTS.md)** - システム要件

### 👥 ユーザーガイド
- **[学生向けガイド](user-guide/STUDENT_GUIDE.md)** - JupyterLab拡張の使用方法
- **[講師向けガイド](user-guide/INSTRUCTOR_GUIDE.md)** - ダッシュボードの使用方法
- **[管理者ガイド](user-guide/ADMIN_GUIDE.md)** - システム管理と監視

## 🤖 AI駆動開発の使い方

### 新機能を実装する場合
1. **実装計画を確認**: 関連する`implementation-plans/`のドキュメントを読む
2. **現在の状況を把握**: `implementation-status/`で既存実装を確認
3. **API仕様を確認**: `api/`でデータ契約を理解
4. **開発環境を準備**: `development/ENVIRONMENT_SETUP.md`に従って環境構築
5. **実装開始**: 実装計画の手順に従って開発
6. **テスト実行**: `development/TESTING_GUIDE.md`に従ってテスト

### 問題を修正する場合
1. **既知の問題を確認**: `implementation-status/KNOWN_ISSUES.md`をチェック
2. **デバッグガイドを参照**: `development/DEBUGGING_GUIDE.md`で診断手順を確認
3. **関連する実装状況を確認**: 該当する`implementation-status/`ドキュメントを読む
4. **修正実装**: 実装計画に従って修正
5. **テスト**: 修正内容をテストで検証

## 👨‍💻 初級開発者向けの学習パス

### Level 1: システム理解
1. [システム概要](overview/SYSTEM_OVERVIEW.md) - 全体像の把握
2. [クイックスタート](QUICKSTART.md) - 動くシステムの体験
3. [開発環境セットアップ](development/ENVIRONMENT_SETUP.md) - 環境構築

### Level 2: 実装理解
1. [システム実装状況](implementation-status/SYSTEM_STATUS.md) - 現状把握
2. [API仕様書](api/API_SPECIFICATION.md) - インターフェース理解
3. [データモデル](api/DATA_MODELS.md) - データ構造理解

### Level 3: 実装参加
1. [コーディング規約](development/CODING_STANDARDS.md) - 開発ルール理解
2. [テスト戦略](development/TESTING_GUIDE.md) - 品質保証方法
3. [実装計画](implementation-plans/) - 具体的な実装手順

## 🔄 ドキュメント更新について

このドキュメントは実装の進行に合わせて継続的に更新されます：

- **実装計画**: システム設計変更時に更新
- **実装状況**: 新機能追加・バグ修正時に更新
- **API仕様**: インターフェース変更時に更新
- **ユーザーガイド**: UI/UX変更時に更新

## 📝 貢献方法

ドキュメントの改善・更新に貢献する場合：

1. 該当するドキュメントを編集
2. 変更内容を明記
3. レビューを依頼
4. 承認後にマージ

---

**最終更新**: 2024年
**次回更新予定**: 実装進捗に応じて適時
