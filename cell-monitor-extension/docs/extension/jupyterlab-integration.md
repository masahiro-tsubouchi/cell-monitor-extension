# JupyterLab Integration Details

**対象**: JupyterLab拡張機能の内部動作を理解したい開発者  
**技術レベル**: 中級〜上級

---

## 🏗️ アーキテクチャ統合

### JupyterLabプラグインシステム統合

```typescript
// src/index.ts - エントリーポイント
const plugin: JupyterFrontEndPlugin<void> = {
  id: '@your-org/cell-monitor',
  autoStart: true,
  requires: [
    INotebookTracker,    // ノートブック追跡
    ISettingRegistry,    // 設定管理
    ILabShell           // UI統合
  ],
  activate: activatePlugin
};
```

### 依存関係マップ
```
JupyterLab Application
├── INotebookTracker ────┐
├── ISettingRegistry ───┼─→ Cell Monitor Plugin
├── ILabShell ──────────┘
└── Kernel Management ──→ Event Capture
```

---

## 🔄 ライフサイクル管理

### 1. プラグイン初期化フロー

```typescript
async function activatePlugin(
  app: JupyterFrontEnd,
  tracker: INotebookTracker,
  settingRegistry: ISettingRegistry,
  shell: ILabShell
): Promise<void> {
  
  // 1. 設定管理システム初期化
  const settingsManager = new SettingsManager(settingRegistry);
  await settingsManager.initialize();
  
  // 2. データ送信サービス初期化
  const dataService = new DataTransmissionService(settingsManager);
  
  // 3. イベント管理システム初期化
  const eventManager = new EventManager(dataService, settingsManager);
  
  // 4. UI統合（ヘルプボタン等）
  setupUI(app, shell, eventManager);
  
  // 5. ノートブック追跡開始
  tracker.widgetAdded.connect(onNotebookAdded);
}
```

### 2. ノートブック追跡システム

```typescript
// ノートブックライフサイクル追跡
function onNotebookAdded(sender: INotebookTracker, panel: NotebookPanel) {
  const { content: notebook } = panel;
  
  // ノートブック開始イベント
  eventManager.handleNotebookOpened(notebook);
  
  // セル実行監視
  notebook.model?.cells.changed.connect(onCellsChanged);
  
  // カーネル接続監視
  panel.sessionContext.statusChanged.connect(onKernelStatusChanged);
}
```

### 3. 終了処理・クリーンアップ

```typescript
// プラグイン無効化時の処理
function deactivatePlugin() {
  // イベントリスナー解除
  eventManager.disconnect();
  
  // タイマー・リソース解放
  TimerPool.cleanup();
  
  // データ送信完了待機
  await dataService.flush();
}
```

---

## 🎯 イベントシステム統合

### JupyterLabイベントとの連携

```typescript
// Kernel実行イベント連携
export class EventManager {
  setupKernelIntegration(notebook: Notebook) {
    const kernel = notebook.sessionContext.session?.kernel;
    
    if (kernel) {
      // カーネル実行開始
      kernel.statusChanged.connect(this.onKernelStatus);
      
      // IOPubメッセージ監視
      kernel.iopubMessage.connect(this.onIOPubMessage);
      
      // 実行結果監視
      kernel.unhandledMessage.connect(this.onUnhandledMessage);
    }
  }
  
  private onKernelStatus(kernel: IKernel, status: Kernel.Status) {
    if (status === 'busy') {
      this.handleCellExecutionStart();
    } else if (status === 'idle') {
      this.handleCellExecutionEnd();
    }
  }
}
```

### カスタムイベント配信

```typescript
// JupyterLab内部イベントバスとの統合
export class CellMonitorEvents {
  // カスタムイベント定義
  static readonly HELP_REQUESTED = 'cell-monitor:help-requested';
  static readonly PROGRESS_UPDATED = 'cell-monitor:progress-updated';
  
  // JupyterLabイベントシステムでの配信
  emitHelpRequested(data: IHelpRequestData) {
    this.app.commands.notifyCommandChanged();
    document.dispatchEvent(new CustomEvent(
      CellMonitorEvents.HELP_REQUESTED, 
      { detail: data }
    ));
  }
}
```

---

## 🎨 UI統合パターン

### 1. ツールバー統合

```typescript
// ノートブックツールバーへのボタン追加
function addHelpButton(notebook: NotebookPanel, eventManager: EventManager) {
  const button = new ToolbarButton({
    className: 'jp-ToolbarButton-Cell-Monitor-Help',
    iconClass: 'jp-Icon jp-Icon-16 jp-HelpIcon',
    onClick: () => eventManager.toggleHelpRequest(),
    tooltip: 'ヘルプを要請'
  });
  
  // ツールバーに追加
  notebook.toolbar.addItem('help-request', button);
}
```

### 2. 設定UI統合

```typescript
// JupyterLab設定システムとの連携
export class SettingsManager {
  async initialize() {
    // 設定スキーマ読み込み
    this.settings = await this.settingRegistry.load(PLUGIN_ID);
    
    // 設定変更監視
    this.settings.changed.connect(this.onSettingsChanged);
    
    // デフォルト値適用
    await this.applyDefaultSettings();
  }
  
  private onSettingsChanged() {
    // 設定変更をリアルタイム反映
    const newConfig = this.settings.composite;
    this.updateConfiguration(newConfig);
  }
}
```

