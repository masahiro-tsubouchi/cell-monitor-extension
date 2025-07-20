import os

# --- Environment Settings ---
JUPYTER_URL = os.environ.get("JUPYTER_URL", "http://localhost:8888")
JUPYTER_TOKEN = os.environ.get("JUPYTER_TOKEN", "easy")
FASTAPI_URL = os.environ.get("FASTAPI_URL", "http://localhost:8000")

# --- Test Behavior Settings ---
TEST_TIMEOUT = int(os.environ.get("TEST_TIMEOUT", 60))  # General timeout for tests
API_POLL_INTERVAL = 1  # Seconds to wait between polling FastAPI for events

# --- Playwright Settings ---
HEADLESS_MODE = os.environ.get("HEADLESS_MODE", "true").lower() == "true"
BROWSER_LAUNCH_TIMEOUT = 30000  # ms
PAGE_NAVIGATION_TIMEOUT = 60000  # ms

# --- JupyterLab UI Selectors ---
# Used to wait for JupyterLab to finish loading
JUPYTER_LAB_LOAD_SELECTORS = [
    "#jp-main-dock-panel",
    "#jp-menu-panel",
    ".jp-JupyterIcon",
]

# Used to create a new notebook from the launcher
LAUNCHER_NOTEBOOK_SELECTORS = [
    'div[data-category="Notebook"] .jp-LauncherCard',
    '.jp-LauncherCard[data-category="Notebook"]',
    'div[title*="Python"] .jp-LauncherCard',
    ".jp-Launcher-content .jp-LauncherCard:first-child",
]

# Used to find a cell in a notebook
CELL_SELECTOR = ".jp-Cell"

# Used to find the input area of a cell
CELL_EDITOR_SELECTORS = [
    ".jp-Cell-inputArea .CodeMirror",
    ".jp-InputArea-editor",
    ".jp-Cell textarea",
]
