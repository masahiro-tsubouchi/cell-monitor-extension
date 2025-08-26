# Server & Advanced Integration - Cell Monitor Extension

**最終更新**: 2025-08-24  
**対象バージョン**: v1.1.0

## 📋 概要

Cell Monitor ExtensionのJupyterLabサーバー拡張、セキュリティ統合、パフォーマンス最適化、テスト戦略について説明します。

---

## 🔌 JupyterLab Server Extension

### Python サーバー拡張機能

Cell Monitor ExtensionはPythonサーバー拡張機能も含み、JupyterLabサーバーと統合します。

```python
# cell_monitor/__init__.py

def _jupyter_server_extension_points():
    """
    JupyterLabサーバー拡張機能エントリーポイント
    """
    return [
        {
            "module": "cell_monitor",
            "app": _load_jupyter_server_extension,
        }
    ]

def _load_jupyter_server_extension(server_app):
    """
    サーバー拡張機能の読み込み

    Args:
        server_app: JupyterLabサーバーアプリケーションインスタンス
    """
    from .handlers import CellMonitorProxyHandler

    # ハンドラーの登録
    handlers = [
        (r"/cell-monitor", CellMonitorProxyHandler),
    ]

    # Webアプリケーションにハンドラーをマウント
    server_app.web_app.add_handlers(".*$", handlers)

    server_app.log.info("Cell Monitor server extension loaded")
```

### プロキシハンドラー実装

```python
# cell_monitor/handlers.py

import json
import os
from jupyter_server.base.handlers import APIHandler
from tornado.httpclient import AsyncHTTPClient, HTTPClientError

class CellMonitorProxyHandler(APIHandler):
    """
    JupyterLabフロントエンドからFastAPIサーバーへのプロキシ
    CORS問題を回避し、認証とセキュリティを管理
    """

    # CSRF保護を無効化（開発用）
    def check_xsrf_cookie(self):
        pass

    @tornado.web.authenticated
    async def post(self):
        """
        POSTリクエストのプロキシ処理
        """
        try:
            # リクエストボディの取得と検証
            try:
                body = self.get_json_body()
            except json.JSONDecodeError:
                self.set_status(400)
                self.write({"error": "Invalid JSON format"})
                return

            # 送信先URLの決定
            server_url = self._determine_server_url(body)

            # FastAPIサーバーへのプロキシリクエスト
            client = AsyncHTTPClient()

            try:
                response = await client.fetch(
                    f"{server_url}/api/v1/events",
                    method="POST",
                    body=json.dumps(body),
                    headers={
                        "Content-Type": "application/json",
                        "User-Agent": "JupyterLab-CellMonitor/1.0"
                    },
                    request_timeout=30.0,
                    validate_cert=False  # 開発用
                )

                # レスポンスの転送
                self.set_status(response.code)
                if response.body:
                    self.write(response.body)

            except HTTPClientError as e:
                self.log.error(f"Proxy request failed: {e}")
                self.set_status(502)
                self.write({"error": "Backend service unavailable"})

            except Exception as e:
                self.log.exception("Unexpected error in proxy handler")
                self.set_status(500)
                self.write({"error": "Internal server error"})

        except Exception as e:
            self.log.exception("Handler error")
            self.set_status(500)
            self.write({"error": str(e)})

    def _determine_server_url(self, body: dict) -> str:
        """
        リクエスト内容に基づいて送信先URLを決定
        """
        # テストモード判定
        if body.get('test_mode', False):
            return os.getenv('TEST_FASTAPI_URL', 'http://localhost:8001')
        
        # 本番環境URL
        return os.getenv('FASTAPI_URL', 'http://fastapi:8000')

    def set_default_headers(self):
        """
        デフォルトヘッダーの設定
        """
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    async def options(self):
        """
        CORS プリフライトリクエストへの対応
        """
        self.set_status(200)
        self.finish()
```

---

## 🎛️ JupyterLab バージョン互換性

### サポートバージョン

| JupyterLab Version | Cell Monitor Support | Notes |
|-------------------|---------------------|-------|
| **4.2.4+** | ✅ Full Support | 推奨バージョン |
| **4.1.x** | ⚠️ Partial Support | 一部機能制限あり |
| **4.0.x** | ⚠️ Partial Support | API変更により互換性問題 |
| **3.x** | ❌ Not Supported | アーキテクチャ差異 |

### バージョン依存コード

