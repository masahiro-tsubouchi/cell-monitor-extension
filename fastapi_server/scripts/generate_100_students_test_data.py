#!/usr/bin/env python3
"""
100人分のテストデータを実際にAPIに送信してDBに保存し、CSVで出力するスクリプト
"""

import requests
import json
import time
import csv
import os
from datetime import datetime
from typing import List, Dict, Any
import psycopg2
from influxdb_client import InfluxDBClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# 設定
API_BASE_URL = "http://localhost:8000"
POSTGRES_URL = "postgresql://admin:secretpassword@postgres:5432/progress_db"
INFLUXDB_URL = "http://influxdb:8086"
INFLUXDB_TOKEN = "my-super-secret-token"
INFLUXDB_ORG = "my-org"
INFLUXDB_BUCKET = "jupyter_events"


def create_test_event(
    student_id: int, notebook_id: int, cell_id: int
) -> Dict[str, Any]:
    """テストイベントデータを作成"""
    return {
        "eventId": f"evt_{int(time.time() * 1000)}_{student_id}_{cell_id}",
        "eventType": "cell_executed",
        "eventTime": None,
        "userId": f"test_student_{student_id:03d}",
        "userName": f"Test Student {student_id:03d}",
        "sessionId": None,
        "notebookPath": f"/test_notebooks/notebook_{notebook_id:02d}.ipynb",
        "cellId": f"cell_{cell_id:03d}",
        "cellIndex": cell_id - 1,
        "cellType": "code",
        "code": f"print('Hello from student {student_id}, cell {cell_id}')",
        "executionCount": 1,
        "hasError": student_id % 7 == 0,  # 7人に1人はエラー
        "errorMessage": (
            f"Test error for student {student_id}" if student_id % 7 == 0 else None
        ),
        "result": None,
        "executionDurationMs": 100 + (student_id % 50) * 10,
        "metadata": None,
    }


def send_events_to_api(events: List[Dict[str, Any]]) -> bool:
    """イベントをAPIに送信"""
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/v1/events",
            json=events,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        if response.status_code == 202:
            print(f"✅ {len(events)}件のイベントを送信成功")
            return True
        else:
            print(f"❌ API送信失敗: {response.status_code} - {response.text}")
            return False

    except Exception as e:
        print(f"❌ API送信エラー: {e}")
        return False


def wait_for_worker_processing(expected_count: int, max_wait_seconds: int = 60):
    """ワーカープロセスの処理完了を待機"""
    print(f"ワーカープロセスの処理完了を待機中... (最大{max_wait_seconds}秒)")

    engine = create_engine(POSTGRES_URL)

    for i in range(max_wait_seconds):
        try:
            with engine.connect() as conn:
                result = conn.execute(
                    text(
                        "SELECT COUNT(*) FROM cell_executions WHERE student_id IN (SELECT id FROM students WHERE user_id LIKE 'test_student_%')"
                    )
                )
                current_count = result.scalar()

                print(f"進行状況: {current_count}/{expected_count} 件処理済み")

                if current_count >= expected_count:
                    print(f"✅ 全{expected_count}件の処理が完了しました")
                    return True

        except Exception as e:
            print(f"DB確認エラー: {e}")

        time.sleep(1)

    print(f"⚠️ タイムアウト: {max_wait_seconds}秒以内に処理が完了しませんでした")
    return False


