#!/usr/bin/env python3
"""
InfluxDB専用CSVエクスポートスクリプト

InfluxDBに保存された時系列データを包括的にCSVエクスポートする
"""

import os
import sys
import logging
import pandas as pd
from datetime import datetime

# パスを追加してモジュールをインポート可能にする
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.config import settings

# InfluxDB接続（設定されている場合）
try:
    from influxdb_client import InfluxDBClient

    INFLUXDB_AVAILABLE = True
except ImportError:
    INFLUXDB_AVAILABLE = False

# ログ設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class InfluxDBCSVExporter:
    """InfluxDB専用CSVエクスポートクラス"""

    def __init__(self, output_dir: str = "/app/test_results"):
        self.output_dir = output_dir
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # 出力ディレクトリ作成
        os.makedirs(output_dir, exist_ok=True)

        # InfluxDB接続
        self.influxdb_client = None
        if INFLUXDB_AVAILABLE and hasattr(settings, "INFLUXDB_URL"):
            try:
                self.influxdb_client = InfluxDBClient(
                    url=settings.INFLUXDB_URL,
                    token=settings.INFLUXDB_TOKEN,
                    org=settings.INFLUXDB_ORG,
                )
                logger.info("InfluxDB connection established")
            except Exception as e:
                logger.warning(f"Failed to connect to InfluxDB: {e}")

    def export_all_influxdb_data(self):
        """全InfluxDBデータをCSVエクスポート"""
        if not self.influxdb_client:
            logger.warning("InfluxDB client not available, skipping export")
            return

        logger.info("=== InfluxDBデータCSVエクスポート開始 ===")

        try:
            # 1. 全測定値を取得
            self._export_all_measurements()

            # 2. 学生進捗イベント詳細
            self._export_student_progress_details()

            # 3. 時系列集計データ
            self._export_time_series_aggregates()

            # 4. エラー統計
            self._export_error_statistics()

            logger.info("=== InfluxDBデータCSVエクスポート完了 ===")

        except Exception as e:
            logger.error(f"InfluxDBエクスポートエラー: {e}")

    def _export_all_measurements(self):
        """全測定値の生データをエクスポート"""
        try:
            # 過去24時間の全データを取得
            query = f"""
            from(bucket: "{settings.INFLUXDB_BUCKET}")
              |> range(start: -24h)
              |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
            """

            result = self.influxdb_client.query_api().query(query)

            data = []
            for table in result:
                for record in table.records:
                    row_data = {
                        "timestamp": record.get_time(),
                        "measurement": record.get_measurement(),
                    }
                    # 全フィールドを追加
                    for key, value in record.values.items():
                        if not key.startswith("_"):
                            row_data[key] = value
                    data.append(row_data)

            if data:
                df = pd.DataFrame(data)
                output_file = (
                    f"{self.output_dir}/influxdb_all_data_{self.timestamp}.csv"
                )
                df.to_csv(output_file, index=False, encoding="utf-8")
                logger.info(
                    f"✅ InfluxDB全データ: {len(data)} records -> {output_file}"
                )
            else:
                logger.warning("⚠️  InfluxDBにデータが見つかりません")

        except Exception as e:
            logger.warning(f"❌ 全データエクスポートエラー: {e}")

    def _export_student_progress_details(self):
        """学生進捗イベント詳細データ"""
        try:
            query = f"""
            from(bucket: "{settings.INFLUXDB_BUCKET}")
              |> range(start: -24h)
              |> filter(fn: (r) => r["_measurement"] == "student_progress")
              |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
            """

            result = self.influxdb_client.query_api().query(query)

            data = []
            for table in result:
                for record in table.records:
                    data.append(
                        {
                            "timestamp": record.get_time(),
                            "user_id": record.values.get("userId"),
                            "event_type": record.values.get("event"),
                            "notebook_path": record.values.get("notebookPath"),
                            "cell_id": record.values.get("cellId"),
                            "execution_count": record.values.get("executionCount"),
                            "duration": record.values.get("duration"),
                            "has_error": record.values.get("hasError"),
                            "error_message": record.values.get("errorMessage"),
                        }
                    )

            if data:
                df = pd.DataFrame(data)
                output_file = (
                    f"{self.output_dir}/influxdb_student_progress_{self.timestamp}.csv"
                )
                df.to_csv(output_file, index=False, encoding="utf-8")
                logger.info(f"✅ 学生進捗データ: {len(data)} records -> {output_file}")
            else:
                logger.warning("⚠️  学生進捗データが見つかりません")

        except Exception as e:
            logger.warning(f"❌ 学生進捗エクスポートエラー: {e}")

    def _export_time_series_aggregates(self):
        """時系列集計データ"""
        try:
            # 10分間隔での活動集計
            query = f"""
            from(bucket: "{settings.INFLUXDB_BUCKET}")
              |> range(start: -24h)
              |> filter(fn: (r) => r["_measurement"] == "student_progress")
              |> aggregateWindow(every: 10m, fn: count)
              |> group(columns: ["event"])
            """

            result = self.influxdb_client.query_api().query(query)

            data = []
            for table in result:
                for record in table.records:
                    data.append(
                        {
                            "timestamp": record.get_time(),
                            "event_type": record.values.get("event"),
                            "activity_count": record.get_value(),
                            "window_size": "10m",
                        }
                    )

            if data:
                df = pd.DataFrame(data)
                output_file = (
                    f"{self.output_dir}/influxdb_time_series_{self.timestamp}.csv"
                )
                df.to_csv(output_file, index=False, encoding="utf-8")
                logger.info(
                    f"✅ 時系列集計データ: {len(data)} records -> {output_file}"
                )
            else:
                logger.warning("⚠️  時系列集計データが見つかりません")

        except Exception as e:
            logger.warning(f"❌ 時系列集計エクスポートエラー: {e}")

    def _export_error_statistics(self):
        """エラー統計データ"""
        try:
            # エラー発生率の統計
            query = f"""
            from(bucket: "{settings.INFLUXDB_BUCKET}")
              |> range(start: -24h)
              |> filter(fn: (r) => r["_measurement"] == "student_progress")
              |> filter(fn: (r) => r["event"] == "cell_executed")
              |> group(columns: ["userId", "notebookPath"])
              |> aggregateWindow(every: 1h, fn: count)
            """

            result = self.influxdb_client.query_api().query(query)

            data = []
            for table in result:
                for record in table.records:
                    data.append(
                        {
                            "timestamp": record.get_time(),
                            "user_id": record.values.get("userId"),
                            "notebook_path": record.values.get("notebookPath"),
                            "execution_count": record.get_value(),
                        }
                    )

            if data:
                df = pd.DataFrame(data)
                output_file = (
                    f"{self.output_dir}/influxdb_execution_stats_{self.timestamp}.csv"
                )
                df.to_csv(output_file, index=False, encoding="utf-8")
                logger.info(f"✅ 実行統計データ: {len(data)} records -> {output_file}")
            else:
                logger.warning("⚠️  実行統計データが見つかりません")

        except Exception as e:
            logger.warning(f"❌ 実行統計エクスポートエラー: {e}")


def main():
    """メイン実行関数"""
    exporter = InfluxDBCSVExporter()
    exporter.export_all_influxdb_data()


if __name__ == "__main__":
    main()