```typescript
// JupyterLabバージョンに応じた互換性対応
function extractCellCodeCompatible(cell: any): string {
  // JupyterLab 4.2.4+ の新しいAPI
  if (cell.model?.sharedModel?.source) {
    return cell.model.sharedModel.source;
  }

  // JupyterLab 4.1.x の旧API
  if (cell.model?.value?.text) {
    return cell.model.value.text;
  }

  // JupyterLab 4.0.x のレガシーAPI
  if (cell.model && typeof cell.model.toString === 'function') {
    return cell.model.toString();
  }

  console.warn('Unable to extract cell code - unsupported JupyterLab version');
  return '';
}
```

---

## 🔐 セキュリティ統合

### 認証統合

```typescript
// JupyterLabの認証システムとの連携
function setupAuthentication(app: JupyterFrontEnd): void {
  const serverConnection = app.serviceManager.serverConnection;

  // JupyterLabの認証トークンを取得
  const token = serverConnection.settings.token;

  if (token) {
    // APIリクエストにトークンを含める
    globalSettings.authToken = token;
  }
}

// 認証付きリクエスト
async function sendAuthenticatedRequest(data: IStudentProgressData): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // JupyterLabトークンの追加
  if (globalSettings.authToken) {
    headers['Authorization'] = `token ${globalSettings.authToken}`;
  }

  const response = await fetch('/cell-monitor', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Authentication failed: ${response.status}`);
  }
}
```

### セキュリティベストプラクティス

```typescript
// 入力サニタイゼーション
function sanitizeEventData(data: IStudentProgressData): IStudentProgressData {
  return {
    ...data,
    code: sanitizeCode(data.code),
    errorMessage: sanitizeString(data.errorMessage),
    output: sanitizeString(data.output, 1000) // 最大1000文字
  };
}

