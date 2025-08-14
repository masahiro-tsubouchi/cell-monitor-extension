# 100人受講生テストデータ - JupyterLab拡張機能とCSVデータの対応関係

> **生成日時**: 2025-08-06 19:42
> **テスト実行**: 100人受講生データ格納テスト
> **合計レコード数**: 250件

## 📊 データフロー概要

```
JupyterLab拡張機能 → FastAPI /events → Redis Pub/Sub → Worker → PostgreSQL → CSV出力
```

### 1. JupyterLab拡張機能からの送信データ

JupyterLab拡張機能 (`cell-monitor-extension/src/index.ts`) は以下の `IStudentProgressData` 構造でデータを送信します：

```typescript
interface IStudentProgressData {
  // --- 基本情報 ---
  eventId: string;         // イベントの一意なID
  eventType: EventType;    // 'cell_executed' | 'notebook_opened' | 'notebook_saved' | 'notebook_closed' | 'help'
  eventTime: string;       // イベント発生時刻 (ISO 8601形式)

  // --- 受講生情報 ---
  userId: string;          // 受講生を識別する一意なID
  userName: string;        // 受講生の表示名
  sessionId: string;       // 学習セッションを識別するID

  // --- ノートブック情報 ---
  notebookPath: string;    // ノートブックのパス

  // --- セル情報（セル実行イベントの場合のみ） ---
  cellId?: string;         // セルのID
  cellIndex?: number;      // ノートブック内でのセルの位置
  cellType?: CellType;     // 'code' | 'markdown' | 'raw'
  code?: string;           // 実行されたコード
  executionCount?: number; // そのセルの実行回数

  // --- 実行結果情報 ---
  hasError?: boolean;      // エラーの有無
  errorMessage?: string;   // エラーメッセージ
  result?: string;         // 実行結果
  executionDurationMs?: number; // セル実行時間（ミリ秒）
}
```

## 📁 CSV出力ファイルとデータ対応

### ✅ `students_20250806_103439.csv` (109レコード)

**対応関係**: JupyterLab拡張機能の `userId`, `userName` → PostgreSQL `students` テーブル

| CSV列名 | JupyterLab送信データ | 説明 |
|---------|---------------------|------|
| `id` | - | データベース内部ID (自動生成) |
| `user_id` | `userId` | 受講生の一意識別子 |
| `name` | `userName` | 受講生の表示名 |
| `email` | - | メールアドレス (テストでは自動生成) |
| `created_at` | - | レコード作成日時 |
| `updated_at` | - | レコード更新日時 |

**データ例**:
```csv
id,user_id,name,email,created_at,updated_at
1,student_001,Student 001,student_001@example.com,2025-08-06 10:33:45,2025-08-06 10:33:45
```

### ✅ `notebooks_20250806_103439.csv` (1レコード)

**対応関係**: JupyterLab拡張機能の `notebookPath` → PostgreSQL `notebooks` テーブル

| CSV列名 | JupyterLab送信データ | 説明 |
|---------|---------------------|------|
| `id` | - | データベース内部ID |
| `path` | `notebookPath` | ノートブックのファイルパス |
| `name` | `notebookPath` (ファイル名部分) | ノートブック名 |
| `created_at` | - | レコード作成日時 |
| `updated_at` | - | レコード更新日時 |
| `last_modified` | - | 最終更新日時 |
| `notebook_metadata` | - | ノートブックメタデータ (JSON) |

### ✅ `classes_20250806_103439.csv` (35レコード)

**対応関係**: テスト環境で自動生成されたクラスデータ

| CSV列名 | 説明 |
|---------|------|
| `id` | データベース内部ID |
| `class_code` | クラスコード (例: "CLASS_001") |
| `name` | クラス名 (例: "Test Class 001") |
| `description` | クラス説明 |
| `instructor_id` | 担当講師ID |
| `start_date` | 開始日 |
| `end_date` | 終了日 |
| `is_active` | アクティブ状態 |
| `created_at` | 作成日時 |
| `updated_at` | 更新日時 |

### ✅ `class_assignments_20250806_103439.csv` (50レコード)

**対応関係**: テスト環境で自動生成された課題データ

| CSV列名 | 説明 |
|---------|------|
| `id` | データベース内部ID |
| `class_id` | 所属クラスID |
| `notebook_id` | 課題ノートブックID |
| `title` | 課題タイトル |
| `description` | 課題説明 |
| `due_date` | 提出期限 |
| `points` | 配点 |
| `created_at` | 作成日時 |
| `updated_at` | 更新日時 |

