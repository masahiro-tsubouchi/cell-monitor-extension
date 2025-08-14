# 初級開発者向けガイド

## 🎯 このガイドの対象者

- プログラミング経験は少しあるが、大規模システム開発は初めて
- Python、JavaScript/TypeScriptの基本は理解している
- Webアプリケーション開発に興味がある
- AI駆動開発を体験してみたい

## 📚 学習ステップ

### Level 1: システムを理解する（1週間目）

#### Day 1-2: 全体像を掴む
1. **[システム概要](../overview/SYSTEM_OVERVIEW.md)を読む**
   - 何を作っているシステムなのか？
   - どんな技術が使われているのか？
   - 誰がどのように使うのか？

2. **実際にシステムを動かしてみる**
   ```bash
   # まずは動かしてみる！
   docker-compose up --build

   # JupyterLabを開く
   # http://localhost:8888 (パスワード: easy)

   # FastAPIの管理画面を見る
   # http://localhost:8000/docs
   ```

3. **システムの流れを体験する**
   - JupyterLabでPythonコードを実行
   - FastAPIのログを見る（データが送信されているか確認）
   - データベースにデータが保存されているか確認

#### Day 3-4: 技術要素を学ぶ
各技術について、まずは「何のために使っているか」を理解：

**フロントエンド（見た目・操作部分）**:
- **JupyterLab**: 学生がコードを書いて実行する場所
- **TypeScript**: JupyterLab拡張機能の開発言語
- **React**: 講師用ダッシュボードの開発言語

**バックエンド（裏側の処理）**:
- **FastAPI**: フロントエンドからのデータを受け取るWebサーバー
- **Python**: サーバー側プログラムの開発言語
- **Redis**: データを一時的に蓄えるメモリデータベース

**データベース（データ保存）**:
- **PostgreSQL**: ユーザー情報、ノートブック情報を保存
- **InfluxDB**: 時系列データ（実行時間、エラー率など）を保存

#### Day 5-7: コードを読んでみる
まずは小さなファイルから：

1. **設定ファイルを見る** (`fastapi_server/core/config.py`)
   ```python
   # これは何を設定しているの？
   PROJECT_NAME: str = "Student Progress Tracker API"
   DATABASE_URL: str = "postgresql://..."
   ```

2. **データの形を見る** (`fastapi_server/schemas/event.py`)
   ```python
   # JupyterLabから送られてくるデータの形
   class EventData(BaseModel):
       eventId: str          # イベントID
       eventType: str        # イベントの種類
       userId: str           # ユーザーID
   ```

3. **簡単なAPI を見る** (`fastapi_server/api/endpoints/events.py`)
   ```python
   # データを受信するAPI
   @router.post("/events")
   async def receive_events(events: List[EventData]):
       # 受信したデータをどう処理しているか？
   ```

### Level 2: 実際に手を動かす（2週間目）

#### 準備: 開発環境を整える
1. **[開発環境セットアップ](ENVIRONMENT_SETUP.md)を実行**
2. **エディタの設定** (VS Code推奨)
3. **Git の基本操作を覚える**

#### 実践 1: 簡単な修正をしてみる
**課題**: APIのレスポンスメッセージを変更してみよう

```python
# fastapi_server/main.py の最後の部分
@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.PROJECT_NAME}"}

# ↓ これを自分の好きなメッセージに変える
@app.get("/")
async def root():
    return {"message": "こんにちは！Cell Monitorシステムです！"}
```

**動作確認**:
```bash
# サーバーを再起動
docker-compose restart fastapi

# ブラウザで確認
# http://localhost:8000
# メッセージが変わっているか確認
```

#### 実践 2: 新しいAPIエンドポイントを作る
**課題**: システムの状態を確認するAPIを作ろう

```python
# fastapi_server/api/endpoints/system.py (新しいファイル)
from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
async def health_check():
    """システムの健康状態をチェックする"""
    return {
        "status": "healthy",
        "message": "システムは正常に動作しています",
        "version": "1.0.0"
    }

@router.get("/stats")
async def get_stats():
    """システムの統計情報を返す"""
    return {
        "total_students": 0,    # 後で実装
        "total_events": 0,      # 後で実装
        "system_uptime": "1 hour"  # 後で実装
    }
```

**APIルーターに登録**:
```python
# fastapi_server/api/api.py に追加
from api.endpoints import system

api_router.include_router(system.router, prefix="/system", tags=["system"])
```

**動作確認**:
```bash
# http://localhost:8000/docs で新しいAPIが追加されているか確認
# 実際にAPIを呼び出してみる
curl http://localhost:8000/api/v1/system/health
```

#### 実践 3: データベースからデータを取得する
**課題**: 学生数を実際にデータベースから取得してみよう

```python
# fastapi_server/api/endpoints/system.py を修正
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.session import get_db
from db.models import Student

@router.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    """システムの統計情報を返す"""

    # データベースから学生数を取得
    student_count = db.query(Student).count()

    return {
        "total_students": student_count,
        "total_events": 0,
        "system_uptime": "1 hour"
    }
```

### Level 3: より高度な機能を作る（3-4週間目）

#### チャレンジ 1: フロントエンドを触ってみる
JupyterLab拡張機能の簡単な修正：

```typescript
// cell-monitor-extension/src/index.ts
// 拡張機能が読み込まれた時のメッセージを変更

console.log('Cell Monitor Extension が読み込まれました！');
```

#### チャレンジ 2: テストコードを書いてみる
APIのテストを作成：

```python
# fastapi_server/tests/api/test_system.py (新しいファイル)
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_check():
    """ヘルスチェックAPIのテスト"""
    response = client.get("/api/v1/system/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"

def test_stats():
    """統計情報APIのテスト"""
    response = client.get("/api/v1/system/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_students" in data
```

