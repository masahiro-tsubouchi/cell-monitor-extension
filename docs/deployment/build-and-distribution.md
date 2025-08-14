# ビルド＆配布ガイド

**バージョン**: 1.0.0
**最終更新日**: 2025-07-19

## 1. 概要

このガイドは、`cell-monitor` JupyterLab拡張機能を、配布可能なPythonホイール（`.whl`）ファイルとしてビルドする手順を説明します。このファイルを使用することで、他のJupyterLab環境に拡張機能をインストールできます。

## 2. 前提条件

ローカルマシンに以下のツールがインストールされていることを確認してください。

- **Docker**: ビルドプロセスは、一貫性のあるクリーンな環境を保証するためにコンテナ化されています。
- **Git**: リポジトリをクローンするために使用します。
- **Bash互換シェル**: ビルドスクリプトはシェルスクリプトです。

## 3. ビルド手順

ビルドプロセス全体は、単一のスクリプトによって自動化されています。

1.  **プロジェクトのルートディレクトリに移動します**:

    ```bash
    cd /path/to/jupyter-extensionver2
    ```

2.  **ビルドスクリプトを実行します**:

    ```bash
    bash build-extension.sh
    ```

### スクリプトの動作内容

`build-extension.sh` スクリプトは、以下のステップを自動で実行します。全体の流れは次の図の通りです。

```mermaid
graph TD
    subgraph Host Machine
        A[User runs<br>bash build-extension.sh] --> B{docker compose run...};
    end

    subgraph Docker Container (extension-builder)
        B --> C[Dockerfile.build creates environment];
        C --> D[1. jlpm install];
        D --> E[2. jlpm build];
        E --> F[3. python -m build];
    end

    subgraph Host Machine
        F --> G[Outputs .whl file to<br>cell-monitor-extension/dist/];
    end
```

具体的には、以下の処理が行われます。

1.  **環境変数の設定**: 現在のユーザーのUIDとGIDをエクスポートし、Dockerコンテナ内で作成されるファイルの所有者が正しくなるようにします。
2.  **クリーンアップ**: `cell-monitor-extension/dist` ディレクトリから古いビルド成果物を削除します。
3.  **Dockerビルダーの実行**: `docker compose run --build --rm extension-builder` コマンドを実行します。このコマンドは:
    -   `docker-compose.yml` で定義された `extension-builder` サービスに基づいて一時的なコンテナを起動します。
    -   `cell-monitor-extension/Dockerfile.build` を使用してビルド環境を構築します。
    -   コンテナ内で、依存関係のインストール (`jlpm install`)、TypeScriptコードのコンパイル (`jlpm build`)、そしてPythonホイールへのパッケージ化 (`python -m build`) を行います。
    -   `--rm` フラグにより、ビルド完了後にコンテナは自動的に削除されます。

## 4. 成果物の確認

スクリプトが正常に完了すると、`cell-monitor-extension/dist/` ディレクトリにビルド成果物が生成されます。

```sh
$ ls -l cell-monitor-extension/dist/

-rw-r--r--  1 your_user  your_group   63372 Jul 19 09:02 cell_monitor-0.1.0-py3-none-any.whl
-rw-r--r--  1 your_user  your_group  85506762 Jul 19 09:02 cell_monitor-0.1.0.tar.gz
```

-   `cell_monitor-0.1.0-py3-none-any.whl`: これが配布に使用するホイールファイルです。
-   `cell_monitor-0.1.0.tar.gz`: これはソースアーカイブです。

## 5. ホイールファイルからのインストール

別のマシンや異なる環境に拡張機能をインストールするには、`.whl` ファイルを対象のマシンにコピーし、以下の `pip` コマンドを実行します。

```bash
# ファイルがカレントディレクトリにある場合の例
pip install cell_monitor-0.1.0-py3-none-any.whl
```

インストール後、拡張機能がJupyterLabに正しくインストールされていることを確認します。

```bash
jupyter labextension list
```

インストール済み拡張機能の一覧に `cell-monitor` が表示されるはずです。
