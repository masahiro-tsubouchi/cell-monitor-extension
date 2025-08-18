# 2025-08-18 連続エラー検出システム実装計画

## 📋 プロジェクト概要

**目的**: JupyterLab Cell Monitor Extensionにおいて、同一セルを3回以上連続で実行してエラーが発生した場合のみエラーカウントを増加させるシステムを実装する。

**スコープ**: High Priority（即効性）対応のみ
- ✅ 現在の高性能処理フローを維持
- 🔄 連続エラー検出ロジック追加
- 📊 有意なエラーのみカウント

---

## 🎯 実装対象

### 🏗️ アーキテクチャ設計原則
- **最小侵襲**: 既存の高性能アーキテクチャ（毎秒6,999+イベント処理）を維持
- **段階的実装**: 既存機能への影響を最小限に抑制
- **データ整合性**: PostgreSQL + InfluxDBの一貫性保持

---

## 📊 技術仕様

### 1. **データ層拡張**

#### 1.1 CellExecutionテーブル拡張
```sql
-- Migration: Add consecutive error tracking fields
ALTER TABLE cell_executions 
ADD COLUMN consecutive_error_count INTEGER DEFAULT 0,
ADD COLUMN is_significant_error BOOLEAN DEFAULT FALSE;

-- Index for performance optimization (複合インデックス)
CREATE INDEX idx_cell_executions_error_tracking 
ON cell_executions(student_id, cell_id, executed_at DESC);

-- エラーステータス専用インデックス
CREATE INDEX idx_cell_executions_errors_only
ON cell_executions(student_id, cell_id, executed_at DESC)
WHERE status = 'error';
```

#### 1.2 データモデル更新
- **ファイル**: `fastapi_server/db/models.py`
- **追加フィールド**:
  - `consecutive_error_count`: 連続エラー回数
  - `is_significant_error`: 3回以上エラーフラグ

### 2. **ビジネスロジック強化**

#### 2.1 連続エラー検出関数
- **ファイル**: `fastapi_server/crud/crud_execution.py`
- **新機能**:
  ```python
  def calculate_consecutive_errors(
      db: Session, 
      student_id: int, 
      cell_id: int
  ) -> int:
      """同一セル（student_id + cell_id）の連続エラー回数を計算"""
      # 直近10件の実行履歴を時系列順で取得
      # 最新から遡って連続エラーをカウント
      # 成功(status='success')があった時点でカウントリセット
      # パフォーマンス: LIMIT 10 + インデックス活用
  
  def is_error_significant(
      consecutive_count: int, 
      threshold: int = 3
  ) -> bool:
      """連続エラー回数が閾値を超えているかチェック"""
      return consecutive_count >= threshold
  ```

#### 2.2 イベント処理ロジック統合
- **ファイル**: `fastapi_server/worker/event_router.py`
- **機能拡張**: `handle_cell_execution()` に連続エラー判定を統合

---

## 🔄 実装フロー

### Phase 1: データベースマイグレーション
1. **Migration作成**: Alembicマイグレーションファイル生成
2. **テーブル拡張**: `consecutive_error_count`, `is_significant_error`フィールド追加
3. **インデックス作成**: パフォーマンス最適化

### Phase 2: CRUD機能拡張
1. **連続エラー検出**: `calculate_consecutive_errors()` と `is_error_significant()` 関数実装
2. **実行履歴作成**: `create_cell_execution()` に連続エラー判定統合
3. **既存データ互換**: 既存レコードの `consecutive_error_count=0`, `is_significant_error=FALSE` 保証
4. **エラーハンドリング**: DB接続エラー時のフォールバック処理

### Phase 3: イベント処理統合
1. **エラー判定ロジック**: `handle_cell_execution()` にスマート検出統合
2. **ダッシュボード通知**: 有意なエラーのみWebSocket配信
3. **統計正規化**: 真のエラー率計算

---

## 📈 パフォーマンス要件

### 処理性能目標
- **スループット維持**: 毎秒6,999+イベント処理能力を保持
- **レスポンス時間**: 平均 < 100ms（現状維持）
- **メモリ使用量**: 追加処理による増加 < 5%

### スケーラビリティ
- **同時接続**: 200名JupyterLabクライアント対応
- **データベース負荷**: インデックス最適化によりクエリ高速化
- **リアルタイム性**: WebSocket配信遅延 < 50ms

---

## 🧪 テスト戦略

