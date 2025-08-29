# Implementation & Testing - Cell Monitor Extension

**最終更新**: 2025-08-29  
**対象バージョン**: v1.1.4

## 📋 概要

Cell Monitor Extension v1.1.4 のモジュール化設計に基づいた実装ガイド、Jestテスト戦略、デバッグ手法の詳細説明です。

---

## 💻 実装ガイド

### コーディング規約

#### TypeScript スタイルガイド
```typescript
// 1. インターフェース命名: I接頭辞なし、PascalCase
interface StudentProgressData {
  eventId: string;
  eventType: EventType;
}

// 2. クラス命名: PascalCase
class EventManager {
  // 3. プライベートフィールド: private修飾子
  private processedCells: Map<string, number>;
  
  // 4. メソッド命名: camelCase
  public processCellExecution(cell: Cell): void {
    // 5. ローカル変数: camelCase
    const currentTime = Date.now();
  }
}

// 6. 定数: UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_SERVER_URL = 'http://localhost:8000';
```

#### エラーハンドリングパターン
```typescript
// ✅ 推奨パターン: 包括的なエラーハンドリング
public async sendData(data: IStudentProgressData[]): Promise<void> {
  try {
    this.logger.debug('Sending data', { count: data.length });
    
    await this.httpClient.post(this.serverUrl, data);
    
    this.logger.info('Data sent successfully');
  } catch (error) {
    // 構造化されたエラーログ
    this.logger.error('Data transmission failed', {
      error: error.message,
      dataCount: data.length,
      serverUrl: this.serverUrl
    });
    
    // エラーの再分類と適切な処理
    if (error instanceof NetworkError) {
      await this.handleNetworkError(data, error);
    } else if (error instanceof ValidationError) {
      await this.handleValidationError(data, error);
    } else {
      await this.handleUnknownError(data, error);
    }
    
    throw error; // 呼び出し元に伝播
  }
}
```

### パフォーマンス最適化

#### メモリ管理
```typescript
class EventManager {
  private processedCells = new Map<string, number>();
  private static readonly MAX_PROCESSED_CELLS = 50;
  
  // メモリ効率的なクリーンアップ
  private cleanupProcessedCells(): void {
    if (this.processedCells.size >= EventManager.MAX_PROCESSED_CELLS) {
      // FIFO削除: O(1)操作
      const firstKey = this.processedCells.keys().next().value;
      if (firstKey) {
        this.processedCells.delete(firstKey);
        this.logger.debug('Memory cleanup: removed oldest entry');
      }
    }
  }
  
  // デバウンス処理: 重複実行防止
  private isDuplicateExecution(cellId: string): boolean {
    const lastTime = this.processedCells.get(cellId) || 0;
    const currentTime = Date.now();
    const timeDiff = currentTime - lastTime;
    
    // 500ms以内の重複実行をスキップ
    if (timeDiff < 500) {
      this.logger.debug('Skipping duplicate execution', { cellId, timeDiff });
      return true;
    }
    
    this.processedCells.set(cellId, currentTime);
    return false;
  }
}
```

#### 非同期処理最適化
```typescript
// ✅ 非ブロッキング処理パターン
class DataTransmissionService {
  public async sendDataNonBlocking(data: IStudentProgressData[]): Promise<void> {
    // UIをブロックしない非同期処理
    setImmediate(async () => {
      try {
        await this.sendData(data);
      } catch (error) {
        // エラーはローカルストレージに保存
        await this.saveToLocalStorage(data);
        this.notifyError('データ送信に失敗しました。後で再試行されます。');
      }
    });
  }
  
  // バッチ処理による効率化
  private batchBuffer: IStudentProgressData[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  
  public addToBatch(data: IStudentProgressData): void {
    this.batchBuffer.push(data);
    
    // 100ms後にバッチ送信
    if (this.batchTimer) clearTimeout(this.batchTimer);
    this.batchTimer = setTimeout(() => {
      this.sendBatch();
    }, 100);
  }
}
```

---

## 🧪 テスト戦略

### テストピラミッド
```
        /\
       /  \          E2E Tests (少数)
      /____\         - 全機能統合テスト
     /      \        
    /        \       Integration Tests (中程度)
   /          \      - コンポーネント間連携
  /____________\     
 /              \    Unit Tests (多数)
/________________\   - 個別関数・メソッド
```

