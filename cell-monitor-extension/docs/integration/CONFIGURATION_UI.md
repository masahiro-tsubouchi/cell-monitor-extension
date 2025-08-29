# Configuration & UI Integration - Cell Monitor Extension

**最終更新**: 2025-08-29  
**対象バージョン**: v1.1.4

## 📋 概要

Cell Monitor Extension v1.1.4 のリアルタイムバリデーション付きJupyterLab設定システムとモジュール化されたUI統合機能について説明します。

---

## ⚙️ 設定システム統合

### JSON Schema ベース設定

JupyterLabの**設定レジストリ**と統合し、ユーザー設定を管理します。

```json
{
  "title": "セルモニター設定",
  "description": "JupyterLabセルモニター拡張機能の設定",
  "type": "object",
  "properties": {
    "serverUrl": {
      "type": "string",
      "title": "サーバーURL",
      "description": "データ送信先のFastAPIサーバーURL",
      "default": "",
      "pattern": "^https?://.+"
    },
    "userId": {
      "type": "string",
      "title": "ユーザーID",
      "description": "ユーザーの識別子（空白の場合は自動生成）",
      "default": "",
      "minLength": 0,
      "maxLength": 100
    },
    "batchSize": {
      "type": "integer",
      "title": "バッチサイズ",
      "description": "一度に送信するイベント数",
      "minimum": 1,
      "maximum": 100,
      "default": 1
    },
    "showNotifications": {
      "type": "boolean",
      "title": "通知表示",
      "description": "通知メッセージの表示/非表示",
      "default": true
    }
  },
  "additionalProperties": false
}
```

### 動的設定更新

```typescript
function loadSettings(settingRegistry: ISettingRegistry): void {
  settingRegistry.load(plugin.id).then(settings => {
    // 初期設定の読み込み
    updateGlobalSettings(settings.composite as ISettings);

    // 設定変更の監視
    settings.changed.connect(() => {
      updateGlobalSettings(settings.composite as ISettings);
      console.log('Settings updated:', globalSettings);
    });
  }).catch(error => {
    console.error('Failed to load settings:', error);
    // デフォルト設定で続行
  });
}

function updateGlobalSettings(newSettings: ISettings): void {
  Object.assign(globalSettings, newSettings);

  // ユーザーIDの自動生成
  if (!globalSettings.userId) {
    globalSettings.userId = generateUUID();
    // 設定に保存（次回起動時に使用）
    settingRegistry.set(plugin.id, 'userId', globalSettings.userId);
  }
}
```

---

## 🖥️ UI統合

### ツールバー統合

```typescript
function setupToolbarIntegration(
  notebookPanel: NotebookPanel,
  labShell: ILabShell
): void {
  const toolbar = notebookPanel.toolbar;

  // ヘルプリクエストボタンの作成
  const helpButton = createHelpButton();

  // ツールバーに追加
  toolbar.addItem('help-request', {
    widget: new Widget({ node: helpButton })
  });

  // ステータスバー統合（オプション）
  if (statusBar) {
    const statusItem = new StatusItem({
      text: () => `監視中: ${getActiveNotebooksCount()}`,
      alignment: 'left'
    });

    statusBar.registerStatusItem('cell-monitor:status', {
      item: statusItem,
      align: 'left',
      rank: 100
    });
  }
}
```

### コマンドパレット統合

```typescript
function registerCommands(app: JupyterFrontEnd): void {
  const { commands } = app;

  // ヘルプリクエストコマンド
  commands.addCommand('cell-monitor:toggle-help', {
    label: 'ヘルプリクエストの切り替え',
    caption: 'ヘルプリクエスト機能のON/OFF',
    isToggled: () => isHelpRequestActive(),
    execute: () => {
      toggleHelpRequest();
    }
  });

  // 設定ダイアログコマンド
  commands.addCommand('cell-monitor:open-settings', {
    label: 'セルモニター設定',
    caption: 'セルモニター拡張機能の設定を開く',
    execute: () => {
      app.commands.execute('settingeditor:open', {
        query: 'Cell Monitor'
      });
    }
  });

  // メニュー統合
  const mainMenu = app.shell.widgets('menu');
  if (mainMenu) {
    // 設定メニューに追加
    mainMenu.addItem({
      command: 'cell-monitor:open-settings',
      category: '設定'
    });
  }
}
```

---

## 🎨 ヘルプボタンのカスタマイゼーション

### ボタンのスタイリング

```typescript
function createHelpButton(): HTMLElement {
  const button = document.createElement('button');
  button.className = 'jp-ToolbarButtonComponent jp-Button';
  button.setAttribute('aria-label', 'ヘルプを要請');
  button.setAttribute('title', '講師にヘルプを要請します');

  // アイコンとラベル
  button.innerHTML = `
    <div class="jp-ToolbarButtonComponent-icon">
      <span class="help-icon">🆘</span>
    </div>
    <span class="jp-ToolbarButtonComponent-label">ヘルプ</span>
  `;

  // イベントハンドラー
  button.addEventListener('click', handleHelpButtonClick);
  button.addEventListener('keydown', handleKeyboardNavigation);

  return button;
}
```

