# Cell Monitor Extension - 技術ドキュメント

JupyterLab Cell Monitor Extension の詳細な技術仕様と開発ガイドです。

## 🚀 クイックスタート

| 読者 | 推奨ドキュメント | 目的 |
|------|-----------------|------|
| **AI開発者** | [AI Development Context](./AI_DEVELOPMENT_CONTEXT.md) | AI駆動開発のための包括的コンテキスト |
| **人間開発者** | [Development Guide](./DEVELOPMENT_GUIDE.md) | 詳細な開発フローとベストプラクティス |
| **新規参加者** | [Setup Guide](./development/SETUP.md) | 開発環境の構築手順 |
| **システム管理者** | [Operations Guide](./OPERATIONS_GUIDE.md) | 運用・保守・トラブルシューティング |

## 📚 ドキュメント構成

### 🤖 AI開発支援
- **[AI Development Context](./AI_DEVELOPMENT_CONTEXT.md)** - AI開発者向け包括的コンテキスト情報
- **[Development Guide](./DEVELOPMENT_GUIDE.md)** - 詳細な開発フローとベストプラクティス

### 🏗️ アーキテクチャ
- [システムアーキテクチャ](./architecture/SYSTEM_ARCHITECTURE.md) - 拡張機能の全体設計
- [Extension Evaluation Report](./EXTENSION_EVALUATION_REPORT.md) - 品質評価と多角的分析

### 📡 API仕様
- [TypeScript API リファレンス](./api/TYPESCRIPT_API.md) - フロントエンドインターフェース

### 🛠️ 開発ガイド
- [開発環境セットアップ](./development/SETUP.md) - 開発開始手順
- [既知の問題一覧](./maintenance/KNOWN_ISSUES.md) - 既存問題の詳細分析と修正状況

### 📋 運用・管理ガイド
- [運用ガイド](./OPERATIONS_GUIDE.md) - 日常運用、サーバー停止時の動作、トラブルシューティング

### 🔗 統合ガイド
- [JupyterLab統合](./integration/JUPYTERLAB_INTEGRATION.md) - JupyterLabとの統合方法

## 🎯 拡張機能の概要

### 主要機能
- **リアルタイムセル監視**: セル実行イベントの自動キャプチャ
- **学習支援機能**: ヘルプリクエストシステム
- **データ収集**: 実行時間、エラー、出力結果の記録
- **設定管理**: 動的な設定変更とユーザーカスタマイズ

### 技術スタック
- **フロントエンド**: TypeScript 5.0, JupyterLab 4.2.4
- **バックエンド**: Python 3.8+, Tornado (JupyterLab server extension)
- **ビルドシステム**: JupyterLab Builder, Jest, ESLint
- **パッケージング**: Hatchling, Wheel distribution

### アーキテクチャの特徴
- **デュアルアーキテクチャ**: TypeScriptフロントエンド + Pythonサーバー拡張
- **イベント駆動**: JupyterLabシグナルベースの監視システム
- **プロキシパターン**: CORS回避のためのサーバー経由通信
- **設定スキーマ駆動**: JSON Schemaベースの設定管理

## 🚀 クイックスタート（開発者向け）

### 開発環境準備
```bash
# リポジトリのクローン
git clone <repository-url>
cd jupyter-extensionver2-claude-code/cell-monitor-extension

# 依存関係のインストール
npm install
pip install -e .

# 開発ビルド
npm run build

# JupyterLabで拡張機能を有効化
jupyter labextension develop . --overwrite
jupyter lab
```

### 主要ファイル構成
```
cell-monitor-extension/
├── src/                      # TypeScript ソースコード
│   ├── index.ts              # メインプラグイン実装
│   ├── types/interfaces.ts   # 型定義
│   ├── core/                 # コアロジック
│   │   ├── EventManager.ts   # イベント処理
│   │   └── SettingsManager.ts# 設定管理
│   ├── services/             # 外部サービス連携
│   │   └── DataTransmissionService.ts # データ送信
│   └── utils/                # ユーティリティ関数
├── cell_monitor/
│   ├── __init__.py           # Python拡張機能エントリーポイント
│   └── handlers.py           # プロキシハンドラー実装
├── schema/
│   └── plugin.json           # 設定スキーマ定義
├── tests/                    # Jest テストスイート
├── style/                    # CSS スタイル
└── docs/                     # 技術ドキュメント
```

## 🔧 開発のポイント

### 1. イベント処理の仕組み
```typescript
// セル実行イベントの監視
notebook.content.activeCellChanged.connect((notebook, cell) => {
  if (cell && cell.model.type === 'code') {
    // セル実行を監視し、データを収集
    monitorCellExecution(cell);
  }
});
```

### 2. 設定システムの活用
```typescript
// 動的設定の読み込み
settingRegistry.load(PLUGIN_ID).then(settings => {
  settings.changed.connect(() => {
    updateGlobalSettings(settings.composite);
  });
});
```

### 3. サーバー通信
```python
# Pythonプロキシハンドラー
class CellMonitorProxyHandler(APIHandler):
    async def post(self):
        # FastAPIサーバーへのプロキシ処理
        await self.proxy_to_fastapi_server(self.request.body)
```

## 📊 パフォーマンス特性

### 最適化機能
- **重複排除**: 500ms内の重複イベントを自動排除
- **メモリ管理**: 処理済みセルの自動クリーンアップ
- **非同期処理**: サーバー通信の非ブロッキング実装
- **エラー回復**: 指数バックオフによるリトライ機能

### メトリクス
- **レスポンス時間**: セル実行検知 < 100ms
- **メモリ使用量**: 基本動作時 < 10MB追加
- **ネットワーク**: イベント当たり平均 1KB データ送信

## 🧪 テスト戦略

### テスト構成
- **ユニットテスト**: 個別コンポーネントの機能検証
- **統合テスト**: JupyterLabとの統合確認
- **UI テスト**: ヘルプボタンと通知システム
- **設定テスト**: JSON Schema検証とデフォルト値確認

### カバレッジ目標
- **コードカバレッジ**: 85%以上
- **型安全性**: TypeScript strict mode準拠
- **アクセシビリティ**: ARIA属性とキーボードナビゲーション対応

---

## 🆘 サポート

### 開発支援
- **Issue トラッキング**: GitHub Issues で問題報告
- **開発チャット**: 開発者向けSlack チャンネル
- **技術相談**: 毎週火曜日のオフィスアワー

### ドキュメント改善
このドキュメントに関する改善提案や追加要望は、プルリクエストまたはIssueでお知らせください。

**最終更新**: 2025-01-18
**対応バージョン**: JupyterLab 4.2.4+