### ユニットテスト例
```typescript
// tests/settings-manager.test.ts
describe('SettingsManager', () => {
  let settingsManager: SettingsManager;
  let mockSettingRegistry: jest.Mocked<ISettingRegistry>;

  beforeEach(() => {
    mockSettingRegistry = createMockSettingRegistry();
    settingsManager = new SettingsManager();
  });

  describe('validateTeamName', () => {
    it('should accept valid team names', () => {
      const validNames = ['チームA', 'チームZ', 'チーム1', 'チーム99'];
      
      validNames.forEach(name => {
        const result = settingsManager.validateTeamName(name);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject invalid team names', () => {
      const invalidNames = ['チーム0', 'チーム100', 'team1', 'チームAA'];
      
      invalidNames.forEach(name => {
        const result = settingsManager.validateTeamName(name);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('loadSettings', () => {
    it('should load settings with default values', async () => {
      mockSettingRegistry.load.mockResolvedValue(createMockSettings());
      
      await settingsManager.initialize(mockSettingRegistry, 'test-plugin-id');
      
      const settings = settingsManager.getSettings();
      expect(settings).toBeDefined();
      expect(mockSettingRegistry.load).toHaveBeenCalledWith('test-plugin-id');
    });
  });
});
```

### 統合テスト例
```typescript
// tests/integration/cell-execution.test.ts
describe('Cell Execution Integration', () => {
  let plugin: CellMonitorPlugin;
  let mockNotebookTracker: jest.Mocked<INotebookTracker>;
  let mockAxios: jest.MockedFunction<typeof axios.post>;

  beforeEach(async () => {
    // 統合テスト環境のセットアップ
    const testEnvironment = await setupIntegrationTestEnvironment();
    plugin = testEnvironment.plugin;
    mockNotebookTracker = testEnvironment.mockNotebookTracker;
    mockAxios = testEnvironment.mockAxios;
  });

  it('should send cell execution data when cell is executed', async () => {
    // セル実行をシミュレート
    const mockCell = createMockCodeCell('print("Hello, World!")');
    const mockNotebook = createMockNotebook([mockCell]);
    
    // イベント発火
    mockNotebookTracker.currentChanged.emit(mockNotebook);
    await simulateCellExecution(mockCell);
    
    // データ送信の検証
    await waitFor(() => {
      expect(mockAxios).toHaveBeenCalledWith(
        expect.any(String), // URL
        expect.objectContaining({
          eventType: 'cell_executed',
          code: 'print("Hello, World!")',
          eventId: expect.any(String)
        })
      );
    });
  });
});
```

### TDD実践例
```typescript
// Step 1: テストを最初に書く
describe('EventManager - addEvent', () => {
  it('should queue events when offline', () => {
    // 期待する動作を先に定義
    const eventManager = new EventManager({ offline: true });
    const testEvent = createTestEvent();
    
    eventManager.addEvent(testEvent);
    
    expect(eventManager.getQueueSize()).toBe(1);
    expect(eventManager.isEventQueued(testEvent.eventId)).toBe(true);
  });
});

// Step 2: 最小限の実装（テストがパスするまで）
class EventManager {
  private eventQueue: IStudentProgressData[] = [];
  private offline: boolean;
  
  constructor(options: { offline?: boolean } = {}) {
    this.offline = options.offline || false;
  }
  
  addEvent(event: IStudentProgressData): void {
    if (this.offline) {
      this.eventQueue.push(event);
    }
  }
  
  getQueueSize(): number {
    return this.eventQueue.length;
  }
}

// Step 3: リファクタリング（機能追加・最適化）
```

---

## 🔧 デバッグ手法

### ログシステム
```typescript
// utils/logger.ts の使用方法
import { createLogger } from '../utils/logger';

class MyComponent {
  private logger = createLogger('MyComponent');

  public performAction(): void {
    this.logger.debug('Starting action', { timestamp: Date.now() });
    
    try {
      // 処理実行
      this.logger.info('Action completed successfully');
    } catch (error) {
      this.logger.error('Action failed', { error: error.message });
    }
  }
}
```

