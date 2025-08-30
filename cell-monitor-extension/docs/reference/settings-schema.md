# Settings Schema Reference

**対象**: システム管理者・開発者  
**更新日**: 2025-08-29

---

## 📋 設定項目一覧

### 基本設定

#### serverUrl
- **型**: `string`
- **形式**: URI
- **必須**: ✅
- **デフォルト**: `"http://localhost:8000/api/v1/events"`
- **説明**: FastAPIサーバーのエンドポイントURL
- **例**: 
  ```json
  "serverUrl": "https://api.example.com/api/v1/events"
  ```

#### userId
- **型**: `string`
- **必須**: ❌
- **デフォルト**: `""`
- **説明**: 学生の一意識別子
- **制約**: 英数字、アンダースコア、ハイフンのみ
- **例**:
  ```json
  "userId": "student_001"
  ```

#### userName
- **型**: `string` 
- **必須**: ❌
- **デフォルト**: `"Anonymous"`
- **説明**: 表示用のユーザー名
- **例**:
  ```json
  "userName": "田中太郎"
  ```

#### teamName
- **型**: `string`
- **必須**: ✅
- **パターン**: `^チーム([A-Z]|[1-9][0-9]?)$`
- **説明**: 所属チーム名（チームA-Z、チーム1-99）
- **例**:
  ```json
  "teamName": "チーム1"
  ```
- **有効な値**:
  - `チーム1` ～ `チーム99`
  - `チームA` ～ `チームZ`

---

## ⚡ パフォーマンス設定

#### batchSize
- **型**: `integer`
- **範囲**: `1 - 100`
- **デフォルト**: `10`
- **説明**: 一度に送信するイベント数
- **推奨**:
  - 低スペック環境: `5`
  - 標準環境: `10`
  - 高性能環境: `20`

#### debounceMs
- **型**: `integer`
- **範囲**: `100 - 2000`
- **デフォルト**: `500`
- **単位**: ミリ秒
- **説明**: 重複イベント排除の待機時間

#### maxRetries
- **型**: `integer`
- **範囲**: `0 - 10`
- **デフォルト**: `3`
- **説明**: 送信失敗時の再試行回数

#### connectionTimeout
- **型**: `integer`
- **範囲**: `1000 - 30000`
- **デフォルト**: `5000`
- **単位**: ミリ秒
- **説明**: HTTP接続タイムアウト時間

---

## 🔔 通知設定

#### enableNotifications
- **型**: `boolean`
- **デフォルト**: `true`
- **説明**: 通知機能の有効/無効

#### notificationPosition
- **型**: `string`
- **選択肢**: `"topRight"`, `"topLeft"`, `"bottomRight"`, `"bottomLeft"`
- **デフォルト**: `"topRight"`
- **説明**: 通知表示位置

#### autoCloseDelay
- **型**: `integer`
- **範囲**: `1000 - 10000`
- **デフォルト**: `3000`
- **単位**: ミリ秒
- **説明**: 通知の自動消去時間

---

## 🐛 デバッグ設定

#### enableDebugLogging
- **型**: `boolean`
- **デフォルト**: `false`
- **説明**: 詳細ログ出力の有効化
- **注意**: 本番環境では`false`推奨

#### logLevel
- **型**: `string`
- **選択肢**: `"error"`, `"warn"`, `"info"`, `"debug"`
- **デフォルト**: `"info"`
- **説明**: ログレベル設定

---

## 🎯 高度な設定

#### customHeaders
- **型**: `object`
- **デフォルト**: `{}`
- **説明**: HTTP リクエストに含める追加ヘッダー
- **例**:
  ```json
  {
    "customHeaders": {
      "Authorization": "Bearer token123",
      "X-Custom-Header": "value"
    }
  }
  ```

#### eventFilter
- **型**: `array`
- **項目**: `string[]`
- **デフォルト**: `[]` (全イベント送信)
- **選択肢**: 
  - `"cell_executed"`
  - `"notebook_opened"` 
  - `"notebook_saved"`
  - `"notebook_closed"`
  - `"help"`
  - `"help_stop"`
- **説明**: 送信するイベントタイプの制限
- **例**:
  ```json
  {
    "eventFilter": ["cell_executed", "help"]
  }
  ```

#### dataTransformation
- **型**: `object`
- **プロパティ**:
  - `includeCode`: `boolean` (デフォルト: `true`)
  - `includeOutput`: `boolean` (デフォルト: `false`)
  - `anonymizeData`: `boolean` (デフォルト: `false`)
