# Test Environment Troubleshooting - Cell Monitor Extension

**最終更新**: 2025-08-29  
**対象バージョン**: v1.1.4

## 📋 概要

Cell Monitor Extension v1.1.4 のテスト環境で発生する問題とその解決策を包括的に説明します。

---

## 🚨 現在確認されているテスト問題

### 1. Jest実行時のMODULE_NOT_FOUNDエラー

**エラー内容**:
```bash
Error: Cannot find module '..'
Require stack:
- /path/to/node_modules/.bin/jest
```

**原因分析**:
- Jest設定ファイルの依存関係解決問題
- node_modules の不整合
- TypeScript設定との競合

**解決方法**:

#### Step 1: 依存関係の再インストール
```bash
# node_modules完全削除
rm -rf node_modules package-lock.json

# 強制的再インストール
npm install --force

# または yarnを使用
yarn install --force
```

#### Step 2: Jest設定の確認
```javascript
// jest.config.js の現在の設定確認
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@jupyterlab/(.*)$': '<rootDir>/node_modules/@jupyterlab/$1',
    '^@lumino/(.*)$': '<rootDir>/node_modules/@lumino/$1',
  },
  // ... 他の設定
};
```

#### Step 3: TypeScript設定の整合性確認
```json
// tsconfig.json の確認
{
  "compilerOptions": {
    "target": "es2018",
    "module": "esnext",
    "moduleResolution": "node",
    // ... 他の設定
  },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.test.ts", "src/__tests__/**/*", "src/**/test*"]
}
```

#### Step 4: 代替テスト実行方法
```bash
# 直接ts-jestで実行
npx ts-jest tests/*.test.ts

# 個別テストファイル実行
npx jest tests/EventManager.test.ts --no-cache

# デバッグモードで実行
npx jest --verbose --detectOpenHandles
```

---

## 🔧 テスト環境の完全セットアップ手順

### 1. 開発環境の準備
```bash
# Node.js バージョン確認（推奨: v16以上）
node --version

# npm バージョン確認
npm --version

# TypeScript グローバルインストール
npm install -g typescript
```

### 2. プロジェクト依存関係のセットアップ
```bash
# プロジェクトルートに移動
cd cell-monitor-extension

# 依存関係インストール
npm install

# TypeScript コンパイル確認
npx tsc --noEmit
```

### 3. Jest設定の検証
```bash
# Jest設定テスト
npx jest --init

# 設定確認
npx jest --showConfig
```

### 4. テスト実行の段階的検証
```bash
# 1. 構文チェック
npm run eslint:check

# 2. TypeScript コンパイル
npm run build:lib

# 3. 単体テスト実行
npm test

# 4. カバレッジ付きテスト
npm run test:coverage
```

---

## 📊 現在のテストファイル構成

```
tests/
├── jest.d.ts                    # Jest型定義
├── setup.ts                     # テスト環境セットアップ
├── tsconfig.json                # テスト用TypeScript設定
├── DataTransmissionService.test.ts  # データ送信テスト
├── EventManager.test.ts         # イベント管理テスト
├── help-button.test.ts          # ヘルプボタンテスト
├── help-request.test.ts         # ヘルプリクエストテスト
├── load-distribution.test.ts    # 負荷分散テスト
├── notification-control.test.ts # 通知制御テスト
├── settings.test.ts             # 設定管理テスト
└── types.test.ts                # 型定義テスト
```

---

## 🐛 トラブルシューティング手順

### 一般的な問題と解決方法

#### 1. モジュール解決エラー
```bash
# キャッシュクリア
npm run clean
rm -rf .parcel-cache
rm -rf node_modules/.cache

# 再インストール
npm install
```

#### 2. TypeScript型エラー
```bash
# 型定義の更新
npm install @types/jest --save-dev
npm install @types/node --save-dev

# TypeScript設定確認
npx tsc --showConfig
```

#### 3. JupyterLab関連モックエラー
```typescript
// tests/setup.ts でモック設定
jest.mock('@jupyterlab/application');
jest.mock('@jupyterlab/notebook');
jest.mock('@jupyterlab/settingregistry');
```

#### 4. ES Modules vs CommonJS 競合
```javascript
// jest.config.js で変換設定
module.exports = {
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      isolatedModules: true
    }]
  },
  // ...
};
```

---

## ✅ テスト成功の確認方法

### 1. 基本テスト実行
```bash
npm test
# 期待結果: All tests pass
```

### 2. カバレッジレポート確認
```bash
npm run test:coverage
# 期待結果: Coverage report generated
```

### 3. 個別テストファイル検証
```bash
# 各テストファイルを個別実行
npx jest tests/EventManager.test.ts
npx jest tests/DataTransmissionService.test.ts
# ... 全11ファイル
```

---

## 📈 テスト環境最適化のベストプラクティス

### 1. CI/CD統合準備
```yaml
# .github/workflows/test.yml 例
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
```

### 2. 開発効率化
```bash
# ウォッチモードでテスト
npm run test:watch

# 特定パターンのテスト実行
npm test -- --testNamePattern="EventManager"
```

### 3. デバッグ設定
```javascript
// VS Code .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Jest Tests",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

---

**最終更新**: 2025-08-29  
**適用バージョン**: v1.1.4  
**メンテナンス**: 定期的なnpm audit実行推奨