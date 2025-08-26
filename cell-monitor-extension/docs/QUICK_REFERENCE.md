# Quick Reference - Cell Monitor Extension

**最終更新**: 2025-08-24  
**バージョン**: v1.1.0

## 🎯 AI開発者向けクイックリファレンス

このドキュメントは、AI開発者が素早く必要な情報にアクセスするためのリファレンスです。

---

## 📋 基本コマンド

### 開発コマンド
```bash
# 開発環境セットアップ
npm install && pip install -e .

# 開発ビルド (ウォッチモード)
npm run watch

# テスト実行
npm test
npm run test:coverage

# プロダクションビルド
npm run build:prod

# コード品質チェック
npm run eslint          # 自動修正付き
npm run eslint:check     # チェックのみ

# 拡張機能インストール
jupyter labextension develop . --overwrite
```

### Docker環境
```bash
# 全サービス起動
docker compose up --build

# 個別サービス
docker compose up jupyterlab
docker compose up fastapi
```

---

## 🏗️ アーキテクチャ概要

### 主要コンポーネント
```typescript
CellMonitorPlugin (src/index.ts:26)
├── SettingsManager (src/core/SettingsManager.ts:29)
├── EventManager (src/core/EventManager.ts:13)
└── DataTransmissionService (src/services/DataTransmissionService.ts)
```

### データフロー
```
[セル実行] → [EventManager] → [DataTransmissionService] → [FastAPI Server]
```

---

## 💻 重要な実装パターン

### 1. イベント処理
```typescript
// src/core/EventManager.ts
export class EventManager {
  private processedCells = new Map<string, number>();
  
  // 500ms デバウンス + 50個上限メモリ管理
  private processCellExecution(cell: any): void {
    const cellId = cell.model.id;
    const currentTime = Date.now();
    const lastTime = this.processedCells.get(cellId) || 0;
    
    // 重複処理防止
    if (currentTime - lastTime < 500) return;
    
    // メモリクリーンアップ
    if (this.processedCells.size >= 50) {
      const firstKey = this.processedCells.keys().next().value;
      if (firstKey) this.processedCells.delete(firstKey);
    }
    
    this.processedCells.set(cellId, currentTime);
    // ... 処理続行
  }
}
```

### 2. 設定管理
```typescript
// src/core/SettingsManager.ts
export class SettingsManager {
  // チーム名バリデーション: チームA-Z | チーム1-99
  public validateTeamName(teamName: string): ValidationResult {
    const pattern = /^チーム([A-Z]|[1-9][0-9]?)$/;
    return {
      isValid: pattern.test(teamName),
      error: pattern.test(teamName) ? undefined : 'Invalid team name format'
    };
  }
}
```

### 3. エラーハンドリング
```typescript
// 実装されているパターン
import { handleDataTransmissionError } from '../utils/errorHandler';

try {
  await this.dataTransmissionService.sendData(eventData);
  this.logger.info('Data sent successfully');
} catch (error) {
  handleDataTransmissionError(
    error instanceof Error ? error : new Error(String(error)),
    'API data transmission',
    `データ送信に失敗しました: ${eventData.eventId}`
  );
  
  // データ永続化 (実装推奨)
  await this.saveToLocalStorage(eventData);
  throw error;
}
```

---

## 🧪 テスト例

### ユニットテスト
```typescript
// tests/settings.test.ts
describe('SettingsManager', () => {
  it('should validate team names correctly', () => {
    const manager = new SettingsManager();
    
    // 有効なチーム名
    expect(manager.validateTeamName('チームA').isValid).toBe(true);
    expect(manager.validateTeamName('チーム99').isValid).toBe(true);
    
    // 無効なチーム名
    expect(manager.validateTeamName('チーム0').isValid).toBe(false);
    expect(manager.validateTeamName('チーム100').isValid).toBe(false);
  });
});
```

### 統合テスト
```typescript
// tests/integration/cell-execution.test.ts
it('should send data when cell is executed', async () => {
  const mockCell = createMockCodeCell('print("Hello")');
  await simulateCellExecution(mockCell);
  
  expect(mockAxios.post).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      eventType: 'cell_executed',
      code: 'print("Hello")'
    })
  );
});
```

