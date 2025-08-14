"""
簡易CSV出力スクリプト - 実際のテストデータを抽出
"""

import csv
import os
from datetime import datetime
from sqlalchemy import create_engine, text
from core.config import settings


def export_table_to_csv(engine, table_name, output_dir):
    """テーブルデータをCSVに出力"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"{output_dir}/{table_name}_{timestamp}.csv"

    with engine.connect() as conn:
        # テーブルの全データを取得
        result = conn.execute(text(f"SELECT * FROM {table_name}"))

        # カラム名を取得
        columns = result.keys()

        # CSVファイルに書き込み
        with open(output_file, "w", newline="", encoding="utf-8") as csvfile:
            writer = csv.writer(csvfile)

            # ヘッダー行
            writer.writerow(columns)

            # データ行
            for row in result:
                writer.writerow(row)

    # レコード数を確認
    with engine.connect() as conn:
        count_result = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
        record_count = count_result.scalar()

    print(f"✅ {table_name}: {record_count} records -> {output_file}")
    return record_count


def main():
    """メイン実行"""
    print("=== 100人受講生テストデータ簡易CSV出力 ===")

    # 出力ディレクトリ作成
    output_dir = "/app/test_results"
    os.makedirs(output_dir, exist_ok=True)

    # データベース接続
    engine = create_engine(settings.DATABASE_URL)

    # 出力対象テーブル（データが存在するもの）
    tables_with_data = [
        "students",  # 109レコード
        "notebooks",  # 1レコード
        "classes",  # 35レコード
        "class_assignments",  # 50レコード
        "assignment_submissions",  # 44レコード
        "instructors",  # 1レコード
        "instructor_status_history",  # 10レコード
    ]

    total_records = 0

    for table_name in tables_with_data:
        try:
            record_count = export_table_to_csv(engine, table_name, output_dir)
            total_records += record_count
        except Exception as e:
            print(f"❌ {table_name}: エラー - {e}")

    print(f"\n📊 合計出力レコード数: {total_records}")
    print(f"📁 出力ディレクトリ: {output_dir}")
    print("=== CSV出力完了 ===")


if __name__ == "__main__":
    main()