### CSS スタイル定義

```css
/* style/index.css */
.jp-cell-monitor-help-button {
  background: var(--jp-brand-color1);
  color: var(--jp-ui-inverse-font-color1);
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.jp-cell-monitor-help-button:hover {
  background: var(--jp-brand-color0);
}

.jp-cell-monitor-help-button.active {
  background: var(--jp-warn-color1);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
}

/* ダークテーマ対応 */
[data-jp-theme-name*="dark"] .jp-cell-monitor-help-button {
  border: 1px solid var(--jp-border-color2);
}
```

---

## 🔔 通知システム統合

### JupyterLab通知の活用

```typescript
import { Notification } from '@jupyterlab/apputils';

function showSuccessNotification(message: string): void {
  if (globalSettings.showNotifications) {
    Notification.success(message, {
      autoClose: 3000,
      actions: [{
        label: '設定',
        callback: () => {
          app.commands.execute('cell-monitor:open-settings');
        }
      }]
    });
  }
}

function showErrorNotification(message: string): void {
  if (globalSettings.showNotifications) {
    Notification.error(message, {
      autoClose: 5000,
      actions: [{
        label: '詳細',
        callback: () => {
          console.log('Cell Monitor Error Details');
        }
      }]
    });
  }
}
```

### カスタム通知ウィジェット

```typescript
import { Widget } from '@lumino/widgets';

class StatusWidget extends Widget {
  private _statusElement: HTMLElement;

  constructor() {
    super();
    this.addClass('jp-cell-monitor-status');
    this._statusElement = document.createElement('div');
    this._statusElement.textContent = '監視中';
    this.node.appendChild(this._statusElement);
  }

  updateStatus(status: string, color: string = 'green'): void {
    this._statusElement.textContent = status;
    this._statusElement.style.color = color;
  }
}
```

---

## 🌍 設定の検証とバリデーション

### リアルタイム設定検証

```typescript
function validateSettings(settings: Partial<ISettings>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // サーバーURL検証
  if (settings.serverUrl) {
    if (!isValidUrl(settings.serverUrl)) {
      errors.push('無効なサーバーURLです');
    }
    if (!settings.serverUrl.startsWith('https://')) {
      warnings.push('HTTPSの使用を推奨します');
    }
  }

  // バッチサイズ検証
  if (settings.batchSize !== undefined) {
    if (settings.batchSize < 1 || settings.batchSize > 100) {
      errors.push('バッチサイズは1-100の範囲で設定してください');
    }
  }

  // チーム名検証
  if (settings.teamName) {
    const teamPattern = /^チーム([A-Z]|[1-9][0-9]?)$/;
    if (!teamPattern.test(settings.teamName)) {
      errors.push('チーム名は「チームA」または「チーム1」の形式で入力してください');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
```

### 設定の自動修復

```typescript
function autoFixSettings(settings: ISettings): ISettings {
  const fixed = { ...settings };

  // サーバーURLの自動修正
  if (fixed.serverUrl && !fixed.serverUrl.startsWith('http')) {
    fixed.serverUrl = `https://${fixed.serverUrl}`;
  }

  // バッチサイズの自動制限
  if (fixed.batchSize > 100) {
    fixed.batchSize = 100;
  } else if (fixed.batchSize < 1) {
    fixed.batchSize = 1;
  }

  return fixed;
}
```

---

## 🔗 アクセシビリティ対応

### キーボードナビゲーション

```typescript
function handleKeyboardNavigation(event: KeyboardEvent): void {
  const target = event.target as HTMLElement;

  switch (event.key) {
    case 'Enter':
    case ' ': // Space
      event.preventDefault();
      handleHelpButtonClick();
      break;
    
    case 'Escape':
      if (isHelpRequestActive()) {
        toggleHelpRequest();
      }
      break;

    case 'Tab':
      // タブキーでの移動を適切に処理
      break;
  }
}
```

### ARIA属性の設定

```typescript
function setupAccessibility(button: HTMLElement): void {
  button.setAttribute('role', 'button');
  button.setAttribute('aria-label', 'ヘルプリクエスト');
  button.setAttribute('aria-describedby', 'help-button-description');
  button.setAttribute('tabindex', '0');

  // 状態に応じてARIA属性を更新
  updateAriaStates(button);
}

function updateAriaStates(button: HTMLElement): void {
  const isActive = isHelpRequestActive();
  button.setAttribute('aria-pressed', isActive.toString());
  button.setAttribute('aria-label', 
    isActive ? 'ヘルプリクエストを停止' : 'ヘルプリクエスト'
  );
}
```

---

## 🔗 関連ドキュメント

- [Core Integration](CORE_INTEGRATION.md) - プラグインシステムとノートブック統合
- [Server & Advanced Integration](SERVER_ADVANCED.md) - サーバー拡張と高度な機能
- [TypeScript API](../api/TYPESCRIPT_API.md) - APIリファレンス

**最終更新**: 2025-08-24  
**対応バージョン**: JupyterLab 4.2.4+