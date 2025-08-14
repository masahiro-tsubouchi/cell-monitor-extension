# Cell Monitor Extension 機能仕様書

> **作成日**: 2025-01-19
> **対象**: JupyterLab Cell Monitor Extension
> **バージョン**: 0.1.0

## 1. 概要

Cell Monitor Extensionは、JupyterLab環境でのセル実行を監視し、学習進捗データをリアルタイムでFastAPIサーバーに送信するJupyterLab拡張機能です。教育現場での学習分析・進捗管理・講師支援を目的として設計されています。

## 2. 主要機能

### 2.1 セル実行監視
- **リアルタイム監視**: JupyterLabでのセル実行を即座にキャッチ
- **包括的データ収集**: セル内容、実行結果、エラー情報、実行時間を記録
- **イベント分類**: セル実行、ノートブック開閉、保存などのイベントを分類

### 2.2 学習進捗データ送信
- **自動送信**: セル実行後に自動的にFastAPIサーバーにデータを送信
- **バッチ処理**: 設定可能なバッチサイズでの効率的な送信
- **リトライ機能**: 送信失敗時の自動リトライ（設定可能な回数）

### 2.3 ユーザー設定管理
- **JupyterLab設定統合**: Advanced Settings Editorでの設定変更
- **リアルタイム設定反映**: 設定変更の即座な適用
- **デフォルト値**: 初期設定での即座利用可能

## 3. データ構造

### 3.1 学習進捗データ（IStudentProgressData）

```typescript
interface IStudentProgressData {
  // 基本情報
  eventId: string;         // イベントの一意なID（UUID）
  eventType: EventType;    // イベントの種類
  eventTime: string;       // イベント発生時刻（ISO 8601形式）

  // 受講生情報
  userId: string;          // 受講生を識別する一意なID
  userName: string;        // 受講生の表示名
  sessionId: string;       // 学習セッションを識別するID

  // ノートブック情報
  notebookPath: string;    // ノートブックのパス

  // セル情報（セル実行イベントの場合）
  cellId?: string;         // セルのID
  cellIndex?: number;      // ノートブック内でのセルの位置
  cellType?: CellType;     // セルの種類（code/markdown/raw）
  code?: string;           // 実行されたコード
  executionCount?: number; // そのセルの実行回数

  // 実行結果情報
  hasError?: boolean;      // エラーの有無
  errorMessage?: string;   // エラーメッセージ
  result?: string;         // 実行結果
  executionDurationMs?: number; // セル実行にかかった時間（ミリ秒）
}
```

### 3.2 イベントタイプ

```typescript
type EventType = 'cell_executed' | 'notebook_opened' | 'notebook_saved' | 'notebook_closed';
```

### 3.3 セル種別

```typescript
type CellType = 'code' | 'markdown' | 'raw';
```

## 4. 設定項目

### 4.1 サーバー設定
- **serverUrl**: データ送信先のFastAPIサーバーURL（デフォルト: `/cell-monitor`）

### 4.2 ユーザー設定
- **userId**: ユーザーを識別する一意なID（デフォルト: 空文字）
- **userName**: ユーザーの表示名（デフォルト: `Anonymous`）

### 4.3 送信設定
- **batchSize**: サーバーに送信するまでの実行セル数（デフォルト: 1、範囲: 1-100）
- **retryAttempts**: 送信失敗時のリトライ回数（デフォルト: 3、範囲: 0-10）

### 4.4 UI設定
- **maxNotifications**: 最大表示通知数（デフォルト: 3、範囲: 0-10）

## 5. 技術仕様

### 5.1 開発環境
- **JupyterLab**: >= 4.2.4
- **Node.js**: 20
- **TypeScript**: 最新版
- **Python**: 3.12

### 5.2 依存関係
- **@jupyterlab/application**: JupyterLabアプリケーション統合
- **@jupyterlab/notebook**: ノートブック監視機能
- **@jupyterlab/settingregistry**: 設定管理
- **axios**: HTTP通信

### 5.3 ビルド・デプロイ
- **TypeScript**: TypeScriptからJavaScriptへのコンパイル
- **JupyterLab Extension**: JupyterLab拡張機能としてのパッケージング
- **pip**: Pythonパッケージとしてのインストール

## 6. アーキテクチャ

### 6.1 プラグイン構造
```
JupyterFrontEndPlugin
├── INotebookTracker: ノートブック監視
├── ISettingRegistry: 設定管理
├── ILabShell: UI統合
└── activate(): プラグイン初期化
```

### 6.2 イベントフロー
1. **セル実行検知**: NotebookTracker経由でセル実行をキャッチ
2. **データ収集**: セル内容、実行結果、メタデータを収集
3. **データ構造化**: IStudentProgressData形式に変換
4. **送信処理**: axiosを使用してFastAPIサーバーに送信
5. **エラーハンドリング**: 失敗時のリトライ・通知表示

### 6.3 設定管理フロー
1. **設定読み込み**: JupyterLab設定レジストリから設定を取得
2. **設定監視**: 設定変更をリアルタイムで監視
3. **設定適用**: 変更された設定を即座にプラグインに反映

## 7. セキュリティ・プライバシー

### 7.1 データ保護
- **ローカル処理**: セル実行データはローカルで処理、外部サービスへの送信なし
- **設定可能な送信先**: 管理者が指定したサーバーのみにデータ送信
- **匿名化オプション**: ユーザー名の匿名化設定可能

### 7.2 エラーハンドリング
- **通信エラー**: ネットワーク障害時の適切なエラーハンドリング
- **データ検証**: 送信前のデータ妥当性チェック
- **ユーザー通知**: エラー発生時の適切な通知表示

## 8. 運用・保守

### 8.1 ログ・監視
- **ブラウザコンソール**: 開発者ツールでの動作確認
- **通知システム**: JupyterLab通知による状態表示
- **設定確認**: Advanced Settings Editorでの設定状況確認

### 8.2 トラブルシューティング
- **設定確認**: サーバーURL、ユーザー設定の確認
- **ネットワーク確認**: ブラウザ開発者ツールでの通信状況確認
- **拡張機能確認**: Extension Managerでのインストール状況確認

## 9. 今後の拡張予定

### 9.1 機能拡張
- **オフライン対応**: ネットワーク切断時のローカルキャッシュ
- **詳細分析**: セル実行パターンの詳細分析
- **リアルタイム通知**: 講師への即座の通知機能

### 9.2 UI/UX改善
- **設定UI**: より直感的な設定インターフェース
- **ダッシュボード**: 学習進捗の可視化機能
- **カスタマイズ**: ユーザー別のカスタマイズ機能

## 10. 関連ドキュメント

- **README.md**: インストール・設定手順
- **API_DATA_SPEC.md**: FastAPIサーバーとの連携仕様
- **EVENT_FLOW.md**: イベント処理フロー詳細
- **PERFORMANCE_REQUIREMENTS.md**: パフォーマンス要件