def export_postgresql_data():
    """PostgreSQLデータをCSVにエクスポート"""
    print("PostgreSQLデータをCSVにエクスポート中...")

    engine = create_engine(POSTGRES_URL)
    output_dir = "/app/test_results"
    os.makedirs(output_dir, exist_ok=True)

    # エクスポート対象テーブルとクエリ
    exports = {
        "students": "SELECT * FROM students WHERE user_id LIKE 'test_student_%' ORDER BY id",
        "notebooks": "SELECT * FROM notebooks WHERE path LIKE '/test_notebooks/%' ORDER BY id",
        "cells": """
            SELECT c.* FROM cells c
            JOIN notebooks n ON c.notebook_id = n.id
            WHERE n.path LIKE '/test_notebooks/%'
            ORDER BY c.id
        """,
        "cell_executions": """
            SELECT ce.* FROM cell_executions ce
            JOIN students s ON ce.student_id = s.id
            WHERE s.user_id LIKE 'test_student_%'
            ORDER BY ce.id
        """,
    }

    for table_name, query in exports.items():
        try:
            with engine.connect() as conn:
                result = conn.execute(text(query))
                rows = result.fetchall()
                columns = result.keys()

                csv_path = f"{output_dir}/{table_name}_100_students.csv"
                with open(csv_path, "w", newline="", encoding="utf-8") as csvfile:
                    writer = csv.writer(csvfile)
                    writer.writerow(columns)
                    writer.writerows(rows)

                print(f"✅ {table_name}: {len(rows)}件 → {csv_path}")

        except Exception as e:
            print(f"❌ {table_name}エクスポートエラー: {e}")


def export_influxdb_data():
    """InfluxDBデータをCSVにエクスポート"""
    print("InfluxDBデータをCSVにエクスポート中...")

    try:
        # InfluxDB接続（トークンが設定されていない場合はスキップ）
        if INFLUXDB_TOKEN == "your-token-here":
            print(
                "⚠️ InfluxDBトークンが設定されていないため、InfluxDBエクスポートをスキップします"
            )
            return

        client = InfluxDBClient(
            url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG
        )
        query_api = client.query_api()

        # 過去1時間のテストデータを取得
        query = f"""
        from(bucket: "{INFLUXDB_BUCKET}")
        |> range(start: -1h)
        |> filter(fn: (r) => r._measurement == "student_progress")
        |> filter(fn: (r) => r.userId =~ /test_student_/)
        """

        result = query_api.query(query)

        output_dir = "/app/test_results"
        csv_path = f"{output_dir}/influxdb_student_progress_100_students.csv"

        with open(csv_path, "w", newline="", encoding="utf-8") as csvfile:
            writer = csv.writer(csvfile)

            # ヘッダー書き込み
            headers_written = False
            row_count = 0

            for table in result:
                for record in table.records:
                    if not headers_written:
                        headers = ["time", "measurement"] + list(record.values.keys())
                        writer.writerow(headers)
                        headers_written = True

                    row = [record.get_time(), record.get_measurement()] + list(
                        record.values.values()
                    )
                    writer.writerow(row)
                    row_count += 1

            print(f"✅ InfluxDB: {row_count}件 → {csv_path}")

    except Exception as e:
        print(f"❌ InfluxDBエクスポートエラー: {e}")


def main():
    """メイン処理"""
    print("🚀 100人分のテストデータ生成・送信・保存・CSV出力を開始します")

    # 1. テストデータ生成
    print("\n📊 テストデータ生成中...")
    events = []

    for student_id in range(1, 101):  # 100人の学生
        for notebook_id in range(1, 6):  # 5つのノートブック
            for cell_id in range(1, 4):  # 各ノートブックに3つのセル
                event = create_test_event(student_id, notebook_id, cell_id)
                events.append(event)

    total_events = len(events)
    print(f"✅ {total_events}件のテストイベントを生成しました")

    # 2. APIに送信（バッチ処理）
    print(f"\n📤 {total_events}件のイベントをAPIに送信中...")
    batch_size = 50
    successful_batches = 0

    for i in range(0, total_events, batch_size):
        batch = events[i : i + batch_size]
        if send_events_to_api(batch):
            successful_batches += 1
        time.sleep(0.5)  # API負荷軽減のため少し待機

    print(f"✅ {successful_batches}個のバッチを送信完了")

    # 3. ワーカープロセスの処理完了を待機
    print(f"\n⏳ ワーカープロセスの処理完了を待機...")
    wait_for_worker_processing(total_events, max_wait_seconds=120)

    # 4. データベースからCSVエクスポート
    print(f"\n📁 データベースからCSVエクスポート...")
    export_postgresql_data()
    export_influxdb_data()

    print(f"\n🎉 100人分のテストデータ処理が完了しました！")
    print(f"📂 結果は /app/test_results ディレクトリに保存されています")


if __name__ == "__main__":
    main()