function sanitizeCode(code?: string): string {
  if (!code) return '';
  
  // 危険なコマンドの検出
  const dangerousPatterns = [
    /rm\s+-rf/gi,
    /sudo\s+/gi,
    /exec\s*\(/gi,
    /__import__\s*\(/gi
  ];

  let sanitized = code;
  dangerousPatterns.forEach(pattern => {
    if (pattern.test(sanitized)) {
      console.warn('Potentially dangerous code detected');
    }
  });

  return sanitized.slice(0, 5000); // 最大5000文字
}

function sanitizeString(str?: string, maxLength = 500): string {
  if (!str) return '';
  return str
    .replace(/[<>]/g, '') // HTMLタグ除去
    .slice(0, maxLength);
}
```

---

## 📊 パフォーマンス統合

### JupyterLabパフォーマンスへの影響

```typescript
// パフォーマンス監視
const performanceMonitor = {
  trackingEnabled: true,
  metrics: new Map<string, number>(),

  measureExecutionTime<T>(
    name: string,
    fn: () => T
  ): T {
    if (!this.trackingEnabled) {
      return fn();
    }

    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    this.metrics.set(name, duration);

    // 長時間処理の警告
    if (duration > 100) {
      console.warn(`Performance warning: ${name} took ${duration}ms`);
    }

    return result;
  },

  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }
};

// 使用例
function processCellExecutionWithMetrics(cell: any): void {
  performanceMonitor.measureExecutionTime('cell-processing', () => {
    processCellExecution(cell);
  });
}
```

### メモリ最適化

```typescript
class MemoryOptimizedEventManager {
  private eventQueue: IStudentProgressData[] = [];
  private readonly maxQueueSize = 100;
  private processingInterval: number | null = null;

  constructor() {
    // 定期的なメモリクリーンアップ
    setInterval(() => {
      this.cleanupMemory();
    }, 60000); // 1分ごと
  }

  addEvent(event: IStudentProgressData): void {
    this.eventQueue.push(event);

    // キューサイズの制限
    if (this.eventQueue.length > this.maxQueueSize) {
      this.eventQueue.shift(); // 古いイベントを削除
    }

    this.scheduleProcessing();
  }

  private scheduleProcessing(): void {
    if (this.processingInterval) {
      return;
    }

    this.processingInterval = window.setTimeout(() => {
      this.processEvents();
      this.processingInterval = null;
    }, 1000);
  }

  private processEvents(): void {
    const events = this.eventQueue.splice(0, 10); // 一度に最大10イベント
    events.forEach(event => {
      this.sendEvent(event);
    });
  }

  private cleanupMemory(): void {
    // 強制ガベージコレクション（開発用）
    if (window.gc && typeof window.gc === 'function') {
      window.gc();
    }

    // メモリ使用量の監視
    if (performance.memory) {
      const { usedJSHeapSize, totalJSHeapSize } = performance.memory;
      const memoryUsage = (usedJSHeapSize / totalJSHeapSize) * 100;
      
      if (memoryUsage > 80) {
        console.warn(`High memory usage: ${memoryUsage.toFixed(1)}%`);
      }
    }
  }
}
```

---

## 🧪 統合テスト

### JupyterLab統合テスト

```typescript
// tests/integration.test.ts
import { JupyterFrontEnd } from '@jupyterlab/application';
import { NotebookPanel } from '@jupyterlab/notebook';

describe('JupyterLab Integration', () => {
  let app: JupyterFrontEnd;
  let notebookPanel: NotebookPanel;

  beforeEach(async () => {
    // テスト用JupyterLabアプリケーションの作成
    app = createTestApp();
    await app.start();

    // テスト用ノートブックの作成
    notebookPanel = await createTestNotebook(app);
  });

  it('should activate plugin correctly', async () => {
    const plugin = app.plugins.get('cell-monitor:plugin');
    expect(plugin).toBeDefined();
    expect(plugin.isActivated).toBe(true);
  });

  it('should monitor cell execution', async () => {
    const cell = notebookPanel.content.activeCell;
    expect(cell).toBeDefined();

    // セル実行をシミュレート
    await executeCell(cell);

    // イベント送信を検証
    expect(mockSendEventData).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'cell_executed',
        cellId: expect.any(String)
      })
    );
  });

  it('should handle settings changes', async () => {
    const settingRegistry = app.serviceManager.settings;
    const settings = await settingRegistry.load('cell-monitor:plugin');

    // 設定変更をシミュレート
    await settings.set('serverUrl', 'https://new-server.com');

    // グローバル設定の更新を検証
    expect(globalSettings.serverUrl).toBe('https://new-server.com');
  });
});
```

### E2Eテスト（Playwright）

```typescript
// tests/e2e/integration.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Cell Monitor E2E Tests', () => {
  test('should send events when cells are executed', async ({ page }) => {
    // JupyterLabの起動を待機
    await page.goto('http://localhost:8888/lab');
    await page.waitForSelector('[data-jp-kernel-user]');

    // ノートブックを作成
    await page.click('[data-command="notebook:create-new"]');
    await page.waitForSelector('.jp-Notebook');

    // セルにコードを入力
    const cell = page.locator('.jp-CodeCell .jp-InputArea-editor');
    await cell.fill('print("Hello, World!")');

    // セルを実行
    await page.keyboard.press('Shift+Enter');

    // ネットワークリクエストの監視
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/cell-monitor')
    );

    const response = await responsePromise;
    expect(response.status()).toBe(200);

    // レスポンスボディの検証
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty('eventType', 'cell_executed');
  });
});
```

### パフォーマンステスト

```typescript
// tests/performance.test.ts
describe('Performance Tests', () => {
  it('should handle multiple cell executions efficiently', async () => {
    const startTime = performance.now();
    const promises: Promise<void>[] = [];

    // 100個の同時セル実行をシミュレート
    for (let i = 0; i < 100; i++) {
      const mockCell = createMockCell(`print(${i})`);
      promises.push(processCellExecution(mockCell));
    }

    await Promise.all(promises);

    const duration = performance.now() - startTime;
    
    // 平均処理時間が10ms以下であることを確認
    const averageTime = duration / 100;
    expect(averageTime).toBeLessThan(10);
  });

  it('should not leak memory during extended usage', () => {
    const initialMemory = getMemoryUsage();
    
    // 1000回のイベント処理をシミュレート
    for (let i = 0; i < 1000; i++) {
      const event = createMockEvent();
      eventManager.addEvent(event);
    }

    // ガベージコレクション実行
    if (global.gc) {
      global.gc();
    }

    const finalMemory = getMemoryUsage();
    const memoryIncrease = finalMemory - initialMemory;

    // メモリ増加が10MB以下であることを確認
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
  });
});
```

---

## 🔗 関連ドキュメント

- [Core Integration](CORE_INTEGRATION.md) - プラグインシステムとノートブック統合
- [Configuration & UI](CONFIGURATION_UI.md) - 設定システムとUI統合
- [Operations Guide](../OPERATIONS_GUIDE.md) - 運用ガイド
- [Known Issues](../maintenance/KNOWN_ISSUES.md) - 既知の問題

この統合ガイドにより、Cell Monitor ExtensionがJupyterLabエコシステムとどのように連携し、堅牢で拡張性の高い監視システムを実現しているかを理解できます。

**最終更新**: 2025-08-24  
**対応バージョン**: JupyterLab 4.2.4+