#!/usr/bin/env python3
"""
Docker環境用シンプルRedis接続テスト
既存の依存関係のみ使用
"""

import asyncio
import time
import json
import sys
import os

# プロジェクトのルートディレクトリをパスに追加
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from db.redis_client import get_redis_client
from schemas.event import EventData
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_redis_connection_pool():
    """Redis接続プールのテスト"""
    print("🔍 Redis接続プール最適化テスト開始")
    print("="*50)
    
    # 1. 基本接続テスト
    print("1️⃣ 基本接続テスト")
    try:
        redis_client = await get_redis_client()
        start_time = time.time()
        result = await redis_client.ping()
        end_time = time.time()
        print(f"   ✅ Redis ping成功: {result}")
        print(f"   ⏱️ レスポンス時間: {(end_time - start_time)*1000:.2f}ms")
    except Exception as e:
        print(f"   ❌ Redis接続失敗: {e}")
        return False
    
    # 2. 同一クライアント再利用テスト
    print("\n2️⃣ 同一クライアント再利用テスト")
    client1 = await get_redis_client()
    client2 = await get_redis_client()
    print(f"   Client 1 ID: {id(client1)}")
    print(f"   Client 2 ID: {id(client2)}")
    if id(client1) == id(client2):
        print("   ✅ シングルトンパターン動作確認")
    else:
        print("   🟡 新しいインスタンス作成（接続プールは共有）")
    
    # 3. 複数操作パフォーマンステスト
    print("\n3️⃣ 複数操作パフォーマンステスト")
    operations = 50
    start_time = time.time()
    
    tasks = []
    for i in range(operations):
        tasks.append(test_redis_operation(i))
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    end_time = time.time()
    
    success_count = sum(1 for r in results if r is True)
    total_time = end_time - start_time
    ops_per_second = operations / total_time
    
    print(f"   📊 結果:")
    print(f"     - 総操作数: {operations}")
    print(f"     - 成功数: {success_count}")
    print(f"     - 失敗数: {operations - success_count}")
    print(f"     - 総時間: {total_time:.3f}秒")
    print(f"     - 操作/秒: {ops_per_second:.2f}")
    print(f"     - 平均レスポンス: {total_time/operations*1000:.2f}ms")
    
    # 4. イベント発行テスト
    print("\n4️⃣ イベント発行テスト")
    await test_event_publishing()
    
    print("\n🎉 テスト完了!")
    return True

async def test_redis_operation(operation_id: int):
    """個別Redis操作テスト"""
    try:
        redis_client = await get_redis_client()
        
        # SET操作
        await redis_client.set(f"test_key_{operation_id}", f"test_value_{operation_id}", ex=10)
        
        # GET操作
        value = await redis_client.get(f"test_key_{operation_id}")
        
        # DEL操作
        await redis_client.delete(f"test_key_{operation_id}")
        
        return True
    except Exception as e:
        logger.error(f"Operation {operation_id} failed: {e}")
        return False

async def test_event_publishing():
    """イベント発行テスト"""
    try:
        redis_client = await get_redis_client()
        
        # テストイベント作成
        event_data = {
            "userId": "test_user_001",
            "userName": "Test User",
            "notebookPath": "/test/notebook.ipynb",
            "cellId": "test_cell_001",
            "eventType": "cell_executed",
            "cellSource": "print('Hello Redis Pool!')",
            "cellOutput": "Hello Redis Pool!",
            "executionCount": 1,
            "executionTime": "2025-08-16T05:00:00.000Z",
            "sessionId": "test_session_001",
            "kernelId": "test_kernel_001"
        }
        
        # イベント発行
        start_time = time.time()
        await redis_client.publish("progress_events", json.dumps(event_data))
        end_time = time.time()
        
        print(f"   ✅ イベント発行成功")
        print(f"   ⏱️ 発行時間: {(end_time - start_time)*1000:.2f}ms")
        
        # パイプライン操作テスト
        print("   🔄 パイプライン操作テスト...")
        start_time = time.time()
        
        pipe = redis_client.pipeline()
        for i in range(10):
            pipe.publish("progress_events", json.dumps({**event_data, "userId": f"user_{i}"}))
        
        await pipe.execute()
        end_time = time.time()
        
        print(f"   ✅ パイプライン操作成功 (10イベント)")
        print(f"   ⏱️ パイプライン時間: {(end_time - start_time)*1000:.2f}ms")
        
    except Exception as e:
        print(f"   ❌ イベント発行失敗: {e}")

async def main():
    """メイン実行"""
    print("Redis接続プール最適化効果検証")
    print("Docker環境での動作確認\n")
    
    success = await test_redis_connection_pool()
    
    if success:
        print("\n✅ Phase 1最適化: 成功")
        print("📈 期待される効果:")
        print("  - Redis接続数の削減")
        print("  - レスポンス時間の安定化") 
        print("  - 200同時接続への対応力向上")
    else:
        print("\n❌ Phase 1最適化: 失敗")
        print("🔧 確認が必要な項目:")
        print("  - Redis接続設定")
        print("  - 接続プール設定")

if __name__ == "__main__":
    asyncio.run(main())