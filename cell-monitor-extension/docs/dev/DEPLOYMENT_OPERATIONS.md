# Deployment & Operations - Cell Monitor Extension

**最終更新**: 2025-08-24  
**対象バージョン**: v1.1.0

## 📋 概要

Cell Monitor Extension のデプロイメント手順、監視システム、継続的改善プロセスの詳細説明です。

---

## 🚀 デプロイメント

### ビルドプロセス
```bash
# 1. 依存関係チェック
npm audit
npm outdated

# 2. 型チェック
npm run build:lib

# 3. テスト実行
npm run test:coverage

# 4. プロダクションビルド
npm run build:prod

# 5. 配布パッケージ作成
./build-extension.sh

# 6. 動作確認
jupyter labextension list | grep cell-monitor
```

### 設定管理
```json
// schema/plugin.json の保守
{
  "title": "Cell Monitor Settings",
  "type": "object",
  "properties": {
    "serverUrl": {
      "type": "string",
      "title": "Server URL",
      "description": "FastAPI server endpoint for data transmission",
      "default": "http://fastapi:8000/api/v1/events",
      "format": "uri"
    },
    "teamName": {
      "type": "string",
      "title": "Team Name",
      "description": "Student team identifier",
      "pattern": "^チーム([A-Z]|[1-9][0-9]?)$",
      "examples": ["チームA", "チーム1", "チーム99"]
    }
  }
}
```

### 本番環境デプロイメント
```bash
#!/bin/bash
# deploy-production.sh

echo "🚀 Production Deployment Started"

# 1. 環境確認
check_environment() {
    echo "Checking environment..."
    node --version
    jupyter --version
    docker --version
}

# 2. バックアップ作成
create_backup() {
    echo "Creating backup..."
    DATE=$(date +"%Y%m%d_%H%M%S")
    cp -r /opt/jupyterlab/extensions /opt/backup/extensions_$DATE
}

# 3. 拡張機能ビルド
build_extension() {
    echo "Building extension..."
    npm ci --production
    npm run build:prod
    ./build-extension.sh
}

# 4. JupyterLabに拡張機能インストール
install_extension() {
    echo "Installing extension..."
    pip install dist/*.whl --force-reinstall
    jupyter labextension list
}

# 5. サービス再起動
restart_services() {
    echo "Restarting services..."
    systemctl restart jupyterlab
    systemctl status jupyterlab
}

# 6. ヘルスチェック
health_check() {
    echo "Running health checks..."
    curl -f http://localhost:8888/lab || exit 1
    sleep 10
    curl -f http://localhost:8000/health || echo "Warning: FastAPI server not responding"
}

# メイン実行
main() {
    check_environment
    create_backup
    build_extension
    install_extension
    restart_services
    health_check
    echo "✅ Production Deployment Completed"
}

main "$@"
```

---

## 📈 監視とメトリクス

### 重要指標
```typescript
interface SystemMetrics {
  // パフォーマンス指標
  averageResponseTime: number;
  memoryUsage: number;
  eventProcessingRate: number;
  
  // 品質指標
  errorRate: number;
  dataValidationFailures: number;
  testCoverage: number;
  
  // ビジネス指標
  activeUsers: number;
  eventsPerSession: number;
  helpRequestFrequency: number;
}
```

### アラート設定
```typescript
const alertThresholds = {
  memoryUsage: 500_000_000, // 500MB
  responseTime: 2000,       // 2秒
  errorRate: 0.01,          // 1%
  diskSpace: 0.9            // 90%
};

class AlertManager {
  public checkThresholds(metrics: SystemMetrics): Alert[] {
    const alerts: Alert[] = [];
    
    if (metrics.memoryUsage > alertThresholds.memoryUsage) {
      alerts.push({
        severity: 'warning',
        message: `Memory usage high: ${metrics.memoryUsage}MB`,
        action: 'Consider memory cleanup optimization'
      });
    }
    
    return alerts;
  }
}
```

### 監視ダッシュボード
```typescript
class MonitoringDashboard {
  private metrics: SystemMetrics;
  
  public async collectMetrics(): Promise<SystemMetrics> {
    return {
      averageResponseTime: await this.measureResponseTime(),
      memoryUsage: process.memoryUsage().heapUsed,
      eventProcessingRate: this.calculateEventRate(),
      errorRate: this.calculateErrorRate(),
      dataValidationFailures: this.getValidationFailures(),
      testCoverage: await this.getTestCoverage(),
      activeUsers: this.getActiveUserCount(),
      eventsPerSession: this.calculateEventsPerSession(),
      helpRequestFrequency: this.getHelpRequestFrequency()
    };
  }
  
  private async measureResponseTime(): Promise<number> {
    const startTime = performance.now();
    try {
      await fetch('/cell-monitor/health');
      return performance.now() - startTime;
    } catch {
      return -1; // Service unavailable
    }
  }
}
```

---

## 🔄 継続的改善

### コードレビュー チェックリスト
- [ ] **型安全性**: TypeScript strict mode 準拠
- [ ] **パフォーマンス**: メモリリーク・無限ループのチェック
- [ ] **セキュリティ**: 入力検証・エラーハンドリング
- [ ] **テスト**: カバレッジ85%以上
- [ ] **ドキュメント**: API変更時の文書更新

