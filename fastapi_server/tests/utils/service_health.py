"""
テスト用のサービスヘルスチェックユーティリティ

このモジュールは、テスト実行前に必要なサービス（PostgreSQL、Redis、InfluxDB）が
正常に動作していることを確認するための関数を提供します。
"""

import asyncio
import logging

import redis
import psycopg2
from sqlalchemy import create_engine, text
from influxdb_client import InfluxDBClient

from core.config import settings

logger = logging.getLogger(__name__)

# 接続リトライの設定
MAX_RETRIES = 5
RETRY_DELAY = 2  # seconds


async def wait_for_postgres(
    max_retries: int = MAX_RETRIES, delay: int = RETRY_DELAY
) -> bool:
    """
    PostgreSQLサービスが利用可能になるまで待機します。

    Args:
        max_retries: 最大リトライ回数
        delay: リトライ間の待機時間（秒）

    Returns:
        bool: 接続成功ならTrue、失敗ならFalse
    """
    logger.info(
        f"PostgreSQL接続確認中... ({settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT})"
    )

    for attempt in range(1, max_retries + 1):
        try:
            # 直接psycopg2で接続テスト
            conn = psycopg2.connect(
                host=settings.POSTGRES_SERVER,
                port=settings.POSTGRES_PORT,
                dbname=settings.POSTGRES_DB,
                user=settings.POSTGRES_USER,
                password=settings.POSTGRES_PASSWORD,
            )
            conn.close()

            # SQLAlchemyでもテスト
            engine = create_engine(settings.DATABASE_URL)
            with engine.connect() as connection:
                result = connection.execute(text("SELECT 1"))
                assert result.scalar() == 1

            logger.info("PostgreSQL接続成功!")
            return True

        except Exception as e:
            if attempt < max_retries:
                logger.warning(
                    f"PostgreSQL接続試行 {attempt}/{max_retries} 失敗: {str(e)}"
                )
                await asyncio.sleep(delay)
            else:
                logger.error(f"PostgreSQL接続失敗: {str(e)}")
                return False

    return False


async def wait_for_redis(
    max_retries: int = MAX_RETRIES, delay: int = RETRY_DELAY
) -> bool:
    """
    Redisサービスが利用可能になるまで待機します。

    Args:
        max_retries: 最大リトライ回数
        delay: リトライ間の待機時間（秒）

    Returns:
        bool: 接続成功ならTrue、失敗ならFalse
    """
    logger.info(f"Redis接続確認中... ({settings.REDIS_HOST}:{settings.REDIS_PORT})")

    for attempt in range(1, max_retries + 1):
        try:
            # Redis接続テスト
            r = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=0,
                socket_connect_timeout=5,
            )
            response = r.ping()
            assert response is True

            logger.info("Redis接続成功!")
            return True

        except Exception as e:
            if attempt < max_retries:
                logger.warning(f"Redis接続試行 {attempt}/{max_retries} 失敗: {str(e)}")
                await asyncio.sleep(delay)
            else:
                logger.error(f"Redis接続失敗: {str(e)}")
                return False

    return False


async def wait_for_influxdb(
    max_retries: int = MAX_RETRIES, delay: int = RETRY_DELAY
) -> bool:
    """
    InfluxDBサービスが利用可能になるまで待機します。

    Args:
        max_retries: 最大リトライ回数
        delay: リトライ間の待機時間（秒）

    Returns:
        bool: 接続成功ならTrue、失敗ならFalse
    """
    logger.info(f"InfluxDB接続確認中... ({settings.DYNAMIC_INFLUXDB_URL})")

    for attempt in range(1, max_retries + 1):
        try:
            # InfluxDB接続テスト
            client = InfluxDBClient(
                url=settings.DYNAMIC_INFLUXDB_URL,
                token=settings.INFLUXDB_TOKEN,
                org=settings.INFLUXDB_ORG,
            )
            health = client.health()
            assert health.status == "pass"

            logger.info("InfluxDB接続成功!")
            client.close()
            return True

        except Exception as e:
            if attempt < max_retries:
                logger.warning(
                    f"InfluxDB接続試行 {attempt}/{max_retries} 失敗: {str(e)}"
                )
                await asyncio.sleep(delay)
            else:
                logger.error(f"InfluxDB接続失敗: {str(e)}")
                return False

    return False


async def ensure_all_services_healthy() -> bool:
    """
    すべての必要なサービスが利用可能になるまで待機します。

    Returns:
        bool: すべてのサービスが利用可能ならTrue、いずれかが失敗ならFalse
    """
    logger.info("サービスヘルスチェック開始...")

    # 並列でヘルスチェックを実行
    results = await asyncio.gather(
        wait_for_postgres(),
        wait_for_redis(),
        wait_for_influxdb(),
        return_exceptions=True,
    )

    # 例外があったか、Falseの結果があるかチェック
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error(f"サービス {i} チェック中にエラー発生: {str(result)}")
            return False
        if not result:
            return False

    logger.info("すべてのサービスが正常に稼働中!")
    return True
