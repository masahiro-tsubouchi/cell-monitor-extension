# AI Development Context - Cell Monitor Extension

**ドキュメント作成日**: 2025-08-24  
**対象システム**: JupyterLab Cell Monitor Extension v1.1.0  
**目的**: AI駆動開発のためのコンテキスト提供

## 🤖 AI開発者への重要情報

### このドキュメントの使用方法
このドキュメントは、AI開発者（Claude Code、GitHub Copilot等）がCell Monitor Extensionの開発作業を効率的に行うための包括的なコンテキスト情報を提供します。

---

## 📋 プロジェクト基本情報

### システム概要
- **名称**: JupyterLab Cell Monitor Extension
- **バージョン**: 1.1.0
- **目的**: 教育現場でのJupyterノートブック学習進捗をリアルタイム追跡・分析
- **運用状況**: 本番稼働中（200名同時利用対応）
- **技術スタック**: TypeScript, JupyterLab Extension API, Python (server extension)

### アーキテクチャ特性
```
[JupyterLab Extension] → [FastAPI Server] → [PostgreSQL + InfluxDB]
                       ↘
                         [Instructor Dashboard (React)]
```

### パフォーマンス指標
- **同時接続**: 200名JupyterLabクライアント + 10名講師ダッシュボード
- **イベント処理**: 毎秒6,999+イベント並列処理
- **稼働率**: 99.9%（全7サービス健全稼働）
- **レスポンス**: 平均 < 100ms

---

## 🏗️ コードベース構造

### ディレクトリ構成
```
cell-monitor-extension/
├── src/                           # TypeScript ソースコード
│   ├── index.ts                   # メインエントリーポイント (117行)
│   ├── types/
│   │   └── interfaces.ts          # 型定義とインターフェース
│   ├── core/                      # コアロジック
│   │   ├── EventManager.ts        # イベント処理エンジン (427行)
│   │   ├── SettingsManager.ts     # 設定管理システム
│   │   ├── ConnectionManager.ts   # 接続管理
│   │   └── index.ts              # コアモジュールエクスポート
│   ├── services/                  # 外部サービス連携
│   │   ├── DataTransmissionService.ts  # データ送信・リトライ処理
│   │   ├── LoadDistributionService.ts  # 負荷分散サービス
│   │   └── index.ts              # サービスエクスポート
│   └── utils/                     # ユーティリティ関数
│       ├── uuid.ts               # UUID生成
│       ├── path.ts               # パス操作
│       ├── logger.ts             # ログシステム
│       ├── errorHandler.ts       # エラー処理
│       └── index.ts              # ユーティリティエクスポート
├── cell_monitor/                  # Python サーバー拡張
│   ├── __init__.py               # Python エントリーポイント
│   └── handlers.py               # プロキシハンドラー実装
├── schema/
│   └── plugin.json               # JupyterLab設定スキーマ
├── tests/                        # Jest テストスイート
├── docs/                         # ドキュメント (このファイルを含む)
└── style/                        # CSS スタイル
```

### 重要ファイルの役割

#### `src/index.ts` (メインプラグイン)
```typescript
// プラグイン構成パターン
class CellMonitorPlugin {
  private settingsManager: SettingsManager;
  private dataTransmissionService: DataTransmissionService;
  private eventManager: EventManager;
  
  constructor(app, notebookTracker, settingRegistry, labShell) {
    // 依存性注入による疎結合設計
    this.settingsManager = new SettingsManager();
    this.dataTransmissionService = new DataTransmissionService(this.settingsManager);
    this.eventManager = new EventManager(/*...*/);
  }
}
```

#### `src/core/EventManager.ts` (イベント処理)
```typescript
// セル実行監視のコアロジック
export class EventManager {
  // 重複処理防止機構 (500ms デバウンス)
  private processedCells: Map<string, number> = new Map();
  
  // メモリ最適化 (50個上限、FIFO削除)
  private cleanupProcessedCells(): void {
    if (this.processedCells.size >= 50) {
      const firstKey = this.processedCells.keys().next().value;
      if (firstKey) this.processedCells.delete(firstKey);
    }
  }
}
```

