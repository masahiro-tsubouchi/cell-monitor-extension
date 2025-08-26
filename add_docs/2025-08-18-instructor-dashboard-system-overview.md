# 📊 講師用ダッシュボードシステム完全ガイド

**作成日**: 2025年8月18日  
**対象**: JupyterLab Cell Monitor Extension 講師用ダッシュボード  
**目的**: システム構成・データフロー・機能説明の完全ドキュメント

## 🎯 システム概要

### 講師用ダッシュボードとは
JupyterLabで学習する**全ての学生の学習活動をリアルタイムで監視・分析**できるWeb管理画面です。

**主な用途:**
- 200名の学生の学習進捗リアルタイム確認
- エラーやヘルプ要請の即座察知
- チーム別学習状況の可視化
- 個別学生の詳細分析

## 🏗️ システムアーキテクチャ

### データフロー全体図
```
[JupyterLab拡張機能] 
    ↓ HTTP/WebSocket
[FastAPIサーバー] 
    ↓ Redis Pub/Sub
[講師ダッシュボード] 
    ↓ 表示
[講師の画面]
```

### 技術スタック
- **フロントエンド**: React 18 + TypeScript + Material-UI
- **状態管理**: Zustand（軽量でシンプル）
- **リアルタイム通信**: Socket.io-client（WebSocket）
- **API通信**: Axios（HTTPクライアント）
- **UI仮想化**: react-window（大量データ高速表示）
- **データ可視化**: Chart.js + react-chartjs-2

## 📊 主要コンポーネント解説

### 1. メインダッシュボード (`ProgressDashboard.tsx`)

**役割**: 全学生の学習状況を一覧表示
**データソース**: `/api/v1/dashboard/overview` + WebSocket更新

**表示データ:**
```typescript
interface StudentActivity {
  emailAddress: string;        // 学生のメールアドレス（識別子）
  userName: string;           // 表示名
  teamName?: string;          // 所属チーム名
  currentNotebook: string;    // 現在開いているノートブック名
  lastActivity: string;       // 最終活動時刻
  status: 'active' | 'idle' | 'error' | 'help';  // 学習状態
  isRequestingHelp?: boolean; // ヘルプ要請中かどうか
  cellExecutions: number;     // セル実行回数
  errorCount: number;         // エラー発生回数
}
```

**表示モード:**
- **グリッド表示**: 学生カード形式（デフォルト）
- **リスト表示**: 表形式で詳細情報
- **チーム表示**: チーム単位でグループ化

### 2. リアルタイムメトリクス (`MetricsPanel.tsx`)

**役割**: システム全体の統計情報をリアルタイム表示
**データソース**: 集計されたダッシュボードデータ

**表示データ:**
```typescript
interface DashboardMetrics {
  totalActive: number;      // アクティブ学生数
  totalStudents: number;    // 総学生数
  errorCount: number;       // 総エラー数
  totalExecutions: number;  // 総セル実行数
  helpCount: number;        // ヘルプ要請数
}
```

### 3. 活動チャート (`ActivityChart.tsx`)

**役割**: 時系列での学習活動推移を可視化
**データソース**: 時系列集計データ

**表示データ:**
```typescript
interface ActivityTimePoint {
  time: string;            // 時刻（ISO 8601形式）
  executionCount: number;  // その時点でのセル実行数
  errorCount: number;      // その時点でのエラー数
  helpCount: number;       // その時点でのヘルプ要請数
}
```

### 4. 学生詳細モーダル (`StudentDetailModal.tsx`)

**役割**: 個別学生の詳細情報表示
**データソース**: 学生個別APIエンドポイント

**詳細情報:**
- 実行履歴（時系列）
- エラーログ詳細
- ノートブック履歴
- 学習時間統計

## 🔄 データフロー詳細

### 1. 初期データ取得フロー
```
1. ダッシュボード起動
   ↓
2. GET /api/v1/dashboard/overview
   → 全学生の現在状況取得
   ↓
3. WebSocket接続確立
   → リアルタイム更新準備
   ↓
4. 画面表示完了
```

