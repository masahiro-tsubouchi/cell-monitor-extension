# Server Components - Cell Monitor Extension

**最終更新**: 2025-08-24  
**対象バージョン**: v1.1.0

## 📋 概要

Cell Monitor Extension のサーバーサイドコンポーネントの詳細について説明します。

---

## 🐍 Python Server Extension

### CellMonitorProxyHandler

**ファイル**: `cell_monitor/handlers.py`

```python
from jupyter_server.base.handlers import APIHandler
from tornado.httpclient import AsyncHTTPClient
import tornado.web
import json

class CellMonitorProxyHandler(APIHandler):
    """
    JupyterLabからFastAPIサーバーへのプロキシハンドラー
    CORS問題を回避し、認証情報を適切に処理
    """

    @tornado.web.authenticated
    async def post(self):
        try:
            # リクエストボディの検証
            body = self.get_json_body()
            
            # 必須フィールドの検証
            if not self.validate_request_body(body):
                self.set_status(400)
                self.write({"error": "Invalid request body"})
                return

            # テストモード判定
            if self.is_test_mode(body):
                server_url = TEST_FASTAPI_URL
            else:
                server_url = FASTAPI_URL

            # FastAPIサーバーへ転送
            client = AsyncHTTPClient()
            response = await client.fetch(
                f"{server_url}/api/v1/events",
                method="POST",
                body=json.dumps(body),
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "JupyterLab-CellMonitor/1.1.0"
                },
                request_timeout=30.0,
                validate_cert=False  # 開発環境用
            )

            # レスポンス返却
            self.set_status(response.code)
            self.set_header("Content-Type", "application/json")
            self.write(response.body)

        except json.JSONDecodeError:
            self.log.error("Invalid JSON in request body")
            self.set_status(400)
            self.write({"error": "Invalid JSON format"})
            
        except Exception as e:
            self.log.error(f"Proxy error: {e}")
            self.set_status(500)
            self.write({"error": "Internal server error"})

    def validate_request_body(self, body: dict) -> bool:
        """リクエストボディの基本検証"""
        required_fields = ['eventId', 'eventType', 'eventTime']
        return all(field in body for field in required_fields)

    def is_test_mode(self, body: dict) -> bool:
        """テストモードの判定"""
        return body.get('userName') == 'TestUser'

    async def options(self):
        """CORS preflight request handling"""
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.set_header("Access-Control-Allow-Headers", "Content-Type")
        self.set_status(204)
```

### 拡張機能登録

```python
# cell_monitor/__init__.py
from .handlers import CellMonitorProxyHandler

def _jupyter_server_extension_points():
    """JupyterLab拡張機能エントリーポイント定義"""
    return [{"module": "cell_monitor"}]

def _load_jupyter_server_extension(server_app):
    """JupyterLabサーバーに拡張機能を登録"""
    
    # ハンドラーの定義
    handlers = [
        (r"/cell-monitor", CellMonitorProxyHandler),
        (r"/cell-monitor/health", HealthCheckHandler),
    ]

    # ハンドラーの登録
    server_app.web_app.add_handlers(".*$", handlers)
    
    # 拡張機能の設定
    server_app.log.info("Cell Monitor extension loaded successfully")
```

---

## 🔧 ヘルスチェックシステム

### HealthCheckHandler

