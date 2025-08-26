# Environment Setup - Cell Monitor Extension

**最終更新**: 2025-08-24  
**対象バージョン**: v1.1.0

## 📋 概要

Cell Monitor Extension の開発環境構築の詳細ガイドです。

---

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

---

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

---

## 🔧 開発ツール設定

### VS Code設定

```json
// .vscode/settings.json
{
  "typescript.preferences.quoteStyle": "single",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.workingDirectories": ["./"],
  "typescript.suggest.autoImports": true
}
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
    "outDir": "lib",              // 出力ディレクトリ
    "rootDir": "src"              // ソースルートディレクトリ
  }
}
```

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

---

## 🧪 テスト環境設定

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

---

## 🛠️ 開発支援ツール

### 有用な開発ツール

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

## 🔍 環境トラブルシューティング

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

---

## 📚 学習リソース

### 主要リファレンス
- [JupyterLab Extension Developer Guide](https://jupyterlab.readthedocs.io/en/stable/extension/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)

---

## 🔗 関連ドキュメント

- [Development Workflow](SETUP_WORKFLOW.md) - 開発ワークフローとビルドプロセス
- [Debug & Troubleshoot](SETUP_DEBUG.md) - デバッグ・トラブルシューティング
- [Implementation & Testing](IMPLEMENTATION_TESTING.md) - 実装ガイドとテスト戦略

**最終更新**: 2025-08-24  
**対応バージョン**: v1.1.0