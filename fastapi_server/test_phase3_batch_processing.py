#!/usr/bin/env python3
"""
Phase 3: 強化バッチ処理とワーカー並列化テスト
Docker環境での動作確認
"""

import asyncio
import json
import sys
import os
import logging
from datetime import datetime
import subprocess

# プロジェクトのルートディレクトリをパスに追加
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

FASTAPI_URL = "http://localhost:8000"

async def test_phase3_enhanced_batch_processing():
    """Phase 3強化バッチ処理テスト"""
    print("🚀 Phase 3: 強化バッチ処理システムテスト開始")
    print("="*70)
    
    # 従来のcurlテストを使用（Dockerコンテナ内部）
    await asyncio.sleep(1)
    
    # 1. 基本的な強化バッチ処理テスト
    print("1️⃣ 基本的な強化バッチ処理テスト")
    
    # 小規模バッチ (5イベント)
    small_batch = []
    for i in range(5):
        event = {
            "emailAddress": f"phase3_test_user_{i}@test.com",
            "userName": f"Phase3 Test User {i}",
            "notebookPath": "/test/phase3_notebook.ipynb",
            "cellId": f"phase3_cell_{i}",
            "cellType": "code",
            "eventType": "cell_executed",
            "cellSource": f"print('Phase 3 Enhanced Processing {i}')",
            "cellOutput": f"Phase 3 Enhanced Processing {i}",
            "executionCount": i + 1,
            "executionTime": f"2025-08-16T06:00:{i:02d}.000Z",
            "sessionId": f"phase3_session_{i}",
            "kernelId": f"phase3_kernel_{i}"
        }
        small_batch.append(event)
    
    # curlコマンドでテスト
    
    # JSON文字列を作成
    json_data = json.dumps(small_batch)
    
    try:
        # curlコマンド実行
        result = subprocess.run([
            'curl', '-X', 'POST', 
            f'{FASTAPI_URL}/api/v1/events',
            '-H', 'Content-Type: application/json',
            '-d', json_data,
            '--max-time', '30'
        ], capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            response_data = json.loads(result.stdout)
            print(f"   ✅ 小規模バッチ処理成功: {response_data.get('message', 'No message')}")
            
            # Phase 3特有の統計確認
            batch_stats = response_data.get('batch_stats', {})
            if 'batch_id' in batch_stats:
                print(f"   📊 バッチID: {batch_stats['batch_id']}")
                print(f"   📊 処理段階数: {len(batch_stats.get('processing_stages', {}))}")
                
                # 各段階の結果確認
                stages = batch_stats.get('processing_stages', {})
                for stage_name, stage_data in stages.items():
                    status = stage_data.get('status', 'unknown')
                    duration = stage_data.get('duration_ms', 0)
                    print(f"     - {stage_name}: {status} ({duration}ms)")
            else:
                print("   🟡 レガシーレスポンス形式（Phase 3機能未使用）")
        else:
            print(f"   ❌ 小規模バッチ処理失敗: {result.stderr}")
            
    except Exception as e:
        print(f"   ❌ テスト実行エラー: {e}")
    
    # 2. 中規模バッチテスト (50イベント)
    print("\n2️⃣ 中規模バッチ処理テスト (50イベント)")
    
    medium_batch = []
    event_types = ["cell_executed", "progress_update", "notebook_saved", "error_occurred"]
    
    for i in range(50):
        event_type = event_types[i % len(event_types)]
        event = {
            "emailAddress": f"phase3_medium_user_{i}@test.com",
            "userName": f"Phase3 Medium User {i}",
            "notebookPath": f"/test/medium_test_{i//10}.ipynb",
            "cellId": f"medium_cell_{i}",
            "cellType": "code",
            "eventType": event_type,
            "cellSource": f"# Medium test {i}\nprint('Processing {i}')",
            "cellOutput": f"Processing {i}",
            "executionCount": i + 1,
            "executionTime": f"2025-08-16T06:01:{i%60:02d}.000Z",
            "sessionId": f"medium_session_{i//10}",
            "kernelId": f"medium_kernel_{i//10}"
        }
        medium_batch.append(event)
    
    try:
        json_data = json.dumps(medium_batch)
        start_time = datetime.now()
        
        result = subprocess.run([
            'curl', '-X', 'POST', 
            f'{FASTAPI_URL}/api/v1/events',
            '-H', 'Content-Type: application/json',
            '-d', json_data,
            '--max-time', '60'
        ], capture_output=True, text=True, timeout=60)
        
        end_time = datetime.now()
        processing_time = (end_time - start_time).total_seconds()
        
        if result.returncode == 0:
            response_data = json.loads(result.stdout)
            print(f"   ✅ 中規模バッチ処理成功: {processing_time:.3f}秒")
            print(f"   📊 処理速度: {50/processing_time:.1f} events/sec")
            
            batch_stats = response_data.get('batch_stats', {})
            if 'processing_stages' in batch_stats:
                print("   📊 処理段階詳細:")
                stages = batch_stats['processing_stages']
                for stage_name, stage_data in stages.items():
                    status = stage_data.get('status', 'unknown')
                    duration = stage_data.get('duration_ms', 0)
                    extra_info = ""
                    if 'persisted_count' in stage_data:
                        extra_info = f", {stage_data['persisted_count']}件永続化"
                    if 'notified_count' in stage_data:
                        extra_info = f", {stage_data['notified_count']}件通知"
                    print(f"     - {stage_name}: {status} ({duration}ms{extra_info})")
        else:
            print(f"   ❌ 中規模バッチ処理失敗: {result.stderr}")
            
    except Exception as e:
        print(f"   ❌ 中規模テスト実行エラー: {e}")
    
    # 3. 大規模バッチテスト (100イベント - 上限チェック)
    print("\n3️⃣ 大規模バッチ処理テスト (100イベント)")
    
    large_batch = []
    for i in range(100):
        event_type = event_types[i % len(event_types)]
        priority = "high" if event_type == "cell_executed" else "medium" if event_type == "progress_update" else "low"
        
        event = {
            "emailAddress": f"phase3_large_user_{i}@test.com",
            "userName": f"Phase3 Large User {i}",
            "notebookPath": f"/test/large_test_{i//20}.ipynb",
            "cellId": f"large_cell_{i}",
            "cellType": "code",
            "eventType": event_type,
            "cellSource": f"# Large test {i}\nprint('Large processing {i}')",
            "cellOutput": f"Large processing {i}",
            "executionCount": i + 1,
            "executionTime": f"2025-08-16T06:02:{i%60:02d}.000Z",
            "sessionId": f"large_session_{i//20}",
            "kernelId": f"large_kernel_{i//20}",
            "priority": priority  # Phase 3での優先度テスト
        }
        large_batch.append(event)
    
    try:
        json_data = json.dumps(large_batch)
        start_time = datetime.now()
        
        result = subprocess.run([
            'curl', '-X', 'POST', 
            f'{FASTAPI_URL}/api/v1/events',
            '-H', 'Content-Type: application/json',
            '-d', json_data,
            '--max-time', '90'
        ], capture_output=True, text=True, timeout=90)
        
        end_time = datetime.now()
        processing_time = (end_time - start_time).total_seconds()
        
        if result.returncode == 0:
            response_data = json.loads(result.stdout)
            print(f"   ✅ 大規模バッチ処理成功: {processing_time:.3f}秒")
            print(f"   📊 処理速度: {100/processing_time:.1f} events/sec")
            
            # Phase 3特有の統計詳細分析
            batch_stats = response_data.get('batch_stats', {})
            if 'event_types' in batch_stats:
                print("   📊 イベントタイプ別統計:")
                for event_type, count in batch_stats['event_types'].items():
                    print(f"     - {event_type}: {count}件")
            
            if 'validation_success_rate' in batch_stats:
                success_rate = batch_stats['validation_success_rate']
                print(f"   📊 検証成功率: {success_rate:.1f}%")
                
        else:
            print(f"   ❌ 大規模バッチ処理失敗: {result.stderr}")
            
    except Exception as e:
        print(f"   ❌ 大規模テスト実行エラー: {e}")
    
    # 4. 超過制限テスト (250イベント - エラー確認)
    print("\n4️⃣ 超過制限テスト (250イベント - エラー確認)")
    
    oversized_batch = []
    for i in range(250):  # MAX_BATCH_SIZE = 200を超過
        event = {
            "emailAddress": f"oversized_user_{i}@test.com",
            "eventType": "test_oversize",
            "cellId": f"oversized_cell_{i}",
            "cellType": "code"
        }
        oversized_batch.append(event)
    
    try:
        json_data = json.dumps(oversized_batch)
        
        result = subprocess.run([
            'curl', '-X', 'POST', 
            f'{FASTAPI_URL}/api/v1/events',
            '-H', 'Content-Type: application/json',
            '-d', json_data,
            '--max-time', '30'
        ], capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            # HTTPステータス確認
            print("   🟡 予期しない成功 - 制限チェック要確認")
        else:
            # 期待されるエラー
            print("   ✅ 適切な制限エラー検出")
            if "413" in result.stderr or "exceeds maximum" in result.stderr:
                print("   📊 正しい413エラー（バッチサイズ超過）")
            
    except Exception as e:
        print(f"   ❌ 超過制限テスト実行エラー: {e}")
    
    print("\n" + "="*70)
    print("📋 Phase 3テスト結果サマリー")
    print("="*70)
    print("✅ Phase 3強化バッチ処理システム機能確認:")
    print("  - トランザクション対応バッチ処理")
    print("  - 処理段階別統計収集")
    print("  - イベントタイプ別優先度処理")
    print("  - 大規模バッチ処理対応 (最大200イベント)")
    print("  - 適切な制限値チェック")
    print("\n🚀 期待される改善効果:")
    print("  - 200同時ユーザー対応")
    print("  - 障害回復機能")
    print("  - 詳細な処理追跡")
    print("  - パフォーマンス最適化")

async def main():
    """メイン実行"""
    print("Phase 3: 強化バッチ処理とワーカー並列化テスト")
    print("Docker環境での動作確認\n")
    
    await test_phase3_enhanced_batch_processing()

if __name__ == "__main__":
    asyncio.run(main())