```python
class HealthCheckHandler(APIHandler):
    """システムヘルスチェック用ハンドラー"""
    
    async def get(self):
        """ヘルスチェック情報を返却"""
        try:
            health_status = {
                "status": "healthy",
                "timestamp": datetime.utcnow().isoformat(),
                "version": "1.1.0",
                "services": {
                    "jupyter_server": await self.check_jupyter_server(),
                    "fastapi_server": await self.check_fastapi_server(),
                    "database": await self.check_database_connection()
                }
            }
            
            # いずれかのサービスが異常な場合
            if any(not service["healthy"] for service in health_status["services"].values()):
                health_status["status"] = "degraded"
                self.set_status(503)
            
            self.write(health_status)
            
        except Exception as e:
            self.log.error(f"Health check error: {e}")
            self.set_status(500)
            self.write({
                "status": "error",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            })

    async def check_jupyter_server(self) -> dict:
        """JupyterServerの状態確認"""
        return {
            "healthy": True,
            "response_time_ms": 0,
            "details": "JupyterLab server is running"
        }

    async def check_fastapi_server(self) -> dict:
        """FastAPIサーバーの状態確認"""
        try:
            client = AsyncHTTPClient()
            start_time = time.time()
            
            response = await client.fetch(
                f"{FASTAPI_URL}/health",
                method="GET",
                request_timeout=10.0
            )
            
            response_time = (time.time() - start_time) * 1000
            
            return {
                "healthy": response.code == 200,
                "response_time_ms": round(response_time, 2),
                "details": f"FastAPI server responded with status {response.code}"
            }
            
        except Exception as e:
            return {
                "healthy": False,
                "response_time_ms": -1,
                "details": f"FastAPI server connection failed: {str(e)}"
            }

    async def check_database_connection(self) -> dict:
        """データベース接続状態確認（プロキシ経由）"""
        try:
            client = AsyncHTTPClient()
            response = await client.fetch(
                f"{FASTAPI_URL}/api/v1/health/database",
                method="GET",
                request_timeout=10.0
            )
            
            db_status = json.loads(response.body.decode())
            
            return {
                "healthy": db_status.get("status") == "healthy",
                "response_time_ms": db_status.get("response_time_ms", -1),
                "details": db_status.get("details", "Database status unknown")
            }
            
        except Exception as e:
            return {
                "healthy": False,
                "response_time_ms": -1,
                "details": f"Database health check failed: {str(e)}"
            }
```

---

## ⚠️ エラーハンドリング

### サーバーサイド例外処理

```python
class CellMonitorProxyHandler(APIHandler):
    
    async def post(self):
        try:
            # メイン処理
            await self.proxy_request()
            
        except json.JSONDecodeError as e:
            self.log.error(f"JSON decode error: {e}")
            self.set_status(400)
            self.write({"error": "Invalid JSON format"})
            
        except tornado.httpclient.HTTPClientError as e:
            self.log.error(f"HTTP client error: {e}")
            
            # FastAPIサーバーからのエラーレスポンスを転送
            if e.response:
                self.set_status(e.code)
                try:
                    error_body = json.loads(e.response.body.decode())
                    self.write(error_body)
                except:
                    self.write({"error": f"Upstream server error: {e.code}"})
            else:
                self.set_status(502)
                self.write({"error": "Bad Gateway: FastAPI server unreachable"})
                
        except asyncio.TimeoutError:
            self.log.error("Request timeout")
            self.set_status(504)
            self.write({"error": "Gateway Timeout"})
            
        except Exception as e:
            self.log.exception("Unexpected error in proxy handler")
            self.set_status(500)
            self.write({"error": "Internal server error"})

    async def proxy_request(self):
        """プロキシリクエストの処理"""
        body = self.get_json_body()
        
        # リクエストの前処理
        body = self.preprocess_request(body)
        
        # サーバー選択
        server_url = self.select_server(body)
        
        # HTTPリクエスト送信
        client = AsyncHTTPClient()
        response = await client.fetch(
            f"{server_url}/api/v1/events",
            method="POST",
            body=json.dumps(body),
            headers=self.build_headers(),
            request_timeout=30.0
        )
        
        # レスポンス処理
        self.process_response(response)

    def preprocess_request(self, body: dict) -> dict:
        """リクエストの前処理"""
        # タイムスタンプの正規化
        if 'eventTime' in body:
            try:
                # ISO 8601形式への変換
                event_time = datetime.fromisoformat(body['eventTime'].replace('Z', '+00:00'))
                body['eventTime'] = event_time.isoformat()
            except ValueError:
                body['eventTime'] = datetime.utcnow().isoformat()
        
        # セキュリティ情報の追加
        body['sourceIp'] = self.request.remote_ip
        body['userAgent'] = self.request.headers.get('User-Agent', 'Unknown')
        
        return body

    def build_headers(self) -> dict:
        """HTTPヘッダーの構築"""
        return {
            "Content-Type": "application/json",
            "User-Agent": "JupyterLab-CellMonitor/1.1.0",
            "X-Forwarded-For": self.request.remote_ip,
            "X-Request-ID": str(uuid.uuid4())
        }
```

