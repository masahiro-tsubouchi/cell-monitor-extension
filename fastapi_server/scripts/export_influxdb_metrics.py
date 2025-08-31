#!/usr/bin/env python3
"""
InfluxDBデータエクスポートスクリプト

使用例:
  # 過去30日のデータをエクスポート
  python scripts/export_influxdb_metrics.py --range 30d
  
  # 全期間データをエクスポート
  python scripts/export_influxdb_metrics.py --range all
  
  # 特定期間をエクスポート
  python scripts/export_influxdb_metrics.py --start 2025-01-01 --end 2025-02-01
  
  # 特定学生のデータをエクスポート
  python scripts/export_influxdb_metrics.py --student student@example.com --range 7d
  
  # 特定measurementのみエクスポート
  python scripts/export_influxdb_metrics.py --range 30d --measurement student_progress
  
  # 出力先ディレクトリ指定
  python scripts/export_influxdb_metrics.py --range 30d --output /path/to/exports
"""

import argparse
import logging
import sys
import csv
import os
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pathlib import Path

# FastAPIアプリケーションのパスを追加
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.config import settings

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

try:
    from influxdb_client import InfluxDBClient
    from influxdb_client.client.query_api import QueryApi
    INFLUXDB_AVAILABLE = True
except ImportError:
    logger.warning("InfluxDB client not available. Install with: pip install influxdb-client")
    INFLUXDB_AVAILABLE = False


