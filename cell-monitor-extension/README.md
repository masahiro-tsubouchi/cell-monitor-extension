# cell-monitor

[![Github Actions Status](https://github.com/company/e/workflows/Build/badge.svg)](https://github.com/company/cell-monitor-extension/actions/workflows/build.yml)

JupyterLab extension for cell execution monitoring. This extension monitors cell executions in JupyterLab and sends data to a FastAPI server for analysis.

## Requirements

- JupyterLab >= 4.2.4

## Install

To install the extension, execute:

```bash
pip install cell-monitor
```

## Development

### Development installation

Create a dev environment:

```bash
# Create and activate a conda environment with mamba
mamba create -n cell-monitor -c conda-forge python=3.12 jupyterlab=4.2.4 nodejs=20 git copier yarn
mamba activate cell-monitor

# Install additional dependencies
mamba install -c conda-forge jinja2_time
```

Install the package in development mode:

```bash
# Install package in development mode
pip install -e .

# Build the extension
npm run build

# Rebuild extension Typescript source after making changes
npm run build:lib
```

### TypeScript Configuration Notes

If you encounter TypeScript build errors related to React types or Intl definitions, check the `tsconfig.json` file. The following settings help resolve common issues:

```json
{
  "compilerOptions": {
    "skipLibCheck": true,
    "target": "es2018",
    "lib": ["es2018", "dom", "ESNext.Intl"]
  }
}
```

You can watch the source directory and run JupyterLab at the same time:

```bash
# Watch the source directory in another terminal tab
jlpm run watch
# Run JupyterLab
jupyter lab
```

### Backend FastAPI server

This extension sends cell execution data to a FastAPI server. Make sure the server is running at the URL specified in the settings.

### Package Structure

The extension follows the standard JupyterLab extension structure:

```
cell-monitor-extension/
├── cell_monitor/            # Python package directory (underscore)
│   ├── __init__.py
│   ├── _version.py
│   └── labextension/        # Built JS assets
├── lib/                     # Compiled TypeScript
├── node_modules/            # Node.js dependencies
├── schema/                  # Extension settings schema
├── src/                     # TypeScript source
├── style/                   # CSS styles
├── package.json             # Node.js package config
├── pyproject.toml           # Python package config
└── tsconfig.json            # TypeScript config
```

### Release Preparation

Before releasing, ensure that:

1. All TypeScript files compile correctly
2. The package name in pyproject.toml matches the directory structure (`cell_monitor`)
3. The extension settings schema is correctly placed
4. The built extension assets are properly included in the package

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
