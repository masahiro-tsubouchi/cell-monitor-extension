# FastAPI Server リファクタリング計画

## 📋 概要

このドキュメントは、JupyterLab Cell Monitor Extension システムの`fastapi_server`ディレクトリに対する構造的リファクタリング計画を定義します。本番稼働中（200名同時利用、99.9%稼働率）のシステムを対象とするため、既存機能を破壊しない最小限実装を目標とします。

## 🎯 リファクタリング目標

### 主要目標
- **既存機能の完全保護**: Phase 3最適化済みシステム（毎秒6,999+イベント処理）の安定性維持
- **最小限実装**: 必要最小限の変更による拡張性向上
- **コード整理**: 重複排除と責任分離の明確化
- **保守性向上**: 将来の機能追加を容易にする構造改善

### 成功指標
- ✅ 全既存テストの継続通過
- ✅ API互換性の完全維持
- ✅ パフォーマンス劣化なし
- ✅ デプロイメント時間の短縮

## 📊 現状分析

### ディレクトリ構造
```
fastapi_server/
├── api/                      # 22個のエンドポイントルーター
├── core/                     # 11個のコアサービス
├── crud/                     # 9個のCRUD操作
├── db/                       # データベース層（6ファイル）
├── schemas/                  # 9個のPydanticスキーマ
├── tests/                    # 包括的テストスイート
├── worker/                   # 並列処理システム（5ファイル）
├── scripts/                  # ユーティリティスクリプト
└── migrations/               # データベースマイグレーション
```

### 識別された課題

#### 1. Connection Manager重複
- `core/connection_manager.py` (従来版)
- `core/unified_connection_manager.py` (Phase 3最適化版)
- **影響**: メモリ使用量増加、保守複雑性

#### 2. API Router集約問題
- `api/api.py`で22個のルーター集約
- **影響**: 可読性低下、変更影響範囲の拡大

#### 3. Core Services分散
- 11個のサービスファイルの依存関係不明瞭
- **影響**: 起動順序問題、デバッグ困難

#### 4. Worker システム責任分散
- `worker/main.py`: エントリーポイント
- `worker/parallel_processor.py`: 8ワーカー並列処理
- `worker/event_router.py`: イベント配信
- **影響**: 機能境界の曖昧性

## 🔧 リファクタリング計画

### Phase 1: 基盤統合 (安全性最優先)

#### 1.1 Connection Manager統合
**目標**: `unified_connection_manager.py`への完全移行

**実装ステップ**:
1. `unified_connection_manager.py`の機能完全性検証
2. `connection_manager.py`依存箇所の特定
3. 段階的移行スクリプト作成
4. 既存WebSocket接続の無停止移行

**影響範囲**:
- `main.py`: インポート変更
- `api/endpoints/websocket.py`: インスタンス参照更新
- 全WebSocket関連テスト

#### 1.2 Core Services初期化統一
**目標**: サービス起動順序とライフサイクル管理の統一

**新規ファイル**: `core/service_initializer.py`
```python
class ServiceManager:
    async def initialize_all_services(self) -> None
    async def shutdown_all_services(self) -> None
    def get_service_health(self) -> Dict[str, bool]
```

### Phase 2: API構造最適化

#### 2.1 API Router階層化
**目標**: 機能群別サブルーター導入

**新規構造**:
```
api/
├── api.py                    # メインルーター
├── routers/
│   ├── core_apis.py         # events, websocket, health
│   ├── lms_apis.py          # classes, assignments, submissions
│   ├── admin_apis.py        # admin, instructor_*, dashboard
│   └── monitoring_apis.py   # progress, realtime_progress
```

#### 2.2 後方互換性保証
**戦略**: 既存エンドポイントURLの完全維持
- エンドポイント移行は内部実装のみ
- 外部APIクライアントへの影響ゼロ

### Phase 3: 最適化と整理

#### 3.1 不要ファイル除去
**対象ファイル**:
- `core/connection_manager.py` (Phase 1完了後)
- 重複テストファイル
- 未使用スクリプト

#### 3.2 Documentation更新
- `CLAUDE.md`の開発コマンド更新
- API仕様書の再生成
- アーキテクチャ図の更新

## 🚀 実装戦略

### 破壊リスク最小化

#### 1. 段階的移行
- **原則**: 一度に1コンポーネントのみ変更
- **検証**: 各段階で全テスト実行
- **ロールバック**: Git履歴による即座復元

#### 2. Feature Flag活用
```python
# 設定による段階的切り替え
USE_UNIFIED_CONNECTION_MANAGER = os.getenv("USE_UNIFIED_MANAGER", "false").lower() == "true"
```

#### 3. 監視強化
- 各フェーズでパフォーマンスメトリクス計測
- エラーレート監視
- WebSocket接続安定性確認

### テスト戦略

#### 1. 回帰テスト
- 全既存テストの継続実行
- パフォーマンステストの定期実行
- E2Eテストによる機能確認

#### 2. 統合テスト追加
- サービス間通信テスト
- 新しいAPI構造のテスト
- 負荷テストによる性能確認

## 📅 実装スケジュール

### Week 1-2: Phase 1 基盤統合
- [ ] Connection Manager移行準備
- [ ] ServiceManager実装
- [ ] 移行スクリプト作成
- [ ] テスト実行・検証

### Week 3-4: Phase 2 API最適化
- [ ] サブルーター実装
- [ ] 段階的移行実行
- [ ] API互換性テスト
- [ ] パフォーマンステスト

### Week 5: Phase 3 最終整理
- [ ] 不要ファイル除去
- [ ] ドキュメント更新
- [ ] 最終統合テスト
- [ ] デプロイメント準備

## ✅ 検証チェックリスト

### 機能検証
- [ ] 全API エンドポイント正常応答
- [ ] WebSocket接続安定性
- [ ] 並列処理性能（6,999+イベント/秒）
- [ ] データベース操作正常性
- [ ] Redis pub/sub機能

### パフォーマンス検証
- [ ] レスポンス時間 < 100ms維持
- [ ] 同時接続200名対応
- [ ] メモリ使用量改善
- [ ] CPU使用率安定性

### 安定性検証
- [ ] 24時間連続稼働テスト
- [ ] エラー回復機能
- [ ] ログ出力正常性
- [ ] 監視システム連携

## 🔄 ロールバック計画

### 緊急時対応
1. **即座復元**: Git revert による前バージョン復元
2. **部分復元**: Feature Flag による旧実装切り替え
3. **データ整合性**: データベース状態確認・修復

### 通信計画
- ステークホルダーへの事前通知
- 作業進捗の定期報告
- 問題発生時の即座エスカレーション

## 📝 成果物

### 技術的成果物
- リファクタリング済みソースコード
- 更新されたテストスイート
- パフォーマンステスト結果
- 新アーキテクチャドキュメント

### ドキュメント更新
- `CLAUDE.md`改訂版
- API仕様書更新
- 開発者ガイド更新
- 運用手順書更新

---

**最終更新**: 2025-08-31  
**作成者**: Claude Code Assistant  
**承認**: 要ステークホルダー確認