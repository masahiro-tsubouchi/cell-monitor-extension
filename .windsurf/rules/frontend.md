---
trigger: manual
description: Frontend
---

# フロントエンドTDD開発ルール

> **バージョン**: 1.0.0
> **最終更新日**: 2025-01-27
> **対象**: フロントエンド開発者
> **プロジェクト**: JupyterLab Cell Monitor Extension - 講師支援ダッシュボード

## 🎯 TDD開発の基本原則

### 1. AI駆動TDDサイクル
本プロジェクトでは、バックエンドで実証済みの**AI駆動TDD**を採用し、186個のテストケース成功の実績を活かします。

```
1. テストファースト → 2. AI実装 → 3. リファクタリング → 4. 検証
     ↑                                                      ↓
     ←←←←←←←←←← フィードバックループ ←←←←←←←←←←←
```

### 2. フロントエンド特有のTDD戦略
- **コンポーネント単位**: 各Reactコンポーネントに対して包括的なテストスイート
- **ユーザー操作重視**: 実際の講師の操作フローに基づくE2Eテスト
- **リアルタイム性**: WebSocket通信・状態変更の即座の検証

## 📋 テスト種別とAI活用指針

### 1. 単体テスト（Unit Tests）
**AI生成率**: 90%以上
**対象**: 個別コンポーネント・フック・ユーティリティ関数

#### AIへの指示テンプレート
```
【目的】
`{コンポーネント名}` の完全な単体テストを作成する。

【対象ファイル】
`src/components/{path}/{ComponentName}.test.tsx`

【テストケース】
- レンダリング: 基本的なレンダリング確認
- Props: 各propsの正常な反映確認
- 状態管理: useState/useReducerの状態変更確認
- イベント: onClick/onChange等のイベントハンドリング
- エラー処理: 異常なpropsや状態での適切なエラーハンドリング
- アクセシビリティ: ARIA属性・キーボード操作の確認

【使用ツール】
`@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`

【参考情報】
Material-UIコンポーネントを使用、講師支援ダッシュボードの文脈で実装
```

#### 必須テストパターン
```typescript
// 基本テンプレート
describe('ComponentName', () => {
  // 1. 基本レンダリング
  it('should render without crashing', () => {
    render(<ComponentName />);
  });

  // 2. Props反映
  it('should display correct props', () => {
    const props = { title: 'Test Title' };
    render(<ComponentName {...props} />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  // 3. ユーザー操作
  it('should handle user interactions', async () => {
    const mockHandler = jest.fn();
    render(<ComponentName onClick={mockHandler} />);

    await user.click(screen.getByRole('button'));
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  // 4. エラー状態
  it('should handle error states gracefully', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    render(<ComponentName invalidProp="error" />);
    // エラーバウンダリーやエラー表示の確認
    consoleError.mockRestore();
  });
});
```

### 2. 統合テスト（Integration Tests）
**AI生成率**: 70%以上
**対象**: 複数コンポーネント連携・API通信・状態管理

#### AIへの指示テンプレート
```
【目的】
座席マップとヘルプ要請システムの統合テストを作成する。

【対象ファイル】
`src/integration/SeatMapHelpRequest.test.tsx`

【テストシナリオ】
1. 座席マップ表示 → ヘルプ要請受信 → 座席状態変更の一連の流れ
2. WebSocket接続 → リアルタイムデータ受信 → UI更新の確認
3. 講師認証 → ダッシュボード表示 → 機能利用可能性の確認

【モック対象】
- WebSocket通信（socket.io-client）
- 認証API（/api/v1/auth）
- ヘルプ要請API（/api/v1/events）

【使用ツール】
`@testing-library/react`, `msw`（API モック）, `socket.io-mock`
```

### 3. E2Eテスト（End-to-End Tests）
**AI生成率**: 50%以上（シナリオ設計は人間、実装はAI）
**対象**: 講師の実際の操作フロー

#### 重要なE2Eシナリオ
```typescript
// 最優先E2Eテスト
describe('講師支援ダッシュボード E2E', () => {
  it('講師ログイン → 座席マップ表示 → ヘルプ要請対応', async () => {
    // 1. ログイン
    await page.goto('/login');
    await page.fill('[data-testid="username"]', 'instructor1');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // 2. ダッシュボード表示確認
    await expect(page.locator('[data-testid="seat-map"]')).toBeVisible();
    await expect(page.locator('[data-testid="help-requests-panel"]')).toBeVisible();

    // 3. ヘルプ要請シミュレーション
    await page.evaluate(() => {
      // WebSocketでヘルプ要請をシミュレート
      window.mockWebSocket.emit('help_request', {
        seatNumber: 'A-01',
        studentName: '田中太郎',
        urgency: 'high'
      });
    });

    // 4. UI更新確認
    await expect(page.locator('[data-testid="seat-A-01"]')).toHaveClass(/help-requested/);
    await expect(page.locator('[data-testid="notification"]')).toBeVisible();
  });
});
```