---

## 📊 データ構造

### IStudentProgressData
```typescript
interface IStudentProgressData {
  // 必須フィールド
  eventId: string;           // UUID
  eventType: EventType;      // 'cell_executed' | 'help' | etc.
  eventTime: string;         // ISO 8601
  emailAddress: string;      // student001@example.com
  userName: string;          // テスト学生001
  teamName: string;          // チームA | チーム1
  sessionId: string;         // UUID
  notebookPath: string;      // notebook.ipynb
  
  // オプションフィールド
  cellId?: string;
  code?: string;
  hasError?: boolean;
  executionDurationMs?: number;
}
```

### EventType
```typescript
type EventType = 
  | 'cell_executed'    // セル実行
  | 'notebook_opened'  // ノートブック開始
  | 'notebook_saved'   // 保存
  | 'notebook_closed'  // 終了
  | 'help'            // ヘルプ要請
  | 'help_stop';      // ヘルプ終了
```

---

## 🔧 設定ファイル

### schema/plugin.json (重要設定)
```json
{
  "properties": {
    "serverUrl": {
      "type": "string",
      "default": "http://fastapi:8000/api/v1/events"
    },
    "teamName": {
      "type": "string",
      "pattern": "^チーム([A-Z]|[1-9][0-9]?)$",
      "default": "チームA"
    },
    "retryAttempts": {
      "type": "integer",
      "default": 3,
      "minimum": 0,
      "maximum": 10
    },
    "showNotifications": {
      "type": "boolean",
      "default": true
    }
  }
}
```

---

## 🚨 既知の問題

### 修正完了 ✅
- イベントハンドラー重複登録
- メモリリーク問題 (50個上限)
- 巨大ファイル分割 (938行→7ファイル)

### 改善推奨 🔄
- データ永続化 (localStorage活用)
- コード検証・フィルタリング
- エラー通知改善

---

## 🎯 よくある開発タスク

### 新しいイベントタイプ追加
```typescript
// 1. types/interfaces.ts
export type EventType = 'cell_executed' | 'help' | 'help_stop' | 'NEW_EVENT_TYPE';

// 2. core/EventManager.ts
private handleNewEvent(data: IStudentProgressData): void {
  this.logger.debug('Processing new event type', { eventType: data.eventType });
  // 新イベント処理ロジック
}

// 3. tests/new-event.test.ts
it('should handle new event type', () => {
  // テストケース実装
});
```

### 設定項目追加
```json
// schema/plugin.json
{
  "properties": {
    "newSetting": {
      "type": "string",
      "title": "新しい設定",
      "default": "defaultValue"
    }
  }
}
```

---

## 📈 デバッグ情報

### ログ確認
```bash
# JupyterLab開発者ツール (F12)
# Console タブで確認

# フィルタ例
cell-monitor  # 拡張機能関連ログ
EventManager  # イベント処理ログ
Memory usage  # メモリ使用量
```

### メモリ監視
```typescript
// ブラウザコンソールで実行
window.cellMonitorDebug?.getProcessedCells()?.size  // 処理済みセル数
performance.memory.usedJSHeapSize                   // メモリ使用量
```

---

## 📚 関連ドキュメント

### 開発関連
- [AI Development Context](./AI_DEVELOPMENT_CONTEXT.md) - AI開発コンテキスト
- [Development Guide](./DEVELOPMENT_GUIDE.md) - 詳細開発ガイド
- [Setup Guide](./development/SETUP.md) - 環境構築

### 技術仕様
- [TypeScript API](./api/TYPESCRIPT_API.md) - API仕様
- [System Architecture](./architecture/SYSTEM_ARCHITECTURE.md) - システム設計

### 運用関連
- [Operations Guide](./OPERATIONS_GUIDE.md) - 運用ガイド
- [Known Issues](./maintenance/KNOWN_ISSUES.md) - 既知問題

---

## 🔗 外部リンク

- [JupyterLab Extension Guide](https://jupyterlab.readthedocs.io/en/stable/extension/extension_dev.html)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)

---

**このリファレンスは開発作業を効率化するために継続的に更新されます。**