### JupyterLab開発者ツール
```typescript
// ブラウザ開発者ツールでの確認方法
declare global {
  interface Window {
    cellMonitorDebug: {
      getProcessedCells: () => Map<string, number>;
      getSettings: () => ISettings;
      getEventCount: () => number;
      simulateEvent: (eventType: string) => void;
    };
  }
}

// デバッグインターフェースの実装
if (process.env.NODE_ENV === 'development') {
  window.cellMonitorDebug = {
    getProcessedCells: () => this.eventManager.getProcessedCells(),
    getSettings: () => this.settingsManager.getCurrentSettings(),
    getEventCount: () => this.eventManager.getEventCount(),
    simulateEvent: (eventType: string) => this.eventManager.simulateEvent(eventType)
  };
}
```

### パフォーマンス監視
```typescript
class PerformanceMonitor {
  private metrics = new Map<string, number[]>();

  public measureOperation<T>(operationName: string, operation: () => T): T {
    const startTime = performance.now();
    
    try {
      const result = operation();
      const endTime = performance.now();
      
      this.recordMetric(operationName, endTime - startTime);
      return result;
    } catch (error) {
      const endTime = performance.now();
      this.recordMetric(`${operationName}_error`, endTime - startTime);
      throw error;
    }
  }

  private recordMetric(name: string, duration: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const measurements = this.metrics.get(name)!;
    measurements.push(duration);
    
    // 最新100件のみ保持
    if (measurements.length > 100) {
      measurements.shift();
    }
  }

  public getAverageTime(operationName: string): number {
    const measurements = this.metrics.get(operationName) || [];
    return measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
  }
}
```

---

## 🛠️ 高度な実装パターン

### Observer Pattern の実装
```typescript
interface IEventObserver {
  onEvent(event: IStudentProgressData): void;
}

class EventManager {
  private observers: Set<IEventObserver> = new Set();
  
  public addObserver(observer: IEventObserver): void {
    this.observers.add(observer);
  }
  
  public removeObserver(observer: IEventObserver): void {
    this.observers.delete(observer);
  }
  
  private notifyObservers(event: IStudentProgressData): void {
    this.observers.forEach(observer => {
      try {
        observer.onEvent(event);
      } catch (error) {
        this.logger.error('Observer error', { error: error.message });
      }
    });
  }
}
```

### Strategy Pattern の活用
```typescript
interface DataTransmissionStrategy {
  send(data: IStudentProgressData[]): Promise<void>;
}

class HTTPTransmissionStrategy implements DataTransmissionStrategy {
  async send(data: IStudentProgressData[]): Promise<void> {
    // HTTP送信実装
  }
}

class WebSocketTransmissionStrategy implements DataTransmissionStrategy {
  async send(data: IStudentProgressData[]): Promise<void> {
    // WebSocket送信実装
  }
}

class DataTransmissionService {
  constructor(private strategy: DataTransmissionStrategy) {}
  
  public setStrategy(strategy: DataTransmissionStrategy): void {
    this.strategy = strategy;
  }
  
  public async sendData(data: IStudentProgressData[]): Promise<void> {
    return this.strategy.send(data);
  }
}
```

### Factory Pattern の使用
```typescript
interface EventHandlerFactory {
  createHandler(eventType: string): EventHandler;
}

class CellExecutionHandler implements EventHandler {
  handle(event: IStudentProgressData): void {
    // セル実行イベント処理
  }
}

class NotebookLifecycleHandler implements EventHandler {
  handle(event: IStudentProgressData): void {
    // ノートブックライフサイクル処理
  }
}

class EventHandlerFactoryImpl implements EventHandlerFactory {
  createHandler(eventType: string): EventHandler {
    switch (eventType) {
      case 'cell_executed':
        return new CellExecutionHandler();
      case 'notebook_opened':
      case 'notebook_closed':
        return new NotebookLifecycleHandler();
      default:
        throw new Error(`Unknown event type: ${eventType}`);
    }
  }
}
```

---

## 🔗 関連ドキュメント

- [Development Workflow](DEVELOPMENT_WORKFLOW.md) - 開発ワークフローとアーキテクチャ
- [Deployment & Operations](DEPLOYMENT_OPERATIONS.md) - デプロイメントと運用
- [TypeScript API](../api/TYPESCRIPT_API.md) - APIリファレンス

**最終更新**: 2025-08-24  
**対応バージョン**: v1.1.0