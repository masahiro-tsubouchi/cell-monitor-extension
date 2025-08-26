# Debug & Troubleshoot - Cell Monitor Extension

**最終更新**: 2025-08-24  
**対象バージョン**: v1.1.0

## 📋 概要

Cell Monitor Extension のデバッグ手法とトラブルシューティングの詳細ガイドです。

---

## 🔍 デバッグ手法

### ブラウザ開発者ツール

```typescript
// JavaScriptコンソールでのデバッグ
console.log('Event data:', eventData);
console.error('Error occurred:', error);
console.warn('Deprecated function used');

// パフォーマンス測定
console.time('cell-processing');
// ... 処理 ...
console.timeEnd('cell-processing');

// オブジェクトの詳細表示
console.table(eventData);
```

### 構造化ログ出力

```typescript
// 構造化ログ出力
const logger = {
  info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data),
  error: (msg: string, error?: any) => console.error(`[ERROR] ${msg}`, error),
  debug: (msg: string, data?: any) => console.debug(`[DEBUG] ${msg}`, data),
};

// 使用例
logger.info('Cell execution started', { cellId: cell.model.id });
logger.error('Failed to send event data', error);
```

### JupyterLabデバッグ用グローバル関数

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

---

## 🛠️ VS Code デバッグ設定

### デバッグ設定ファイル

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Jest Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "disableOptimisticBPs": true,
      "windows": {
        "program": "${workspaceFolder}/node_modules/jest/bin/jest"
      }
    },
    {
      "name": "Debug TypeScript Build",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/tsc",
      "args": ["--watch"],
      "console": "integratedTerminal"
    }
  ]
}
```

### VS Code タスク設定

```json
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Build and Watch",
      "type": "shell",
      "command": "npm",
      "args": ["run", "watch"],
      "group": {
        "kind": "build",
        "isDefault": true
      },
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared"
      }
    }
  ]
}
```

---

## 🔧 トラブルシューティング

### 拡張機能関連の問題

#### 1. 拡張機能が表示されない

```bash
# 問題の診断
jupyter labextension list
jupyter lab --version

# 解決手順
jupyter labextension develop . --overwrite
jupyter lab build --dev-build=False
jupyter lab clean

# キャッシュクリア
rm -rf ~/.cache/jupyterlab
rm -rf ~/.local/share/jupyter/lab
```

#### 2. 拡張機能の設定が反映されない

```typescript
// 設定の確認方法
console.log('Current settings:', settingsManager.getSettings());

// 設定のリセット
settingsManager.resetToDefault();

// 設定の手動再読み込み
await settingsManager.reload();
```

```bash
# JupyterLabの設定ディレクトリ確認
jupyter --paths
ls -la ~/.jupyter/lab/user-settings
```

### ビルドエラーのトラブルシューティング

#### 1. TypeScriptコンパイルエラー

```bash
# TypeScript設定の検証
npx tsc --showConfig

# 型定義の再インストール
rm -rf node_modules/@types
npm install --save-dev @types/node @types/react

# 段階的なビルド確認
npx tsc --noEmit  # 型チェックのみ
npx tsc --build   # インクリメンタルビルド
```

#### 2. 依存関係の問題

```bash
# 依存関係の整合性確認
npm ls
npm audit

# パッケージロックファイルの再生成
rm package-lock.json
rm -rf node_modules
npm install

# 特定パッケージの確認
npm ls @jupyterlab/application
```

### テスト関連の問題

#### 1. テスト実行エラー

```bash
# Jest設定の確認
npx jest --showConfig

# テストの段階的実行
npm test -- --detectOpenHandles
npm test -- --forceExit
npm test -- --runInBand

# 特定テストの詳細デバッグ
npm test -- --verbose settings.test.ts
```

#### 2. テストカバレッジの問題

```bash
# カバレッジファイルのクリア
rm -rf coverage/

# カバレッジの詳細確認
npm run test:coverage -- --verbose

