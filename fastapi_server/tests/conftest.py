import sys
import os

# Add the project root directory to the sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from typing import Generator

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app
from db.base import Base
from db.session import get_db
from core.config import settings

# テスト用のDBエンジンを作成
# 本番とは別のテスト用DBを使うのが理想だが、ここでは同じDBを使う
# トランザクションでテストの独立性を担保する
engine = create_engine(settings.DATABASE_URL)

# テスト用のセッションを作成
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    """テスト全体の開始時にテーブルを一度だけ作成する"""
    Base.metadata.create_all(bind=engine)
    yield
    # テスト全体の終了時にテーブルを削除してもよいが、今回はシンプルに作成のみ
    # Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session() -> Generator:
    """各テスト関数にDBセッションを提供し、テスト後にロールバックする"""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def client(db_session) -> Generator:
    """APIテスト用のクライアントを提供し、DBセッションをオーバーライドする"""

    def override_get_db():
        try:
            yield db_session
        finally:
            pass # db_sessionフィクスチャがクローズとロールバックを管理

    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as c:
        yield c
    
    # テスト終了後にオーバーライドを元に戻す
    app.dependency_overrides.clear()