### 1. **ユニットテスト**
- `test_consecutive_error_detection.py`: 連続エラー検出ロジック
  - 連続エラー3回未満: カウントしない
  - 連続エラー3回以上: カウントする
  - 成功後エラー: 連続カウントリセット
- `test_crud_execution_enhanced.py`: 拡張CRUD機能
  - `calculate_consecutive_errors()` 関数テスト
  - `is_error_significant()` 閾値テスト
  - エッジケース（データなし、混在パターン）

### 2. **統合テスト**
- `test_event_processing_with_error_tracking.py`: エンドツーエンド処理
- `test_performance_with_error_detection.py`: パフォーマンス回帰テスト

### 3. **負荷テスト**
- 200同時ユーザーでの連続エラー検出動作確認
- 高頻度エラー発生時のシステム安定性検証

---

## 🚀 実装スケジュール

### 即時実装（本日）
1. **データベースマイグレーション**: 30分
2. **CRUD機能拡張**: 45分
3. **イベント処理統合**: 60分
4. **基本テスト**: 30分

### 検証・調整（1-2日後）
1. **パフォーマンステスト**: 1時間
2. **統合テスト**: 1時間
3. **本番反映準備**: 30分

---

## ⚠️ リスク管理

### 潜在的リスク
1. **データベース負荷**: 新しいクエリによる性能影響
2. **処理遅延**: 連続エラー計算による微小な遅延（~1-2ms増加想定）
3. **データ整合性**: 既存データとの互換性
4. **メモリ使用量**: 連続エラー検出用の一時データ
5. **競合状態**: 同時セル実行時の整合性

### リスク軽減策
1. **インデックス最適化**: 複合インデックスによる効率的なクエリ実行
2. **クエリ制限**: LIMIT 10による検索範囲制限
3. **エラーハンドリング**: DB接続失敗時のフォールバック処理
4. **段階的ロールアウト**: 開発→ステージング→本番の順次展開
5. **監視強化**: 新機能のパフォーマンス指標追跡

---

## 📝 成功指標

### 機能要件達成
- ✅ 同一セル3回以上エラー時のみカウント増加
- ✅ 有意なエラーのみダッシュボード表示
- ✅ 既存高性能フロー維持

### 性能要件達成
- ✅ スループット: 毎秒6,999+イベント処理維持
- ✅ レスポンス: 平均 < 100ms維持
- ✅ 稼働率: 99.9%維持

---

## 🔧 実装詳細

### 1. Database Migration
```sql
-- fastapi_server/alembic/versions/add_consecutive_error_tracking.py
```

### 2. Model Enhancement
```python
# fastapi_server/db/models.py
class CellExecution(Base):
    consecutive_error_count = Column(Integer, default=0)
    is_significant_error = Column(Boolean, default=False)
```

### 3. CRUD Logic
```python
# fastapi_server/crud/crud_execution.py
def calculate_consecutive_errors(db: Session, student_id: int, cell_id: int) -> int:
    """効率的な連続エラー検出"""
    # 最新10件の実行履歴を取得（インデックス活用）
    recent_executions = db.query(CellExecution)\
        .filter(CellExecution.student_id == student_id,
                CellExecution.cell_id == cell_id)\
        .order_by(CellExecution.executed_at.desc())\
        .limit(10)\
        .all()
    
    # 最新から遡って連続エラーカウント
    consecutive_count = 0
    for execution in recent_executions:
        if execution.status == 'error':
            consecutive_count += 1
        else:
            break  # 成功があったら終了
    
    return consecutive_count
```

### 4. Event Processing
```python
# fastapi_server/worker/event_router.py
async def handle_cell_execution_with_error_tracking():
    # 連続エラー判定統合
```

---

## 📋 チェックリスト

### 実装前確認
- [ ] 現在のシステム稼働状況確認
- [ ] データベースバックアップ作成
- [ ] テスト環境準備

### 実装中確認
- [ ] マイグレーション正常実行
- [ ] 新機能ユニットテスト合格
- [ ] 既存機能回帰テスト合格

### 実装後確認
- [ ] パフォーマンス指標確認
- [ ] エラー検出動作確認
- [ ] ダッシュボード表示確認

---

**作成日**: 2025-08-18  
**作成者**: Claude Code Assistant  
**レビュー**: 実装前にシステム管理者による確認推奨  
**承認**: 本ドキュメント確認後、実装開始可能