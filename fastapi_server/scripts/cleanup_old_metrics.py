#!/usr/bin/env python3
"""
InfluxDB古いデータ削除スクリプト

使用例:
  # 90日以上前のデータを削除
  python scripts/cleanup_old_metrics.py --days 90
  
  # 特定期間のデータを削除
  python scripts/cleanup_old_metrics.py --start 2025-01-01 --end 2025-02-01
  
  # 特定学生のデータを削除
  python scripts/cleanup_old_metrics.py --student student@example.com --days 30
  
  # ドライランモード（削除せずに対象データのみ表示）
  python scripts/cleanup_old_metrics.py --days 90 --dry-run
"""

import argparse
import logging
import sys
from datetime import datetime, timedelta
from typing import Optional, List
import os

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
    from influxdb_client.client.delete_api import DeleteApi
    from influxdb_client.client.query_api import QueryApi
    INFLUXDB_AVAILABLE = True
except ImportError:
    logger.warning("InfluxDB client not available. Install with: pip install influxdb-client")
    INFLUXDB_AVAILABLE = False


class InfluxDBMetricsCleanup:
    """InfluxDB古いメトリクスデータクリーンアップクラス"""
    
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.influx_client: Optional[InfluxDBClient] = None
        self.delete_api: Optional[DeleteApi] = None
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
            
            # API クライアント初期化
            self.delete_api = self.influx_client.delete_api()
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
    
    def cleanup_old_data(
        self, 
        days: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        student_email: Optional[str] = None
    ) -> dict:
        """古いデータをクリーンアップ"""
        
        # 時間範囲の設定
        if days:
            start_time = datetime.utcnow() - timedelta(days=days)
            end_time = datetime.utcnow()
            logger.info(f"🗓️ {days}日以上前のデータを削除対象とします")
        elif start_date and end_date:
            start_time = datetime.fromisoformat(start_date)
            end_time = datetime.fromisoformat(end_date)
            logger.info(f"🗓️ {start_date} から {end_date} の期間データを削除対象とします")
        else:
            raise ValueError("--days または --start/--end を指定してください")
        
        # 削除対象データの確認
        deleted_measurements = []
        total_points_deleted = 0
        
        measurements = [
            "student_progress",
            "cell_execution_metrics", 
            "performance_data",
            "help_request_events"
        ]
        
        for measurement in measurements:
            try:
                # 削除対象データ数を確認
                count_query = self._build_count_query(
                    measurement, start_time, end_time, student_email
                )
                
                count_result = self.query_api.query(count_query)
                point_count = 0
                
                for table in count_result:
                    for record in table.records:
                        if record.get_value() is not None:
                            point_count += int(record.get_value())
                
                if point_count > 0:
                    logger.info(f"📊 {measurement}: {point_count:,} ポイント削除対象")
                    
                    if not self.dry_run:
                        # 実際の削除実行
                        predicate = self._build_delete_predicate(
                            measurement, start_time, end_time, student_email
                        )
                        
                        self.delete_api.delete(
                            start=start_time,
                            stop=end_time,
                            predicate=predicate,
                            bucket=settings.INFLUXDB_BUCKET
                        )
                        
                        logger.info(f"✅ {measurement}: {point_count:,} ポイント削除完了")
                    else:
                        logger.info(f"🔍 [DRY RUN] {measurement}: {point_count:,} ポイントが削除されます")
                    
                    deleted_measurements.append({
                        "measurement": measurement,
                        "points_deleted": point_count
                    })
                    total_points_deleted += point_count
                else:
                    logger.info(f"ℹ️ {measurement}: 削除対象データなし")
                    
            except Exception as e:
                logger.error(f"❌ {measurement} の処理エラー: {e}")
        
        # サマリー
        result = {
            "operation": "dry_run" if self.dry_run else "delete",
            "time_range": {
                "start": start_time.isoformat(),
                "end": end_time.isoformat()
            },
            "student_filter": student_email,
            "measurements_processed": deleted_measurements,
            "total_points_deleted": total_points_deleted,
            "executed_at": datetime.utcnow().isoformat()
        }
        
        if self.dry_run:
            logger.info(f"🔍 [DRY RUN完了] 削除対象: {total_points_deleted:,} ポイント")
        else:
            logger.info(f"✅ [削除完了] {total_points_deleted:,} ポイント削除")
        
        return result
    
    def _build_count_query(
        self, 
        measurement: str, 
        start_time: datetime, 
        end_time: datetime,
        student_email: Optional[str] = None
    ) -> str:
        """カウントクエリを構築"""
        query = f'''
        from(bucket: "{settings.INFLUXDB_BUCKET}")
          |> range(start: {start_time.strftime("%Y-%m-%dT%H:%M:%SZ")}, 
                   stop: {end_time.strftime("%Y-%m-%dT%H:%M:%SZ")})
          |> filter(fn: (r) => r["_measurement"] == "{measurement}")
        '''
        
        if student_email:
            query += f'  |> filter(fn: (r) => r["emailAddress"] == "{student_email}")\n'
        
        query += '  |> count()\n'
        
        return query
    
    def _build_delete_predicate(
        self, 
        measurement: str,
        start_time: datetime,
        end_time: datetime, 
        student_email: Optional[str] = None
    ) -> str:
        """削除条件を構築"""
        predicate = f'_measurement="{measurement}"'
        
        if student_email:
            predicate += f' AND emailAddress="{student_email}"'
        
        return predicate
    
    def get_storage_stats(self) -> dict:
        """ストレージ使用量統計を取得"""
        try:
            # バケット使用量クエリ
            usage_query = f'''
            from(bucket: "{settings.INFLUXDB_BUCKET}")
              |> range(start: -30d)
              |> group(columns: ["_measurement"])
              |> count()
            '''
            
            result = self.query_api.query(usage_query)
            
            usage_stats = {}
            for table in result:
                for record in table.records:
                    measurement = record.values.get("_measurement")
                    count = record.get_value()
                    if measurement and count:
                        usage_stats[measurement] = count
            
            total_points = sum(usage_stats.values())
            
            return {
                "bucket": settings.INFLUXDB_BUCKET,
                "total_points_30d": total_points,
                "measurements": usage_stats,
                "generated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"ストレージ統計取得エラー: {e}")
            return {"error": str(e)}
    
    def close(self):
        """接続を閉じる"""
        if self.influx_client:
            self.influx_client.close()
            logger.info("InfluxDB接続を閉じました")


def main():
    parser = argparse.ArgumentParser(
        description="InfluxDB古いメトリクスデータクリーンアップツール",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    # 時間範囲指定（方法1: 日数指定）
    parser.add_argument(
        "--days", 
        type=int,
        help="指定した日数以上前のデータを削除（例: --days 90）"
    )
    
    # 時間範囲指定（方法2: 期間指定）
    parser.add_argument(
        "--start",
        type=str,
        help="削除開始日時（ISO形式: 2025-01-01T00:00:00）"
    )
    parser.add_argument(
        "--end", 
        type=str,
        help="削除終了日時（ISO形式: 2025-02-01T00:00:00）"
    )
    
    # フィルタリング
    parser.add_argument(
        "--student",
        type=str,
        help="特定学生のデータのみ削除（メールアドレス指定）"
    )
    
    # 実行モード
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="実際には削除せず、削除対象データのみ表示"
    )
    
    # 統計表示
    parser.add_argument(
        "--stats",
        action="store_true", 
        help="ストレージ使用量統計のみ表示"
    )
    
    args = parser.parse_args()
    
    # 引数検証
    if not args.stats and not args.days and not (args.start and args.end):
        parser.error("--days または --start/--end または --stats を指定してください")
    
    if args.start and not args.end:
        parser.error("--start を指定した場合、--end も必要です")
    
    try:
        # クリーンアップ実行
        cleanup = InfluxDBMetricsCleanup(dry_run=args.dry_run)
        
        if args.stats:
            # 統計情報のみ表示
            stats = cleanup.get_storage_stats()
            print("\n📊 InfluxDB ストレージ使用量統計 (過去30日)")
            print("=" * 50)
            print(f"バケット: {stats.get('bucket', 'N/A')}")
            print(f"総ポイント数: {stats.get('total_points_30d', 0):,}")
            print("\n📋 Measurement別ポイント数:")
            
            for measurement, count in stats.get('measurements', {}).items():
                print(f"  • {measurement}: {count:,} ポイント")
            
            print(f"\n生成時刻: {stats.get('generated_at', 'N/A')}")
        else:
            # データクリーンアップ実行
            result = cleanup.cleanup_old_data(
                days=args.days,
                start_date=args.start,
                end_date=args.end,
                student_email=args.student
            )
            
            # 結果サマリー表示
            print(f"\n{'🔍 [DRY RUN] ' if args.dry_run else '✅ '}クリーンアップ結果")
            print("=" * 50)
            print(f"操作タイプ: {'ドライラン' if args.dry_run else '実削除'}")
            print(f"期間: {result['time_range']['start']} ～ {result['time_range']['end']}")
            if result['student_filter']:
                print(f"学生フィルタ: {result['student_filter']}")
            print(f"{'削除対象' if args.dry_run else '削除済み'}ポイント数: {result['total_points_deleted']:,}")
            
            print("\n📋 Measurement別詳細:")
            for item in result['measurements_processed']:
                status = "削除対象" if args.dry_run else "削除完了"
                print(f"  • {item['measurement']}: {item['points_deleted']:,} ポイント ({status})")
        
        cleanup.close()
        
    except Exception as e:
        logger.error(f"❌ スクリプト実行エラー: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()