#### `src/types/interfaces.ts` (型定義)
```typescript
// 主要なデータ構造
export interface IStudentProgressData {
  eventId: string;
  eventType: EventType; // 'cell_executed' | 'help' | 'help_stop' など
  eventTime: string;
  emailAddress: string;
  teamName: string;     // 'チームA-Z' | 'チーム1-99' 形式
  sessionId: string;
  notebookPath: string;
  cellId?: string;
  code?: string;
  hasError?: boolean;
  executionDurationMs?: number;
}
```

---

## 🧪 テスト戦略

### Jest設定 (`jest.config.js`)
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts']
};
```

### 重要テストファイル
- `tests/settings.test.ts`: 設定スキーマバリデーション
- `tests/help-request.test.ts`: ヘルプ機能テスト
- `tests/load-distribution.test.ts`: パフォーマンステスト

---

## 🔧 開発コマンド

### 基本的な開発フロー
```bash
# 開発準備
npm install
pip install -e .

# 開発ビルド (ウォッチモード)
npm run watch

# テスト実行
npm test
npm run test:coverage

# プロダクションビルド
npm run build:prod

# コード品質チェック
npm run eslint
npm run eslint:check

# 拡張機能インストール
jupyter labextension develop . --overwrite
```

### Docker統合環境
```bash
# 全サービス起動
docker compose up --build

# 個別サービス制御
docker compose up jupyterlab
docker compose up fastapi
```

---

## ⚡ パフォーマンス最適化

### メモリ管理戦略
```typescript
// 実装済み最適化
class EventManager {
  private processedCells: Map<string, number> = new Map();
  
  // 50個上限でメモリ使用量50%削減
  private cleanupMemory(): void {
    if (this.processedCells.size >= 50) {
      const firstKey = this.processedCells.keys().next().value;
      if (firstKey) {
        this.processedCells.delete(firstKey);
        this.logger.debug('Memory cleanup completed');
      }
    }
  }
}
```

### 重複処理防止
```typescript
// 500msデバウンス機構
const timeDiff = currentTime - lastTime;
if (timeDiff < 500 && this.processedCells.has(cellId)) {
  this.logger.debug('Skipping duplicate cell execution', { cellId, timeDiff });
  return;
}
```

---

## 🎓 教育機能仕様

### サポートするイベントタイプ
1. **`cell_executed`**: セル実行監視
2. **`notebook_opened`**: ノートブック開始
3. **`notebook_saved`**: 進捗保存
4. **`notebook_closed`**: セッション終了
5. **`help`**: 講師サポート要請
6. **`help_stop`**: サポート終了

### チーム管理システム
```typescript
// チーム名バリデーションパターン
const teamNamePattern = /^チーム([A-Z]|[1-9][0-9]?)$/;

// 有効な例: チームA, チームB, チーム1, チーム10, チーム99
// 無効な例: チーム0, チーム100, team1, チームAA
```

---

## 🔒 セキュリティ考慮事項

### 入力検証
```typescript
// 実装推奨: コード検証機能
function sanitizeCodeForEducation(code: string): {
  cleanCode: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  const concernPatterns = [
    { pattern: /import\s+requests/gi, message: '外部API呼び出しを検出' },
    { pattern: /password|secret|token/gi, message: '機密情報の可能性を検出' },
    { pattern: /for.*range\([0-9]{4,}\)/gi, message: '大量ループ処理を検出' }
  ];
  
  // パターンマッチングとアラート生成
  return { cleanCode: code, warnings };
}
```

### エラーハンドリング
```typescript
// 適切なエラー処理パターン
try {
  await this.dataTransmissionService.sendData(eventData);
} catch (error) {
  this.errorLogger.log('DATA_TRANSMISSION_FAILED', error);
  this.saveToLocalStorage(eventData); // データ永続化
  this.notificationService.showError('データ送信に問題が発生しました');
}
```

---

## 🏢 運用環境特性

### オンプレミス環境設定
- **サーバー**: 社内ネットワーク内のオンプレミスサーバー
- **セキュリティ**: 外部インターネットアクセス制限、内部ファイアウォール保護
- **運用パターン**: 教育時間中のみサーバー稼働、時間外は停止

### サーバー停止時の動作
```typescript
// 現在の実装: 3回リトライ後にデータ破棄
// 改善推奨: localStorage永続化
const handleServerFailure = async (data: IStudentProgressData[]) => {
  try {
    await this.retryWithBackoff(data);
  } catch (error) {
    // データ永続化実装推奨
    localStorage.setItem('cell_monitor_failed', JSON.stringify(data));
  }
};
```

---

## 🐛 既知の問題と修正状況

### 修正完了項目 ✅
1. **イベントハンドラー重複登録**: 修正完了（重複防止フラグ実装）
2. **メモリリーク問題**: 修正完了（50個上限、FIFO削除）
3. **巨大ファイル分割**: 修正完了（938行→7ファイル分割）
4. **セル実行データ送信**: 修正完了（正常動作確認済み）

### 改善推奨項目 🔄
1. **データ永続化**: ローカルストレージでの失敗データ保存
2. **コード検証**: 教育用コードフィルタリング機能
3. **エラー通知**: ユーザーフレンドリーなエラー表示

---

## 🎯 AI開発支援情報

### よくある開発タスク

#### 1. 新しいイベントタイプの追加
```typescript
// types/interfaces.ts
export type EventType = 'cell_executed' | 'help' | 'NEW_EVENT_TYPE';

