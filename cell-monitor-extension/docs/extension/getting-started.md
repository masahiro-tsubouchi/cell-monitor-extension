# Getting Started - Cell Monitor Extension

**対象**: JupyterLab拡張機能を初めて使用する開発者・管理者  
**所要時間**: 15-20分  
**前提条件**: JupyterLab 4.2+, Docker（推奨）

---

## 🚀 クイックスタート

### 1. 環境準備（5分）

#### Docker環境（推奨）
```bash
# リポジトリクローン
git clone https://github.com/your-org/cell-monitor-extension.git
cd cell-monitor-extension

# Docker Composeで一括起動
docker compose up --build
```

#### 手動インストール
```bash
# Python環境準備
pip install jupyterlab>=4.2.0

# 拡張機能インストール
pip install dist/cell_monitor-1.1.4-py3-none-any.whl
```

### 2. JupyterLabアクセス（2分）

```bash
# ブラウザで以下にアクセス
http://localhost:8888?token=easy
```

### 3. 初期設定（5分）

#### Settings → Advanced Settings Editor → Cell Monitor
```json
{
  "serverUrl": "http://localhost:8000/api/v1/events",
  "userId": "your-id",
  "userName": "Your Name",
  "teamName": "チーム1",
  "batchSize": 10,
  "maxRetries": 3,
  "enableNotifications": true
}
```

### 4. 動作確認（3分）

1. **新しいノートブック作成**
2. **セルにコード入力**: `print("Hello, Cell Monitor!")`
3. **実行**: `Shift + Enter`
4. **ヘルプボタン確認**: ツールバーの🆘アイコン

---

## ✅ 正常動作の確認

### ブラウザ開発者ツール（F12）で確認：
```javascript
// Console に以下のログが表示されるか確認
[CellMonitor][EventManager][DEBUG] Cell execution event captured
[CellMonitor][DataTransmissionService][DEBUG] Event sent successfully
```

### 期待される動作：
- セル実行時にイベントが自動送信される
- ヘルプボタンがツールバーに表示される
- 設定変更が即座に反映される

---

## 🔄 次のステップ

### 開発者向け
- [Extension Development Guide](extension-development.md) - カスタマイズ方法
- [JupyterLab Integration](jupyterlab-integration.md) - 統合詳細
- [API Reference](../api/core-classes.md) - プログラマティック操作

### エンドユーザー向け
- [Educator Handbook](../guides/educator-handbook.md) - 教育者向け活用法
- [Student Workflow](../guides/student-workflow.md) - 学生向け使用方法
- [Troubleshooting](../guides/troubleshooting.md) - 問題解決

### 管理者向け
- [Configuration Guide](configuration.md) - 詳細設定
- [Operations Guide](../OPERATIONS_GUIDE.md) - 運用手順
- [Installation Guide](installation.md) - 本番環境構築

---

## 🆘 サポート

### よくある問題
1. **拡張機能が表示されない** → [Troubleshooting](../guides/troubleshooting.md#extension-not-visible)
2. **イベントが送信されない** → [Configuration](configuration.md#event-transmission)
3. **パフォーマンスが遅い** → [Best Practices](../guides/best-practices.md#performance)

### 技術サポート
- **Issues**: [GitHub Issues](https://github.com/your-org/cell-monitor-extension/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/cell-monitor-extension/discussions)
- **Email**: support@your-org.com

**最終更新**: 2025-08-29