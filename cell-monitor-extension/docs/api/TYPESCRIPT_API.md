# TypeScript API リファレンス - Cell Monitor Extension

**最終更新**: 2025-08-29  
**対象バージョン**: v1.1.4

## 📋 概要

Cell Monitor Extension のモジュール化されたTypeScript API仕様の包括的リファレンスです。v1.1.4のクラスベースアーキテクチャと高性能最適化機能を反映しています。

---

## 📚 API ドキュメント

### 🎯 コアAPI
- **[Interfaces](INTERFACES.md)** - インターフェースと型定義
- **[API Functions](API_FUNCTIONS.md)** - 関数とメソッドの詳細

### 📖 詳細な実装仕様
各ドキュメントには以下の内容が含まれています：

#### [Interfaces](INTERFACES.md)
- `IStudentProgressData` - セル実行イベントデータ
- `EventType` - イベント種類の型定義  
- `ISettings` - 拡張機能設定インターフェース
- Constants - プラグイン定数
- Error Handling - エラーハンドリングパターン

#### [API Functions](API_FUNCTIONS.md)
- `generateUUID()` - UUID v4生成
- `sendEventData()` - サーバー送信
- `extractCellCode()` - セルコード抽出
- `extractCellOutput()` - セル出力抽出
- `loadSettings()` - 設定管理
- `createHelpButton()` - UIコンポーネント
- `TestDataGenerator` - テストユーティリティ

---

## 🚀 クイックスタート

### 基本的な使用例

```typescript
// イベントデータの作成と送信
const eventData: IStudentProgressData = {
  eventId: generateUUID(),
  eventType: 'cell_executed',
  emailAddress: 'student@example.com',
  userName: 'テスト学生',
  teamName: 'チームA',
  sessionId: 'session-123',
  notebookPath: '/notebooks/lesson1.ipynb',
  code: 'print("Hello, World!")',
  executionDurationMs: 150
};

await sendEventData(eventData);
```

### 設定の読み込み

```typescript
settingRegistry.load(PLUGIN_ID).then(settings => {
  loadSettings(settings);
});
```

---

## 🔗 関連ドキュメント

- [System Architecture](../architecture/SYSTEM_ARCHITECTURE.md) - システムアーキテクチャ
- [Development Guide](../dev/GETTING_STARTED.md) - 開発ガイド
- [Operations Guide](../OPERATIONS_GUIDE.md) - 運用ガイド

**最終更新**: 2025-08-24  
**対応バージョン**: JupyterLab 4.2.4+
