"""
E2Eテスト: JupyterLab → Jupyter Server Proxy → FastAPI
セル実行からFastAPIへのデータ送信を自動検証する
"""

import pytest
import asyncio
import uuid
import time
import os
from typing import Dict, Any, List
from playwright.async_api import async_playwright, Page, Browser
import requests


# テスト設定
# JUPYTER_URLを環境変数から取得。Docker内からのテスト実行に対応するため。
JUPYTER_URL = os.getenv("JUPYTER_URL", "http://jupyterlab:8888")
JUPYTER_TOKEN = "easy"  # nosec B105
FASTAPI_URL = os.getenv("FASTAPI_URL", "http://fastapi:8000")
TEST_TIMEOUT = 30  # 秒


class JupyterLabE2ETest:
    """JupyterLabのE2Eテストクラス"""

    def __init__(self):
        self.browser: Browser = None
        self.page: Page = None
        self.test_id: str = None

    async def setup(self):
        """テスト環境のセットアップ"""
        self.test_id = f"e2e_test_{uuid.uuid4().hex[:8]}_{int(time.time())}"

        # Playwrightブラウザの起動
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=True)
        self.page = await self.browser.new_page()

        # JupyterLabにアクセス
        await self.page.goto(f"{JUPYTER_URL}/lab?token={JUPYTER_TOKEN}")

        # JupyterLabの読み込み完了を待機
        await self.page.wait_for_selector("[data-jp-main-dock-panel]", timeout=60000)

    async def teardown(self):
        """テスト環境のクリーンアップ"""
        if self.browser:
            await self.browser.close()

        # テスト用イベントデータのクリーンアップ
        if self.test_id:
            try:
                requests.delete(
                    f"{FASTAPI_URL}/api/v1/test/events/{self.test_id}", timeout=10
                )
            except Exception:
                pass  # nosec B110 クリーンアップエラーは無視

    async def create_new_notebook(self) -> str:
        """新しいノートブックを作成し、ノートブック名を返す"""
        # ランチャーから新しいノートブックを作成
        try:
            # "Python 3" ノートブックボタンをクリック
            await self.page.click('div[data-category="Notebook"] >> text=Python 3')
            await self.page.wait_for_timeout(2000)  # ノートブック作成を待機

            # ノートブックのタイトルを取得
            notebook_title = await self.page.text_content(".jp-Notebook-title")
            return notebook_title or "Untitled.ipynb"

        except Exception:
            # フォールバック: ファイルメニューから作成
            await self.page.click("text=File")
            await self.page.click("text=New >> text=Notebook")
            await self.page.wait_for_timeout(2000)
            return "Untitled.ipynb"

    async def execute_cell_with_code(self, code: str):
        """指定されたコードでセルを実行"""
        # セルにコードを入力
        cell_editor = await self.page.wait_for_selector(
            ".jp-Cell-inputArea .CodeMirror"
        )
        await cell_editor.click()
        await self.page.keyboard.type(code)

        # セルを実行 (Shift+Enter)
        await self.page.keyboard.press("Shift+Enter")

        # セル実行完了を待機（実行カウンターの変化を待つ）
        await self.page.wait_for_timeout(3000)

    async def wait_for_events_in_fastapi(
        self, expected_count: int = 1, timeout: int = TEST_TIMEOUT
    ) -> List[Dict[str, Any]]:
        """FastAPIでイベントが受信されるまで待機"""
        start_time = time.time()

        while time.time() - start_time < timeout:
            try:
                response = requests.get(
                    f"{FASTAPI_URL}/api/v1/test/events/{self.test_id}", timeout=10
                )
                if response.status_code == 200:
                    data = response.json()
                    if data.get("count", 0) >= expected_count:
                        return data.get("events", [])
            except Exception:
                pass  # nosec B110 リクエストエラーは無視して再試行

            await asyncio.sleep(1)

        # タイムアウト時は空のリストを返す
        return []