### リファクタリング指針
1. **機能追加前のクリーンアップ**: 既存コードの整理
2. **段階的リファクタリング**: 一度に大きく変更せず段階的に
3. **後方互換性**: 設定ファイルやAPIの破壊的変更を避ける
4. **テスト保護**: リファクタリング前にテストを充実

### 技術負債管理
```typescript
// TODO コメントの構造化
// TODO(priority:high, assignee:dev-team, deadline:2024-09-01): 
//   データ永続化機能の実装
//   - ローカルストレージ活用
//   - サーバー復旧時の自動再送信

// FIXME(bug:memory-leak, impact:high, reporter:user-123):
//   長時間利用時のメモリ増加問題
//   - processedCells の定期クリーンアップ強化
```

---

## 🛠️ 運用手順

### 日常運用タスク
```bash
#!/bin/bash
# daily-maintenance.sh

echo "📅 Daily Maintenance Tasks"

# 1. ログローテーション
rotate_logs() {
    echo "Rotating logs..."
    journalctl --vacuum-time=7d
    find /var/log/jupyterlab -name "*.log" -mtime +7 -delete
}

# 2. メトリクス収集
collect_metrics() {
    echo "Collecting metrics..."
    curl -s http://localhost:8888/cell-monitor/metrics > /tmp/daily_metrics.json
    python3 scripts/analyze_metrics.py /tmp/daily_metrics.json
}

# 3. バックアップ確認
verify_backups() {
    echo "Verifying backups..."
    ls -la /opt/backup/ | grep $(date +"%Y%m%d")
}

# 4. セキュリティスキャン
security_scan() {
    echo "Running security scan..."
    npm audit --audit-level high
    pip-audit
}

# メイン実行
rotate_logs
collect_metrics
verify_backups
security_scan
echo "✅ Daily maintenance completed"
```

### インシデント対応手順
```typescript
interface IncidentResponse {
  severity: 'low' | 'medium' | 'high' | 'critical';
  steps: string[];
  rollbackPlan: string[];
}

const incidentPlaybook = {
  memoryLeak: {
    severity: 'high',
    steps: [
      '1. メモリ使用量の確認: ps aux | grep jupyter',
      '2. プロセスの詳細分析: pmap -d <jupyter-pid>',
      '3. 一時的な制限設定: ulimit -v 1000000',
      '4. JupyterLab再起動: systemctl restart jupyterlab',
      '5. 監視強化: メモリ使用量を5分間隔で監視'
    ],
    rollbackPlan: [
      '1. 前のバージョンに戻す',
      '2. 設定をデフォルトに戻す',
      '3. ユーザーに影響を通知'
    ]
  },
  
  serverConnectivity: {
    severity: 'medium',
    steps: [
      '1. ネットワーク接続確認: ping fastapi-server',
      '2. FastAPIサーバー状態確認: curl http://fastapi:8000/health',
      '3. プロキシ設定確認: cat /etc/nginx/sites-enabled/jupyterlab',
      '4. ローカルキャッシュ確認: du -sh ~/.jupyter/lab/workspaces'
    ],
    rollbackPlan: [
      '1. オフラインモードに切り替え',
      '2. ローカルストレージに一時保存',
      '3. サーバー復旧後に自動再送信'
    ]
  }
};
```

---

## 📚 学習リソース

### JupyterLab Extension 開発
- [JupyterLab Extension Development Guide](https://jupyterlab.readthedocs.io/en/stable/extension/extension_dev.html)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)

### パフォーマンス最適化
- [JavaScript Performance](https://developer.mozilla.org/en-US/docs/Web/Performance)
- [Memory Management in TypeScript](https://www.typescriptlang.org/docs/handbook/memory-management.html)

### 運用・監視
- [Prometheus Monitoring](https://prometheus.io/docs/introduction/overview/)
- [Grafana Dashboards](https://grafana.com/docs/grafana/latest/dashboards/)
- [JupyterLab Server Configuration](https://jupyter-server.readthedocs.io/en/latest/operators/configure-jupyterlab.html)

---

## 🔍 品質保証プロセス

### 自動化されたCI/CD
```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Type check
        run: npm run build
      
      - name: Lint
        run: npm run eslint:check
      
      - name: Test
        run: npm run test:coverage
      
      - name: Build extension
        run: ./build-extension.sh

  deploy:
    if: github.ref == 'refs/heads/main'
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: ./deploy-production.sh
```

### 品質ゲート
```typescript
interface QualityGates {
  // コード品質
  eslintViolations: 0;
  typeScriptErrors: 0;
  testCoverage: 85; // %
  
  // パフォーマンス
  bundleSize: 200; // KB
  buildTime: 120; // seconds
  memoryUsage: 50; // MB
  
  // セキュリティ
  securityVulnerabilities: 0;
  dependencyAuditIssues: 0;
  
  // ドキュメント
  apiDocumentationCoverage: 90; // %
  changelogUpdated: true;
}
```

---

## 🔗 関連ドキュメント

- [Development Workflow](DEVELOPMENT_WORKFLOW.md) - 開発ワークフローとアーキテクチャ
- [Implementation & Testing](IMPLEMENTATION_TESTING.md) - 実装ガイドとテスト戦略
- [Operations Guide](../OPERATIONS_GUIDE.md) - 詳細な運用ガイド

**このガイドは living document です。プロジェクトの成長とともに継続的に更新されます。**

**最終更新**: 2025-08-24  
**次回レビュー予定**: 2025-11-24