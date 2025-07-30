# 段階的フロントエンド開発計画

> **バージョン**: 1.0.0
> **最終更新日**: 2025-01-27
> **対象**: 開発者・プロジェクトマネージャー
> **ヒアリング結果反映**: 完了

## 🎯 開発優先順位

### 最優先要求（Phase 1）
1. **座席のヘルプ要請表示**: どこの座席の誰がヘルプを要請しているかの即座の把握
2. **講師対応状況表示**: 講師の対応可能状況とリアルタイム位置情報

### 段階的開発アプローチ
- **小さく始める**: MVPから段階的に機能拡張
- **実用性重視**: 授業現場で即座に使える機能を優先
- **フィードバック駆動**: 各段階で実際の使用感を確認

## 📋 Phase 1: 基本座席マップとヘルプ要請表示

### 🎯 目標
- 200席対応の座席マップ表示
- リアルタイムヘルプ要請の可視化
- 講師認証とログイン機能

### 📦 実装内容

#### 1.1 プロジェクト初期設定
- **技術スタック**: React 18.2+ + TypeScript 5.0+ + Material-UI 5.0+
- **開発環境**: Docker Compose統合
- **認証**: 既存講師認証API（/api/v1/auth）連携

#### 1.2 基本レイアウト
```typescript
// 基本コンポーネント構成
src/
├── components/
│   ├── auth/
│   │   └── LoginForm.tsx        // 講師ログイン
│   ├── layout/
│   │   ├── Header.tsx           // ヘッダー（講師情報、ログアウト）
│   │   └── MainLayout.tsx       // メインレイアウト
│   └── classroom/
│       ├── SeatMap.tsx          // 座席マップ表示
│       └── SeatItem.tsx         // 個別座席表示
├── pages/
│   ├── Login.tsx                // ログインページ
│   └── Dashboard.tsx            // メインダッシュボード
└── hooks/
    ├── useAuth.tsx              // 認証フック
    └── useWebSocket.tsx         // WebSocket通信フック
```

#### 1.3 座席マップ機能
- **座席レイアウト**: 4×4グリッド基本表示
- **座席状態表示**:
  - 正常（緑）
  - ヘルプ要請中（赤）
  - 無活動（黄）
  - 空席（グレー）
- **学生情報表示**: 座席クリックで学生名・ID・チーム番号表示

#### 1.4 ヘルプ要請機能
- **リアルタイム更新**: WebSocket（5秒間隔、設定変更可能）
- **緊急度表示**: エラー継続時間・無活動時間による色分け
- **ヘルプ要請リスト**: 優先度順のヘルプ要請一覧

### 🧪 テスト戦略
- **単体テスト**: 各コンポーネントのレンダリング・状態管理
- **統合テスト**: WebSocket通信・API連携
- **E2Eテスト**: ログイン〜座席マップ表示〜ヘルプ要請確認の一連の流れ

### 📊 成功指標
- [x] 200席の座席マップが3秒以内に表示される（SeatMapパフォーマンステスト実装済み）
- [x] ヘルプ要請が5秒以内にリアルタイム反映される（WebSocket統合完了・全19テスト成功）
- [x] 講師認証が正常に動作する（認証API統合・8テスト成功）
- [x] レスポンシブデザインでスマートフォン表示が適切（Material-UI使用・アクセシビリティ対応済み）

**✅ Phase 1 完了** - 全成功指標達成・TDDサイクル確立・Docker環境統合済み

## 📋 Phase 2: 講師ステータス管理とスマートフォン通知

### 🎯 目標
- 講師の対応可能状況管理
- スマートフォンプッシュ通知システム
- 通知設定管理

### 📦 実装内容

#### 2.1 講師ステータス管理
```typescript
// 講師ステータス関連コンポーネント
src/components/instructor/
├── StatusPanel.tsx              // 講師ステータス表示・変更
├── LocationTracker.tsx          // 教室内位置追跡
└── AvailabilityToggle.tsx       // 対応可能/不可切り替え
```

#### 2.2 通知システム
- **プッシュ通知**: Web Push API使用
- **通知内容**: 座席番号・学生名・緊急度・推定問題内容
- **通知設定**: ON/OFF・緊急度別設定・音声通知設定

#### 2.3 講師位置追跡
- **手動位置更新**: 講師が現在位置を手動で更新
- **移動履歴**: 講師の教室内移動パターン記録
- **効率分析**: 移動効率の可視化

### 🧪 TDD開発戦略（Docker環境）

#### 2.4 開発フェーズ別TDDサイクル

**Phase 2.1: 講師ステータス管理コンポーネント**
```bash
# Docker環境でのTDD開発サイクル
docker compose exec instructor-dashboard npm test -- --watch

# 1. Red フェーズ: 失敗するテストを作成
src/components/instructor/StatusPanel.test.tsx
src/components/instructor/LocationTracker.test.tsx
src/components/instructor/AvailabilityToggle.test.tsx

# 2. Green フェーズ: 最小限の実装でテストを通す
src/components/instructor/StatusPanel.tsx
src/components/instructor/LocationTracker.tsx
src/components/instructor/AvailabilityToggle.tsx

# 3. Refactor フェーズ: コード品質向上
```

**Phase 2.2: 通知システムTDD**
```typescript
// 通知システムのテスト駆動開発
src/services/
├── notificationService.test.ts     // 通知サービステスト（Red→Green）
├── notificationService.ts          // Web Push API実装
├── notificationSettings.test.ts    // 設定管理テスト
└── notificationSettings.ts         // 設定永続化実装

src/hooks/
├── useNotification.test.ts         // 通知フックテスト
└── useNotification.ts              // 通知フック実装
```