@pytest.mark.asyncio
async def test_jupyter_cell_execution_to_fastapi():
    """
    JupyterLabでセルを実行し、FastAPIにイベントが送信されることを確認する
    """
    test_runner = JupyterLabE2ETest()

    try:
        # テスト環境のセットアップ
        await test_runner.setup()

        # 新しいノートブックを作成
        notebook_name = await test_runner.create_new_notebook()
        print(f"Created notebook: {notebook_name}")

        # テスト用のコードを実行
        test_code = f"""
# E2Eテスト用のコード - Test ID: {test_runner.test_id}
import time
print("Hello from E2E test!")
print(f"Test ID: {test_runner.test_id}")
print(f"Executed at: {{time.strftime('%Y-%m-%d %H:%M:%S')}}")
result = 2 + 2
print(f"Result: {{result}}")
"""

        # セルを実行
        await test_runner.execute_cell_with_code(test_code)
        print("Cell execution completed")

        # FastAPIでイベントが受信されるまで待機
        events = await test_runner.wait_for_events_in_fastapi(expected_count=1)

        # アサーション: イベントが受信されたことを確認
        assert (
            len(events) > 0
        ), f"No events received in FastAPI for test_id: {test_runner.test_id}"

        # イベントの内容を検証
        cell_execution_events = [
            event for event in events if event.get("eventType") == "cell_executed"
        ]

        print(
            f"Received {len(events)} total events, {len(cell_execution_events)} cell execution events"
        )

        # セル実行イベントが存在することを確認
        assert len(cell_execution_events) > 0, "No cell execution events found"

        # イベントの基本的な構造を検証
        event = cell_execution_events[0]
        assert event.get("eventType") == "cell_executed"
        assert event.get("notebookPath") is not None
        assert event.get("code") is not None
        assert test_runner.test_id in event.get("code", "")

        print("✅ E2E Test Passed: JupyterLab → FastAPI data flow verified")

    except Exception:
        print("❌ E2E Test Failed")
        if test_runner.page:
            artifacts_dir = os.path.join(os.path.dirname(__file__), "test-artifacts")
            os.makedirs(artifacts_dir, exist_ok=True)
            screenshot_path = os.path.join(
                artifacts_dir, f"failure_single_cell_{test_runner.test_id}.png"
            )
            try:
                await test_runner.page.screenshot(path=screenshot_path)
                print(f"📷 Screenshot saved to {screenshot_path}")
            except Exception as screenshot_error:
                print(f"Could not save screenshot: {screenshot_error}")
        raise

    finally:
        # クリーンアップ
        await test_runner.teardown()


@pytest.mark.asyncio
async def test_jupyter_multiple_cell_executions():
    """
    複数のセル実行でイベントが正しく送信されることを確認する
    """
    test_runner = JupyterLabE2ETest()

    try:
        await test_runner.setup()

        # 新しいノートブックを作成
        await test_runner.create_new_notebook()

        # 複数のセルを実行
        test_codes = [
            f"# Cell 1 - Test ID: {test_runner.test_id}\nprint('First cell')",
            f"# Cell 2 - Test ID: {test_runner.test_id}\nprint('Second cell')",
            f"# Cell 3 - Test ID: {test_runner.test_id}\nprint('Third cell')",
        ]

        for i, code in enumerate(test_codes):
            await test_runner.execute_cell_with_code(code)
            print(f"Executed cell {i + 1}")

            # セル間で少し待機
            await asyncio.sleep(1)

        # すべてのイベントが受信されるまで待機
        events = await test_runner.wait_for_events_in_fastapi(expected_count=3)

        # アサーション
        assert len(events) >= 3, f"Expected at least 3 events, got {len(events)}"

        # セル実行イベントの数を確認
        cell_execution_events = [
            event for event in events if event.get("eventType") == "cell_executed"
        ]

        assert (
            len(cell_execution_events) >= 3
        ), f"Expected at least 3 cell execution events, got {len(cell_execution_events)}"

        print("✅ Multiple Cell Execution Test Passed")

    except Exception:
        print("❌ Multiple Cell E2E Test Failed")
        if test_runner.page:
            artifacts_dir = os.path.join(os.path.dirname(__file__), "test-artifacts")
            os.makedirs(artifacts_dir, exist_ok=True)
            screenshot_path = os.path.join(
                artifacts_dir, f"failure_multi_cell_{test_runner.test_id}.png"
            )
            try:
                await test_runner.page.screenshot(path=screenshot_path)
                print(f"📷 Screenshot saved to {screenshot_path}")
            except Exception as screenshot_error:
                print(f"Could not save screenshot: {screenshot_error}")
        raise
    finally:
        await test_runner.teardown()


if __name__ == "__main__":
    # 単体でテストを実行する場合
    asyncio.run(test_jupyter_cell_execution_to_fastapi())