### ✅ `assignment_submissions_20250806_103439.csv` (44レコード)

**対応関係**: テスト環境で自動生成された提出データ

| CSV列名 | 説明 |
|---------|------|
| `id` | データベース内部ID |
| `assignment_id` | 課題ID |
| `student_id` | 提出学生ID |
| `submitted_at` | 提出日時 |
| `status` | 提出状況 |
| `grade` | 評価点数 |
| `feedback` | フィードバック |

### ✅ `instructors_20250806_103439.csv` (1レコード)

**対応関係**: 講師管理システムのデータ

| CSV列名 | 説明 |
|---------|------|
| `id` | データベース内部ID |
| `email` | 講師メールアドレス |
| `password_hash` | パスワードハッシュ |
| `name` | 講師名 |
| `role` | 役割 |
| `is_active` | アクティブ状態 |
| `status` | 現在のステータス |
| `current_session_id` | 現在のセッションID |
| `status_updated_at` | ステータス更新日時 |
| `last_login_at` | 最終ログイン日時 |
| `created_at` | 作成日時 |
| `updated_at` | 更新日時 |

### ✅ `instructor_status_history_20250806_103439.csv` (10レコード)

**対応関係**: 講師ステータス履歴データ

| CSV列名 | 説明 |
|---------|------|
| `id` | データベース内部ID |
| `instructor_id` | 講師ID |
| `status` | ステータス |
| `started_at` | 開始日時 |
| `ended_at` | 終了日時 |
| `duration_minutes` | 継続時間（分） |

## 🔍 重要な注意事項

### ❌ セル実行データが見つからない理由

**期待されるデータ**: JupyterLab拡張機能から送信される `cell_executed` イベント
**実際の状況**: `cell_executions` テーブルは0レコード

**原因分析**:
1. **データベーススキーマの不整合**: テストで使用されたデータベースモデルと実際のスキーマが異なる
2. **イベント処理の問題**: Redis Pub/Sub → Worker → DB永続化の過程でセル実行データが正しく処理されていない
3. **テストデータ生成の制限**: テストでは学生・クラス・課題データは生成されたが、実際のセル実行イベントは発生していない

### 📊 実際に送信されたイベントデータの確認

テスト実行ログから確認できる実際の送信データ：

```json
{
  "eventId": "01b9231f-1055-42cd-8c9b-e56273433f3f",
  "eventType": "cell_executed",
  "eventTime": "2025-08-06T10:34:55.010189",
  "userId": "student_001",
  "userName": "Student 001",
  "sessionId": "b8a8c0f8-ecaf-4be0-a749-7f61003c1ee2",
  "notebookPath": "/notebooks/lesson_1.ipynb",
  "cellId": "cell_0",
  "cellIndex": 0,
  "cellType": "code",
  "code": "data = [1, 2, 3, 4, 5]\naverage = sum(data) / len(data)\nprint(f'Average: {average}')",
  "executionCount": 1,
  "hasError": false,
  "errorMessage": null,
  "result": "Average: 3.0",
  "executionDurationMs": 2716.7987712216445,
  "metadata": {"kernel": "python3", "timestamp": 1754314495.010189}
}
```

**処理統計**:
- 総イベント数: 500個 (10人 × 50イベント)
- イベント種別: `cell_executed`, `notebook_opened`, `notebook_saved`, `notebook_closed`, `help_requested`
- WebSocket通知: 正常に配信済み

## 🔧 データ整合性の改善提案

### 1. セル実行データの永続化修正
- `cell_executions` テーブルのスキーマ確認
- Worker プロセスのイベント処理ロジック修正
- データベースマイグレーションの実行

### 2. 統合テストの強化
- JupyterLab拡張機能 → FastAPI → DB の完全なE2Eテスト
- 各イベントタイプの永続化確認
- データ整合性チェックの自動化

### 3. 監視・ログ強化
- Redis Pub/Sub メッセージの詳細ログ
- Worker プロセスの処理状況監視
- データベース書き込みエラーの詳細記録

## 📈 今後の拡張予定

1. **リアルタイムダッシュボード**: CSV データを可視化するダッシュボード
2. **学習分析**: セル実行パターンの分析機能
3. **パフォーマンス最適化**: 大規模データ処理の効率化
4. **データエクスポート**: 複数形式でのデータ出力対応

---

**生成者**: AI駆動TDD (186個テストケース成功パターン活用)
**関連ドキュメント**: `docs/testing/100_STUDENTS_LOAD_TEST_PLAN.md`