- **例**:
  ```json
  {
    "dataTransformation": {
      "includeCode": true,
      "includeOutput": false,
      "anonymizeData": false
    }
  }
  ```

---

## 🏭 環境別設定例

### 開発環境
```json
{
  "serverUrl": "http://localhost:8000/api/v1/events",
  "userId": "dev_user",
  "userName": "開発者",
  "teamName": "チーム1",
  "batchSize": 5,
  "enableDebugLogging": true,
  "logLevel": "debug",
  "enableNotifications": true
}
```

### ステージング環境
```json
{
  "serverUrl": "https://staging-api.example.com/api/v1/events",
  "userId": "staging_user_001",
  "userName": "テストユーザー",
  "teamName": "チームA",
  "batchSize": 10,
  "enableDebugLogging": false,
  "logLevel": "info",
  "maxRetries": 5
}
```

### 本番環境
```json
{
  "serverUrl": "https://api.example.com/api/v1/events",
  "userId": "",
  "userName": "",
  "teamName": "チーム1",
  "batchSize": 10,
  "enableDebugLogging": false,
  "logLevel": "error",
  "maxRetries": 3,
  "connectionTimeout": 5000,
  "customHeaders": {
    "Authorization": "Bearer ${API_TOKEN}"
  }
}
```

---

## 🔧 設定管理ベストプラクティス

### 1. 段階的設定適用
```javascript
// 基本設定 → 環境別設定 → ユーザー設定の順で適用
const config = {
  ...defaultConfig,
  ...environmentConfig,
  ...userConfig
};
```

### 2. バリデーション
```typescript
// 設定値検証の例
function validateSettings(settings: ISettings): ValidationResult {
  const errors: string[] = [];
  
  // URL形式チェック
  if (!isValidUrl(settings.serverUrl)) {
    errors.push('Invalid serverUrl format');
  }
  
  // チーム名パターンチェック
  if (!settings.teamName.match(/^チーム([A-Z]|[1-9][0-9]?)$/)) {
    errors.push('Invalid teamName pattern');
  }
  
  return { isValid: errors.length === 0, errors };
}
```

### 3. 動的設定更新
```typescript
// 設定変更の即座反映
settings.changed.connect((sender, changes) => {
  if (changes.newValue !== changes.oldValue) {
    this.applyNewSettings(changes.newValue);
  }
});
```

---

## ⚠️ 注意事項・制限事項

### セキュリティ考慮事項
- **認証情報**: `customHeaders`に機密情報を含める場合は環境変数使用を推奨
- **URL**: `serverUrl`は信頼できるドメインのみ指定
- **ログレベル**: 本番環境では`debug`レベルを避ける

### パフォーマンス考慮事項
- **batchSize**: 大きすぎるとメモリ使用量増加
- **debounceMs**: 小さすぎるとCPU使用率増加
- **connectionTimeout**: ネットワーク環境に応じて調整

### 互換性
- **JupyterLab**: 4.2.0+ 必須
- **ブラウザ**: ES2018+ 対応ブラウザ
- **TypeScript**: 5.0+ 推奨

---

## 🔄 設定移行ガイド

### v1.0 → v1.1 移行
```json
// v1.0 (旧)
{
  "server": "http://localhost:8000",
  "team": "team1"
}

// v1.1+ (新)
{
  "serverUrl": "http://localhost:8000/api/v1/events",
  "teamName": "チーム1"
}
```

### 自動移行スクリプト
```typescript
function migrateSettings(oldSettings: any): ISettings {
  return {
    serverUrl: oldSettings.server + '/api/v1/events',
    teamName: convertTeamName(oldSettings.team),
    // 他の設定項目...
  };
}
```

---

## 🔗 関連ドキュメント

- [Configuration Guide](../extension/configuration.md) - 設定手順詳細
- [Getting Started](../extension/getting-started.md) - 初期設定
- [Troubleshooting](../guides/troubleshooting.md) - 設定関連問題
- [API Reference](../api/core-classes.md) - プログラマティック設定

---

## 📊 設定テンプレート

### 小規模クラス（～30名）
```json
{
  "batchSize": 5,
  "debounceMs": 1000,
  "maxRetries": 3,
  "connectionTimeout": 5000
}
```

### 大規模クラス（100名+）
```json
{
  "batchSize": 20,
  "debounceMs": 200,
  "maxRetries": 5,
  "connectionTimeout": 10000
}
```

### 低帯域環境
```json
{
  "batchSize": 3,
  "debounceMs": 2000,
  "maxRetries": 5,
  "connectionTimeout": 15000
}
```

**最終更新**: 2025-08-29  
**スキーマバージョン**: 1.1.4