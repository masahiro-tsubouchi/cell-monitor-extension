import asyncio
import logging
import os
import sys
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# プロジェクトのルートディレクトリをsys.pathに追加
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.config import settings  # noqa: E402
from db.base import Base  # noqa: E402
from db.session import get_db  # noqa: E402
from main import app  # noqa: E402


# 注意: pytest-asyncioの設定はpytest.iniに移動しました
# pytest-asyncioが自動的にevent_loopフィクスチャを提供するので、再定義しない
# 代わりにevent_loop_policyフィクスチャを使用
@pytest.fixture(scope="session")
def event_loop_policy():
    return asyncio.get_event_loop_policy()


# テスト用のDBエンジンを作成
# Docker環境のPostgreSQLを使用
# トランザクションでテストの独立性を担保する
engine = create_engine(settings.DATABASE_URL)

# テスト用のセッションを作成
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session")
def setup_db():
    """テスト用データベースのセットアップ"""
    # データベーススキーマ作成
    logging.info("テストDBスキーマを作成しています...")
    Base.metadata.create_all(bind=engine)

    yield

    # テスト全体の終了時にテーブルを削除してもよいが、今回はシンプルに作成のみ
    # Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="session", autouse=True)
async def setup_services(setup_db):
    """テスト全体の開始時に各サービスのヘルスチェックを実行"""
    from tests.utils.service_health import ensure_all_services_healthy

    # ロギング設定
    logging.basicConfig(level=logging.INFO)
    logging.info("サービスのヘルスチェックを開始します...")

    # asyncioマークを使って非同期テストを実行
    services_ready = await ensure_all_services_healthy()

    if not services_ready:
        pytest.skip(
            "必要なサービス(PostgreSQL/Redis/InfluxDB)が利用できません。Docker環境が正常に起動しているか確認してください。"
        )
    else:
        logging.info("全サービスが正常に動作しています")

    yield


@pytest.fixture(scope="function")
def db_session() -> Generator:
    """各テスト関数にDBセッションを提供し、テスト後にロールバックする"""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    try:
        yield session
    finally:
        # セッションを閉じる前に保留中の変更があればロールバック
        session.rollback()
        # 次にセッションを閉じる
        session.close()
        # トランザクションと接続を閉じる
        transaction.rollback()
        connection.close()


@pytest.fixture(scope="function")
def client(db_session) -> Generator:
    """APIテスト用のクライアントを提供し、DBセッションをオーバーライドする"""

    def override_get_db():
        try:
            yield db_session
        finally:
            pass  # db_sessionフィクスチャがクローズとロールバックを管理

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        yield c

    # テスト終了後にオーバーライドを元に戻す
    app.dependency_overrides.clear()
