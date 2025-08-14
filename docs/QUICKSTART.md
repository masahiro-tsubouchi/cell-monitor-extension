# クイックスタートガイド

JupyterLab Cell Monitor Extensionシステムの迅速なセットアップと動作確認のためのガイドです。

## 🚀 5分でセットアップ

### 1. 前提条件

以下がインストールされていることを確認してください：
- Docker & Docker Compose
- Git

### 2. プロジェクトクローンと起動

```bash
# プロジェクトをクローン
git clone <repository-url>
cd jupyter-extensionver2-claude-code

# 全サービスを起動
docker-compose up --build
```

### 3. 各サービスへのアクセス

起動完了後（約2-3分）、以下にアクセスできます：

| サービス | URL | 用途 |
|---------|-----|------|
| **JupyterLab** | http://localhost:8888 | 学習環境（token: easy） |
| **FastAPI** | http://localhost:8000 | APIサーバー |
| **ダッシュボード** | http://localhost:3000 | 講師用監視画面 |

## 🧪 動作確認テスト

### 1. JupyterLabでセル実行

1. http://localhost:8888 にアクセス（token: easy）
2. 新しいノートブックを作成
3. セルにコードを入力して実行：
   ```python
   print("Hello, World!")
   ```

### 2. イベント送信の確認

ブラウザの開発者ツール（F12）で：
1. **Network** タブを開く
2. セル実行後、`events` へのPOSTリクエストを確認
3. レスポンスが200 OKであることを確認

### 3. ダッシュボードでの確認

1. http://localhost:3000 にアクセス
2. リアルタイムでセル実行イベントが表示されることを確認

## ⚙️ JupyterLab拡張機能の設定

### 設定手順

1. JupyterLab画面で **Settings** → **Advanced Settings Editor**
2. 左ペインで **Cell Monitor** を選択
3. 右ペインで以下を設定：

```json
{
  "serverUrl": "http://fastapi:8000/api/v1/events",
  "userId": "test_user",
  "userName": "テストユーザー"
}
```

4. **Save User Settings** をクリック

## 🔧 よくある問題と解決方法

### JupyterLabが起動しない
```bash
# コンテナの状態を確認
docker-compose ps

# ログを確認
docker-compose logs jupyterlab
```

### イベントが送信されない
1. 拡張機能の設定を確認
2. FastAPIサーバーが起動しているか確認
3. ブラウザのコンソールエラーを確認

### ダッシュボードに表示されない
1. WebSocket接続を確認
2. Redisサービスの状態を確認

## 📚 次のステップ

セットアップが完了したら：

1. **講師向け**: [講師用ガイド](user-guide/instructors.md) でダッシュボードの活用方法を学習
2. **開発者向け**: [開発者ガイド](developer-guide/) でアーキテクチャと開発方法を理解
3. **管理者向け**: [展開ガイド](deployment/) で本番環境への展開方法を確認

## 🆘 サポート

問題が解決しない場合：
- [トラブルシューティング](reference/troubleshooting.md) を確認
- [GitHub Issues](https://github.com/your-repo/issues) で問題を報告
