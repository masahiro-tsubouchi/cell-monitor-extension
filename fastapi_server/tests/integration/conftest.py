"""
E2Eテスト用の設定とフィクスチャ
"""

import pytest
import time
import asyncio
import requests

# テスト用の設定
JUPYTER_URL = "http://localhost:8888"
FASTAPI_URL = "http://localhost:8000"
HEALTH_CHECK_TIMEOUT = 60  # 秒


def wait_for_service(url: str, timeout: int = HEALTH_CHECK_TIMEOUT) -> bool:
    """サービスが起動するまで待機"""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                return True
        except Exception:  # nosec B110
            pass
        time.sleep(2)
    return False


@pytest.fixture(scope="session")
def ensure_services_running():
    """
    テスト実行前にJupyterLabとFastAPIが起動していることを確認
    """
    print("Checking if services are running...")

    # FastAPIの健康チェック
    if not wait_for_service(FASTAPI_URL):
        pytest.skip(f"FastAPI server not available at {FASTAPI_URL}")

    # JupyterLabの健康チェック
    if not wait_for_service(f"{JUPYTER_URL}/api/status"):
        pytest.skip(f"JupyterLab server not available at {JUPYTER_URL}")

    print("✅ All services are running")
    yield
    print("E2E tests completed")


@pytest.fixture(scope="session")
def event_loop():
    """
    セッションスコープでイベントループを提供
    """
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()