### 3. 通知システム統合

```typescript
// JupyterLab通知システム活用
import { Notification } from '@jupyterlab/apputils';

export class NotificationManager {
  showSuccess(message: string) {
    Notification.success(message, { autoClose: 3000 });
  }
  
  showError(message: string, error?: Error) {
    Notification.error(
      `${message}: ${error?.message || 'Unknown error'}`,
      { autoClose: 5000 }
    );
  }
  
  showInfo(message: string) {
    Notification.info(message, { autoClose: 2000 });
  }
}
```

---

## 🔧 拡張機能開発パターン

### 1. プラグイン拡張

```typescript
// 新機能追加のためのプラグイン拡張
export interface ICellMonitorExtension {
  readonly id: string;
  activate(context: ExtensionContext): void;
  deactivate?(): void;
}

// 拡張機能登録
export class ExtensionRegistry {
  private extensions: Map<string, ICellMonitorExtension> = new Map();
  
  register(extension: ICellMonitorExtension) {
    this.extensions.set(extension.id, extension);
  }
  
  activate(context: ExtensionContext) {
    this.extensions.forEach(ext => ext.activate(context));
  }
}
```

### 2. カスタムイベントハンドラー

```typescript
// 独自イベント処理の追加
export interface IEventHandler<T = any> {
  eventType: EventType;
  handle(data: T, context: EventContext): Promise<void>;
}

// カスタムハンドラー登録
export class CustomEventHandler implements IEventHandler<ICustomEventData> {
  eventType = 'custom_event' as EventType;
  
  async handle(data: ICustomEventData, context: EventContext) {
    // カスタム処理実装
    await this.processCustomEvent(data);
  }
}
```

### 3. 設定スキーマ拡張

```json
// schema/plugin.json - 設定項目の追加
{
  "title": "Cell Monitor",
  "type": "object",
  "properties": {
    "customFeature": {
      "title": "Custom Feature Settings",
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "title": "Enable Custom Feature",
          "default": false
        },
        "threshold": {
          "type": "number",
          "title": "Threshold Value",
          "minimum": 0,
          "maximum": 100,
          "default": 50
        }
      }
    }
  }
}
```

---

## 🚀 パフォーマンス最適化

### JupyterLabとの協調動作

```typescript
// JupyterLabのレンダリングサイクルと協調
export class PerformanceOptimizer {
  // requestAnimationFrameでの非同期処理
  scheduleUpdate(callback: () => void) {
    requestAnimationFrame(() => {
      if (document.hasFocus()) {
        callback();
      } else {
        // バックグラウンド時は頻度を下げる
        setTimeout(callback, 1000);
      }
    });
  }
  
  // JupyterLabのアイドル時間活用
  scheduleIdleWork(callback: () => void) {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(callback, { timeout: 5000 });
    } else {
      setTimeout(callback, 100);
    }
  }
}
```

### メモリ効率最適化

```typescript
// WeakMap活用でメモリリーク防止
export class ResourceManager {
  private notebookData = new WeakMap<NotebookPanel, NotebookData>();
  private cellData = new WeakMap<Cell, CellData>();
  
  // ノートブック閉鎖時の自動クリーンアップ
  onNotebookClosed(panel: NotebookPanel) {
    this.notebookData.delete(panel);
    // WeakMapなので明示的削除は不要だが、関連リソースは解放
    this.cleanupAssociatedResources(panel);
  }
}
```

---

## 🔍 デバッグ・テスト統合

### 開発時デバッグ

```typescript
// 開発環境でのデバッグ支援
export class DebugManager {
  private isDebugMode = process.env.NODE_ENV === 'development';
  
  logEventFlow(event: string, data: any) {
    if (this.isDebugMode) {
      console.group(`[CellMonitor] ${event}`);
      console.log('Data:', data);
      console.log('Stack:', new Error().stack);
      console.groupEnd();
    }
  }
  
  // JupyterLab開発者ツールとの統合
  exposeToDevTools() {
    if (this.isDebugMode) {
      (window as any).cellMonitorDebug = {
        eventManager: this.eventManager,
        settingsManager: this.settingsManager,
        dataService: this.dataService
      };
    }
  }
}
```

### テスト環境統合

```typescript
// JupyterLabテスト環境でのモック
export class TestingUtilities {
  static createMockNotebook(): NotebookPanel {
    // JupyterLabテストユーティリティ活用
    return NBTestUtils.createNotebookPanel();
  }
  
  static simulateCellExecution(notebook: NotebookPanel, code: string) {
    const cell = notebook.content.activeCell;
    if (cell?.model.type === 'code') {
      (cell.model as ICodeCellModel).value.text = code;
      return NotebookActions.run(notebook.content, notebook.sessionContext);
    }
  }
}
```

---

## 🔗 関連ドキュメント

- [Extension Development](extension-development.md) - 拡張機能開発
- [Configuration Guide](configuration.md) - 設定詳細
- [API Reference](../api/core-classes.md) - API仕様
- [Best Practices](../guides/best-practices.md) - ベストプラクティス

**最終更新**: 2025-08-29