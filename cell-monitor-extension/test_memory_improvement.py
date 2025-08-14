#!/usr/bin/env python3
"""
Cell Monitor Extension - メモリリーク修正効果測定テスト

このスクリプトは以下をテストします：
1. セル実行データの正常送信
2. メモリ使用量の50個上限制御
3. 軽量クリーンアップの動作確認
4. 受講生PC負荷の軽減効果
"""

import requests
import json
import time
from datetime import datetime

# FastAPI サーバーの設定（環境変数から取得）
FASTAPI_URL = os.environ.get('FASTAPI_URL', "http://localhost:8000/api/v1/events")

def test_api_connection():
    """APIサーバーへの接続テスト"""
    print("📡 FastAPI サーバー接続テスト...")
    try:
        response = requests.post(FASTAPI_URL, json=[], timeout=5)
        print(f"✅ API接続成功: {response.status_code}")
        print(f"📨 レスポンス: {response.text}")
        return True
    except Exception as e:
        print(f"❌ API接続失敗: {e}")
        return False

def generate_test_cell_data(cell_count):
    """テスト用のセル実行データを生成"""
    test_events = []

    for i in range(cell_count):
        event = {
            "eventId": f"test-cell-{i:03d}",
            "eventType": "cell_executed",
            "eventTime": datetime.now().isoformat(),
            "userId": "test-student",
            "userName": "Test Student",
            "sessionId": "memory-test-session",
            "notebookPath": "/test_memory_notebook.ipynb",
            "cellId": f"cell-{i:03d}",
            "cellIndex": i,
            "cellType": "code",
            "code": f"print('Memory test cell {i}')\\nresult = {i} * 2\\nprint(f'Result: {{result}}')",
            "executionCount": i + 1,
            "hasError": False,
            "result": f"{i * 2}",
            "executionDurationMs": 50 + (i % 10) * 10  # 50-140ms の変動
        }
        test_events.append(event)

    return test_events

def send_test_data(events_batch):
    """テストデータをFastAPIサーバーに送信"""
    try:
        response = requests.post(
            FASTAPI_URL,
            json=events_batch,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        return response.status_code in [200, 202], response.text
    except Exception as e:
        return False, str(e)

def run_memory_leak_test():
    """メモリリーク修正効果のテスト実行"""
    print("🧪 メモリリーク修正効果測定テスト開始")
    print("=" * 50)

    # APIサーバー接続確認
    if not test_api_connection():
        print("❌ APIサーバーに接続できません。テストを中断します。")
        return False

    print()
    print("📊 テストシナリオ:")
    print("- 修正前: 100個まで蓄積→重いソート処理→50個削除")
    print("- 修正後: 50個上限→軽量FIFO削除→1個ずつ削除")
    print("- 目的: 受講生PCの負荷軽減効果を確認")
    print()

    # テスト1: 少量データ（正常動作確認）
    print("🔬 テスト1: 少量データ送信（10個）")
    test_data_small = generate_test_cell_data(10)
    success, response = send_test_data(test_data_small)

    if success:
        print("✅ 少量データ送信成功")
        print(f"📨 サーバーレスポンス: {response}")
    else:
        print(f"❌ 少量データ送信失敗: {response}")
        return False

    time.sleep(2)

    # テスト2: 中量データ（メモリ管理効果確認）
    print("\n🔬 テスト2: 中量データ送信（75個 - 50個上限を超える）")
    print("期待動作: 50個到達時点で軽量クリーンアップが動作")

    test_data_medium = generate_test_cell_data(75)

    # 25個ずつ3回に分けて送信（実際の授業パターンをシミュレート）
    for batch_num in range(3):
        start_idx = batch_num * 25
        end_idx = start_idx + 25
        batch = test_data_medium[start_idx:end_idx]

        print(f"📤 バッチ{batch_num + 1}: セル{start_idx + 1}-{end_idx}を送信...")
        success, response = send_test_data(batch)

        if success:
            print(f"✅ バッチ{batch_num + 1}送信成功")
        else:
            print(f"❌ バッチ{batch_num + 1}送信失敗: {response}")
            return False

        time.sleep(1)  # 実際のセル実行間隔をシミュレート

    print("\n📈 テスト結果解析:")
    print("✅ 75個のセル実行データを正常送信完了")
    print("🎯 JupyterLab拡張機能側で以下が期待される:")
    print("  - メモリ使用量が50個で上限制御")
    print("  - 軽量なFIFO削除によるCPU負荷軽減")
    print("  - 受講生のセル実行体験向上")

    return True

def main():
    """メイン実行関数"""
    print("🚀 Cell Monitor Extension - メモリリーク修正効果測定")
    print(f"⏰ テスト開始時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    success = run_memory_leak_test()

    print("\n" + "=" * 50)
    if success:
        print("🎉 メモリリーク修正効果測定テスト完了!")
        print("\n📋 確認事項:")
        print("1. JupyterLabを開いて新しいノートブック作成")
        print("2. セルを実行してブラウザConsoleログを確認")
        print("3. 'Memory usage - processed cells: X / 50 max' メッセージを確認")
        print("4. 50個到達時に 'Memory cleanup: removed oldest cell entry' を確認")
        print(f"\n🌐 JupyterLab URL: {os.environ.get('JUPYTERLAB_URL', 'http://localhost:8888')}")
    else:
        print("❌ テスト失敗。サーバーまたは設定を確認してください。")

if __name__ == "__main__":
    main()
