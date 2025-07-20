from playwright.async_api import Page
from . import e2e_config


class JupyterLabPage:
    """Encapsulates Playwright actions for the JupyterLab UI."""

    def __init__(self, page: Page):
        self.page = page

    async def wait_for_lab_to_load(self):
        """Waits for the main JupyterLab interface to be ready."""
        print("⏳ Waiting for JupyterLab to load...")
        for i, selector in enumerate(e2e_config.JUPYTER_LAB_LOAD_SELECTORS):
            try:
                await self.page.wait_for_selector(selector, timeout=15000)
                print(f"✅ JupyterLab loaded successfully (found: {selector})")
                return
            except Exception as e:
                print(
                    f"... Still waiting (attempt {i + 1} with {selector} failed): {e}"
                )
        # Fallback if selectors fail
        await self.page.wait_for_timeout(5000)
        title = await self.page.title()
        if "JupyterLab" in title:
            print("✅ JupyterLab loaded successfully (title check)")
        else:
            raise Exception(f"JupyterLab did not load. Current title: {title}")

    async def create_new_notebook(self) -> str:
        """Creates a new notebook and returns its name."""
        print("📝 Creating new notebook...")
        # Try clicking the launcher button first
        for selector in e2e_config.LAUNCHER_NOTEBOOK_SELECTORS:
            try:
                await self.page.click(selector, timeout=5000)
                await self.page.wait_for_selector(
                    e2e_config.CELL_SELECTOR, timeout=10000
                )
                print(f"✅ Created notebook via launcher ({selector})")
                return "Untitled.ipynb"
            except Exception as e:
                print(f"... Launcher selector {selector} failed: {e}")

        # Fallback to keyboard shortcut if launcher fails
        try:
            await self.page.keyboard.press("Control+Shift+N")
            await self.page.wait_for_selector(e2e_config.CELL_SELECTOR, timeout=10000)
            print("✅ Created notebook via keyboard shortcut")
            return "Untitled.ipynb"
        except Exception as e:
            raise Exception(f"Could not create a new notebook: {e}")

    async def execute_cell(self, code: str):
        """Finds a cell, types code into it, and executes it."""
        print(f"⚡ Executing cell with code: '{code[:30]}...'")
        editor_selector = None
        for selector in e2e_config.CELL_EDITOR_SELECTORS:
            try:
                await self.page.wait_for_selector(selector, timeout=5000)
                editor_selector = selector
                break
            except Exception as e:
                print(f"... Cell editor selector {selector} failed: {e}")
                continue

        if not editor_selector:
            raise Exception("Could not find a cell editor on the page.")

        await self.page.click(editor_selector)
        await self.page.keyboard.press("Control+A")  # Select all existing text
        await self.page.keyboard.type(code)
        await self.page.keyboard.press("Shift+Enter")
        await self.page.wait_for_timeout(3000)  # Wait for execution to process
        print("✅ Cell execution command sent.")