### 2. リアルタイム更新フロー
```
[学生がJupyterLabでセル実行]
   ↓
[JupyterLab拡張機能がイベント送信]
   ↓ POST /api/v1/events
[FastAPIサーバーでイベント処理]
   ↓ Redis Pub/Sub
[講師ダッシュボードにWebSocket送信]
   ↓ instructor_updates チャンネル
[ダッシュボード画面リアルタイム更新]
```

### 3. WebSocketイベント種類
```typescript
// 学生活動更新
'instructor_status_update' : {
  emailAddress: string;
  userName: string;
  status: 'active' | 'idle' | 'error' | 'help';
  lastActivity: string;
  metrics: {
    cellExecutions: number;
    errorCount: number;
  }
}

// ヘルプ要請
'student_help_request': {
  emailAddress: string;
  userName: string;
  timestamp: string;
  notebookName: string;
  requestType: 'help' | 'help_stop';
}

// セル実行通知
'cell_execution': {
  emailAddress: string;
  cellId: string;
  executionTime: number;
  success: boolean;
}
```

## 🛠️ 設定とカスタマイズ

### 1. 環境設定ファイル

**開発環境 (`.env.development`)**
```bash
# ダッシュボード専用設定
REACT_APP_API_BASE_URL=http://localhost:8000/api/v1
REACT_APP_WS_URL=ws://localhost:8000
REACT_APP_DEBUG=true

# UI設定
REACT_APP_AUTO_REFRESH_INTERVAL=5000  # 5秒間隔
REACT_APP_MAX_STUDENTS_PER_PAGE=50    # ページング
REACT_APP_CHART_UPDATE_INTERVAL=10000 # チャート更新間隔
```

**本番環境 (`.env.production`)**
```bash
REACT_APP_API_BASE_URL=https://your-server.com/api/v1
REACT_APP_WS_URL=wss://your-server.com
REACT_APP_DEBUG=false
```

### 2. 表示設定のカスタマイズ

**講師設定ファイル** (`instructorStorage.ts`)
```typescript
interface InstructorSettings {
  viewMode: 'grid' | 'list' | 'team';     // 表示モード
  autoRefresh: boolean;                    // 自動更新ON/OFF
  refreshInterval: number;                 // 更新間隔（秒）
  showInactiveStudents: boolean;          // 非アクティブ学生表示
  alertOnHelp: boolean;                   // ヘルプ要請時の音声アラート
  teamGrouping: boolean;                  // チーム別グループ化
}
```

### 3. アラート設定

**重要イベント通知:**
- ヘルプ要請発生 → 音声アラート + 画面点滅
- 大量エラー発生（5個以上/分） → 警告表示
- 学生の長時間非アクティブ → 注意喚起
- システム接続切断 → 再接続通知

## 🎨 画面構成とUI説明

### 1. メイン画面レイアウト
```
┌─────────────────────────────────────────┐
│ 📊 講師用ダッシュボード            🔄 自動更新 │
├─────────────────────────────────────────┤
│ 📈 メトリクス: アクティブ200名 エラー8件    │
├─────────────────────────────────────────┤
│ 📊 活動チャート (時系列グラフ)             │
├─────────────────────────────────────────┤
│ 👥 学生一覧 [グリッド|リスト|チーム] 表示   │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │
│ │田中  │ │佐藤  │ │鈴木  │ │高橋  │        │
│ │📗📘 │ │📕❌ │ │📗✅ │ │📘🆘│        │
│ └─────┘ └─────┘ └─────┘ └─────┘        │
└─────────────────────────────────────────┘
```

### 2. 学生カード情報
```
┌─────────────────┐
│ 👤 田中太郎      │
│ 📧 tanaka@uni.ac.jp │
│ 👥 チームA       │
│ 📗 notebook1.ipynb │
│ ⏰ 2分前        │
│ 🟢 アクティブ    │
│ ▶️ 実行: 15回    │
│ ❌ エラー: 2回   │
└─────────────────┘
```

