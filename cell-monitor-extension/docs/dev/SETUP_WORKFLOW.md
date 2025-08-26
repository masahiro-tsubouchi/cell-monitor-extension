# Development Workflow - Cell Monitor Extension

**最終更新**: 2025-08-24  
**対象バージョン**: v1.1.0

## 📋 概要

Cell Monitor Extension の日常的な開発ワークフロー詳細説明です。

---

## 🔧 開発ワークフロー

### 日常的な開発サイクル

#### 1. ソースコード編集

```bash
# メインの実装ファイル
src/index.ts

# 設定スキーマ
schema/plugin.json

# スタイルファイル
style/index.css
```

#### 2. 自動ビルドモード

```bash
# ファイル変更を監視してTypeScriptを自動コンパイル
npm run watch:src

# JupyterLab拡張機能を自動リビルド（別ターミナル）
npm run watch:labextension

# または、並行実行
npm run watch
```

#### 3. JupyterLabでのテスト

```bash
# JupyterLabの起動（開発モード）
jupyter lab --ip=127.0.0.1 --port=8888

# ブラウザの開発者ツールでJavaScriptコンソールを確認
# F12 → Console タブ
```

---

## 本格的な開発フロー

### 機能追加のワークフロー

```bash
# 新しい機能ブランチを作成
git checkout -b feature/new-monitoring-feature

# TypeScriptコードの変更
# src/index.ts を編集

# 設定スキーマの更新（必要に応じて）
# schema/plugin.json を編集

# テストケースの追加
# tests/ ディレクトリにテストを追加

# ビルドとテスト
npm run build
npm test

# 変更をコミット
git add .
git commit -m "Add new monitoring feature"

# プルリクエストの作成
git push origin feature/new-monitoring-feature
```

### デバッグワークフロー

```typescript
// src/index.ts でのデバッグ例
function processCellExecution(cell: any): void {
  // デバッグ情報の出力
  console.log('Processing cell:', {
    cellId: cell.model?.id,
    cellType: cell.model?.type,
    executionCount: cell.model?.executionCount
  });

  // ブレークポイントの設定（ブラウザデバッガー用）
  debugger;

  try {
    // セル処理のロジック
    const eventData = extractCellData(cell);
    sendEventData(eventData);
  } catch (error) {
    console.error('Cell processing error:', error);
    // エラー処理
  }
}
```

---

## 📦 ビルドとパッケージング

### 開発ビルド

```bash
# 開発用ビルド（高速、デバッグ情報含む）
npm run build

# 詳細ビルド過程の表示
npm run build -- --verbose
```

### プロダクションビルド

```bash
# 本番用ビルド（最適化、圧縮）
npm run build:prod

# クリーンビルド（既存ファイル削除後にビルド）
npm run clean
npm run build:prod
```

### パッケージング

```bash
# Python wheel パッケージの生成
pip install build
python -m build

# 生成されたファイルの確認
ls -la dist/
# cell_monitor-0.1.0-py3-none-any.whl
# cell_monitor-0.1.0.tar.gz
```

### 配布用パッケージテスト

```bash
# ローカル環境での配布テスト
pip install dist/cell_monitor-0.1.0-py3-none-any.whl

# JupyterLabでの動作確認
jupyter lab

# 拡張機能の一覧確認
jupyter labextension list
```

---

## 🎨 コード品質管理

### コード品質チェック

```bash
# 全体的な品質チェック
npm run quality:check

# 内容:
# - ESLint静的解析
# - TypeScript型チェック
# - テストカバレッジ測定
# - バンドルサイズ測定
# - メモリリーク検出
```

### 自動フォーマット

```bash
# Prettierによるコードフォーマット
npm run format

# ESLintによる自動修正
npm run lint:fix

# コミット前の自動実行（husky設定）
git add .
git commit -m "feature: Add new functionality"
# → 自動的にlint/formatが実行される
```

---

## 🧪 開発中のテスト戦略

### 継続的テスト

```bash
# テスト監視モード（ファイル変更時に自動実行）
npm run test:watch

# 特定のテストファイルを監視
npm run test:watch -- settings.test.ts

# カバレッジ付きで監視
npm run test:watch:coverage
```

### テスト駆動開発（TDD）

```typescript
// Step 1: テストを最初に書く
describe('EventManager - addEvent', () => {
  it('should queue events when offline', () => {
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

## 📊 開発メトリクス

### パフォーマンス監視

```typescript
// パフォーマンス測定
console.time('cell-processing');
// ... 処理 ...
console.timeEnd('cell-processing');

// メモリ使用量監視
function detectMemoryLeaks() {
  if (performance.memory) {
    console.log('Used heap:', performance.memory.usedJSHeapSize);
    console.log('Total heap:', performance.memory.totalJSHeapSize);
  }
}

// 定期的なメモリチェック
setInterval(detectMemoryLeaks, 30000);
```

### 品質メトリクス追跡

```typescript
interface QualityMetrics {
  // テスト品質
  unitTestCoverage: number;    // % (目標: 85%以上)
  integrationTestCoverage: number; // % (目標: 70%以上)
  
  // コード品質
  eslintViolations: number;    // violations (目標: 0)
  cyclomaticComplexity: number; // max per function (目標: 10以下)
  
  // パフォーマンス
  bundleSize: number;          // KB (目標: 200KB以下)
  buildTime: number;           // seconds
}
```

---

## 🔄 CI/CD統合

### 自動化パイプライン

```bash
# ローカルでのCI/CDシミュレーション
npm run ci:simulate

# 内容:
# 1. 依存関係インストール
# 2. TypeScript型チェック
# 3. ESLintチェック
# 4. テスト実行（カバレッジ付き）
# 5. プロダクションビルド
# 6. パッケージング
```

### プレコミットフック

```bash
# Huskyによるプレコミットフック設定
npx husky add .husky/pre-commit "npm run pre-commit"

# .husky/pre-commit の内容
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npm run lint:staged
npm run test:changed
npm run build:check
```

---

## 📈 効率化のコツ

### 開発生産性向上

```typescript
// デバッグ用のグローバル関数（開発環境のみ）
if (process.env.NODE_ENV === 'development') {
  (window as any).cellMonitorDebug = {
    getProcessedCells: () => this.eventManager.getProcessedCells(),
    getSettings: () => this.settingsManager.getCurrentSettings(),
    simulateEvent: (eventType: string) => this.eventManager.simulateEvent(eventType)
  };
}
```

### ホットリロード最適化

```bash
# 最適なホットリロード設定
npm run dev:fast

# 内容:
# - TypeScriptのインクリメンタルビルド
# - JupyterLabの部分リビルド
# - ブラウザの自動リフレッシュ
```

---

## 🔗 関連ドキュメント

- [Environment Setup](SETUP_ENVIRONMENT.md) - 開発環境構築
- [Debug & Troubleshoot](SETUP_DEBUG.md) - デバッグ・トラブルシューティング
- [Implementation & Testing](IMPLEMENTATION_TESTING.md) - 実装ガイドとテスト戦略

**最終更新**: 2025-08-24  
**対応バージョン**: v1.1.0