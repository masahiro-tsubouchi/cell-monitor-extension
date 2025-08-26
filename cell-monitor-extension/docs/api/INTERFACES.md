# TypeScript Interfaces - Cell Monitor Extension

**最終更新**: 2025-08-24  
**対象バージョン**: v1.1.0

## 📋 概要

Cell Monitor Extension のコアインターフェースと型定義の詳細説明です。

---

## 📡 Core Interfaces

### IStudentProgressData

セル実行イベントデータの主要インターフェース。

```typescript
interface IStudentProgressData {
  /**
   * イベントの一意識別子
   * UUID v4形式で自動生成
   */
  eventId: string;

  /**
   * イベントの種類
   * - 'cell_executed': セル実行
   * - 'notebook_opened': ノートブック開始
   * - 'notebook_saved': ノートブック保存
   * - 'notebook_closed': ノートブック終了
   * - 'help': ヘルプ要請
   * - 'help_stop': ヘルプ終了
   */
  eventType: EventType;

  /**
   * イベント発生時刻
   * ISO 8601形式の日時文字列
   */
  eventTime: string;

  /**
   * 受講生のメールアドレス
   * ユーザー識別子として使用
   */
  emailAddress: string;

  /**
   * 受講生の表示名
   * UI表示用の名前
   */
  userName: string;

  /**
   * 受講生の所属チーム名
   * チームA-Z または チーム1-99 の形式
   */
  teamName: string;

  /**
   * セッション識別子
   * JupyterLabセッション開始時に生成
   */
  sessionId: string;

  /**
   * ノートブックファイルパス
   * 例: "/notebooks/lesson1.ipynb"
   */
  notebookPath: string;

  /**
   * セルの固有ID（オプション）
   * JupyterLab内部で管理されるセルID
   */
  cellId?: string;

  /**
   * セルのインデックス番号（オプション）
   * ノートブック内での0ベースのセル位置
   */
  cellIndex?: number;

  /**
   * 実行されたコード（オプション）
   * セル実行時のソースコード内容
   */
  code?: string;

  /**
   * セルの実行カウンター（オプション）
   * In[n]の番号
   */
  executionCount?: number;

  /**
   * セル実行時間（オプション）
   * ミリ秒単位の実行時間
   */
  executionDurationMs?: number;

  /**
   * エラー発生フラグ（オプション）
   * セル実行時にエラーが発生したかどうか
   */
  hasError?: boolean;

  /**
   * エラーメッセージ（オプション）
   * エラー発生時の詳細メッセージ
   */
  errorMessage?: string;

  /**
   * 実行結果出力（オプション）
   * セル実行の出力結果（文字列化）
   */
  output?: string;

  /**
   * イベント発生タイムスタンプ（オプション）
   * ISO 8601形式の日時文字列
   */
  timestamp?: string;
}
```

### EventType

イベントの種類を定義するユニオン型。

```typescript
type EventType =
  | 'cell_executed'         // セル実行完了
  | 'notebook_opened'       // ノートブック開始
  | 'notebook_saved'        // ノートブック保存
  | 'notebook_closed'       // ノートブック終了
  | 'help'                  // ヘルプ要請開始
  | 'help_stop';            // ヘルプ要請終了
```

### ISettings

拡張機能の設定インターフェース。

```typescript
interface ISettings {
  /**
   * FastAPIサーバーのURL
   * データ送信先エンドポイント
   * 例: "http://fastapi:8000/api/v1/events"
   */
  serverUrl: string;

  /**
   * 受講生のメールアドレス
   * ユーザー識別子として使用
   * デフォルト: "student001@example.com"
   */
  emailAddress: string;

  /**
   * 受講生の表示名
   * UI表示用の名前
   * デフォルト: "テスト学生001"
   */
  userName: string;

  /**
   * 受講生の所属チーム名
   * チームA-Z または チーム1-99 の形式
   * デフォルト: "チームA"
   */
  teamName: string;

  /**
   * バッチ処理サイズ
   * 一度に送信するイベント数
   * 範囲: 1-100, デフォルト: 1
   */
  batchSize: number;

  /**
   * リトライ試行回数
   * 送信失敗時の再試行回数
   * デフォルト: 3
   */
  retryAttempts: number;

  /**
   * 最大通知数
   * 表示する通知の最大数
   * デフォルト: 3
   */
  maxNotifications: number;

  /**
   * 通知表示フラグ
   * 通知メッセージの表示/非表示
   * デフォルト: true
   */
  showNotifications: boolean;
}
```

---

## 📊 Constants

### Plugin Constants

```typescript
/**
 * プラグイン識別子
 */
const PLUGIN_ID = 'cell-monitor:plugin';

/**
 * 設定スキーマID
 */
const SETTINGS_SCHEMA_ID = 'cell-monitor:settings';

/**
 * プロキシエンドポイント
 */
const PROXY_ENDPOINT = '/cell-monitor';

/**
 * イベント処理の重複排除時間（ミリ秒）
 */
const DEDUPLICATION_WINDOW = 500;

/**
 * ヘルプシグナルの送信間隔（ミリ秒）
 */
const HELP_SIGNAL_INTERVAL = 5000;

/**
 * デフォルト通知表示時間（ミリ秒）
 */
const DEFAULT_NOTIFICATION_DURATION = 3000;
```

---

## 🔍 Error Handling

TypeScript実装では、以下のエラーハンドリングパターンを使用しています：

### Try-Catch Pattern
```typescript
try {
  await sendEventData(eventData);
} catch (error) {
  console.error('Event sending failed:', error);
  showErrorNotification('データ送信に失敗しました');
}
```

### Optional Chaining
```typescript
const code = cell?.model?.value?.text ?? '';
const outputs = cell?.model?.outputs ?? [];
```

### Type Guards
```typescript
function isCodeCell(cell: any): cell is CodeCell {
  return cell && cell.model && cell.model.type === 'code';
}
```

---

## 🔗 関連ドキュメント

- [API Functions](API_FUNCTIONS.md) - 関数とメソッドの詳細
- [System Architecture](../architecture/SYSTEM_ARCHITECTURE.md) - システムアーキテクチャ
- [Development Guide](../dev/GETTING_STARTED.md) - 開発ガイド

この包括的なインターフェースリファレンスにより、開発者はCell Monitor Extensionの型システムを理解し、適切に活用することができます。

**最終更新**: 2025-08-24  
**対応バージョン**: JupyterLab 4.2.4+