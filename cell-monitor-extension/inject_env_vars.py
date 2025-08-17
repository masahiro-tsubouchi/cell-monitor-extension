#!/usr/bin/env python3
"""
JupyterLab環境変数注入スクリプト
Dockerコンテナの環境変数をJavaScriptで利用可能にします
"""

import os
import json

def inject_env_vars():
    """環境変数をJavaScriptで利用可能な形式でHTMLに注入"""
    
    # 注入する環境変数のリスト
    env_vars = {
        'CELL_MONITOR_SERVER_URL': os.environ.get('CELL_MONITOR_SERVER_URL', 'http://fastapi:8000/api/v1/events'),
        'CELL_MONITOR_TEST_MODE': os.environ.get('CELL_MONITOR_TEST_MODE', 'true'),
        'NODE_ENV': os.environ.get('NODE_ENV', 'development')
    }
    
    # JavaScriptで利用可能な形式に変換
    js_vars = json.dumps(env_vars, indent=2)
    
    print(f"<!-- Cell Monitor Environment Variables -->")
    print(f"<script>")
    print(f"  window.CELL_MONITOR_ENV = {js_vars};")
    for key, value in env_vars.items():
        print(f"  window.{key} = {json.dumps(value)};")
    print(f"</script>")

if __name__ == '__main__':
    inject_env_vars()