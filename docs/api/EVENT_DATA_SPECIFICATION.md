# イベントデータ仕様書

**バージョン**: 1.0.0
**最終更新日**: 2025-07-19

## 1. 概要

このドキュメントは、JupyterLab拡張機能 `cell-monitor` からFastAPIサーバーへ送信されるイベントデータの仕様を定義します。この仕様は、フロントエンドとバックエンド間の正確なデータ連携を保証するための規約です。

## 2. データモデル

イベントデータは、JupyterLab内でユーザーが実行した主要なアクション（例: セルの実行）を捕捉し、JSON形式でFastAPIサーバーの `/api/v1/events` エンドポイントに `POST` リクエストで送信されます。

### 共通フィールド

すべてのイベントデータには、以下の共通フィールドが含まれます。

| フィールド名    | 型     | 説明                               |
| :-------------- | :----- | :--------------------------------- |
| `eventType`     | string | イベントの種類を示す識別子。       |
| `eventTime`     | string | イベントが発生した時刻 (ISO 8601)。|
| `userId`        | string | イベントを発生させたユーザーの識別子。 |
| `notebookPath`  | string | イベントが発生したノートブックのパス。 |

## 3. イベント種別ごとの仕様

### 3.1. `cell_executed`

ユーザーがノートブックのセルを実行した際に送信されます。

#### 追加フィールド

| フィールド名        | 型      | 説明                                     |
| :------------------ | :------ | :--------------------------------------- |
| `cellId`            | string  | 実行されたセルの一意なID。               |
| `cellIndex`         | integer | ノートブック内でのセルのインデックス（0から開始）。 |
| `cellType`          | string  | セルの種類 (`code` または `markdown`)。    |
| `code`              | string  | 実行されたセルのコード内容。             |
| `executionCount`    | integer | セルの実行カウンター (`In[xx]:`)。       |
| `executionSuccess`  | boolean | セルの実行が成功したかどうか。           |
| `executionTime`     | float   | セルの実行にかかった時間（秒）。         |

#### JSONサンプル

```json
{
  "eventType": "cell_executed",
  "eventTime": "2025-07-19T10:30:00.123Z",
  "userId": "user-abc-123",
  "notebookPath": "/path/to/MyAnalysis.ipynb",
  "cellId": "cell-def-456",
  "cellIndex": 2,
  "cellType": "code",
  "code": "import pandas as pd\nprint('Hello, World!')",
  "executionCount": 3,
  "executionSuccess": true,
  "executionTime": 0.52
}
```

## 4. 将来的な拡張

今後、以下のイベントタイプが追加される可能性があります。

- `notebook_opened`: ノートブックが開かれた時
- `notebook_saved`: ノートブックが保存された時
- `cell_added`: 新しいセルが追加された時
- `cell_deleted`: セルが削除された時

これらの仕様は、機能拡張に合わせて本ドキュメントで定義されます。
