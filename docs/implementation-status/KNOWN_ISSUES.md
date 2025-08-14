# 既知の問題一覧

## 🚨 修正優先度: 即座（Critical）

### 1. データベーススキーマ不整合エラー
**影響コンポーネント**: `fastapi_server/db/models.py`, `fastapi_server/crud/crud_execution.py`

**問題内容**:
```python
# models.py:117 - session_idがNOT NULL制約
session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)

# crud_execution.py:21 - 実装でNoneを設定
# session_id=session_db_id, # 将来的にセッションIDを関連付ける
```

**エラー例**:
```
IntegrityError: NOT NULL constraint failed: cell_executions.session_id
```

**修正方法**:
```sql
-- データベースマイグレーション
ALTER TABLE cell_executions ALTER COLUMN session_id DROP NOT NULL;
```

**影響度**: システム全体のセル実行機能が停止

---

### 2. 外部キー制約問題（講師ステータス管理）
**影響コンポーネント**: `fastapi_server/worker/event_router.py:295`

**問題内容**:
```python
# 講師ステータス更新時にNullを設定
status_update = InstructorStatusUpdate(
    status=InstructorStatus.IN_SESSION,
    current_session_id=None  # ← 外部キー制約違反の可能性
)
```

**エラー例**:
```
ForeignKeyViolationError: session_id does not exist
```

**修正方法**:
1. セッション管理機能の完全実装
2. または外部キー制約をnullable=Trueに変更

**影響度**: 講師ステータス管理機能の完全停止

---

### 3. InfluxDB設定値の不整合
**影響コンポーネント**: `fastapi_server/db/influxdb_client.py:32`

**問題内容**:
```python
# 実際の接続先
influx_client = InfluxDBClient(url=settings.DYNAMIC_INFLUXDB_URL, ...)

# ログ出力（異なる設定値）
logger.info(f"InfluxDBクライアントを初期化: {settings.INFLUXDB_URL}")
```

**影響度**: デバッグ時の混乱、接続問題の診断困難

**修正方法**:
```python
logger.info(f"InfluxDBクライアントを初期化: {settings.DYNAMIC_INFLUXDB_URL}")
```

---

## ⚠️ 修正優先度: 高（High）

### 4. セキュリティ脆弱性（CORS設定）
**影響コンポーネント**: `fastapi_server/core/config.py:12`

**問題内容**:
```python
BACKEND_CORS_ORIGINS: List[str] = ["*"]  # すべてのオリジンを許可
```

**セキュリティリスク**: クロスオリジン攻撃、CSRF攻撃

**修正方法**:
```python
# 環境別設定
class Settings(BaseSettings):
    @computed_field
    @property
    def BACKEND_CORS_ORIGINS(self) -> List[str]:
        if self.ENVIRONMENT == "development":
            return ["http://localhost:3000", "http://localhost:8888"]
        return ["https://your-production-domain.com"]
```

---

### 5. WebSocket双方向通信未実装
**影響コンポーネント**: `fastapi_server/api/endpoints/instructor_websocket.py:163`

**問題内容**:
```python
# TODO: 実際の学生WebSocket接続に返信を送信する実装
```

**影響度**: 講師-学生間のリアルタイム通信制限

**実装が必要な機能**:
- 学生からの質問受信
- 講師からの回答送信
- グループ通信機能

---

### 6. 環境情報API設計問題
**影響コンポーネント**: `fastapi_server/api/endpoints/environment.py:226-228`

**問題内容**:
```python
if (environment_collector._last_snapshot
    and environment_collector._last_snapshot.snapshot_id != current_snapshot.snapshot_id):
```

**設計違反**: プライベート変数への直接アクセス

**修正方法**:
```python
# 適切なパブリックメソッドを使用
if environment_collector.has_previous_snapshot():
    diff = environment_collector.get_environment_diff()
```

---

### 7. オフライン同期API時刻問題
**影響コンポーネント**: `fastapi_server/api/endpoints/offline_sync.py:161`