# 特定ファイルのカバレッジ確認
npm run test:coverage -- --collectCoverageOnlyFrom=src/index.ts
```

---

## 📊 パフォーマンス診断

### メモリリーク検出

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

  public getMemoryUsage(): any {
    if (performance.memory) {
      return {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
      };
    }
    return null;
  }
}
```

### ネットワーク診断

```typescript
// API通信の詳細ログ
class NetworkDiagnostics {
  public async testConnection(): Promise<boolean> {
    try {
      const startTime = Date.now();
      const response = await fetch('/cell-monitor/health', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      const endTime = Date.now();
      
      console.log('Network diagnostics:', {
        status: response.status,
        responseTime: endTime - startTime,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      return response.ok;
    } catch (error) {
      console.error('Network connection failed:', error);
      return false;
    }
  }

  public diagnoseConnectivityIssues(): void {
    // ネットワーク接続状態の確認
    console.log('Navigator online:', navigator.onLine);
    
    // サーバーへの接続テスト
    this.testConnection();
    
    // プロキシ設定の確認（可能であれば）
    console.log('User agent:', navigator.userAgent);
  }
}
```

---

## 🔍 高度なデバッグ技術

### リアルタイムメトリクス

```typescript
// リアルタイム監視ダッシュボード
class RealTimeMetrics {
  private intervalId: number | null = null;

  public startMonitoring(intervalMs: number = 5000): void {
    this.intervalId = setInterval(() => {
      const metrics = {
        timestamp: new Date().toISOString(),
        memory: this.getMemoryUsage(),
        eventQueue: this.getEventQueueSize(),
        activeConnections: this.getActiveConnections(),
        errors: this.getRecentErrors()
      };
      
      console.table(metrics);
      
      // メトリクスをローカルストレージに保存
      this.saveMetricsToStorage(metrics);
    }, intervalMs);
  }

  public stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private saveMetricsToStorage(metrics: any): void {
    const storageKey = 'cell-monitor-metrics';
    const existingMetrics = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    existingMetrics.push(metrics);
    
    // 最新50件のみ保持
    if (existingMetrics.length > 50) {
      existingMetrics.shift();
    }
    
    localStorage.setItem(storageKey, JSON.stringify(existingMetrics));
  }
}
```

### 自動診断システム

```typescript
class AutoDiagnostics {
  public async runComprehensiveDiagnostics(): Promise<DiagnosticReport> {
    const report: DiagnosticReport = {
      timestamp: new Date().toISOString(),
      environment: await this.checkEnvironment(),
      performance: await this.checkPerformance(),
      connectivity: await this.checkConnectivity(),
      configuration: await this.checkConfiguration(),
      recommendations: []
    };

    // 問題の分析と推奨事項の生成
    report.recommendations = this.generateRecommendations(report);
    
    return report;
  }

  private async checkEnvironment(): Promise<EnvironmentCheck> {
    return {
      userAgent: navigator.userAgent,
      jupyterlabVersion: await this.getJupyterLabVersion(),
      browserSupport: this.checkBrowserSupport(),
      memoryAvailable: this.getAvailableMemory()
    };
  }

  private generateRecommendations(report: DiagnosticReport): string[] {
    const recommendations: string[] = [];

    if (report.performance.memoryUsage > 100) {
      recommendations.push('メモリ使用量が高いです。ブラウザタブを整理することを推奨します。');
    }

    if (!report.connectivity.serverReachable) {
      recommendations.push('サーバーに接続できません。ネットワーク設定を確認してください。');
    }

    return recommendations;
  }
}

interface DiagnosticReport {
  timestamp: string;
  environment: EnvironmentCheck;
  performance: PerformanceCheck;
  connectivity: ConnectivityCheck;
  configuration: ConfigurationCheck;
  recommendations: string[];
}
```

---

## 🔗 関連ドキュメント

- [Environment Setup](SETUP_ENVIRONMENT.md) - 開発環境構築
- [Development Workflow](SETUP_WORKFLOW.md) - 開発ワークフロー
- [Implementation & Testing](IMPLEMENTATION_TESTING.md) - 実装ガイドとテスト戦略

**最終更新**: 2025-08-24  
**対応バージョン**: v1.1.0