// core/EventManager.ts
private handleNewEvent(data: IStudentProgressData): void {
  // 新イベント処理ロジック
}
```

#### 2. 設定項目の追加
```json
// schema/plugin.json
{
  "properties": {
    "newSetting": {
      "type": "string",
      "title": "新しい設定",
      "description": "設定の説明",
      "default": "defaultValue"
    }
  }
}
```

#### 3. テストケースの追加
```typescript
// tests/new-feature.test.ts
describe('New Feature Tests', () => {
  it('should handle new functionality', () => {
    // テストケース実装
    expect(newFeature()).toBeTruthy();
  });
});
```

### デバッグ情報

#### ログレベル設定
```typescript
// utils/logger.ts で制御
const logger = createLogger('ComponentName');
logger.debug('Debug message');
logger.info('Info message');
logger.error('Error message');
```

#### メモリ使用量監視
```typescript
// EventManager でメモリ状況確認
console.log('Memory usage - processed cells:', this.processedCells.size, '/ 50 max');
```

---

## 📚 関連ドキュメント

### 必読ドキュメント
1. **[README.md](./README.md)**: プロジェクト概要と基本情報
2. **[SETUP.md](./development/SETUP.md)**: 開発環境セットアップ
3. **[SYSTEM_ARCHITECTURE.md](./architecture/SYSTEM_ARCHITECTURE.md)**: システム設計詳細
4. **[maintenance/KNOWN_ISSUES.md](./maintenance/KNOWN_ISSUES.md)**: 既知問題と修正履歴

### API仕様
- **[TYPESCRIPT_API.md](./api/TYPESCRIPT_API.md)**: TypeScript API リファレンス
- **[JUPYTERLAB_INTEGRATION.md](./integration/JUPYTERLAB_INTEGRATION.md)**: JupyterLab統合方法

### 運用ガイド
- **[OPERATIONS_GUIDE.md](./OPERATIONS_GUIDE.md)**: 日常運用とトラブルシューティング
- **[EXTENSION_EVALUATION_REPORT.md](./EXTENSION_EVALUATION_REPORT.md)**: 品質評価レポート

---

## 🤖 AI開発時の注意事項

### コード修正時の原則
1. **既存の動作を破壊しない**: 本番稼働中のため慎重な変更
2. **テストファースト**: 修正前にテストケース作成
3. **パフォーマンス考慮**: メモリ効率と処理速度の維持
4. **ログ出力**: デバッグ可能なログ情報の追加

### 推奨される修正パターン
```typescript
// ❌ 避けるべきパターン
function handleEvent(data: any): void {
  // 型安全性がない、エラー処理なし
  sendData(data);
}

// ✅ 推奨パターン
function handleEvent(data: IStudentProgressData): Promise<void> {
  try {
    this.logger.debug('Processing event', { eventId: data.eventId });
    await this.dataTransmissionService.sendData(data);
    this.logger.info('Event processed successfully');
  } catch (error) {
    this.errorHandler.handleError('EVENT_PROCESSING_FAILED', error);
    throw error;
  }
}
```

### モジュール間の依存関係
```typescript
// 適切な依存性注入パターンを維持
constructor(
  private settingsManager: SettingsManager,
  private dataTransmissionService: DataTransmissionService,
  private logger: Logger
) {
  // 疎結合設計を維持
}
```

---

**最終更新**: 2025-08-24  
**対象バージョン**: v1.1.0  
**AIコンテキストバージョン**: 1.0