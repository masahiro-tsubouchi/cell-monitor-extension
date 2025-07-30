# cell-monitor

[![Github Actions Status](https://github.com/company/e/workflows/Build/badge.svg)](https://github.com/company/cell-monitor-extension/actions/workflows/build.yml)

JupyterLabでのセル実行監視用拡張機能。この拡張機能はJupyterLabでのセル実行を監視し、分析のためにFastAPIサーバーにデータを送信します。

## 要件

- JupyterLab >= 4.2.4

## インストール

拡張機能をインストールするには、以下を実行してください：

```bash
pip install cell-monitor
```

## 開発

### 開発環境のインストール

開発環境を作成：

```bash
# mambaを使用してconda環境を作成・アクティベート
mamba create -n cell-monitor -c conda-forge python=3.12 jupyterlab=4.2.4 nodejs=20 git copier yarn
mamba activate cell-monitor

# 追加の依存関係をインストール
mamba install -c conda-forge jinja2_time
```

開発モードでパッケージをインストール：

```bash
# 開発モードでパッケージをインストール
pip install -e .

# 拡張機能をビルド
npm run build

# 変更後にTypeScriptソースを再ビルド
npm run build:lib
```

### TypeScript設定に関する注意事項

ReactタイプやIntl定義に関連するTypeScriptビルドエラーが発生した場合は、`tsconfig.json`ファイルを確認してください。以下の設定により一般的な問題を解決できます：

```json
{
  "compilerOptions": {
    "skipLibCheck": true,
    "target": "es2018",
    "lib": ["es2018", "dom", "ESNext.Intl"]
  }
}
```

ソースディレクトリを監視しながら同時にJupyterLabを実行できます：

```bash
# 別のターミナルタブでソースディレクトリを監視
jlpm run watch
# JupyterLabを実行
jupyter lab
```

### バックエンドFastAPIサーバー

この拡張機能はセル実行データをFastAPIサーバーに送信します。設定で指定されたURLでサーバーが動作していることを確認してください。

### パッケージ構造

拡張機能は標準的なJupyterLab拡張機能の構造に従っています：

```
cell-monitor-extension/
├── cell_monitor/            # Pythonパッケージディレクトリ（アンダースコア）
│   ├── __init__.py
│   ├── _version.py
│   └── labextension/        # ビルドされたJSアセット
├── lib/                     # コンパイル済みTypeScript
├── node_modules/            # Node.js依存関係
├── schema/                  # 拡張機能設定スキーマ
├── src/                     # TypeScriptソース
├── style/                   # CSSスタイル
├── package.json             # Node.jsパッケージ設定
├── pyproject.toml           # Pythonパッケージ設定
└── tsconfig.json            # TypeScript設定
```

### リリース準備

リリース前に以下を確認してください：

1. すべてのTypeScriptファイルが正しくコンパイルされること
2. pyproject.tomlのパッケージ名がディレクトリ構造（`cell_monitor`）と一致すること
3. 拡張機能設定スキーマが正しく配置されていること
4. ビルドされた拡張機能アセットがパッケージに適切に含まれていること

## 起動手順

### 1. 開発環境のアクティベート

```bash
# 新しいターミナルを開いて実行
conda activate cell-monitor
cd /path/to/cell-monitor-extension
```

### 2. JupyterLabの起動

```bash
jupyter lab --ip=127.0.0.1
```

ブラウザが自動的に開かない場合は、表示されたURL（例：`http://localhost:8888/lab`）にアクセスしてください。

## 拡張機能の確認方法

1. JupyterLabの左サイドバーにある「設定」アイコン（歯車マーク）をクリック
2. ドロップダウンメニューから「Advanced Settings Editor」を選択
3. 左ペインの「Extension Manager」をクリック
4. インストール済みの拡張機能の一覧に「cell-monitor」が表示されていることを確認

## 設定方法

1. 上記の手順で「Advanced Settings Editor」を開く
2. 左ペインで「Cell Monitor」を選択
3. 右ペインで以下の設定を変更できます：
   - **Server URL**: データを送信するFastAPIサーバーのURL
   - **Batch Size**: サーバーに送信するまでの実行セル数
   - **Retry Attempts**: 送信失敗時のリトライ回数
4. 変更後は「Save User Settings」ボタンをクリックして保存

## 動作確認

1. 新しいノートブックを開く
2. セルにコードを入力して実行
3. ブラウザの開発者ツール（F12）で「Network」タブを開き、指定したサーバーURLにリクエストが送信されていることを確認
