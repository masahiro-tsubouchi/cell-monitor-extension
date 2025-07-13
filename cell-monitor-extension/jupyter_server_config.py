# Configuration file for jupyter_server

import os

c = get_config()  # noqa

# Configure Content Security Policy to allow connection to FastAPI server
# This will allow our extension to make requests to the FastAPI server
c.ServerApp.tornado_settings = {
    'headers': {
        'Content-Security-Policy': "frame-ancestors 'self'; "
                                  "default-src 'self'; "
                                  "script-src 'self' 'unsafe-eval' 'unsafe-inline'; "
                                  "style-src 'self' 'unsafe-inline'; "
                                  "connect-src 'self' http://fastapi:8000 https://fastapi:8000 "
                                  "http://localhost:8000 https://localhost:8000 "
                                  "http://127.0.0.1:8000 https://127.0.0.1:8000 "
                                  "ws://localhost:* ws://127.0.0.1:*;"
    }
}

print("CSP configuration loaded with FastAPI server access allowed")
