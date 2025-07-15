# JupyterLab拡張機能ビルドガイド

## 概要

このドキュメントでは、Docker環境を使用してJupyterLab拡張機能（cell-monitor-extension）をビルドし、配布可能なパッケージを作成する方法を説明します。このアプローチにより、ホスト環境を汚すことなく、一貫した環境で拡張機能のビルドが可能になります。

## 前提条件

- Docker と Docker Compose がインストールされていること
- プロジェクトのルートディレクトリに移動していること

## ビルド手順

### 1. ビルドスクリプトの実行

プロジェクトルートディレクトリにある `build-extension.sh` スクリプトを実行します：

```bash
./build-extension.sh
```

このスクリプトは以下の処理を自動的に行います：

1. 現在のユーザーのUID/GIDを取得し、権限問題を防止
2. ビルダーコンテナが起動していない場合は起動
3. コンテナ内でビルドプロセスを実行
4. 結果の確認と次のステップの案内を表示

### 2. ビルド結果の確認

ビルドが成功すると、`cell-monitor-extension/dist/` ディレクトリに以下のようなファイルが生成されます：

- `cell_monitor_extension-x.y.z-py3-none-any.whl` (Pythonホイールパッケージ)
- `cell_monitor_extension-x.y.z.tar.gz` (ソース配布パッケージ)

### 3. 拡張機能のインストール

生成されたパッケージは、以下のコマンドでJupyterLabにインストールできます：

```bash
pip install ./cell-monitor-extension/dist/cell_monitor_extension-*.whl
jupyter labextension list  # インストール確認
```

インストール後、JupyterLabを再起動すると拡張機能が有効になります。

## トラブルシューティング

### ビルドエラーが発生する場合

1. ビルダーコンテナ内でログを確認：
   ```bash
   docker-compose exec extension-builder cat /app/build.log
   ```

2. コンテナに入って手動でビルドを試す：
   ```bash
   docker-compose exec -it extension-builder /bin/bash
   cd /app
   jlpm
   jlpm build
   python -m build
   ```

### 権限問題が発生する場合

生成されたファイルの所有者がrootになっている場合は、以下のコマンドで修正できます：

```bash
sudo chown -R $(id -u):$(id -g) ./cell-monitor-extension/dist
```

## カスタマイズ

### バージョン番号の変更

バージョン番号は `cell-monitor-extension/package.json` と `cell-monitor-extension/pyproject.toml` の両方で定義されています。リリース前に適切に更新してください。

### ビルド環境のカスタマイズ

ビルド環境を修正したい場合は、以下のファイルを編集してください：

- `cell-monitor-extension/Dockerfile.build` - ビルド用Dockerイメージの定義
- `cell-monitor-extension/build-entrypoint.sh` - ビルドプロセス制御スクリプト
- `docker-compose.yml` の `extension-builder` サービス定義
