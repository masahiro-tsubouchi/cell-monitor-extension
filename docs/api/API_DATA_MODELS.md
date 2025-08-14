# APIデータ仕様書

**バージョン**: 1.0.0
**最終更新日**: 2025-07-19

## 1. 概要

このドキュメントは、`cell-monitor` JupyterLab拡張機能からFastAPIバックエンドに送信されるJSONペイロードのデータ構造を定義します。このデータモデルは、JupyterLab内でのセル実行イベントに関する包括的な情報を収集するために設計されています。

## 2. データモデル: `EventData`

すべてのイベントのコアとなるデータモデルは `EventData` です。以下に各フィールドの詳細な説明を示します。

| フィールド名          | 型            | 説明                                                                        | 例                                         |
| --------------------- | ------------- | --------------------------------------------------------------------------- | ------------------------------------------ |
| `eventId`             | `string`      | イベントの一意な識別子。通常はUUID。                                        | `"a1b2c3d4-e5f6-7890-1234-567890abcdef"`   |
| `eventType`           | `string`      | イベントの種類（例: `"cell_executed"`, `"cell_error"`）。                   | `"cell_executed"`                          |
| `eventTime`           | `string`      | イベントが発生したタイムスタンプ（ISO 8601形式）。                          | `"2025-07-19T09:30:00.123Z"`               |
| `userId`              | `string`      | ユーザーの一意な識別子。                                                    | `"user-123"`                               |
| `userName`            | `string`      | ユーザー名。                                                                | `"John Doe"`                               |
| `sessionId`           | `string`      | JupyterLabのセッションID。                                                  | `"f0a1b2c3-d4e5-f6a7-b8c9-d0e1f2a3b4c5"`   |
| `notebookPath`        | `string`      | サーバー上のノートブックのファイルパス。                                      | `"/notebooks/MyAnalysis.ipynb"`            |
| `cellId`              | `string`      | ノートブック内のセルの一意な識別子。                                        | `"cell-abc-123"`                           |
| `cellIndex`           | `integer`     | ノートブック内でのセルの0から始まるインデックス。                             | `5`                                        |
| `cellType`            | `string`      | セルの種類（例: `"code"`, `"markdown"`）。                                 | `"code"`                                   |
| `code`                | `string`      | 実行されたセルのソースコード。                                              | `"print('Hello, World!')"`                 |
| `executionCount`      | `integer`     | セルの実行回数 (`In [ ]`)。                                                 | `10`                                       |
| `hasError`            | `boolean`     | 実行中にエラーが発生したかどうかを示すフラグ。                                | `false`                                    |
| `errorMessage`        | `string`      | `hasError`がtrueの場合のエラーメッセージ。                                  | `null` または `"NameError: name 'x' is not defined"` |
| `result`              | `string`      | セルの出力や結果の文字列表現。                                              | `"Hello, World!\n"`                       |
| `executionDurationMs` | `float`       | セル実行にかかった時間（ミリ秒）。                                          | `150.75`                                   |
| `metadata`            | `object`      | その他の追加情報を格納するための柔軟なオブジェクト。                          | `{"tags": ["test"], "version": 2}`        |

## 3. JSONペイロードのサンプル

以下は、`/api/events` エンドポイントに送信される典型的なJSONペイロードの例です。

```json
{
  "eventId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "eventType": "cell_executed",
  "eventTime": "2025-07-19T09:30:00.123Z",
  "userId": "user-123",
  "userName": "John Doe",
  "sessionId": "f0a1b2c3-d4e5-f6a7-b8c9-d0e1f2a3b4c5",
  "notebookPath": "/notebooks/MyAnalysis.ipynb",
  "cellId": "cell-abc-123",
  "cellIndex": 5,
  "cellType": "code",
  "code": "import pandas as pd\ndf = pd.DataFrame({'A': [1, 2], 'B': [3, 4]})\ndf.head()",
  "executionCount": 10,
  "hasError": false,
  "errorMessage": null,
  "result": "   A  B\n0  1  3\n1  2  4",
  "executionDurationMs": 250.5,
  "metadata": {
    "source": "web_client",
    "test_id": "e2e-run-001"
  }
}
```
