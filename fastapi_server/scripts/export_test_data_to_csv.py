"""
100人受講生テストデータCSV出力スクリプト

PostgreSQLとInfluxDBから格納されたテストデータを抽出してCSV形式で出力
AI駆動TDD: 186個テストケース成功パターンを活用したデータ抽出
"""

import asyncio
import csv
import os
import pandas as pd
from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import logging

# 設定とモデルのインポート
from core.config import settings
from db.models import (
    Student,
    Notebook,
    CellExecution,
    Class,
    Session,
    Cell,
    NotebookAccess,
)
from db.session import SessionLocal

# InfluxDB接続（設定されている場合）
try:
    from influxdb_client import InfluxDBClient

    INFLUXDB_AVAILABLE = True
except ImportError:
    INFLUXDB_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TestDataExporter:
    """テストデータCSV出力クラス"""

    def __init__(self, output_dir: str = "/app/test_results"):
        self.output_dir = output_dir
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # 出力ディレクトリ作成
        os.makedirs(output_dir, exist_ok=True)

        # データベース接続
        self.engine = create_engine(settings.DATABASE_URL)
        self.SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=self.engine
        )

        # InfluxDB接続（設定があれば）
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

    def export_all_data(self):
        """全テストデータをCSV出力"""
        logger.info("Starting test data export...")

        # PostgreSQLデータ出力
        self.export_students_data()
        self.export_notebooks_data()
        self.export_cell_executions_data()
        self.export_sessions_data()
        self.export_classes_data()
        self.export_cells_data()
        self.export_notebook_accesses_data()

        # InfluxDBデータ出力（利用可能な場合）
        if self.influxdb_client:
            self.export_influxdb_data()

        # 統計サマリー出力
        self.export_summary_statistics()

        logger.info(f"Data export completed. Files saved to: {self.output_dir}")

    def export_students_data(self):
        """学生データCSV出力"""
        db = self.SessionLocal()
        try:
            students = db.query(Student).all()

            data = []
            for student in students:
                data.append(
                    {
                        "id": student.id,
                        "user_id": student.user_id,
                        "name": student.name,
                        "email": student.email,
                        "created_at": student.created_at,
                        "updated_at": student.updated_at,
                    }
                )

            df = pd.DataFrame(data)
            output_file = f"{self.output_dir}/students_{self.timestamp}.csv"
            df.to_csv(output_file, index=False, encoding="utf-8")
            logger.info(f"Students data exported: {len(data)} records -> {output_file}")

        finally:
            db.close()

    def export_notebooks_data(self):
        """ノートブックデータCSV出力"""
        db = self.SessionLocal()
        try:
            notebooks = db.query(Notebook).all()

            data = []
            for notebook in notebooks:
                data.append(
                    {
                        "id": notebook.id,
                        "path": notebook.path,
                        "name": notebook.name,
                        "created_at": notebook.created_at,
                        "updated_at": notebook.updated_at,
                        "last_modified": notebook.last_modified,
                        "notebook_metadata": notebook.notebook_metadata,
                    }
                )

            df = pd.DataFrame(data)
            output_file = f"{self.output_dir}/notebooks_{self.timestamp}.csv"
            df.to_csv(output_file, index=False, encoding="utf-8")
            logger.info(
                f"Notebooks data exported: {len(data)} records -> {output_file}"
            )

        finally:
            db.close()

    def export_cell_executions_data(self):
        """セル実行データCSV出力"""
        db = self.SessionLocal()
        try:
            cell_executions = db.query(CellExecution).all()

            data = []
            for execution in cell_executions:
                data.append(
                    {
                        "id": execution.id,
                        "execution_id": execution.execution_id,
                        "notebook_id": execution.notebook_id,
                        "cell_id": execution.cell_id,
                        "student_id": execution.student_id,
                        "session_id": execution.session_id,
                        "executed_at": execution.executed_at,
                        "execution_count": execution.execution_count,
                        "status": execution.status,
                        "duration": execution.duration,
                        "error_message": execution.error_message,
                        "output": execution.output,
                    }
                )

            df = pd.DataFrame(data)
            output_file = f"{self.output_dir}/cell_executions_{self.timestamp}.csv"
            df.to_csv(output_file, index=False, encoding="utf-8")
            logger.info(
                f"Cell executions data exported: {len(data)} records -> {output_file}"
            )

        finally:
            db.close()

    def export_sessions_data(self):
        """セッションデータCSV出力"""
        db = self.SessionLocal()
        try:
            sessions = db.query(Session).all()

            data = []
            for session in sessions:
                data.append(
                    {
                        "id": session.id,
                        "session_id": session.session_id,
                        "student_id": session.student_id,
                        "started_at": session.started_at,
                        "ended_at": session.ended_at,
                        "is_active": session.is_active,
                        "created_at": session.created_at,
                        "updated_at": session.updated_at,
                    }
                )

            df = pd.DataFrame(data)
            output_file = f"{self.output_dir}/sessions_{self.timestamp}.csv"
            df.to_csv(output_file, index=False, encoding="utf-8")
            logger.info(f"Sessions data exported: {len(data)} records -> {output_file}")

        finally:
            db.close()

    def export_classes_data(self):
        """クラスデータCSV出力"""
        db = self.SessionLocal()
        try:
            classes = db.query(Class).all()

            data = []
            for cls in classes:
                data.append(
                    {
                        "id": cls.id,
                        "class_code": cls.class_code,
                        "name": cls.name,
                        "description": cls.description,
                        "instructor_id": cls.instructor_id,
                        "start_date": cls.start_date,
                        "end_date": cls.end_date,
                        "is_active": cls.is_active,
                        "created_at": cls.created_at,
                        "updated_at": cls.updated_at,
                    }
                )

            df = pd.DataFrame(data)
            output_file = f"{self.output_dir}/classes_{self.timestamp}.csv"
            df.to_csv(output_file, index=False, encoding="utf-8")
            logger.info(f"Classes data exported: {len(data)} records -> {output_file}")

        finally:
            db.close()

    def export_cells_data(self):
        """セルデータCSV出力"""
        db = self.SessionLocal()
        try:
            cells = db.query(Cell).all()

            data = []
            for cell in cells:
                data.append(
                    {
                        "id": cell.id,
                        "cell_id": cell.cell_id,
                        "notebook_id": cell.notebook_id,
                        "cell_type": cell.cell_type,
                        "position": cell.position,
                        "content": cell.content,
                        "cell_metadata": cell.cell_metadata,
                    }
                )

            df = pd.DataFrame(data)
            output_file = f"{self.output_dir}/cells_{self.timestamp}.csv"
            df.to_csv(output_file, index=False, encoding="utf-8")
            logger.info(f"Cells data exported: {len(data)} records -> {output_file}")

        finally:
            db.close()

    def export_notebook_accesses_data(self):
        """ノートブックアクセスデータCSV出力"""
        db = self.SessionLocal()
        try:
            accesses = db.query(NotebookAccess).all()

            data = []
            for access in accesses:
                data.append(
                    {
                        "id": access.id,
                        "student_id": access.student_id,
                        "notebook_id": access.notebook_id,
                        "accessed_at": access.accessed_at,
                        "action": access.action,
                    }
                )

            df = pd.DataFrame(data)
            output_file = f"{self.output_dir}/notebook_accesses_{self.timestamp}.csv"
            df.to_csv(output_file, index=False, encoding="utf-8")
            logger.info(
                f"Notebook accesses data exported: {len(data)} records -> {output_file}"
            )

        finally:
            db.close()

    def export_influxdb_data(self):
        """InfluxDBデータCSV出力（包括的なデータ取得）"""
        if not self.influxdb_client:
            logger.warning("InfluxDB client not available, skipping InfluxDB export")
            return

        try:
            # 1. 学生進捗イベントデータを取得
            self._export_influxdb_student_progress()

            # 2. セル実行統計データを取得
            self._export_influxdb_execution_stats()

            # 3. 時系列集計データを取得
            self._export_influxdb_time_series_aggregates()

        except Exception as e:
            logger.error(f"Failed to export InfluxDB data: {e}")

    def _export_influxdb_student_progress(self):
        """学生進捗イベントデータのエクスポート"""
        try:
            # 過去24時間の全学生進捗イベントを取得
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
                    row_data = {
                        "timestamp": record.get_time(),
                        "measurement": record.get_measurement(),
                    }
                    # タグ情報を追加
                    for key, value in record.values.items():
                        if not key.startswith("_"):
                            row_data[key] = value
                    data.append(row_data)

            if data:
                df = pd.DataFrame(data)
                output_file = (
                    f"{self.output_dir}/influxdb_student_progress_{self.timestamp}.csv"
                )
                df.to_csv(output_file, index=False, encoding="utf-8")
                logger.info(
                    f"InfluxDB student progress exported: {len(data)} records -> {output_file}"
                )
            else:
                logger.warning("No student progress data found in InfluxDB")

        except Exception as e:
            logger.warning(f"Failed to export student progress from InfluxDB: {e}")

    def _export_influxdb_execution_stats(self):
        """セル実行統計データのエクスポート"""
        try:
            # ユーザー別・ノートブック別の実行統計
            query = f"""
            from(bucket: "{settings.INFLUXDB_BUCKET}")
              |> range(start: -24h)
              |> filter(fn: (r) => r["_measurement"] == "student_progress")
              |> filter(fn: (r) => r["event"] == "cell_executed")
              |> group(columns: ["userId", "notebookPath"])
              |> aggregateWindow(every: 1h, fn: count)
              |> yield(name: "execution_counts")
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
                            "measurement": record.get_measurement(),
                        }
                    )

            if data:
                df = pd.DataFrame(data)
                output_file = (
                    f"{self.output_dir}/influxdb_execution_stats_{self.timestamp}.csv"
                )
                df.to_csv(output_file, index=False, encoding="utf-8")
                logger.info(
                    f"InfluxDB execution stats exported: {len(data)} records -> {output_file}"
                )
            else:
                logger.warning("No execution stats data found in InfluxDB")

        except Exception as e:
            logger.warning(f"Failed to export execution stats from InfluxDB: {e}")

    def _export_influxdb_time_series_aggregates(self):
        """時系列集計データのエクスポート"""
        try:
            # 10分間隔での活動集計
            query = f"""
            from(bucket: "{settings.INFLUXDB_BUCKET}")
              |> range(start: -24h)
              |> filter(fn: (r) => r["_measurement"] == "student_progress")
              |> aggregateWindow(every: 10m, fn: count)
              |> group(columns: ["event"])
              |> yield(name: "activity_by_event_type")
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
                            "window": "10m",
                        }
                    )

            if data:
                df = pd.DataFrame(data)
                output_file = (
                    f"{self.output_dir}/influxdb_time_series_{self.timestamp}.csv"
                )
                df.to_csv(output_file, index=False, encoding="utf-8")
                logger.info(
                    f"InfluxDB time series data exported: {len(data)} records -> {output_file}"
                )
            else:
                logger.warning("No time series data found in InfluxDB")

        except Exception as e:
            logger.warning(f"Failed to export time series data from InfluxDB: {e}")

    def export_summary_statistics(self):
        """統計サマリーCSV出力"""
        db = self.SessionLocal()
        try:
            # 基本統計
            stats = {}

            # 学生数
            stats["total_students"] = db.query(Student).count()

            # ノートブック数
            stats["total_notebooks"] = db.query(Notebook).count()

            # セル実行数
            stats["total_cell_executions"] = db.query(CellExecution).count()

            # エラー数
            stats["total_errors"] = (
                db.query(CellExecution).filter(CellExecution.has_error == True).count()
            )

            # セッション数
            stats["total_sessions"] = db.query(Session).count()

            # イベント種別統計
            event_type_stats = db.execute(
                text(
                    """
                SELECT
                    status as event_type,
                    COUNT(*) as count
                FROM cell_executions
                GROUP BY status
            """
                )
            ).fetchall()

            # 学生別統計
            student_stats = db.execute(
                text(
                    """
                SELECT
                    s.user_id,
                    s.name,
                    COUNT(ce.id) as total_executions,
                    SUM(CASE WHEN ce.status = 'error' THEN 1 ELSE 0 END) as error_count,
                    AVG(ce.duration) as avg_execution_time_ms
                FROM students s
                LEFT JOIN cell_executions ce ON s.id = ce.student_id
                GROUP BY s.id, s.user_id, s.name
                ORDER BY total_executions DESC
            """
                )
            ).fetchall()

            # 基本統計をCSV出力
            basic_stats_df = pd.DataFrame([stats])
            basic_stats_file = (
                f"{self.output_dir}/summary_statistics_{self.timestamp}.csv"
            )
            basic_stats_df.to_csv(basic_stats_file, index=False, encoding="utf-8")

            # 学生別統計をCSV出力
            student_stats_data = []
            for stat in student_stats:
                student_stats_data.append(
                    {
                        "user_id": stat.user_id,
                        "name": stat.name,
                        "total_executions": stat.total_executions,
                        "error_count": stat.error_count,
                        "avg_execution_time_ms": stat.avg_execution_time_ms,
                    }
                )

            student_stats_df = pd.DataFrame(student_stats_data)
            student_stats_file = (
                f"{self.output_dir}/student_statistics_{self.timestamp}.csv"
            )
            student_stats_df.to_csv(student_stats_file, index=False, encoding="utf-8")

            logger.info(f"Summary statistics exported:")
            logger.info(f"  Basic stats: {basic_stats_file}")
            logger.info(f"  Student stats: {student_stats_file}")
            logger.info(f"  Total students: {stats['total_students']}")
            logger.info(f"  Total executions: {stats['total_cell_executions']}")
            logger.info(f"  Total errors: {stats['total_errors']}")

        finally:
            db.close()

    def create_combined_export(self):
        """全データを統合したCSV出力"""
        db = self.SessionLocal()
        try:
            # 学生、ノートブック、セル実行を結合したクエリ
            combined_query = text(
                """
                SELECT
                    s.user_id,
                    s.name,
                    s.email,
                    n.path as notebook_path,
                    n.name as notebook_name,
                    c.cell_id,
                    c.position as cell_index,
                    c.cell_type,
                    c.content as code,
                    ce.execution_count,
                    ce.status,
                    ce.error_message,
                    ce.output as result,
                    ce.duration as execution_duration_ms,
                    ce.executed_at as event_time
                FROM students s
                JOIN cell_executions ce ON s.id = ce.student_id
                JOIN notebooks n ON ce.notebook_id = n.id
                JOIN cells c ON ce.cell_id = c.id
                ORDER BY s.user_id, n.path, ce.executed_at
            """
            )

            result = db.execute(combined_query)

            data = []
            for row in result:
                data.append(
                    {
                        "user_id": row.user_id,
                        "name": row.name,
                        "email": row.email,
                        "notebook_path": row.notebook_path,
                        "notebook_name": row.notebook_name,
                        "cell_id": row.cell_id,
                        "cell_index": row.cell_index,
                        "cell_type": row.cell_type,
                        "code": row.code,
                        "execution_count": row.execution_count,
                        "status": row.status,
                        "error_message": row.error_message,
                        "result": row.result,
                        "execution_duration_ms": row.execution_duration_ms,
                        "event_time": row.event_time,
                    }
                )

            df = pd.DataFrame(data)
            output_file = f"{self.output_dir}/combined_test_data_{self.timestamp}.csv"
            df.to_csv(output_file, index=False, encoding="utf-8")
            logger.info(f"Combined data exported: {len(data)} records -> {output_file}")

        finally:
            db.close()


def main():
    """メイン実行関数"""
    logger.info("=== 100人受講生テストデータCSV出力開始 ===")

    exporter = TestDataExporter()

    # 全データ出力
    exporter.export_all_data()

    # 統合データ出力
    exporter.create_combined_export()

    logger.info("=== CSV出力完了 ===")


if __name__ == "__main__":
    main()
