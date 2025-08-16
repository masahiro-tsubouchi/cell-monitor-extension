#!/usr/bin/env python3
"""
Redis接続プール最適化の効果をテストするスクリプト
Phase 1の改善効果を検証
"""

import asyncio
import aiohttp
import time
import json
from typing import List
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

FASTAPI_URL = "http://localhost:8000"

async def send_event_batch(session: aiohttp.ClientSession, batch_id: int, events_count: int = 5):
    """イベントバッチを送信"""
    events = []
    for i in range(events_count):
        event = {
            "userId": f"student{batch_id}_{i}",
            "userName": f"Test Student {batch_id}_{i}",
            "notebookPath": "/test/notebook.ipynb",
            "cellId": f"cell_{i}",
            "eventType": "cell_executed",
            "cellSource": f"print('Test {batch_id}_{i}')",
            "cellOutput": f"Test {batch_id}_{i}",
            "executionCount": i + 1,
            "executionTime": f"2025-08-16T05:00:{i:02d}.000Z",
            "sessionId": f"session_{batch_id}",
            "kernelId": f"kernel_{batch_id}"
        }
        events.append(event)
    
    try:
        start_time = time.time()
        async with session.post(
            f"{FASTAPI_URL}/api/v1/events",
            json=events,
            headers={"Content-Type": "application/json"}
        ) as response:
            end_time = time.time()
            response_time = (end_time - start_time) * 1000  # ms
            
            if response.status == 202:
                result = await response.json()
                return {
                    "batch_id": batch_id,
                    "success": True,
                    "response_time_ms": response_time,
                    "events_count": events_count,
                    "batch_stats": result.get("batch_stats", {})
                }
            else:
                return {
                    "batch_id": batch_id,
                    "success": False,
                    "response_time_ms": response_time,
                    "error": f"HTTP {response.status}"
                }
    except Exception as e:
        return {
            "batch_id": batch_id,
            "success": False,
            "error": str(e)
        }

async def run_concurrent_test(concurrent_users: int = 50, events_per_user: int = 5):
    """同時接続テスト実行"""
    logger.info(f"開始: {concurrent_users}ユーザー、各{events_per_user}イベント")
    
    connector = aiohttp.TCPConnector(
        limit=100,  # 総接続数制限
        limit_per_host=50,  # ホスト毎接続数制限
        keepalive_timeout=30
    )
    
    async with aiohttp.ClientSession(connector=connector) as session:
        # ヘルスチェック
        try:
            async with session.get(f"{FASTAPI_URL}/api/v1/health") as response:
                if response.status != 200:
                    logger.error("ヘルスチェック失敗")
                    return
                logger.info("ヘルスチェック成功")
        except Exception as e:
            logger.error(f"ヘルスチェック失敗: {e}")
            return
        
        # 同時リクエスト実行
        start_time = time.time()
        tasks = [
            send_event_batch(session, i, events_per_user) 
            for i in range(concurrent_users)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        end_time = time.time()
        
        # 結果分析
        total_time = end_time - start_time
        successful_requests = sum(1 for r in results if isinstance(r, dict) and r.get("success"))
        failed_requests = len(results) - successful_requests
        
        response_times = [
            r["response_time_ms"] for r in results 
            if isinstance(r, dict) and "response_time_ms" in r
        ]
        
        if response_times:
            avg_response_time = sum(response_times) / len(response_times)
            max_response_time = max(response_times)
            min_response_time = min(response_times)
        else:
            avg_response_time = max_response_time = min_response_time = 0
        
        # 結果レポート
        total_events = concurrent_users * events_per_user
        events_per_second = total_events / total_time if total_time > 0 else 0
        
        print("\n" + "="*60)
        print("🚀 Redis接続プール最適化テスト結果")
        print("="*60)
        print(f"同時ユーザー数: {concurrent_users}")
        print(f"ユーザー毎イベント数: {events_per_user}")
        print(f"総イベント数: {total_events}")
        print(f"総実行時間: {total_time:.2f}秒")
        print(f"イベント/秒: {events_per_second:.2f}")
        print(f"成功リクエスト: {successful_requests}")
        print(f"失敗リクエスト: {failed_requests}")
        print(f"成功率: {(successful_requests/len(results)*100):.1f}%")
        print()
        print("⏱️ レスポンス時間統計:")
        print(f"  平均: {avg_response_time:.2f}ms")
        print(f"  最大: {max_response_time:.2f}ms")
        print(f"  最小: {min_response_time:.2f}ms")
        print()
        
        # エラー詳細
        errors = [r for r in results if isinstance(r, dict) and not r.get("success")]
        if errors:
            print("❌ エラー詳細:")
            error_counts = {}
            for error in errors[:5]:  # 最初の5個のエラーを表示
                error_msg = error.get("error", "Unknown error")
                error_counts[error_msg] = error_counts.get(error_msg, 0) + 1
                print(f"  - {error_msg}")
            print()
        
        # パフォーマンス判定
        print("📊 パフォーマンス評価:")
        if successful_requests == len(results):
            print("  ✅ 全リクエスト成功")
        elif successful_requests >= len(results) * 0.95:
            print("  🟡 高成功率 (95%+)")
        else:
            print("  ❌ 低成功率 (<95%)")
            
        if avg_response_time < 100:
            print("  ✅ 高速レスポンス (<100ms)")
        elif avg_response_time < 500:
            print("  🟡 許容レスポンス (<500ms)")
        else:
            print("  ❌ 低速レスポンス (>=500ms)")
            
        if events_per_second > 100:
            print("  ✅ 高スループット (>100 events/sec)")
        elif events_per_second > 50:
            print("  🟡 中スループット (>50 events/sec)")
        else:
            print("  ❌ 低スループット (<=50 events/sec)")
        
        print("="*60)

async def main():
    """メイン実行"""
    print("Redis接続プール最適化効果テスト")
    print("段階的に負荷を増やしてテストします...\n")
    
    # 段階的テスト
    test_cases = [
        (10, 5),   # 10ユーザー、各5イベント
        (25, 5),   # 25ユーザー、各5イベント  
        (50, 5),   # 50ユーザー、各5イベント
        (100, 3),  # 100ユーザー、各3イベント
    ]
    
    for users, events in test_cases:
        await run_concurrent_test(users, events)
        print(f"\n⏳ 次のテストまで3秒待機...\n")
        await asyncio.sleep(3)
    
    print("🎉 全テスト完了!")

if __name__ == "__main__":
    asyncio.run(main())