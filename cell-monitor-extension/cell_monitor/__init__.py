"""
JupyterLab extension for cell execution monitoring
"""
from ._version import __version__
from .handlers import setup_handlers

def _jupyter_labextension_paths():
    return [{
        "src": "labextension",
        "dest": "cell-monitor"
    }]

def _load_jupyter_server_extension(server_app):
    """Register the API handler to receive HTTP requests from frontend extension."""
    setup_handlers(server_app.web_app)
    server_app.log.info("Registered cell_monitor server extension")

# For backward compatibility with notebook server
load_jupyter_server_extension = _load_jupyter_server_extension