**Phase 2.3: WebSocket統合拡張**
```typescript
// 既存WebSocketServiceの拡張
src/services/websocket.ts
// 講師ステータス更新イベントの追加実装
// - instructor_status_change
// - instructor_location_update
// - notification_settings_sync
```

#### 2.5 テスト実行戦略
```bash
# 単体テスト（各コンポーネント）
docker compose exec instructor-dashboard npm test -- src/components/instructor/

# 統合テスト（WebSocket + 通知）
docker compose exec instructor-dashboard npm test -- src/services/

# E2Eテスト（講師ステータス変更 → 通知送信）
docker compose exec instructor-dashboard npm run test:e2e
```

### 📊 成功指標
- [ ] ヘルプ要請から1秒以内のプッシュ通知
- [ ] 講師ステータス変更がリアルタイム反映
- [ ] 通知設定が正常に保存・適用される
- [ ] 全コンポーネントのテストカバレッジ90%以上
- [ ] Docker環境でのCI/CDパイプライン構築

## 📋 Phase 3: 座席レイアウトエディターと高度な分析

### 🎯 目標
- 授業ごとの座席配置変更機能
- 学習データ分析・可視化
- 授業改善提案システム

### 📦 実装内容

#### 3.1 座席レイアウトエディター
```typescript
src/components/classroom/
├── SeatEditor.tsx               // 座席配置エディター
├── LayoutTemplates.tsx          // レイアウトテンプレート
└── SeatAssignment.tsx           // 学生座席割り当て
```

#### 3.2 データ分析機能
- **リアルタイム分析**: 授業中の学習進捗分析
- **事後分析**: 授業終了後の詳細分析
- **改善提案**: AI駆動の授業改善提案

#### 3.3 永続化・履歴管理
- **座席配置履歴**: 過去の座席配置パターン保存
- **学習データ保存**: 授業改善分析用データ蓄積
- **パフォーマンス分析**: システム利用状況分析

### 📊 成功指標
- [ ] 座席レイアウト変更が直感的に操作可能
- [ ] データ分析結果が有用な改善提案を生成
- [ ] 過去データとの比較分析が可能

## 🛠️ 技術実装詳細

### 開発環境セットアップ
```bash
# 1. プロジェクト作成
npx create-react-app instructor-dashboard --template typescript
cd instructor-dashboard

# 2. 必要パッケージインストール
npm install @mui/material @emotion/react @emotion/styled
npm install @mui/icons-material @mui/lab
npm install zustand react-query
npm install socket.io-client
npm install @types/node

# 3. Docker統合
# docker-compose.yml に frontend サービス追加
```

### WebSocket通信実装
```typescript
// hooks/useWebSocket.tsx
export const useWebSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([]);

  useEffect(() => {
    const newSocket = io('/instructor/ws', {
      auth: { token: getAuthToken() }
    });

    newSocket.on('help_request', (data: HelpRequest) => {
      setHelpRequests(prev => [...prev, data]);
      // プッシュ通知送信
      sendNotification(data);
    });

    setSocket(newSocket);
    return () => newSocket.close();
  }, []);

  return { socket, helpRequests };
};
```

### 座席マップコンポーネント
```typescript
// components/classroom/SeatMap.tsx
interface SeatMapProps {
  seats: Seat[];
  layout: LayoutConfig;
  onSeatClick: (seat: Seat) => void;
}

export const SeatMap: React.FC<SeatMapProps> = ({ seats, layout, onSeatClick }) => {
  return (
    <Grid container spacing={1}>
      {seats.map((seat) => (
        <Grid item key={seat.id} xs={layout.gridSize}>
          <SeatItem
            seat={seat}
            onClick={() => onSeatClick(seat)}
            status={getSeatStatus(seat)}
          />
        </Grid>
      ))}
    </Grid>
  );
};
```

## 🚀 デプロイメント戦略

### Docker統合
```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### docker-compose.yml統合
```yaml
services:
  instructor-dashboard:
    build: ./instructor-dashboard
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=http://localhost:8000
      - REACT_APP_WS_URL=ws://localhost:8000
    depends_on:
      - fastapi-server
```

## 📈 品質保証・監視

### パフォーマンス監視
- **初期表示時間**: 3秒以内（200席対応）
- **WebSocket応答時間**: 1秒以内
- **メモリ使用量**: 200席同時監視で100MB以下

### エラー監視
- **WebSocket接続エラー**: 自動再接続機能
- **API通信エラー**: リトライ機能・エラー通知
- **レンダリングエラー**: エラーバウンダリー実装

### ユーザビリティテスト
- **講師による実地テスト**: 実際の授業環境での動作確認
- **レスポンシブテスト**: 各種デバイスでの表示確認
- **アクセシビリティテスト**: キーボード操作・スクリーンリーダー対応

## 🎯 次のステップ

1. **Phase 1開発開始**: 基本座席マップとヘルプ要請表示の実装
2. **プロトタイプ作成**: 最小限の機能でのプロトタイプ作成
3. **ユーザーフィードバック**: 実際の講師による使用感確認
4. **反復改善**: フィードバックに基づく機能改善・追加

この段階的開発計画により、実用的で高品質な講師支援ダッシュボードを効率的に開発できます。
