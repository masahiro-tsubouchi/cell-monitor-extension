#!/usr/bin/env python3
"""
JupyterLab Cell Monitor Extension - 受講生シミュレータ
10名の受講生が5チームに分かれてセル実行とヘルプ要請を行うシミュレーション
"""

import asyncio
import json
import time
import random
import aiohttp
import logging
from datetime import datetime
from typing import List, Dict
from dataclasses import dataclass
from pathlib import Path

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class Student:
    """受講生データクラス"""
    id: int
    email: str
    name: str
    team: str
    notebook_id: str = None
    session_id: str = None
    help_requested: bool = False
    cell_count: int = 0
    error_count: int = 0

class StudentSimulator:
    """受講生行動シミュレータ"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api/v1"
        self.students: List[Student] = []
        self.session = None
        self.test_start_time = None
        self.test_results = {
            "events_sent": 0,
            "errors_occurred": 0,
            "help_requests": 0,
            "students": {},
            "performance": {
                "avg_response_time": 0,
                "max_response_time": 0,
                "min_response_time": float('inf')
            }
        }
        
    def create_students(self) -> List[Student]:
        """10名の受講生を5チームに分けて作成"""
        teams = ["チームA", "チームB", "チームC", "チームD", "チームE"]
        students = []
        
        for i in range(1, 11):  # 001-010
            team_index = (i - 1) // 2  # 2名ずつチーム分け
            student = Student(
                id=i,
                email=f"student{i:03d}@example.com",
                name=f"テスト学生{i:03d}",
                team=teams[team_index],
                notebook_id=f"test_notebook_{i:03d}.ipynb",
                session_id=f"session_{i:03d}_{int(time.time())}"
            )
            students.append(student)
            
        self.students = students
        logger.info(f"✅ 受講生{len(students)}名を作成しました")
        
        # チーム構成表示
        for team in teams:
            team_members = [s.name for s in students if s.team == team]
            logger.info(f"📋 {team}: {', '.join(team_members)}")
            
        return students
    
    async def send_cell_event(self, student: Student, success: bool = True) -> float:
        """セル実行イベントを送信"""
        cell_id = f"cell_{student.cell_count + 1:03d}"
        execution_time = random.uniform(0.5, 3.0)
        
        event_data = {
            "eventType": "cell_executed" if success else "cell_error",
            "eventTime": datetime.now().isoformat(),
            "emailAddress": student.email,
            "userName": student.name,
            "teamName": student.team,
            "notebookPath": student.notebook_id,
            "sessionId": student.session_id,
            "cellId": cell_id,
            "cellType": "code",
            "executionCount": student.cell_count + 1,
            "executionDurationMs": execution_time * 1000,  # ミリ秒に変換
            "code": self._generate_code_content(success),
            "result": self._generate_output(success),
            "hasError": not success,
            "errorMessage": self._generate_output(success) if not success else None,
            "metadata": {
                "source": "test_simulator",
                "test_case": "case_1_10students_5teams"
            }
        }
        
        # デバッグ用: 最初のイベントのみ詳細ログ出力
        if student.cell_count == 0:
            logger.info(f"🔍 {student.name}: 送信データサンプル - {json.dumps(event_data, ensure_ascii=False, indent=2)[:300]}...")
        
        start_time = time.time()
        try:
            async with self.session.post(
                f"{self.api_url}/events", 
                json=[event_data],  # バッチ送信形式
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                response_time = time.time() - start_time
                
                if response.status in [200, 202]:  # 202 (Accepted) も成功として扱う
                    student.cell_count += 1
                    if not success:
                        student.error_count += 1
                    self.test_results["events_sent"] += 1
                    self._update_performance_metrics(response_time)
                    logger.debug(f"📤 {student.name}: セル実行イベント送信成功 (HTTP {response.status}, 応答時間: {response_time:.3f}s)")
                else:
                    # エラーレスポンスの詳細を取得
                    try:
                        error_text = await response.text()
                        logger.error(f"❌ {student.name}: セル実行イベント送信失敗 (HTTP {response.status})")
                        logger.error(f"   エラー詳細: {error_text[:200]}...")
                    except:
                        logger.error(f"❌ {student.name}: セル実行イベント送信失敗 (HTTP {response.status})")
                    self.test_results["errors_occurred"] += 1
                    
                return response_time
                
        except Exception as e:
            response_time = time.time() - start_time
            logger.error(f"❌ {student.name}: セル実行イベント送信エラー: {e}")
            self.test_results["errors_occurred"] += 1
            return response_time
    
    async def send_help_request(self, student: Student) -> bool:
        """ヘルプ要請イベントを送信"""
        event_data = {
            "eventType": "help",
            "eventTime": datetime.now().isoformat(),
            "emailAddress": student.email,
            "userName": student.name,
            "teamName": student.team,
            "notebookPath": student.notebook_id,
            "sessionId": student.session_id,
            "result": f"{student.name}がヘルプを要請しています",
            "metadata": {
                "source": "test_simulator",
                "help_reason": random.choice([
                    "エラーが解決できません", 
                    "コードの意味がわかりません", 
                    "実行結果が期待と違います"
                ])
            }
        }
        
        try:
            async with self.session.post(
                f"{self.api_url}/events",
                json=[event_data],
                timeout=aiohttp.ClientTimeout(total=5)
            ) as response:
                if response.status in [200, 202]:  # 202 (Accepted) も成功として扱う
                    student.help_requested = True
                    self.test_results["help_requests"] += 1
                    logger.debug(f"🆘 {student.name}: ヘルプ要請送信成功 (HTTP {response.status})")
                    return True
                else:
                    try:
                        error_text = await response.text()
                        logger.error(f"❌ {student.name}: ヘルプ要請送信失敗 (HTTP {response.status})")
                        logger.error(f"   エラー詳細: {error_text[:200]}...")
                    except:
                        logger.error(f"❌ {student.name}: ヘルプ要請送信失敗 (HTTP {response.status})")
                    return False
                    
        except Exception as e:
            logger.error(f"❌ {student.name}: ヘルプ要請送信エラー: {e}")
            return False
    
    async def send_help_stop(self, student: Student) -> bool:
        """ヘルプ要請停止イベントを送信"""
        if not student.help_requested:
            return True
            
        event_data = {
            "eventType": "help_stop",
            "eventTime": datetime.now().isoformat(),
            "emailAddress": student.email,
            "userName": student.name,
            "teamName": student.team,
            "notebookPath": student.notebook_id,
            "sessionId": student.session_id,
            "result": f"{student.name}のヘルプ要請を停止します",
            "metadata": {
                "source": "test_simulator",
                "help_resolved": True
            }
        }
        
        try:
            async with self.session.post(
                f"{self.api_url}/events",
                json=[event_data],
                timeout=aiohttp.ClientTimeout(total=5)
            ) as response:
                if response.status in [200, 202]:  # 202 (Accepted) も成功として扱う
                    student.help_requested = False
                    logger.debug(f"✅ {student.name}: ヘルプ要請停止送信成功 (HTTP {response.status})")
                    return True
                else:
                    try:
                        error_text = await response.text()
                        logger.error(f"❌ {student.name}: ヘルプ要請停止送信失敗 (HTTP {response.status})")
                        logger.error(f"   エラー詳細: {error_text[:200]}...")
                    except:
                        logger.error(f"❌ {student.name}: ヘルプ要請停止送信失敗 (HTTP {response.status})")
                    return False
                    
        except Exception as e:
            logger.error(f"❌ {student.name}: ヘルプ要請停止送信エラー: {e}")
            return False
    
    async def simulate_student_activity(self, student: Student, duration_minutes: int = 5):
        """個別受講生の活動シミュレーション"""
        logger.info(f"🎯 {student.name} ({student.team}) の活動開始")
        
        end_time = time.time() + (duration_minutes * 60)
        cell_interval = 15  # 15秒間隔
        help_interval = 60  # 60秒間隔
        
        last_cell_time = 0
        last_help_time = 0
        
        while time.time() < end_time:
            current_time = time.time()
            
            # セル実行 (15秒間隔)
            if current_time - last_cell_time >= cell_interval:
                # 3回に1回はエラー
                success = (student.cell_count + 1) % 3 != 0
                await self.send_cell_event(student, success)
                last_cell_time = current_time
                
            # ヘルプ要請 (60秒間隔)
            if current_time - last_help_time >= help_interval:
                if not student.help_requested:
                    await self.send_help_request(student)
                else:
                    await self.send_help_stop(student)
                last_help_time = current_time
                
            # 短い間隔で次のチェック
            await asyncio.sleep(1)
        
        # 最後にヘルプ要請が残っていれば停止
        if student.help_requested:
            await self.send_help_stop(student)
            
        # 活動統計を計算
        success_rate = ((student.cell_count - student.error_count) / max(student.cell_count, 1)) * 100
        logger.info(f"🏁 {student.name}: 活動終了 (セル実行: {student.cell_count}, エラー: {student.error_count}, 成功率: {success_rate:.1f}%)")
    
    async def run_simulation(self, duration_minutes: int = 5):
        """シミュレーション実行"""
        self.test_start_time = datetime.now()
        logger.info(f"🚀 テストシミュレーション開始 (実行時間: {duration_minutes}分)")
        
        # HTTPセッション作成
        connector = aiohttp.TCPConnector(limit=50, limit_per_host=30)
        self.session = aiohttp.ClientSession(connector=connector)
        
        try:
            # 受講生作成
            self.create_students()
            
            # 全受講生の活動を並列実行
            tasks = [
                self.simulate_student_activity(student, duration_minutes)
                for student in self.students
            ]
            
            await asyncio.gather(*tasks)
            
            # 結果集計
            self._compile_results()
            
        finally:
            await self.session.close()
            
        logger.info("✅ テストシミュレーション完了")
        return self.test_results
    
    def _generate_code_content(self, success: bool) -> str:
        """コード内容を生成"""
        if success:
            codes = [
                "print('Hello, World!')",
                "x = 10\ny = 20\nprint(x + y)",
                "import pandas as pd\ndf = pd.DataFrame({'A': [1, 2, 3]})\nprint(df)",
                "for i in range(5):\n    print(f'Number: {i}')",
                "def add(a, b):\n    return a + b\nresult = add(5, 3)\nprint(result)"
            ]
        else:
            codes = [
                "print(undefined_variable)",  # NameError
                "1 / 0",                      # ZeroDivisionError
                "import nonexistent_module",  # ImportError
                "[1, 2, 3][10]",             # IndexError
                "{'a': 1}['b']"              # KeyError
            ]
        return random.choice(codes)
    
    def _generate_output(self, success: bool) -> str:
        """出力内容を生成"""
        if success:
            return "実行成功"
        else:
            errors = [
                "NameError: name 'undefined_variable' is not defined",
                "ZeroDivisionError: division by zero",
                "ImportError: No module named 'nonexistent_module'",
                "IndexError: list index out of range",
                "KeyError: 'b'"
            ]
            return random.choice(errors)
    
    def _update_performance_metrics(self, response_time: float):
        """パフォーマンス指標を更新"""
        perf = self.test_results["performance"]
        perf["max_response_time"] = max(perf["max_response_time"], response_time)
        perf["min_response_time"] = min(perf["min_response_time"], response_time)
        
        # 移動平均で平均応答時間を計算
        current_avg = perf["avg_response_time"]
        total_events = self.test_results["events_sent"]
        perf["avg_response_time"] = (current_avg * (total_events - 1) + response_time) / total_events
    
    def _compile_results(self):
        """結果をコンパイル"""
        for student in self.students:
            self.test_results["students"][student.email] = {
                "name": student.name,
                "team": student.team,
                "cells_executed": student.cell_count,
                "errors_occurred": student.error_count,
                "help_requested": student.help_requested
            }
        
        # パフォーマンス指標の最終調整
        if self.test_results["performance"]["min_response_time"] == float('inf'):
            self.test_results["performance"]["min_response_time"] = 0
    
    def generate_report(self) -> str:
        """テスト結果レポートを生成"""
        results = self.test_results
        
        report = f"""
