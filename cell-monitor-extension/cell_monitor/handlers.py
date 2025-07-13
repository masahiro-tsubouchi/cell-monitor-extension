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
            
            # FastAPIサーバーへのリクエストを準備
            target_url = urljoin(self.FASTAPI_SERVER_URL, '/cell-monitor')
            
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
