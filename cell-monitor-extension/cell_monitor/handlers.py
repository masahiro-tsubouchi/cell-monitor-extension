"""
Handlers for the JupyterLab Cell Monitor extension.
"""

import json
import tornado
import os
from urllib.parse import urljoin
from notebook.base.handlers import APIHandler
from tornado.httpclient import AsyncHTTPClient, HTTPRequest
from jupyter_server.utils import url_path_join
import tornado.web

class CellMonitorProxyHandler(APIHandler):
    """
    プロキシハンドラーは、JupyterLabからのデータを受け取り、FastAPIサーバーに転送します。
    これにより、ブラウザのContent Security Policy (CSP)制限を回避します。
    """

    # CSRFチェックを無効化（本番環境では注意が必要）
    def check_xsrf_cookie(self):
        pass

    # FastAPIサーバーのURLを設定（環境変数またはデフォルト値）
    FASTAPI_SERVER_URL = os.environ.get('FASTAPI_URL', 'http://fastapi:8000')

    @tornado.web.authenticated
    async def post(self):
        # クライアントからのデータを取得
        try:
            body = self.request.body.decode('utf-8')
            data = json.loads(body)
            self.log.info(f"Received cell execution data via proxy: {len(data)} items")

            test_id = None
            # テストモードが有効な場合のみ、テストIDの検出とルーティングを行う
            is_test_mode = os.environ.get('CELL_MONITOR_TEST_MODE', 'false').lower() == 'true'

            if is_test_mode and isinstance(data, list) and len(data) > 0:
                first_event = data[0]
                if isinstance(first_event, dict):
                    code = first_event.get('code', '')
                    if 'e2e_test_' in code:
                        import re
                        match = re.search(r'e2e_test_[a-f0-9]+_\d+', code)
                        if match:
                            test_id = match.group(0)
                            self.log.info(f"Detected test ID for routing: {test_id}")

            # 適切なエンドポイントを選択
            if test_id:
                # テスト用エンドポイントに送信
                target_url = urljoin(self.FASTAPI_SERVER_URL, f'/api/v1/test/events/{test_id}')
                self.log.info(f"Routing to test endpoint: {target_url}")
            else:
                # 通常のエンドポイントに送信
                target_url = urljoin(self.FASTAPI_SERVER_URL, '/api/v1/events')
                self.log.info(f"Routing to normal endpoint: {target_url}")

            # リクエストオブジェクトを作成
            request = HTTPRequest(
                url=target_url,
                method='POST',
                headers={'Content-Type': 'application/json'},
                body=body
            )

            # 非同期HTTPクライアントでリクエストを実行
            http_client = AsyncHTTPClient()
            response = await http_client.fetch(request, raise_error=False)

            # FastAPIからのレスポンスをクライアントに転送
            if response.code >= 400:
                self.log.error(f"Error from FastAPI server: {response.code} - {response.body}")
                self.set_status(response.code)
                self.write({"error": "Failed to process cell data"})
            else:
                if test_id:
                    self.log.info(f"Successfully proxied test data to FastAPI server (test_id: {test_id})")
                else:
                    self.log.info("Successfully proxied data to FastAPI server")
                self.write({"status": "success", "message": "Data sent to FastAPI server"})

        except Exception as e:
            self.log.error(f"Error in proxy handler: {str(e)}")
            self.set_status(500)
            self.write({"error": str(e)})

    @tornado.web.authenticated
    async def get(self):
        # ヘルスチェック用エンドポイント
        self.write({"status": "ok", "message": "Cell monitor proxy is running"})


def setup_handlers(web_app):
    """Set up the web app handlers."""

    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]

    # プロキシハンドラーのルートを設定
    # このエンドポイントは JupyterLab から直接アクセス可能
    cell_monitor_path = url_path_join(base_url, "cell-monitor")
    handlers = [
        (cell_monitor_path, CellMonitorProxyHandler)
    ]

    web_app.add_handlers(host_pattern, handlers)
    print(f"Cell Monitor: Proxy handler registered at {cell_monitor_path}")
