# API Functions - Cell Monitor Extension

**最終更新**: 2025-08-24  
**対象バージョン**: v1.1.0

## 📋 概要

Cell Monitor Extension の関数とメソッドの詳細な実装仕様です。

---

## 🔧 Core Functions

### generateUUID()

UUID v4形式の一意識別子を生成する関数。

```typescript
/**
 * UUID v4形式の文字列を生成
 * @returns {string} 生成されたUUID文字列
 *
 * @example
 * const eventId = generateUUID();
 * // "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
```

### sendEventData()

イベントデータをサーバーに送信する非同期関数。

```typescript
/**
 * イベントデータをFastAPIサーバーに送信
 * @param {IStudentProgressData} data - 送信するイベントデータ
 * @returns {Promise<void>} 送信完了のPromise
 *
 * @example
 * await sendEventData({
 *   eventId: generateUUID(),
 *   eventType: 'cell_executed',
 *   userId: 'user123',
 *   sessionId: 'session456',
 *   notebookPath: '/notebooks/test.ipynb',
 *   cellId: 'cell-789',
 *   code: 'print("Hello, World!")',
 *   executionDurationMs: 150,
 *   hasError: false
 * });
 */
async function sendEventData(data: IStudentProgressData): Promise<void> {
  const maxRetries = globalSettings.retryAttempts;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = await fetch('/cell-monitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        if (globalSettings.showNotifications) {
          showSuccessNotification('データ送信完了');
        }
        return;
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);

      if (attempt === maxRetries - 1) {
        showErrorNotification('データ送信に失敗しました');
        throw error;
      }
    }

    attempt++;

    // 指数バックオフ（1s, 2s, 4s, ...）
    const delay = Math.pow(2, attempt) * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
```

### extractCellCode()

セルからコード内容を安全に抽出する関数。

```typescript
/**
 * セルオブジェクトからコード内容を抽出
 * 複数のJupyterLabバージョンに対応した抽出方法
 *
 * @param {any} cell - JupyterLabセルオブジェクト
 * @returns {string} 抽出されたコード文字列
 *
 * @example
 * const code = extractCellCode(cell);
 * // "import pandas as pd\nprint('Hello')"
 */
function extractCellCode(cell: any): string {
  try {
    // Method 1: 直接的なソース取得
    if (cell.model && cell.model.value && cell.model.value.text) {
      return cell.model.value.text;
    }

    // Method 2: sharedModelからの取得
    if (cell.model && cell.model.sharedModel && cell.model.sharedModel.source) {
      return cell.model.sharedModel.source;
    }

    // Method 3: toStringメソッド
    if (cell.model && typeof cell.model.toString === 'function') {
      return cell.model.toString();
    }

    // Method 4: エディターからの取得
    if (cell.editor && cell.editor.model && cell.editor.model.value) {
      return cell.editor.model.value.text;
    }

    return '';

  } catch (error) {
    console.error('Error extracting cell code:', error);
    return '';
  }
}
```

### extractCellOutput()

セルの実行結果を抽出する関数。

```typescript
/**
 * セルの実行出力を抽出
 * エラーと正常出力の両方に対応
 *
 * @param {any} cell - JupyterLabセルオブジェクト
 * @returns {object} 出力情報オブジェクト
 *
 * @example
 * const output = extractCellOutput(cell);
 * // {
 * //   hasError: false,
 * //   output: "Hello, World!",
 * //   errorMessage: null
 * // }
 */
function extractCellOutput(cell: any): {
  hasError: boolean;
  output: string;
  errorMessage: string | null;
} {
  try {
    const outputs = cell.model.outputs;
    let hasError = false;
    let output = '';
    let errorMessage = null;

    for (let i = 0; i < outputs.length; i++) {
      const out = outputs.get(i);

      if (out.type === 'error') {
        hasError = true;
        errorMessage = `${out.ename}: ${out.evalue}`;

        // トレースバック情報の追加
        if (out.traceback && out.traceback.length > 0) {
          errorMessage += '\n' + out.traceback.join('\n');
        }

      } else if (out.type === 'stream' && out.name === 'stdout') {
        output += out.text;

      } else if (out.type === 'execute_result') {
        // 実行結果の抽出
        if (out.data && out.data['text/plain']) {
          output += out.data['text/plain'];
        }
      }
    }

    return {
      hasError,
      output: output.trim(),
      errorMessage
    };

  } catch (error) {
    console.error('Error extracting cell output:', error);
    return {
      hasError: true,
      output: '',
      errorMessage: 'Output extraction failed'
    };
  }
}
```

---

## 🎛️ Settings Management

### loadSettings()

設定レジストリから設定を読み込む関数。

