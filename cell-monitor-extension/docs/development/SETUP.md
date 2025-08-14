# 開発環境セットアップガイド

Cell Monitor Extension の開発環境構築と開発ワークフローの詳細ガイドです。

## 🎯 前提条件

### 必須ソフトウェア

| ソフトウェア | バージョン | 確認コマンド |
|-------------|----------|------------|
| **Node.js** | 18.0+ | `node --version` |
| **npm** | 8.0+ | `npm --version` |
| **Python** | 3.8+ | `python --version` |
| **pip** | 21.0+ | `pip --version` |
| **JupyterLab** | 4.2.4+ | `jupyter lab --version` |

### 推奨ツール

- **IDE**: VS Code with TypeScript/Python extensions
- **Git**: バージョン管理
- **Docker**: 統合環境でのテスト用

## 🚀 初期セットアップ

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd jupyter-extensionver2-claude-code/cell-monitor-extension
```

### 2. 開発環境の確認

```bash
# Node.js環境の確認
node --version  # v18以上が必要
npm --version   # v8以上が必要

# Python環境の確認
python --version  # 3.8以上が必要
pip --version

# JupyterLab環境の確認
jupyter lab --version  # 4.2.4以上が必要
```

### 3. 依存関係のインストール

#### Node.js依存関係
```bash
# パッケージの依存関係をインストール
npm install

# 依存関係の確認
npm list --depth=0
```

#### Python依存関係
```bash
# 仮想環境の作成（推奨）
python -m venv venv

# 仮想環境のアクティベート
# macOS/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Python拡張機能の開発モードインストール
pip install -e .

# JupyterLab拡張機能の開発モードでのリンク
jupyter labextension develop . --overwrite
```

### 4. 拡張機能のビルドと有効化

```bash
# TypeScriptのコンパイル
npm run build:lib

# JupyterLab拡張機能のビルド
npm run build:labextension:dev

# または、一括ビルド
npm run build

# JupyterLabの再ビルド（必要に応じて）
jupyter lab build
```

### 5. 動作確認

```bash
# JupyterLabの起動
jupyter lab --ip=127.0.0.1 --port=8888

# ブラウザで http://localhost:8888 にアクセス
# 拡張機能が正しくロードされていることを確認
```

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

### 本格的な開発フロー

#### 1. 機能追加のワークフロー

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

#### 2. デバッグワークフロー

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

## 🧪 テスト環境

### 単体テスト実行

```bash
# 全テストの実行
npm test

# 特定テストファイルの実行
npm test -- settings.test.ts

# テストの詳細出力
npm test -- --verbose

# カバレッジ測定付きテスト
npm run test:coverage

# ウォッチモード（ファイル変更時に自動実行）
npm run test:watch
```

### テスト構成

```
tests/
├── settings.test.ts          # 設定システムテスト
├── help-button.test.ts       # ヘルプボタンUIテスト
├── help-request.test.ts      # ヘルプリクエストロジックテスト
├── notification-control.test.ts # 通知制御テスト
├── types.test.ts             # 型定義テスト
└── setup.ts                  # テスト環境セットアップ
```

### Jest設定

```javascript
// jest.config.js の主要設定
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapping: {
    // JupyterLabモジュールのモック
    '^@jupyterlab/(.*)': '<rootDir>/tests/mocks/jupyterlab-$1.ts'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

## 🎨 コード品質

### ESLint設定

```bash
# ESLintによるコード検査
npm run eslint:check

# ESLintによる自動修正
npm run eslint

# 特定ファイルの検査
npx eslint src/index.ts

# 設定ファイル: .eslintrc.js
```

### TypeScript設定

```json
// tsconfig.json の重要な設定項目
{
  "compilerOptions": {
    "target": "es2018",           // モダンJavaScript機能
    "lib": ["es2018", "dom"],     // 使用可能なライブラリ
    "moduleResolution": "node",   // Node.js形式のモジュール解決
    "strict": true,               // 厳格な型チェック
    "esModuleInterop": true,      // CommonJS互換性
    "skipLibCheck": true,         // 外部ライブラリの型チェックスキップ
    "declaration": true,          // 型定義ファイル生成
    "outDir": "lib",              # 出力ディレクトリ
    "rootDir": "src"              # ソースルートディレクトリ
  }
}
```

### プリティファイア設定

```json
// .prettierrc.json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false
}
```

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

### VS Code デバッグ設定

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
    }
  ]
}
```

### ログ出力の活用

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

## 🔧 トラブルシューティング

### よくある問題と解決方法

#### 1. 拡張機能が表示されない

```bash
# JupyterLab拡張機能の確認
jupyter labextension list

# 拡張機能の再インストール
jupyter labextension develop . --overwrite
jupyter lab build

# キャッシュクリア
rm -rf ~/.cache/jupyterlab
```

#### 2. TypeScriptコンパイルエラー

```bash
# 型定義の再インストール
npm install --save-dev @types/node @types/react

# TypeScriptコンパイラの確認
npx tsc --version

# 設定ファイルの検証
npx tsc --showConfig
```

#### 3. テスト実行エラー

```bash
# テスト環境のリセット
rm -rf node_modules
npm install

# Jestキャッシュのクリア
npm test -- --clearCache

# 特定テストのデバッグ実行
npm test -- --detectOpenHandles --verbose settings.test.ts
```

#### 4. パフォーマンス問題

```typescript
// メモリリーク検出
function detectMemoryLeaks() {
  if (performance.memory) {
    console.log('Used heap:', performance.memory.usedJSHeapSize);
    console.log('Total heap:', performance.memory.totalJSHeapSize);
  }
}

// 定期的なメモリチェック
setInterval(detectMemoryLeaks, 30000);
```

## 📚 追加リソース

### 学習資料

- [JupyterLab Extension Developer Guide](https://jupyterlab.readthedocs.io/en/stable/extension/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)

### 開発ツール

```bash
# 有用な開発ツールの追加インストール
npm install --save-dev \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser \
  prettier \
  husky \
  lint-staged
```

### VS Code 推奨拡張機能

- TypeScript and JavaScript Language Features
- ESLint
- Prettier - Code formatter
- Jest Runner
- Python
- Jupyter

---

この開発環境セットアップガイドに従うことで、効率的で品質の高いCell Monitor Extension開発が可能になります。問題が発生した場合は、トラブルシューティングセクションを参照するか、開発チームに相談してください。