## 🛠️ 開発ワークフロー

### 1. コンポーネント開発の標準フロー

#### Step 1: テスト設計（AI支援）
```bash
# AIに指示してテストファイルを生成
# 例: SeatMapコンポーネントのテスト生成
```

#### Step 2: テスト実行（Red）
```bash
npm test -- --watch SeatMap.test.tsx
# 全テストが失敗することを確認
```

#### Step 3: 最小実装（AI生成）
```bash
# AIに指示してテストが通る最小限の実装を生成
```

#### Step 4: テスト実行（Green）
```bash
npm test -- SeatMap.test.tsx
# 全テストが成功することを確認
```

#### Step 5: リファクタリング（AI支援）
```bash
# コード品質向上、パフォーマンス最適化
# テストは常に通る状態を維持
```

### 2. AI活用の具体的指針

#### 効果的なAI指示の構造
```
【コンテキスト】
講師支援ダッシュボードの{機能名}コンポーネント

【技術スタック】
React 18.2+ + TypeScript + Material-UI + Jest + Testing Library

【要件】
- 200席対応の座席マップ表示
- リアルタイムヘルプ要請の可視化
- レスポンシブデザイン（スマートフォン対応）

【制約】
- アクセシビリティ対応必須
- パフォーマンス: 3秒以内の初期表示
- WebSocket: 5秒間隔の更新
```

#### AI生成コードの必須レビュー観点
- **型安全性**: TypeScriptの型定義が適切か
- **アクセシビリティ**: ARIA属性・キーボード操作対応
- **パフォーマンス**: 不要な再レンダリングの回避
- **テスト網羅性**: エッジケース・エラーケースのカバー

## 📊 品質保証基準

### 1. テストカバレッジ目標
- **単体テスト**: 90%以上
- **統合テスト**: 80%以上
- **E2Eテスト**: 主要ユーザーフロー100%カバー

### 2. パフォーマンステスト
```typescript
// パフォーマンステストの例
describe('SeatMap Performance', () => {
  it('should render 200 seats within 3 seconds', async () => {
    const startTime = performance.now();

    render(<SeatMap seats={generate200Seats()} />);

    await waitFor(() => {
      expect(screen.getAllByTestId(/seat-/)).toHaveLength(200);
    });

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(3000);
  });
});
```

### 3. アクセシビリティテスト
```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Accessibility', () => {
  it('should not have accessibility violations', async () => {
    const { container } = render(<SeatMap />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

## 🔄 継続的改善プロセス

### 1. テスト実行の自動化
```json
// package.json scripts
{
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "test:e2e": "playwright test",
  "test:all": "npm run test && npm run test:e2e"
}
```

### 2. pre-commitフック
```bash
# .husky/pre-commit
#!/bin/sh
npm run test:coverage
npm run lint
npm run type-check
```

### 3. CI/CDでの品質ゲート
```yaml
# .github/workflows/frontend-test.yml
name: Frontend Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:coverage
      - run: npm run test:e2e
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## 🎯 成功指標

### 1. 開発効率指標
- **テスト作成時間**: AIにより50%短縮
- **バグ発見率**: テストによる早期発見90%以上
- **リファクタリング安全性**: テストによる回帰防止100%

### 2. 品質指標
- **テスト実行時間**: 全テスト5分以内
- **テスト安定性**: フレーキーテスト0%
- **コードカバレッジ**: 目標値達成率100%

### 3. ユーザビリティ指標
- **講師満足度**: E2Eテストシナリオ通りの操作で目標達成
- **エラー率**: 想定外のエラー発生0%
- **レスポンス性**: パフォーマンステスト基準達成

## 📚 参考資料・ベストプラクティス

### 1. Testing Library推奨パターン
- **クエリ優先順位**: getByRole > getByLabelText > getByTestId
- **ユーザー中心**: 実際のユーザー操作に近いテスト
- **非同期処理**: waitFor, findByを適切に使用

### 2. Material-UIテストパターン
```typescript
// Material-UIコンポーネントのテスト例
it('should handle Material-UI Button click', async () => {
  const handleClick = jest.fn();
  render(<Button onClick={handleClick}>Click me</Button>);

  await user.click(screen.getByRole('button', { name: /click me/i }));
  expect(handleClick).toHaveBeenCalled();
});
```

### 3. WebSocketテストパターン
```typescript
// WebSocket通信のモック
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn()
};

jest.mock('socket.io-client', () => ({
  io: () => mockSocket
}));
```

このTDD開発ルールにより、高品質で保守性の高いフロントエンドコードを効率的に開発できます。バックエンドで実証済みのAI駆動TDDの成功パターンを活用し、講師支援ダッシュボードの確実な品質を保証します。