```typescript
/**
 * JupyterLab設定レジストリから設定を読み込み
 * @param {ISettingRegistry.ISettings} settings - 設定オブジェクト
 *
 * @example
 * settingRegistry.load(PLUGIN_ID).then(settings => {
 *   loadSettings(settings);
 * });
 */
function loadSettings(settings: ISettingRegistry.ISettings): void {
  const composite = settings.composite as ISettings;

  // グローバル設定の更新
  Object.assign(globalSettings, composite);

  // ユーザーIDの自動生成
  if (!globalSettings.userId) {
    globalSettings.userId = generateUUID();
    settings.set('userId', globalSettings.userId);
  }

  console.log('Settings loaded:', globalSettings);
}
```

---

## 🔔 UI Components

### createHelpButton()

ヘルプリクエストボタンを作成する関数。

```typescript
/**
 * ヘルプリクエストボタンUI要素の作成
 * @returns {HTMLButtonElement} 作成されたボタン要素
 *
 * @example
 * const button = createHelpButton();
 * toolbar.addItem('help-button', { widget: button });
 */
function createHelpButton(): HTMLButtonElement {
  const button = document.createElement('button');

  // CSS クラス設定
  button.className = 'jp-ToolbarButtonComponent jp-Button';

  // アクセシビリティ属性
  button.setAttribute('aria-label', 'ヘルプを要請');
  button.setAttribute('role', 'button');
  button.setAttribute('tabindex', '0');
  button.setAttribute('data-testid', 'help-button');

  // ボタンコンテンツ
  button.innerHTML = `
    <div class="jp-ToolbarButtonComponent-icon">
      <span>🆘</span>
    </div>
    <span class="jp-ToolbarButtonComponent-label">ヘルプ</span>
  `;

  // イベントハンドラーの設定
  button.addEventListener('click', toggleHelpRequest);
  button.addEventListener('keydown', handleKeyboardNavigation);

  return button;
}
```

### showNotification()

通知メッセージを表示する関数。

```typescript
/**
 * ユーザーに通知メッセージを表示
 * @param {string} message - 通知メッセージ
 * @param {'info' | 'success' | 'error'} type - 通知タイプ
 * @param {number} duration - 表示時間（ミリ秒、デフォルト: 3000）
 *
 * @example
 * showNotification('データ送信完了', 'success', 2000);
 * showNotification('エラーが発生しました', 'error');
 */
function showNotification(
  message: string,
  type: 'info' | 'success' | 'error' = 'info',
  duration: number = 3000
): void {
  if (!globalSettings.showNotifications) {
    return; // 通知無効の場合はスキップ
  }

  const notification = Notification.manager.notify(
    message,
    type,
    { autoClose: duration }
  );

  // 最大通知数の制限
  const activeNotifications = Notification.manager.notifications;
  if (activeNotifications.length > globalSettings.maxNotifications) {
    // 古い通知を削除
    activeNotifications[0].dispose();
  }
}
```

---

## 🧪 Testing Utilities

### TestDataGenerator

テスト用のダミーデータ生成クラス。

```typescript
/**
 * テスト用イベントデータの生成
 */
class TestDataGenerator {
  /**
   * セル実行イベントのテストデータ生成
   * @param {Partial<IStudentProgressData>} overrides - 上書きするフィールド
   * @returns {IStudentProgressData} テスト用イベントデータ
   */
  static generateCellExecutionEvent(
    overrides: Partial<IStudentProgressData> = {}
  ): IStudentProgressData {
    return {
      eventId: generateUUID(),
      eventType: 'cell_executed',
      userId: 'test-user-123',
      sessionId: 'test-session-456',
      notebookPath: '/notebooks/test.ipynb',
      cellId: 'cell-789',
      cellIndex: 0,
      code: 'print("Hello, Test!")',
      executionCount: 1,
      executionDurationMs: 150,
      hasError: false,
      errorMessage: null,
      output: 'Hello, Test!',
      timestamp: new Date().toISOString(),
      ...overrides
    };
  }

  /**
   * エラーイベントのテストデータ生成
   */
  static generateErrorEvent(): IStudentProgressData {
    return this.generateCellExecutionEvent({
      hasError: true,
      errorMessage: 'NameError: name "undefined_var" is not defined',
      output: ''
    });
  }

  /**
   * ヘルプリクエストイベントのテストデータ生成
   */
  static generateHelpEvent(): IStudentProgressData {
    return this.generateCellExecutionEvent({
      eventType: 'help',
      cellId: undefined,
      cellIndex: undefined,
      code: undefined,
      executionCount: undefined,
      executionDurationMs: undefined,
      hasError: undefined,
      errorMessage: undefined,
      output: undefined
    });
  }
}
```

---

## 🔗 関連ドキュメント

- [Interfaces](INTERFACES.md) - インターフェースと型定義
- [System Architecture](../architecture/SYSTEM_ARCHITECTURE.md) - システムアーキテクチャ
- [Development Guide](../dev/GETTING_STARTED.md) - 開発ガイド

この包括的なAPIリファレンスにより、開発者はCell Monitor Extensionのすべての機能を理解し、適切に活用することができます。

**最終更新**: 2025-08-24  
**対応バージョン**: JupyterLab 4.2.4+