#!/usr/bin/env python3
"""
Refactored E2E Test Runner

Orchestrates the E2E test flow using separated modules for configuration,
UI interaction, and API communication.
"""

import asyncio
import uuid
import time
import sys
from playwright.async_api import async_playwright

from . import e2e_config
from .jupyter_ui import JupyterLabPage
from .api_client import FastAPIClient


class TestRunner:
    """Manages the setup, execution, and teardown of the E2E test."""

    def __init__(self):
        self.playwright = None
        self.browser = None
        self.page = None
        self.test_id = f"e2e_test_{uuid.uuid4().hex[:8]}_{int(time.time())}"
        self.api_client = FastAPIClient(self.test_id)

    async def setup(self):
        """Initializes the browser and navigates to JupyterLab."""
        print(f"\n🔧 Setting up test environment (Test ID: {self.test_id})")
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=e2e_config.HEADLESS_MODE, timeout=e2e_config.BROWSER_LAUNCH_TIMEOUT
        )
        self.page = await self.browser.new_page()
        await self.page.goto(
            f"{e2e_config.JUPYTER_URL}/lab?token={e2e_config.JUPYTER_TOKEN}",
            timeout=e2e_config.PAGE_NAVIGATION_TIMEOUT,
        )
        self.jupyter_page = JupyterLabPage(self.page)
        await self.jupyter_page.wait_for_lab_to_load()

    async def teardown(self):
        """Closes the browser and cleans up test data."""
        print("\n🧹 Cleaning up test environment")
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
        self.api_client.cleanup_test_data()

    async def run_test_scenario(self):
        """Executes the core test steps."""
        # 1. Create a new notebook
        await self.jupyter_page.create_new_notebook()

        # 2. Define and execute code in a cell
        test_code = f'# Test code for {self.test_id}\nprint("Hello from E2E test")'
        await self.jupyter_page.execute_cell(test_code)

        # 3. Wait for the event to be received by FastAPI
        events = await self.api_client.wait_for_events(
            expected_count=1, timeout=e2e_config.TEST_TIMEOUT
        )

        # 4. Validate the received event
        if not events:
            raise Exception("Test failed: No events received by FastAPI.")

        event = events[0]
        print("\n📊 Validating received event...")
        assert (
            event.get("eventType") == "cell_executed"
        ), "Event type is not 'cell_executed'"
        assert self.test_id in event.get("code", ""), "Test ID not found in event code"
        print("✅ Event validation successful.")


async def main():
    """Main function to run the E2E test."""
    runner = TestRunner()
    try:
        await runner.setup()
        await runner.run_test_scenario()
        print("\n🎉 E2E Test PASSED")
        return True
    except Exception as e:
        print(f"\n❌ E2E Test FAILED: {e}")
        import traceback

        traceback.print_exc()
        return False
    finally:
        await runner.teardown()


if __name__ == "__main__":
    # To run this test, navigate to the `fastapi_server` directory and use:
    # python -m tests.e2e.test_main_flow
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
