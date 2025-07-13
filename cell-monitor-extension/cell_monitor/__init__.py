"""
JupyterLab extension for cell execution monitoring
"""

def _jupyter_labextension_paths():
    return [{
        "src": "labextension",
        "dest": "cell-monitor"
    }]

def _jupyter_server_extension_points():
    return [{
        "module": "cell_monitor"
    }]

def _load_jupyter_server_extension(server_app):
    """Register the API handler to receive HTTP requests from frontend extension."""
    from .handlers import setup_handlers
    setup_handlers(server_app.web_app)
    server_app.log.info("Registered cell_monitor server extension")

# For backward compatibility with notebook server
load_jupyter_server_extension = _load_jupyter_server_extension

from ._version import __version__


def _jupyter_server_extension_points():
    return [{
        "module": "cell_monitor"
    }]


def _load_jupyter_server_extension(server_app):
    """Register the API handler to receive HTTP requests from the frontend extension."""
    from .handlers import setup_handlers
    setup_handlers(server_app.web_app)
    server_app.log.info("Registered HelloWorld extension at URL path /cell-monitor")