class InfluxDBMetricsExporter:
    """InfluxDBメトリクスデータエクスポートクラス"""
    
    def __init__(self, output_dir: str = "./exports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        self.influx_client: Optional[InfluxDBClient] = None
        self.query_api: Optional[QueryApi] = None
        
        if not INFLUXDB_AVAILABLE:
            raise RuntimeError("InfluxDB client is not available")
        
        self._connect_to_influxdb()
    
    def _connect_to_influxdb(self):
        """InfluxDBに接続"""
        try:
            self.influx_client = InfluxDBClient(
                url=settings.DYNAMIC_INFLUXDB_URL,
                token=settings.INFLUXDB_TOKEN,
                org=settings.INFLUXDB_ORG
            )
            
            self.query_api = self.influx_client.query_api()
            
            # 接続テスト
            health = self.influx_client.health()
            if health.status == "pass":
                logger.info("✅ InfluxDB接続成功")
            else:
                raise RuntimeError(f"InfluxDB接続失敗: {health.message}")
                
        except Exception as e:
            logger.error(f"❌ InfluxDB接続エラー: {e}")
            raise
    
    def export_metrics(
        self,
        time_range: str = "30d",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        student_email: Optional[str] = None,
        measurement_filter: Optional[str] = None
    ) -> Dict[str, Any]:
        """メトリクスデータをCSVエクスポート"""
        
        # 時間範囲の設定
        if time_range == "all":
            start_time = "1970-01-01T00:00:00Z"
            end_time = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
            logger.info("📅 全期間のデータをエクスポートします")
        elif time_range.endswith('d'):
            days = int(time_range[:-1])
            start_time = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
            end_time = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ") 
            logger.info(f"📅 過去{days}日のデータをエクスポートします")
        elif start_date and end_date:
            start_time = datetime.fromisoformat(start_date).strftime("%Y-%m-%dT%H:%M:%SZ")
            end_time = datetime.fromisoformat(end_date).strftime("%Y-%m-%dT%H:%M:%SZ")
            logger.info(f"📅 {start_date} から {end_date} の期間データをエクスポートします")
        else:
            raise ValueError("--range または --start/--end を指定してください")
        
        # エクスポート対象measurement
        measurements = [
            "student_progress",
            "cell_execution_metrics",
            "performance_data", 
            "help_request_events"
        ]
        
        if measurement_filter:
            measurements = [m for m in measurements if measurement_filter in m]
            logger.info(f"🔍 フィルタリング: '{measurement_filter}' を含むmeasurementのみ")
        
        exported_files = []
        total_records = 0
        
        for measurement in measurements:
            try:
                # データエクスポート実行
                file_info = self._export_measurement_data(
                    measurement=measurement,
                    start_time=start_time,
                    end_time=end_time,
                    student_email=student_email
                )
                
                if file_info:
                    exported_files.append(file_info)
                    total_records += file_info['record_count']
                    
            except Exception as e:
                logger.error(f"❌ {measurement} エクスポートエラー: {e}")
        
        # サマリー
        result = {
            "export_completed": True,
            "time_range": {
                "start": start_time,
                "end": end_time
            },
            "student_filter": student_email,
            "measurement_filter": measurement_filter,
            "exported_files": exported_files,
            "total_records": total_records,
            "output_directory": str(self.output_dir),
            "exported_at": datetime.utcnow().isoformat()
        }
        
        logger.info(f"✅ エクスポート完了: {total_records:,} レコード、{len(exported_files)} ファイル")
        
        return result
    
    def _export_measurement_data(
        self,
        measurement: str,
        start_time: str,
        end_time: str,
        student_email: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """指定measurement のデータをCSVエクスポート"""
        
        # Fluxクエリ構築
        query = f'''
        from(bucket: "{settings.INFLUXDB_BUCKET}")
          |> range(start: {start_time}, stop: {end_time})
          |> filter(fn: (r) => r["_measurement"] == "{measurement}")
        '''
        
        if student_email:
            query += f'  |> filter(fn: (r) => r["emailAddress"] == "{student_email}")\n'
        
        query += '''
          |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
          |> sort(columns: ["_time"])
        '''
        
        try:
            # クエリ実行
            logger.info(f"🔍 {measurement} データ取得中...")
            result = self.query_api.query(query)
            
            # データ変換
            records = []
            for table in result:
                for record in table.records:
                    record_data = {
                        "time": record.get_time().isoformat() if record.get_time() else None,
                        "measurement": record.get_measurement(),
                    }
                    
                    # フィールドデータを追加
                    for key, value in record.values.items():
                        if not key.startswith('_') or key in ['_value', '_field']:
                            record_data[key] = value
                    
                    records.append(record_data)
            
            if not records:
                logger.info(f"ℹ️ {measurement}: データが見つかりません")
                return None
            
            # CSVファイル出力
            filename_parts = [f"influxdb_{measurement}"]
            if student_email:
                # メールアドレスの@をアンダースコアに置換
                safe_email = student_email.replace("@", "_").replace(".", "_")
                filename_parts.append(f"student_{safe_email}")
            filename_parts.append(self.timestamp)
            
            csv_filename = "_".join(filename_parts) + ".csv"
            csv_path = self.output_dir / csv_filename
            
            # CSV書き込み
            if records:
                # 全レコードから全フィールド名を収集
                all_fieldnames = set()
                for record in records:
                    all_fieldnames.update(record.keys())
                
                fieldnames = sorted(list(all_fieldnames))
                
                with open(csv_path, 'w', newline='', encoding='utf-8') as csvfile:
                    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                    writer.writeheader()
                    writer.writerows(records)
            
            file_size_mb = os.path.getsize(csv_path) / (1024 * 1024)
            logger.info(f"✅ {measurement}: {len(records):,} レコード → {csv_path} ({file_size_mb:.1f}MB)")
            
            return {
                "measurement": measurement,
                "filename": csv_filename,
                "file_path": str(csv_path),
                "record_count": len(records),
                "file_size_mb": round(file_size_mb, 1)
            }
            
        except Exception as e:
            logger.error(f"❌ {measurement} エクスポートエラー: {e}")
            return None
    
    def export_aggregated_summary(
        self,
        time_range: str = "30d"
    ) -> Optional[str]:
        """集約サマリーデータをエクスポート"""
        
        if time_range.endswith('d'):
            days = int(time_range[:-1])
            start_time = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
        else:
            start_time = "-30d"
        
        # 集約クエリ
        summary_query = f'''
        from(bucket: "{settings.INFLUXDB_BUCKET}")
          |> range(start: {start_time})
          |> group(columns: ["_measurement", "emailAddress"])
          |> aggregateWindow(every: 1d, fn: count, createEmpty: false)
          |> yield(name: "daily_counts")
        '''
        
        try:
            logger.info("📊 集約サマリーデータ取得中...")
            result = self.query_api.query(summary_query)
            
            records = []
            for table in result:
                for record in table.records:
                    records.append({
                        "date": record.get_time().strftime("%Y-%m-%d") if record.get_time() else None,
                        "measurement": record.get_measurement(),
                        "student_email": record.values.get("emailAddress", ""),
                        "daily_count": record.get_value()
                    })
            
            if records:
                csv_filename = f"influxdb_daily_summary_{self.timestamp}.csv"
                csv_path = self.output_dir / csv_filename
                
                fieldnames = ["date", "measurement", "student_email", "daily_count"]
                with open(csv_path, 'w', newline='', encoding='utf-8') as csvfile:
                    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                    writer.writeheader()
                    writer.writerows(records)
                
                file_size_mb = os.path.getsize(csv_path) / (1024 * 1024)
                logger.info(f"✅ 集約サマリー: {len(records):,} レコード → {csv_path} ({file_size_mb:.1f}MB)")
                
                return str(csv_path)
            else:
                logger.info("ℹ️ 集約サマリー: データが見つかりません")
                return None
                
        except Exception as e:
            logger.error(f"❌ 集約サマリーエクスポートエラー: {e}")
            return None
    
    def get_export_stats(self) -> Dict[str, Any]:
        """エクスポート可能データの統計を取得"""
        try:
            stats_query = f'''
            from(bucket: "{settings.INFLUXDB_BUCKET}")
              |> range(start: -30d)
              |> group(columns: ["_measurement"])
              |> count()
              |> yield(name: "measurement_counts")
            '''
            
            result = self.query_api.query(stats_query)
            
            measurement_stats = {}
            total_points = 0
            
            for table in result:
                for record in table.records:
                    measurement = record.values.get("_measurement")
                    count = record.get_value()
                    if measurement and count:
                        measurement_stats[measurement] = count
                        total_points += count
            
            # 最古・最新データの取得
            time_range_query = f'''
            from(bucket: "{settings.INFLUXDB_BUCKET}")
              |> range(start: -3650d)  // 10年前から検索
              |> first()
              |> keep(columns: ["_time"])
            '''
            
            oldest_time = None
            try:
                time_result = self.query_api.query(time_range_query)
                for table in time_result:
                    for record in table.records:
                        if record.get_time():
                            oldest_time = record.get_time().isoformat()
                            break
            except Exception:
                pass
            
            return {
                "bucket": settings.INFLUXDB_BUCKET,
                "measurements": measurement_stats,
                "total_points_30d": total_points,
                "oldest_data": oldest_time,
                "latest_check": datetime.utcnow().isoformat(),
                "exportable": total_points > 0
            }
            
        except Exception as e:
            logger.error(f"統計取得エラー: {e}")
            return {"error": str(e)}
    
    def close(self):
        """接続を閉じる"""
        if self.influx_client:
            self.influx_client.close()
            logger.info("InfluxDB接続を閉じました")


def parse_time_range(time_range: str) -> tuple:
    """時間範囲文字列を解析"""
    if time_range == "all":
        return "1970-01-01T00:00:00Z", datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    elif time_range.endswith('d'):
        days = int(time_range[:-1])
        start = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
        end = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        return start, end
    elif time_range.endswith('h'):
        hours = int(time_range[:-1])
        start = (datetime.utcnow() - timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%SZ")
        end = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        return start, end
    else:
        raise ValueError(f"無効な時間範囲形式: {time_range}. 例: 30d, 24h, all")


def main():
    parser = argparse.ArgumentParser(
        description="InfluxDBメトリクスデータエクスポートツール",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    # 時間範囲指定（方法1: 範囲指定）
    parser.add_argument(
        "--range",
        type=str,
        help="エクスポート範囲（例: 30d, 7d, 24h, all）"
    )
    
    # 時間範囲指定（方法2: 期間指定）
    parser.add_argument(
        "--start",
        type=str,
        help="開始日時（ISO形式: 2025-01-01T00:00:00）"
    )
    parser.add_argument(
        "--end",
        type=str,
        help="終了日時（ISO形式: 2025-02-01T00:00:00）"
    )
    
    # フィルタリング
    parser.add_argument(
        "--student",
        type=str,
        help="特定学生のデータのみエクスポート（メールアドレス指定）"
    )
    parser.add_argument(
        "--measurement",
        type=str,
        help="特定measurementのみエクスポート（部分マッチ）"
    )
    
    # 出力設定
    parser.add_argument(
        "--output",
        type=str,
        default="./exports",
        help="出力ディレクトリ（デフォルト: ./exports）"
    )
    
    # オプション
    parser.add_argument(
        "--stats",
        action="store_true",
        help="エクスポート可能データの統計のみ表示"
    )
    parser.add_argument(
        "--summary",
        action="store_true",
        help="日次集約サマリーも生成"
    )
    
    args = parser.parse_args()
    
    # 引数検証
    if not args.stats and not args.range and not (args.start and args.end):
        parser.error("--range または --start/--end または --stats を指定してください")
    
    if args.start and not args.end:
        parser.error("--start を指定した場合、--end も必要です")
    
    try:
        # エクスポーター初期化
        exporter = InfluxDBMetricsExporter(output_dir=args.output)
        
        if args.stats:
            # 統計情報のみ表示
            stats = exporter.get_export_stats()
            print("\n📊 InfluxDB エクスポート可能データ統計")
            print("=" * 60)
            print(f"バケット: {stats.get('bucket', 'N/A')}")
            print(f"総ポイント数（過去30日）: {stats.get('total_points_30d', 0):,}")
            print(f"最古データ: {stats.get('oldest_data', '不明')}")
            
            print("\n📋 Measurement別ポイント数（過去30日）:")
            for measurement, count in stats.get('measurements', {}).items():
                print(f"  • {measurement}: {count:,} ポイント")
            
            if stats.get('exportable', False):
                print("\n✅ エクスポート可能データが存在します")
            else:
                print("\n⚠️ エクスポート可能データが見つかりません")
                
        else:
            # データエクスポート実行
            result = exporter.export_metrics(
                time_range=args.range,
                start_date=args.start,
                end_date=args.end,
                student_email=args.student,
                measurement_filter=args.measurement
            )
            
            # 集約サマリー生成（オプション）
            summary_file = None
            if args.summary:
                summary_file = exporter.export_aggregated_summary(
                    time_range=args.range or "30d"
                )
            
            # 結果サマリー表示
            print(f"\n✅ InfluxDB エクスポート完了")
            print("=" * 60)
            print(f"期間: {result['time_range']['start']} ～ {result['time_range']['end']}")
            if result['student_filter']:
                print(f"学生フィルタ: {result['student_filter']}")
            if result['measurement_filter']:
                print(f"Measurementフィルタ: {result['measurement_filter']}")
            print(f"総レコード数: {result['total_records']:,}")
            print(f"出力ディレクトリ: {result['output_directory']}")
            
            print(f"\n📁 生成ファイル ({len(result['exported_files'])} ファイル):")
            for file_info in result['exported_files']:
                print(f"  • {file_info['filename']}")
                print(f"    └─ {file_info['record_count']:,} レコード ({file_info['file_size_mb']}MB)")
            
            if summary_file:
                print(f"\n📊 集約サマリー: {os.path.basename(summary_file)}")
        
        exporter.close()
        
    except Exception as e:
        logger.error(f"❌ スクリプト実行エラー: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()