**問題内容**:
```python
"timestamp": "2025-01-19T12:00:00Z",  # 実際の実装では現在時刻を使用
```

**修正方法**:
```python
from datetime import datetime, timezone
"timestamp": datetime.now(timezone.utc).isoformat(),
```

---

## 🔶 修正優先度: 中（Medium）

### 8. コード品質問題
**影響コンポーネント**: 複数ファイル

#### 8.1 型注釈の互換性問題
```python
# fastapi_server/crud/crud_notebook.py:8
def get_notebook_by_path(db: Session, path: str) -> models.Notebook | None:
# Python 3.9以前で動作しない
```

**修正**:
```python
from typing import Union
def get_notebook_by_path(db: Session, path: str) -> Union[models.Notebook, None]:
```

#### 8.2 デッドコード除去
```python
# crud_notebook.py:66-71 - 重複処理
if isinstance(db_cell.content, str):
    db_cell.content = event.code
else:
    db_cell.content = event.code  # ← 同じ処理の重複
```

---

### 9. パフォーマンス問題
**影響コンポーネント**: `fastapi_server/api/endpoints/events.py:69-71`

**問題内容**:
```python
# 本番環境での不要な処理
print(f"--- Batch Processing Stats ---\n{json.dumps(batch_stats, indent=2)}")
```

**修正方法**:
```python
logger.debug("Batch processing completed: %d events", len(events))
```

---

### 10. テスト環境の不安定性
**影響コンポーネント**: `fastapi_server/tests/integration/`

**問題内容**:
- 外部サービス依存による不安定なテスト
- テスト間のデータ汚染
- 不完全なクリーンアップ処理

**対策**:
1. モックサービスの利用
2. テスト専用データベースの分離
3. setUp/tearDownの改善

---

## 🔍 修正優先度: 低（Low）

### 11. ドキュメント・コメント改善
- 日本語・英語コメントの混在
- APIドキュメント文字列の不整合
- 設定値の説明不足

### 12. ログ設定の改善
- 構造化ログの導入
- ログレベルの最適化
- ログローテーション設定

---

## 🛠️ 修正手順

### Phase 1: 緊急修正（1週間以内）
1. **データベーススキーマ修正**
   ```bash
   # マイグレーション作成
   alembic revision --autogenerate -m "Fix session_id constraints"
   alembic upgrade head
   ```

2. **設定値統一**
   ```python
   # config.py の修正
   # influxdb_client.py のログ修正
   ```

3. **CORS設定修正**
   ```python
   # 環境別CORS設定の実装
   ```

### Phase 2: 機能修正（2-3週間）
1. **WebSocket双方向通信実装**
2. **環境情報API設計改善**
3. **エラーハンドリング統一**

### Phase 3: 品質改善（1-2ヶ月）
1. **コードリファクタリング**
2. **テスト環境改善**
3. **パフォーマンス最適化**

---

## 📊 修正進捗追跡

### 修正済み
- [ ] （まだありません）

### 修正中
- [ ] （現在作業中のものはありません）

### 修正予定
- [x] データベーススキーマ不整合 - 優先度: Critical
- [x] InfluxDB設定値不整合 - 優先度: Critical
- [x] CORS設定脆弱性 - 優先度: High
- [x] WebSocket双方向通信 - 優先度: High

---

## 💡 修正完了時の検証方法

### 自動テスト
```bash
# 全テスト実行
pytest fastapi_server/tests/ -v --cov=fastapi_server

# 統合テスト
pytest fastapi_server/tests/integration/ -v

# セキュリティテスト
pytest fastapi_server/tests/security/ -v
```

### 手動検証
1. **データベース整合性**
   - 全テーブルのデータ投入テスト
   - 外部キー制約の動作確認

2. **API動作確認**
   - 全エンドポイントの動作テスト
   - エラーケースの確認

3. **WebSocket通信**
   - 講師-学生間通信テスト
   - 接続の安定性確認

---

**このドキュメントは問題の発見・修正に応じて継続的に更新されます。**