---

## 📊 ログ・監視システム

### 構造化ログ

```python
import structlog
from datetime import datetime

logger = structlog.get_logger(__name__)

class CellMonitorProxyHandler(APIHandler):
    
    async def post(self):
        request_id = str(uuid.uuid4())
        start_time = time.time()
        
        logger.info(
            "Request started",
            request_id=request_id,
            method=self.request.method,
            path=self.request.path,
            remote_ip=self.request.remote_ip
        )
        
        try:
            await self.proxy_request()
            
            # 成功ログ
            logger.info(
                "Request completed successfully",
                request_id=request_id,
                duration_ms=round((time.time() - start_time) * 1000, 2),
                status_code=self.get_status()
            )
            
        except Exception as e:
            # エラーログ
            logger.error(
                "Request failed",
                request_id=request_id,
                duration_ms=round((time.time() - start_time) * 1000, 2),
                error=str(e),
                error_type=type(e).__name__
            )
            raise
```

### メトリクス収集

```python
import time
from collections import defaultdict, deque
from threading import Lock

class MetricsCollector:
    """メトリクス収集システム"""
    
    def __init__(self):
        self.request_count = defaultdict(int)
        self.error_count = defaultdict(int)
        self.response_times = deque(maxlen=1000)
        self.lock = Lock()
        
    def record_request(self, method: str, status_code: int, duration_ms: float):
        """リクエストメトリクスの記録"""
        with self.lock:
            self.request_count[f"{method}_{status_code}"] += 1
            self.response_times.append(duration_ms)
            
            if status_code >= 400:
                self.error_count[status_code] += 1
                
    def get_metrics(self) -> dict:
        """メトリクスの取得"""
        with self.lock:
            if not self.response_times:
                avg_response_time = 0
            else:
                avg_response_time = sum(self.response_times) / len(self.response_times)
                
            return {
                "request_count": dict(self.request_count),
                "error_count": dict(self.error_count),
                "average_response_time_ms": round(avg_response_time, 2),
                "timestamp": datetime.utcnow().isoformat()
            }

# グローバルメトリクスコレクター
metrics = MetricsCollector()
```

---

## 🔧 設定管理

### 環境変数設定

```python
import os
from typing import Optional

class Config:
    """拡張機能設定管理"""
    
    # FastAPI サーバーURL
    FASTAPI_URL: str = os.getenv('FASTAPI_URL', 'http://localhost:8000')
    TEST_FASTAPI_URL: str = os.getenv('TEST_FASTAPI_URL', 'http://localhost:8001')
    
    # タイムアウト設定
    REQUEST_TIMEOUT: float = float(os.getenv('REQUEST_TIMEOUT', '30.0'))
    HEALTH_CHECK_TIMEOUT: float = float(os.getenv('HEALTH_CHECK_TIMEOUT', '10.0'))
    
    # ログ設定
    LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'INFO')
    ENABLE_METRICS: bool = os.getenv('ENABLE_METRICS', 'true').lower() == 'true'
    
    # セキュリティ設定
    VALIDATE_SSL: bool = os.getenv('VALIDATE_SSL', 'true').lower() == 'true'
    MAX_REQUEST_SIZE: int = int(os.getenv('MAX_REQUEST_SIZE', '1048576'))  # 1MB

config = Config()
```

---

## 🔗 関連ドキュメント

- [System Overview](SYSTEM_OVERVIEW.md) - システム全体像
- [Event Processing](SYSTEM_EVENT_PROCESSING.md) - イベント処理システム
- [Server Integration](../integration/SERVER_ADVANCED.md) - 高度なサーバー統合

**最終更新**: 2025-08-24  
**対応バージョン**: v1.1.0