# Development Setup Guide - Cell Monitor Extension

**最終更新**: 2025-08-29  
**対象バージョン**: v1.1.4

## 🎯 開発環境セットアップガイド

Cell Monitor Extension の開発環境構築と開発ワークフローの包括的なガイドです。

---

## 📚 セットアップガイド

### 🌐 環境構築
- **[Environment Setup](dev/SETUP_ENVIRONMENT.md)** - 開発環境の構築と初期セットアップ
  - 必須ソフトウェアとツールの確認
  - 依存関係のインストール手順
  - 拡張機能のビルドと有効化
  - VS Code・TypeScript・ESLint設定
  - Jest テスト環境の構築

### 🔄 開発ワークフロー
- **[Development Workflow](dev/SETUP_WORKFLOW.md)** - 日常的な開発フローとビルドプロセス
  - 日常的な開発サイクル
  - 機能追加のワークフロー
  - ビルド・パッケージング手順
  - CI/CD統合とプレコミットフック
  - 効率化のコツとホットリロード

### 🐛 デバッグ・トラブルシューティング
- **[Debug & Troubleshoot](dev/SETUP_DEBUG.md)** - デバッグ手法とトラブルシューティング
  - ブラウザ開発者ツール活用
  - VS Code デバッグ設定
  - 拡張機能・ビルド・テスト問題の解決
  - パフォーマンス診断とメトリクス
  - 自動診断システム

---

## 🚀 クイックスタート

### 基本セットアップ（5分）
```bash
# 1. リポジトリクローン
git clone <repository-url>
cd jupyter-extensionver2-claude-code/cell-monitor-extension

# 2. 依存関係インストール
npm install
pip install -e .

# 3. 拡張機能リンクとビルド
jupyter labextension develop . --overwrite
npm run build

# 4. JupyterLab起動
jupyter lab
```

### 開発モード起動
```bash
# 自動ビルド監視モード
npm run watch

# JupyterLab起動（別ターミナル）
jupyter lab --ip=127.0.0.1 --port=8888
```

---

## ⭐ 主要コマンド

### ビルド・テスト
```bash
# 開発ビルド
npm run build

# プロダクションビルド
npm run build:prod

# テスト実行
npm test

# カバレッジ付きテスト
npm run test:coverage

# コード品質チェック
npm run eslint:check
```

### 配布・デプロイメント
```bash
# パッケージ生成
python -m build

# パッケージインストール
pip install dist/cell_monitor-0.1.0-py3-none-any.whl

# 拡張機能確認
jupyter labextension list
```

---

## 📊 品質基準

### コード品質メトリクス
- **TypeScript厳格モード**: 100%準拠
- **テストカバレッジ**: 85%以上
- **ESLint違反**: 0件
- **バンドルサイズ**: 200KB以下

### 開発ツール
- **Node.js**: 18.0+
- **JupyterLab**: 4.2.4+
- **TypeScript**: 5.0+
- **Jest**: テストフレームワーク

---

## 🔗 関連ドキュメント

- [Development Guide](../DEVELOPMENT_GUIDE.md) - 開発ガイド全体
- [Implementation & Testing](../dev/IMPLEMENTATION_TESTING.md) - 実装ガイドとテスト戦略
- [TypeScript API](../api/TYPESCRIPT_API.md) - APIリファレンス

この開発環境セットアップガイドにより、効率的で品質の高い Cell Monitor Extension 開発が可能になります。

**最終更新**: 2025-08-24  
**次回レビュー予定**: 2025-11-24
