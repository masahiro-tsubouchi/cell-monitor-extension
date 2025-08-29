# JupyterLab Cell Monitor Extension インストールガイド

**バージョン**: 1.1.3  
**最終更新**: 2025-08-29  
**対象**: 教育機関・学習環境・開発環境

---

## 📋 目次

- [🔧 事前準備](#-事前準備)
- [🚀 インストール方法](#-インストール方法)
  - [方法1: 標準インストール](#方法1-標準インストール-推奨)
  - [方法2: 開発者向けDocker環境](#方法2-開発者向けdocker環境)
  - [方法3: 仮想環境でのインストール](#方法3-仮想環境でのインストール)
- [⚙️ 設定](#️-設定)
- [✅ 動作確認](#-動作確認)
- [🔄 アップデート・アンインストール](#-アップデートアンインストール)
- [⚠️ トラブルシューティング](#️-トラブルシューティング)

---

## 🔧 事前準備

### システム要件

- **Python**: 3.9以上（3.12推奨）
- **JupyterLab**: 4.0以上
- **Node.js**: 18以上（JupyterLab拡張機能用）
- **OS**: Windows 10/11, macOS 12+, Linux (Ubuntu 20.04+)

### 必要なパッケージ

```bash
# JupyterLabがインストールされていない場合
pip install jupyterlab>=4.0

# バージョン確認
jupyter --version
```

---

## 🚀 インストール方法

### 方法1: 標準インストール（推奨）

#### Step 1: パッケージファイルの取得

最新の配布パッケージ `cell_monitor-1.1.3-py3-none-any.whl` を取得してください。

#### Step 2: インストール実行

**Windows環境:**
```powershell
# 重要：--userフラグを使用（Windows推奨）
pip install --user cell_monitor-1.1.3-py3-none-any.whl
```

**macOS/Linux環境:**
```bash
# 標準インストール
pip install cell_monitor-1.1.3-py3-none-any.whl
```

#### Step 3: JupyterLab再起動

```bash
# JupyterLabを一度閉じて再起動
jupyter lab
```

---

### 方法2: 開発者向けDocker環境

#### Step 1: リポジトリクローン・ビルド

```bash
# リポジトリクローン
git clone [repository-url]
cd jupyter-extensionver2-claude-code

# 拡張機能ビルド（高速版）
./build-extension-quick.sh
```

#### Step 2: Docker環境起動

```bash
# JupyterLab + FastAPI環境起動
docker compose up -d jupyterlab fastapi
```

#### Step 3: 手動インストール

```bash
# コンテナ内でインストール
docker exec -it jupyterlab bash -c "pip install /app/dist/cell_monitor-1.1.4-py3-none-any.whl"

# JupyterLab再起動
docker compose restart jupyterlab
```

#### アクセス

- **JupyterLab**: http://localhost:8888 (token: easy)
- **講師ダッシュボード**: http://localhost:3000

---

### 方法3: 仮想環境でのインストール

#### Conda環境

```bash
# 新しい仮想環境作成
conda create -n jupyter-cellmonitor python=3.12 jupyterlab
conda activate jupyter-cellmonitor

# 拡張機能インストール
pip install cell_monitor-1.1.3-py3-none-any.whl

# JupyterLab起動
jupyter lab
```

#### Python venv環境

```bash
# 仮想環境作成・有効化
python -m venv jupyter-env
source jupyter-env/bin/activate  # Windows: jupyter-env\Scripts\activate

# JupyterLab・拡張機能インストール
pip install jupyterlab>=4.0
pip install cell_monitor-1.1.3-py3-none-any.whl

# JupyterLab起動
jupyter lab
```

---

## ⚙️ 設定

### 基本設定

JupyterLab Settings → Advanced Settings Editor → Cell Monitor で以下を設定:

```json
{
  "serverUrl": "http://localhost:8000/api/v1/events",
  "emailAddress": "student001@example.com",
  "teamName": "チームA",
  "userName": "テスト学生001",
  "retryAttempts": 3,
  "showNotifications": true,
  "animationEnabled": true
}
```

### 教育機関用設定例

```json
{
  "serverUrl": "https://your-server.edu/api/v1/events",
  "emailAddress": "{学生のメールアドレス}",
  "teamName": "チーム{A-Z または 1-99}",
  "userName": "{学生の氏名}",
  "retryAttempts": 5,
  "showNotifications": true,
  "animationEnabled": true
}
```

### 設定項目説明

| 設定項目 | 説明 | デフォルト値 | 必須 |
|----------|------|--------------|------|
| `serverUrl` | データ送信先FastAPIサーバーURL | `http://localhost:8000/api/v1/events` | ✅ |
| `emailAddress` | 学生識別用メールアドレス | `student001@example.com` | ✅ |
| `teamName` | チーム名（チームA-Z、チーム1-99形式） | `チームA` | ✅ |
| `userName` | 学生表示名 | `テスト学生001` | ✅ |
| `retryAttempts` | 送信失敗時の再試行回数 | `3` | - |
| `showNotifications` | 成功通知の表示 | `true` | - |
| `animationEnabled` | ヘルプボタンアニメーション | `true` | - |

---

## ✅ 動作確認

### 1. インストール確認

```bash
# 拡張機能一覧表示
jupyter labextension list

# 期待される出力
# JupyterLab v4.x.x
# cell-monitor v1.1.3 enabled OK
```

### 2. 機能確認

1. **新しいノートブック作成**
2. **セル実行**: `print("Hello, Cell Monitor!")`
3. **ヘルプボタン確認**: ツールバーにヘルプボタンが表示されることを確認
4. **設定画面確認**: Settings → Advanced Settings → Cell Monitor に設定が表示される

### 3. データ送信確認

FastAPIサーバーが動作している場合：

```python
# テスト用セル
import time
print(f"テスト実行: {time.strftime('%H:%M:%S')}")
print("Cell Monitorがこの実行を記録します")
```

サーバーログで以下のような出力を確認：
```
[INFO] Student progress data received: {"eventType": "cell_executed", ...}
```

---

## 🔄 アップデート・アンインストール

### アップデート

```bash
# 新バージョンで上書きインストール
pip install --upgrade cell_monitor-1.1.3-py3-none-any.whl

# JupyterLab再起動
jupyter lab
```

### アンインストール

```bash
# Pythonパッケージのアンインストール
pip uninstall cell-monitor

# JupyterLabキャッシュクリア（必要な場合）
jupyter lab clean
jupyter lab build
```

**または JupyterLab UI から:**
1. Extension Manager → Installed
2. cell-monitor → Uninstall

---

## ⚠️ トラブルシューティング

### 💻 Windows環境でのトラブル

#### 問題1: 「lockedExtensions」エラー

**症状**: 拡張機能が無効化・アンインストールできない

**原因**: システムレベル（管理者権限）でインストールしたため

**解決方法**:
```powershell
# 1. 現在のインストール状況確認
pip show cell-monitor

# 2. 管理者権限でアンインストール
# （管理者としてコマンドプロンプトを開く）
pip uninstall cell-monitor --yes
jupyter lab clean

# 3. 通常権限で正しく再インストール  
pip install --user cell_monitor-1.1.3-py3-none-any.whl
```

#### 問題2: PermissionError

**解決方法**:
```powershell
# ユーザーレベルインストールを使用
pip install --user cell_monitor-1.1.3-py3-none-any.whl

# または仮想環境を使用
conda create -n jupyter-env python=3.12 jupyterlab
conda activate jupyter-env
pip install cell_monitor-1.1.3-py3-none-any.whl
```

### 🐧 Linux/macOS環境でのトラブル

#### 問題1: 拡張機能が表示されない

```bash
# JupyterLabの再ビルド
jupyter lab build

# キャッシュクリア
rm -rf ~/.cache/jupyterlab
jupyter lab clean
```

#### 問題2: Node.js依存関係エラー

```bash
# Node.jsバージョン確認
node --version  # 18以上必要

# JupyterLabの再インストール
pip uninstall jupyterlab
pip install jupyterlab>=4.0
```

### 🐳 Docker環境でのトラブル

#### 問題1: コンテナ内でインストールが反映されない

```bash
# コンテナの完全再起動
docker compose down
docker compose up -d jupyterlab

# ボリュームの確認
docker compose exec jupyterlab ls -la /app/dist/
```

#### 問題2: 設定が保存されない

```bash
# 設定ディレクトリの権限確認
docker compose exec jupyterlab ls -la ~/.jupyter/

# 必要に応じて権限修正
docker compose exec jupyterlab chmod 755 ~/.jupyter/
```

### 📊 ログによる診断

#### JupyterLabログの確認

```bash
# スタンドアロン環境
jupyter lab --log-level=DEBUG

# Docker環境
docker compose logs jupyterlab
```

#### 期待されるログメッセージ

```
✅ 正常ログ:
[I] cell_monitor | extension was successfully loaded.
[I] cell_monitor | Settings loaded: {...}

❌ エラーログ:
[E] cell_monitor | Failed to load extension
[W] cell_monitor | Configuration validation failed
```

### 🔧 環境別推奨解決策

| 環境タイプ | 推奨インストール方法 | トラブル解決策 |
|------------|----------------------|----------------|
| **個人PC (Windows)** | `--user`フラグ | 仮想環境作成 |
| **企業環境 (Windows)** | 仮想環境 | IT部門相談 |
| **macOS/Linux** | 標準インストール | パッケージマネージャー確認 |
| **教育機関** | Docker環境 | 管理者権限調整 |
| **開発環境** | Docker Compose | コンテナ再起動 |

---

## 📞 サポート

### よくある質問

**Q: 設定はどこに保存されますか？**
A: `~/.jupyter/lab/user-settings/@cell-monitor/extension/plugin.jupyterlab-settings`

**Q: 複数のJupyterLab環境で使えますか？**
A: はい。環境ごとに個別にインストール・設定が必要です。

**Q: オフライン環境で使用できますか？**
A: 拡張機能自体は動作しますが、FastAPIサーバーへのデータ送信は利用できません。

**Q: 学生データのプライバシーは保護されますか？**
A: はい。送信されるのは学習進捗データのみで、ノートブックの内容や個人情報は送信されません。

### 技術サポート

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Documentation**: [技術ドキュメント](./docs/)
- **Email**: support@your-domain.com

---

## 📋 チェックリスト

インストール完了後、以下を確認してください：

- [ ] `jupyter labextension list` で cell-monitor が表示される
- [ ] JupyterLab Settings で Cell Monitor 設定が表示される
- [ ] ヘルプボタンがノートブックツールバーに表示される
- [ ] セル実行時に通知が表示される（showNotifications: true の場合）
- [ ] FastAPIサーバーでデータ受信が確認できる（サーバー環境の場合）

**全てのチェックが完了したら、Cell Monitor Extension のインストールは成功です！** 🎉