**テスト実行**:
```bash
cd fastapi_server
pytest tests/api/test_system.py -v
```

## 🤖 AI駆動開発の始め方

### 初心者向けAI活用法

#### 1. コード理解を助けてもらう
**良い質問例**:
```
以下のPythonコードを初心者向けに説明してください：

@router.post("/events", status_code=202)
async def receive_events(events: List[EventData]):
    if not events:
        raise HTTPException(status_code=400, detail="No events")
    return {"message": f"{len(events)} events received"}

特に以下を説明してください：
- @router.post() は何をしているの？
- async def とは？
- HTTPExceptionとは？
```

#### 2. 簡単な機能追加を依頼する
**良い依頼例**:
```
初級開発者です。以下の簡単な機能を実装したいです：

目的: 現在時刻を返すAPIエンドポイントを追加したい
URL: GET /api/v1/system/time
レスポンス: {"current_time": "2024-01-15T10:30:00Z"}

参考にするファイル:
- fastapi_server/api/endpoints/system.py (既存のsystemエンドポイント)
- fastapi_server/api/api.py (ルーター登録方法)

初心者にも分かるよう、コメントを多めに入れてください。
```

#### 3. エラーの解決を依頼する
**良い質問例**:
```
初心者です。以下のエラーが出て困っています：

エラーメッセージ:
ImportError: cannot import name 'system' from 'api.endpoints'

実行したコマンド:
docker-compose up --build

何をした後に起きた:
- 新しいファイル api/endpoints/system.py を作成
- api/api.py を修正してルーターを追加

初心者向けに解決方法を教えてください。
```

### 段階的学習アプローチ

#### Week 1: 基本理解
- 既存のコードを読む
- 小さな修正（メッセージ変更など）
- システム全体の動作理解

#### Week 2: 単純な追加
- 新しいAPIエンドポイント追加
- 簡単なデータベース操作
- テストコードの作成

#### Week 3: 機能統合
- フロントエンドとバックエンドの連携
- より複雑なデータ操作
- エラーハンドリングの実装

#### Week 4: 品質向上
- コードの最適化
- セキュリティの考慮
- ドキュメンテーション

## 💡 つまずきやすいポイントと解決法

### 1. 環境構築でつまずいた場合

**症状**: Docker が動かない
```bash
# Dockerの状態確認
docker --version
docker-compose --version

# Dockerサービスの起動（Linuxの場合）
sudo systemctl start docker

# ディスク容量の確認
df -h
```

**症状**: ポートが使用中エラー
```bash
# 使用中のポートを確認
lsof -i :8000  # FastAPIのポート
lsof -i :8888  # JupyterLabのポート

# 既存のプロセスを終了
docker-compose down
```

### 2. コード修正でつまずいた場合

**症状**: 文法エラー
- Pythonのインデント（字下げ）を確認
- 括弧の対応を確認
- コロン（:）の付け忘れを確認

**症状**: インポートエラー
```python
# ファイルパスの確認
# api/endpoints/system.py というファイルを作った場合
from api.endpoints import system  # 正しい
from api.endpoints.system import router  # これも正しい
```

### 3. データベースでつまずいた場合

**症状**: テーブルが見つからない
```bash
# データベースの初期化
docker-compose down
docker volume prune  # 注意: データが削除されます
docker-compose up --build
```

**症状**: データが表示されない
```bash
# PostgreSQLに直接接続してデータ確認
docker-compose exec postgres psql -U admin -d progress_db
\dt  # テーブル一覧
SELECT * FROM students LIMIT 5;  # データ確認
```

## 🎓 次のステップ

### 初級から中級への移行
1. **フレームワークの深い理解**
   - FastAPIの高度な機能（依存性注入、ミドルウェア）
   - SQLAlchemyの高度なクエリ操作
   - 非同期プログラミングの理解

2. **システム設計の理解**
   - マイクロサービスアーキテクチャ
   - API設計ベストプラクティス
   - データベース設計原則

3. **運用・保守の知識**
   - ログ管理
   - 監視・アラート
   - パフォーマンス最適化

### おすすめ学習リソース

#### プロジェクト内ドキュメント
- **[AI駆動開発ガイド](AI_DRIVEN_DEVELOPMENT_GUIDE.md)**: AI との効果的な協働方法
- **[実装計画](../implementation-plans/)**: より高度な機能の実装手順
- **[テスト戦略](TESTING_GUIDE.md)**: 品質保証の方法

#### 外部学習リソース
- **Python**: [Real Python](https://realpython.com/)
- **FastAPI**: [公式チュートリアル](https://fastapi.tiangolo.com/tutorial/)
- **JavaScript/TypeScript**: [MDN Web Docs](https://developer.mozilla.org/)
- **SQL**: [SQL Tutorial](https://www.w3schools.com/sql/)

## 🚀 プロジェクトへの貢献

### 小さな貢献から始める
1. **ドキュメント改善**: 分からない部分があった場合の説明追加
2. **翻訳・多言語化**: コメントやメッセージの日本語化
3. **テストケース追加**: エッジケースのテスト追加
4. **バグ報告**: 見つけた問題の詳細な報告

### 貢献の手順
```bash
# 1. 新しいブランチを作成
git checkout -b feature/improve-docs

# 2. 修正・追加を実行
# （ファイルを編集）

# 3. 変更をコミット
git add .
git commit -m "初級開発者ガイドに例を追加"

# 4. プッシュしてプルリクエスト作成
git push origin feature/improve-docs
```

---

**初級開発者の皆さん、一歩ずつ確実に進んでいけば必ず成長できます。分からないことがあれば積極的に質問し、小さな成功を積み重ねていきましょう！**
