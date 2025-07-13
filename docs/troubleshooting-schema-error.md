# JupyterLab拡張機能: スキーマ404エラーのトラブルシューティング

## 1. 現象

JupyterLabの起動後、フロントエンドの開発者コンソールに `cell-monitor:plugin` に関する404 (Not Found) エラーが繰り返し表示される。

```
GET http://localhost:8888/lab/api/settings/cell-monitor:plugin 404 (Not Found)

Failed to load cell-monitor settings: Schema not found: /usr/local/share/jupyter/lab/schemas/cell-monitor/plugin.json
```

このエラーは、コンテナ内で `ls` コマンドを使い、ファイルが指定されたパスに存在することを確認した後でも発生し続けたため、原因の特定が困難だった。

## 2. 根本原因

調査の結果、この問題には2つの独立した原因が絡み合っていた。

### 原因1: スキーマファイルの配置パスの不一致

JupyterLabが期待するスキーマファイルのパスと、ビルドプロセスによって実際に配置されていたパスに齟齬があった。

- **期待するパス:** `/usr/local/share/jupyter/lab/schemas/cell-monitor/plugin.json`
- **実際のパス:** `/usr/local/share/jupyter/lab/schemas/cell-monitor/cell-monitor/plugin.json`

この余分な `cell-monitor` ディレクトリは、`pyproject.toml` のビルド設定と、ソースコードのディレクトリ構造の組み合わせによって生まれていた。

- `pyproject.toml` は `schema` ディレクトリの中身を `.../schemas/cell-monitor/` にコピーするよう設定されていた。
- ソースコード側で `schema/cell-monitor/plugin.json` という階層構造にしていたため、結果的に深すぎるパスが生成されていた。

### 原因2: `plugin.json` のJSON構文エラー

上記パスの問題を修正した後もエラーが解消されなかった。最終的な原因は、`plugin.json` ファイル自体の内容にあった。

```json
// 修正前
"default": "http://localhost:8000S/cell-monitor"
```

`serverUrl` のデフォルト値のポート番号に、意図しない文字 `S` が含まれており、これがJSON構文エラーを引き起こしていた。

JupyterLabは、スキーマファイルを見つけても、その中身がJSONとして不正である場合、ファイルを「見つけられなかった」ものとして扱い、「Schema not found」エラーを報告する。これが、ファイルが存在するのにエラーが出続けるという不可解な状況の正体だった。

## 3. 修正方法

上記2つの原因を解消するため、以下の修正を行った。

1.  **ファイル構造の修正:**
    - `plugin.json` を `schema/` ディレクトリの直下に移動させる。
    - `mv schema/cell_monitor/plugin.json schema/plugin.json`
    - 不要になったサブディレクトリ (`schema/cell_monitor`, `schema/cell-monitor`) を削除する。

2.  **`plugin.json` の内容修正:**
    - JSON構文エラーの原因となっていたタイプミスを修正する。
    - `"default": "http://localhost:8000S/cell-monitor"` → `"default": "http://localhost:8888/cell-monitor"`

3.  **`Dockerfile` の簡素化:**
    - デバッグ目的で追加していた、スキーマファイルを手動でコピーする `RUN` コマンドをすべて削除する。
    - `pip install .` の標準ビルドプロセスが、`pyproject.toml` の設定に基づいて自動的に正しい場所へファイルを配置するため、手動での操作は不要かつ問題の原因となる。

## 4. 今後のための教訓

- **ビルドプロセスを信頼する:** `hatch-jupyter-builder` のような標準的なビルドツールは、スキーマファイルの配置を自動で行うように設計されている。`Dockerfile`での手動コピーは避け、ビルド設定 (`pyproject.toml` や `package.json`) を正しく構成することに集中する。
- **「ファイルが見つからない」エラーは、中身も疑う:** ファイルが存在するにも関わらず "Not Found" エラーが出る場合、ファイル自体の構文エラー（JSON, YAMLなど）やパーミッションの問題を疑う。
- **エラーメッセージのパスを正確に確認する:** エラーが示すパスと、自分が意図したパスを1文字ずつ比較し、微妙な違い（ディレクトリの深さ、ハイフンとアンダースコアなど）を見逃さないようにする。
