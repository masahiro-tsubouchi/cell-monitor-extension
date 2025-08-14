/**
 * 型定義ファイル
 * Cell Monitor Extension で使用するすべての型とインターフェースを定義
 */

/**
 * Settings interface for the cell-monitor extension
 */
export interface ISettings {
  serverUrl: string;
  emailAddress: string;
  userName: string;
  teamName: string;
  batchSize: number;
  retryAttempts: number;
  maxNotifications: number;
  showNotifications: boolean;
}

/**
 * イベントタイプの定義
 * 学習進捗データの種別を表す
 */
export type EventType = 'cell_executed' | 'notebook_opened' | 'notebook_saved' | 'notebook_closed' | 'help' | 'help_stop';

/**
 * セル種別の定義
 * Jupyter Notebookのセル種別を表す
 */
export type CellType = 'code' | 'markdown' | 'raw';

/**
 * 学習進捗データインターフェース（拡張版）
 * 受講生の学習進捗をより詳細に追跡するためのデータ構造
 */
export interface IStudentProgressData {
  // --- 基本情報 ---
  eventId: string;         // イベントの一意なID
  eventType: EventType;    // イベントの種類
  eventTime: string;       // イベント発生時刻 (ISO 8601形式)

  // --- 受講生情報 ---
  emailAddress: string;    // 受講生を識別するメールアドレス
  userName: string;        // 受講生の表示名（任意）
  teamName: string;        // 受講生の所属チーム名
  sessionId: string;       // 学習セッションを識別するID

  // --- ノートブック情報 ---
  notebookPath: string;    // ノートブックのパス
  // --- セル情報（セル実行イベントの場合のみ使用） ---
  cellId?: string;         // セルのID
  cellIndex?: number;      // ノートブック内でのセルの位置
  cellType?: CellType;     // セルの種類
  code?: string;           // 実行されたコード
  executionCount?: number; // そのセルの実行回数

  // --- 実行結果情報 ---
  hasError?: boolean;      // エラーの有無
  errorMessage?: string;   // エラーメッセージ（エラーがある場合）
  result?: string;         // 実行結果
  executionDurationMs?: number; // セル実行にかかった時間（ミリ秒）
}

/**
 * 従来の Cell execution data interface (後方互換性のため保持)
 */
export interface ICellExecutionData {
  cellId: string;
  code: string;
  executionTime: string;
  result: string;
  hasError: boolean;
  notebookPath: string;
}