### 3. ステータス色分け
- 🟢 **緑色（active）**: 学習中（5分以内に活動）
- 🟡 **黄色（idle）**: 一時停止中（5-15分非活動）
- 🔴 **赤色（error）**: エラー発生中
- 🆘 **オレンジ（help）**: ヘルプ要請中

## 🔧 運用・監視機能

### 1. パフォーマンス監視

**リアルタイム監視項目:**
- WebSocket接続状況
- API応答時間
- メモリ使用量
- 描画フレームレート

**アラート閾値:**
- API応答時間 > 2秒 → 警告
- WebSocket切断 > 10秒 → エラー
- メモリ使用量 > 500MB → 注意

### 2. エラーハンドリング

**自動復旧機能:**
- WebSocket接続切断時の自動再接続
- APIエラー時のリトライ処理（最大3回）
- データ取得失敗時のキャッシュ利用

**エラー表示:**
- ネットワークエラー → 上部バナーで通知
- データ読み込みエラー → 各コンポーネントでローディング表示
- 致命的エラー → エラーページ表示

### 3. ログ・デバッグ機能

**開発モード (`NODE_ENV=development`):**
```javascript
// コンソールに詳細ログ出力
console.log('🔄 WebSocket connected');
console.log('📊 Received data:', studentData);
console.log('⚡ Performance:', renderTime);
```

**本番モード:**
- エラーログのみ外部サービス送信
- ユーザー操作ログの匿名化収集

## 🚀 起動・運用手順

### 1. 開発環境での起動
```bash
# 1. 依存関係インストール
cd instructor-dashboard
npm install

# 2. 環境設定確認
cp .env.example .env.development
# 必要に応じて設定値編集

# 3. 開発サーバー起動
npm start
# → http://localhost:3000 でアクセス可能
```

### 2. Docker環境での起動
```bash
# 全システム起動（ダッシュボード含む）
docker compose up instructor-dashboard

# ダッシュボードのみ再ビルド
docker compose up --build instructor-dashboard
```

### 3. 本番環境デプロイ
```bash
# 1. 本番ビルド作成
npm run build

# 2. 静的ファイル配布
# build/ ディレクトリの内容をWebサーバーに配置

# 3. Nginx設定例
server {
    listen 80;
    server_name dashboard.yourdomain.com;
    root /var/www/instructor-dashboard/build;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## 🎯 期待効果・活用シーナリオ

### 1. 授業中の活用
- **リアルタイム学習状況把握**: 200名全員の状況を一画面で確認
- **困っている学生の即座発見**: ヘルプ要請やエラー多発を瞬時に察知
- **学習進捗の可視化**: チーム間・個人間の進捗差を一目で確認

### 2. 課題・実習での活用
- **提出状況確認**: 各学生の作業進捗をリアルタイムで把握
- **トラブル対応**: エラー発生時の迅速なサポート提供
- **学習分析**: 実行パターンや躓きポイントの分析

### 3. 長期的な教育改善
- **カリキュラム最適化**: データに基づく教材・進度の調整
- **個別指導**: 学習パターン分析による個別サポート
- **チーム編成**: 学習スタイルや進度に基づくチーム作り

## ✅ トラブルシューティング

### よくある問題と解決方法

**1. ダッシュボードが表示されない**
```bash
# 環境変数確認
echo $REACT_APP_API_BASE_URL
echo $REACT_APP_WS_URL

# APIサーバー接続確認
curl http://localhost:8000/api/v1/dashboard/overview
```

**2. リアルタイム更新が動かない**
```bash
# WebSocket接続確認
# ブラウザ開発者ツール → Network → WS タブで確認

# サーバー側Redis確認
docker compose exec redis redis-cli
> PSUBSCRIBE instructor_updates
```

**3. 大量学生データで動作が重い**
```javascript
// パフォーマンス設定調整
REACT_APP_VIRTUALIZATION_ENABLED=true
REACT_APP_UPDATE_THROTTLE=1000  // 更新頻度制限
```

JupyterLab Cell Monitor Extension 講師用ダッシュボードは、大規模教育環境でのリアルタイム学習監視を実現する強力なツールです。適切な設定と運用により、効果的な教育支援が可能になります。