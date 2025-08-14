# Configuration file for jupyter_server

import os

c = get_config()  # noqa

# 環境変数からCSPホストを構築
def build_csp_connect_src():
    # 環境変数からホスト設定を取得（デフォルト値付き）
    fastapi_hosts = os.environ.get('CSP_FASTAPI_HOSTS', 'fastapi:8000,localhost:8000,127.0.0.1:8000').split(',')

    # プロトコルリスト
    protocols = ['http', 'https']
    ws_protocols = ['ws', 'wss']

    # connect-srcのURLリストを構築
    csp_urls = ["'self'"]

    for host in fastapi_hosts:
        host = host.strip()
        # HTTP/HTTPSプロトコル
        for protocol in protocols:
            csp_urls.append(f"{protocol}://{host}")

        # WebSocketプロトコル（ポート番号をワイルドカードに）
        host_without_port = host.split(':')[0]
        for ws_protocol in ws_protocols:
            csp_urls.append(f"{ws_protocol}://{host_without_port}:*")

    return ' '.join(csp_urls)

# Configure Content Security Policy to allow connection to FastAPI server
# This will allow our extension to make requests to the FastAPI server
connect_src = build_csp_connect_src()

c.ServerApp.tornado_settings = {
    'headers': {
        'Content-Security-Policy': f"frame-ancestors 'self'; "
                                  f"default-src 'self'; "
                                  f"script-src 'self' 'unsafe-eval' 'unsafe-inline'; "
                                  f"style-src 'self' 'unsafe-inline'; "
                                  f"connect-src {connect_src};"
    }
}

print(f"CSP configuration loaded with FastAPI server access allowed: {connect_src}")