# 🧪 JupyterLab Cell Monitor Extension - 負荷テスト結果

## 📊 テスト概要
- **開始時刻**: {self.test_start_time.strftime('%Y-%m-%d %H:%M:%S')}
- **受講生数**: {len(self.students)}名
- **チーム数**: 5チーム

## 📈 実行結果
- **送信イベント数**: {results['events_sent']:,}
- **発生エラー数**: {results['errors_occurred']:,}
- **ヘルプ要請数**: {results['help_requests']:,}
- **成功率**: {((results['events_sent'] - results['errors_occurred']) / max(results['events_sent'], 1) * 100):.1f}%

## ⚡ パフォーマンス
- **平均応答時間**: {results['performance']['avg_response_time']:.3f}秒
- **最大応答時間**: {results['performance']['max_response_time']:.3f}秒
- **最小応答時間**: {results['performance']['min_response_time']:.3f}秒

## 👥 受講生別結果
"""
        
        for email, student_data in results['students'].items():
            report += f"- **{student_data['name']}** ({student_data['team']}): "
            report += f"セル実行 {student_data['cells_executed']}回, "
            report += f"エラー {student_data['errors_occurred']}回\n"
        
        return report

# CLI実行用
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="JupyterLab Cell Monitor Extension 負荷テスト")
    parser.add_argument("--url", default="http://localhost:8000", help="FastAPI サーバーURL")
    parser.add_argument("--duration", type=int, default=5, help="テスト実行時間（分）")
    parser.add_argument("--output", help="結果出力ファイル")
    
    args = parser.parse_args()
    
    async def main():
        simulator = StudentSimulator(args.url)
        results = await simulator.run_simulation(args.duration)
        
        # 結果出力
        report = simulator.generate_report()
        print(report)
        
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(report)
            print(f"\n📝 詳細結果を {args.output} に保存しました")
        
        # JSON形式でも保存
        json_output = args.output.replace('.md', '.json') if args.output else 'test_results.json'
        with open(json_output, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2, default=str)
        print(f"📊 JSON結果を {json_output} に保存しました")
    
    asyncio.run(main())