#!/usr/bin/env python3
"""
JupyterLab Cell Monitor Extension - 環境変数対応負荷テストシミュレータ
.envファイルの設定に基づいて受講生数やテスト条件を動的に変更可能

テスト構成（.env設定可能）:
- 受講生数: LOAD_TEST_STUDENT_COUNT (デフォルト: 100名)
- チームサイズ: LOAD_TEST_TEAM_SIZE (デフォルト: 5名)
- 実行時間: LOAD_TEST_DURATION_MINUTES (デフォルト: 10分)
- 講師数: LOAD_TEST_INSTRUCTOR_COUNT (デフォルト: 5名)
"""

import asyncio
import json
import time
import random
import aiohttp
import logging
import psutil
import os
from datetime import datetime
from typing import List, Dict, Optional
from dataclasses import dataclass, field
from pathlib import Path

# .envファイル読み込み
from dotenv import load_dotenv
load_dotenv()

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 環境変数から設定を取得
class LoadTestConfig:
    """負荷テスト設定クラス"""
    
    def __init__(self):
        self.student_count = int(os.getenv('LOAD_TEST_STUDENT_COUNT', '100'))
        self.team_size = int(os.getenv('LOAD_TEST_TEAM_SIZE', '5'))
        self.duration_minutes = int(os.getenv('LOAD_TEST_DURATION_MINUTES', '10'))
        self.instructor_count = int(os.getenv('LOAD_TEST_INSTRUCTOR_COUNT', '5'))
        self.cell_interval_min = int(os.getenv('LOAD_TEST_CELL_INTERVAL_MIN', '12'))
        self.cell_interval_max = int(os.getenv('LOAD_TEST_CELL_INTERVAL_MAX', '18'))
        self.help_interval_min = int(os.getenv('LOAD_TEST_HELP_INTERVAL_MIN', '90'))
        self.help_interval_max = int(os.getenv('LOAD_TEST_HELP_INTERVAL_MAX', '150'))
        self.batch_size = int(os.getenv('LOAD_TEST_BATCH_SIZE', '20'))
        self.gradual_mode = os.getenv('LOAD_TEST_GRADUAL_MODE', 'true').lower() == 'true'
        
        # 自動計算値
        self.team_count = max(1, self.student_count // self.team_size)
        self.expected_events_per_second = self.student_count * (60 / self.cell_interval_min) 
        
    def log_config(self):
        """設定内容をログ出力"""
        logger.info(f"🔧 負荷テスト設定 (.env):")
        logger.info(f"   受講生数: {self.student_count}名")
        logger.info(f"   チーム数: {self.team_count}チーム (サイズ: {self.team_size}名)")
        logger.info(f"   実行時間: {self.duration_minutes}分")
        logger.info(f"   講師数: {self.instructor_count}名")
        logger.info(f"   セル間隔: {self.cell_interval_min}-{self.cell_interval_max}秒")
        logger.info(f"   ヘルプ間隔: {self.help_interval_min}-{self.help_interval_max}秒")
        logger.info(f"   段階的負荷: {'有効' if self.gradual_mode else '無効'}")
        logger.info(f"   予想負荷: ~{self.expected_events_per_second:.0f}イベント/秒")

# グローバル設定インスタンス
config = LoadTestConfig()

@dataclass
class Student:
    """拡張受講生データクラス"""
    id: int
    email: str
    name: str
    team: str
    team_id: int
    notebook_id: str = None
    session_id: str = None
    help_requested: bool = False
    cell_count: int = 0
    error_count: int = 0
    last_activity: float = 0
    total_response_time: float = 0
    response_count: int = 0

@dataclass
class PerformanceMetrics:
    """パフォーマンス計測データ"""
    start_time: float = field(default_factory=time.time)
    events_sent: int = 0
    events_successful: int = 0
    events_failed: int = 0
    help_requests: int = 0
    avg_response_time: float = 0
    max_response_time: float = 0
    min_response_time: float = float('inf')
    system_metrics: Dict = field(default_factory=dict)
    redis_metrics: Dict = field(default_factory=dict)
    error_details: List = field(default_factory=list)

class EnhancedLoadTestSimulator:
    """環境変数対応拡張負荷テストシミュレータ"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api/v1"
        self.students: List[Student] = []
        self.instructors: List[Dict] = []
        self.session = None
        self.performance = PerformanceMetrics()
        self.monitoring_data = {
            "timeline": [],
            "system_resources": [],
            "redis_connections": [],
            "response_times": []
        }
        
    def create_students(self) -> List[Student]:
        """環境変数に基づいて受講生を作成"""
        # チーム名生成（A, B, C... またはチーム1, チーム2...）
        if config.team_count <= 26:
            teams = [f"チーム{chr(65+i)}" for i in range(config.team_count)]  # チームA～Z
        else:
            teams = [f"チーム{i+1:02d}" for i in range(config.team_count)]  # チーム01～
        
        students = []
        
        for i in range(1, config.student_count + 1):
            team_index = (i - 1) // config.team_size
            # チーム数を超えた場合は最後のチームに追加
            team_index = min(team_index, len(teams) - 1)
            
            student = Student(
                id=i,
                email=f"student{i:03d}@university.edu",
                name=f"学生{i:03d}",
                team=teams[team_index],
                team_id=team_index + 1,
                notebook_id=f"lecture_notebook_{i:03d}.ipynb",
                session_id=f"session_{i:03d}_{int(time.time())}"
            )
            students.append(student)
            
        self.students = students
        logger.info(f"✅ 受講生{len(students)}名を{len(teams)}チームに作成")
        
        # チーム構成表示（最初の5チームのみ）
        display_teams = min(5, len(teams))
        for i, team in enumerate(teams[:display_teams]):
            team_members = [s.name for s in students if s.team == team]
            logger.info(f"📋 {team}: {', '.join(team_members)}")
        if len(teams) > display_teams:
            logger.info(f"   ... 他{len(teams)-display_teams}チーム")
            
        return students
    
    def create_instructors(self) -> List[Dict]:
        """環境変数に基づいて講師アカウント作成"""
        instructors = []
        for i in range(1, config.instructor_count + 1):
            instructor = {
                "id": i,
                "email": f"instructor{i:02d}@university.edu", 
                "name": f"講師{i:02d}",
                "dashboard_id": f"dashboard_{i:02d}_{int(time.time())}"
            }
            instructors.append(instructor)
            
        self.instructors = instructors
        logger.info(f"✅ 講師{len(instructors)}名のダッシュボードアカウント作成")
        return instructors
    
    async def send_enhanced_cell_event(self, student: Student, success: bool = True) -> float:
        """JupyterLab実仕様対応セル実行イベント送信"""
        cell_id = f"cell_{student.cell_count + 1:03d}"
        execution_time = random.uniform(0.2, 4.0)  # より現実的な実行時間
        
        # JupyterLab Extension の正式イベントタイプ
        # 成功/失敗関係なく 'cell_executed' のみ（hasErrorで判定）
        event_data = {
            "eventId": f"cell_{student.id}_{int(time.time())}_{student.cell_count}",  # JupyterLab仕様
            "eventType": "cell_executed",  # JupyterLab仕様に統一
            "eventTime": datetime.now().isoformat(),
            "emailAddress": student.email,
            "userName": student.name,
            "teamName": student.team,
            "teamId": student.team_id,
            "notebookPath": student.notebook_id,
            "sessionId": student.session_id,
            "cellId": cell_id,
            "cellIndex": student.cell_count,  # JupyterLab仕様
            "cellType": "code",  # JupyterLabでは主にcode
            "code": self._generate_realistic_code(success),
            "executionCount": student.cell_count + 1,
            "executionDurationMs": int(execution_time * 1000),
            "hasError": not success,  # JupyterLab仕様のエラー判定
            "errorMessage": self._generate_realistic_output(success) if not success else None,
            "result": self._generate_realistic_output(success),
            "metadata": {
                "source": "enhanced_100_student_simulator",
                "test_phase": "production_readiness_test",
                "cpu_load": psutil.cpu_percent(),
                "memory_usage": psutil.virtual_memory().percent
            }
        }
        
        start_time = time.time()
        try:
            async with self.session.post(
                f"{self.api_url}/events",
                json=[event_data],
                timeout=aiohttp.ClientTimeout(total=15)
            ) as response:
                response_time = time.time() - start_time
                
                if response.status in [200, 202]:
                    student.cell_count += 1
                    student.total_response_time += response_time
                    student.response_count += 1
                    student.last_activity = time.time()
                    
                    if not success:
                        student.error_count += 1
                    
                    self.performance.events_sent += 1
                    self.performance.events_successful += 1
                    self._update_performance_metrics(response_time)
                    
                    logger.debug(f"📤 {student.name}: セル実行成功 (HTTP {response.status}, {response_time:.3f}s)")
                else:
                    error_text = await response.text()
                    self.performance.events_failed += 1
                    self.performance.error_details.append({
                        "student": student.name,
                        "status": response.status,
                        "error": error_text[:200],
                        "timestamp": datetime.now().isoformat()
                    })
                    logger.error(f"❌ {student.name}: セル実行失敗 (HTTP {response.status})")
                    
                return response_time
                
        except Exception as e:
            response_time = time.time() - start_time
            self.performance.events_failed += 1
            self.performance.error_details.append({
                "student": student.name,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            })
            logger.error(f"❌ {student.name}: セル実行エラー: {e}")
            return response_time
    
    async def send_batch_events(self, students: List[Student], batch_size: int = 20) -> Dict:
        """バッチイベント送信（システム負荷軽減）"""
        batch_events = []
        
        for student in students[:batch_size]:
            success = (student.cell_count + 1) % 3 != 0
            cell_id = f"cell_{student.cell_count + 1:03d}"
            
            event_data = {
                "eventId": f"batch_{student.id}_{int(time.time())}_{student.cell_count}",  # JupyterLab仕様
                "eventType": "cell_executed",  # JupyterLab仕様統一
                "eventTime": datetime.now().isoformat(),
                "emailAddress": student.email,
                "userName": student.name,
                "teamName": student.team,
                "teamId": student.team_id,
                "notebookPath": student.notebook_id,
                "sessionId": student.session_id,
                "cellId": cell_id,
                "cellIndex": student.cell_count,  # JupyterLab仕様
                "cellType": "code",
                "code": self._generate_realistic_code(success),
                "executionCount": student.cell_count + 1,
                "executionDurationMs": int(random.uniform(200, 4000)),
                "hasError": not success,  # JupyterLab仕様
                "errorMessage": self._generate_realistic_output(success) if not success else None,
                "result": self._generate_realistic_output(success),
                "metadata": {
                    "source": "batch_simulator",
                    "batch_size": batch_size
                }
            }
            batch_events.append(event_data)
        
        start_time = time.time()
        try:
            async with self.session.post(
                f"{self.api_url}/events",
                json=batch_events,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                response_time = time.time() - start_time
                
                if response.status in [200, 202]:
                    # バッチ成功時の統計更新
                    for student in students[:batch_size]:
                        student.cell_count += 1
                        if (student.cell_count) % 3 == 0:
                            student.error_count += 1
                    
                    self.performance.events_sent += len(batch_events)
                    self.performance.events_successful += len(batch_events)
                    logger.info(f"📦 バッチ送信成功: {len(batch_events)}イベント ({response_time:.3f}s)")
                else:
                    error_text = await response.text()
                    self.performance.events_failed += len(batch_events)
                    logger.error(f"❌ バッチ送信失敗: HTTP {response.status}")
                
                return {
                    "success": response.status in [200, 202],
                    "response_time": response_time,
                    "batch_size": len(batch_events)
                }
                
        except Exception as e:
            self.performance.events_failed += len(batch_events)
            logger.error(f"❌ バッチ送信エラー: {e}")
            return {"success": False, "error": str(e)}
    
    async def monitor_system_resources(self):
        """システムリソース監視（別タスク）"""
        while True:
            try:
                # システムメトリクス取得
                system_data = {
                    "timestamp": time.time(),
                    "cpu_percent": psutil.cpu_percent(interval=1),
                    "memory_percent": psutil.virtual_memory().percent,
                    "disk_io": psutil.disk_io_counters()._asdict() if psutil.disk_io_counters() else {},
                    "network_io": psutil.net_io_counters()._asdict()
                }
                
                # Redis接続情報取得
                try:
                    async with self.session.get(
                        f"{self.api_url}/health/redis",
                        timeout=aiohttp.ClientTimeout(total=5)
                    ) as response:
                        if response.status == 200:
                            redis_data = await response.json()
                            system_data["redis_connections"] = redis_data.get("redis_info", {}).get("connected_clients", 0)
                            system_data["redis_pool_used"] = redis_data.get("pool_info", {}).get("created_connections", 0)
                except:
                    system_data["redis_connections"] = -1
                
                self.monitoring_data["system_resources"].append(system_data)
                
                # メモリ使用量が80%超えたら警告
                if system_data["memory_percent"] > 80:
                    logger.warning(f"🚨 高メモリ使用率: {system_data['memory_percent']:.1f}%")
                
                await asyncio.sleep(5)  # 5秒間隔で監視
                
            except Exception as e:
                logger.error(f"システム監視エラー: {e}")
                await asyncio.sleep(10)
    
    async def simulate_enhanced_student_activity(self, student: Student, duration_minutes: int = None):
        """拡張受講生活動シミュレーション"""
        if duration_minutes is None:
            duration_minutes = config.duration_minutes
            
        end_time = time.time() + (duration_minutes * 60)
        
        # JupyterLab実仕様: 学習開始時にノートブック開封イベント
        await self.send_notebook_event(student, "notebook_opened")
        
        # 環境変数から間隔設定
        base_cell_interval = random.uniform(config.cell_interval_min, config.cell_interval_max)
        base_help_interval = random.uniform(config.help_interval_min, config.help_interval_max)
        
        last_cell_time = 0
        last_help_time = 0
        last_save_time = 0
        save_interval = random.uniform(120, 300)  # 2-5分間隔で保存
        burst_mode = False
        burst_end_time = 0
        
        while time.time() < end_time:
            current_time = time.time()
            
            # ランダムにバーストモード（集中作業）
            if not burst_mode and random.random() < 0.05:  # 5%の確率
                burst_mode = True
                burst_end_time = current_time + random.uniform(30, 120)
                logger.debug(f"🔥 {student.name}: バーストモード開始")
            
            if burst_mode and current_time > burst_end_time:
                burst_mode = False
                logger.debug(f"😌 {student.name}: バーストモード終了")
            
            # セル実行間隔（バーストモード時は短縮）
            cell_interval = base_cell_interval * (0.3 if burst_mode else 1.0)
            
            # セル実行
            if current_time - last_cell_time >= cell_interval:
                # 時間帯による成功率変動
                hour = datetime.now().hour
                if 14 <= hour <= 16:  # 午後の集中時間
                    success_rate = 0.8
                else:
                    success_rate = 0.67  # 通常時
                
                success = random.random() < success_rate
                await self.send_enhanced_cell_event(student, success)
                last_cell_time = current_time
                
            # ヘルプ要請
            if current_time - last_help_time >= base_help_interval:
                if not student.help_requested and random.random() < 0.7:
                    await self.send_help_request(student)
                elif student.help_requested:
                    await self.send_help_stop(student)
                last_help_time = current_time
            
            # JupyterLab実仕様: 定期的なノートブック保存
            if current_time - last_save_time >= save_interval:
                await self.send_notebook_event(student, "notebook_saved")
                last_save_time = current_time
                save_interval = random.uniform(120, 300)  # 次回保存間隔をランダム化
                
            # 動的待機時間
            await asyncio.sleep(random.uniform(0.5, 2.0))
        
        # 活動終了処理
        if student.help_requested:
            await self.send_help_stop(student)
            
        # JupyterLab実仕様: 学習終了時にノートブック終了イベント
        await self.send_notebook_event(student, "notebook_closed")
            
        avg_response = student.total_response_time / max(student.response_count, 1)
        success_rate = ((student.cell_count - student.error_count) / max(student.cell_count, 1)) * 100
        logger.info(f"🏁 {student.name}: 活動終了 (セル: {student.cell_count}, エラー: {student.error_count}, "
                   f"成功率: {success_rate:.1f}%, 平均応答: {avg_response:.3f}s)")
    
    async def send_help_request(self, student: Student) -> bool:
        """JupyterLab実仕様ヘルプ要請送信"""
        event_data = {
            "eventId": f"help_{student.id}_{int(time.time())}",  # JupyterLab仕様
            "eventType": "help",
            "eventTime": datetime.now().isoformat(),
            "emailAddress": student.email,
            "userName": student.name,
            "teamName": student.team,
            "sessionId": student.session_id,
            "notebookPath": student.notebook_id,
            # JupyterLab仕様では result は使わない
            "metadata": {
                "source": "jupyterlab_extension_simulator",
                "help_reason": random.choice([
                    "エラーが解決できません",
                    "実行が遅すぎます", 
                    "期待した結果になりません",
                    "メモリエラーが発生します"
                ])
            }
        }
        
        try:
            async with self.session.post(
                f"{self.api_url}/events",
                json=[event_data],
                timeout=aiohttp.ClientTimeout(total=5)
            ) as response:
                if response.status in [200, 202]:
                    student.help_requested = True
                    self.performance.help_requests += 1
                    logger.debug(f"🆘 {student.name}: ヘルプ要請送信成功")
                    return True
                else:
                    logger.error(f"❌ {student.name}: ヘルプ要請失敗 (HTTP {response.status})")
                    return False
        except Exception as e:
            logger.error(f"❌ {student.name}: ヘルプ要請エラー: {e}")
            return False
    
    async def send_help_stop(self, student: Student) -> bool:
        """JupyterLab実仕様ヘルプ要請停止送信"""
        if not student.help_requested:
            return True
            
        event_data = {
            "eventId": f"help_stop_{student.id}_{int(time.time())}",  # JupyterLab仕様
            "eventType": "help_stop",
            "eventTime": datetime.now().isoformat(),
            "emailAddress": student.email,
            "userName": student.name,
            "teamName": student.team,
            "sessionId": student.session_id,
            "notebookPath": student.notebook_id,
            # JupyterLab仕様では result は使わない
            "metadata": {
                "source": "jupyterlab_extension_simulator",
                "help_resolved": True
            }
        }
        
        try:
            async with self.session.post(
                f"{self.api_url}/events",
                json=[event_data],
                timeout=aiohttp.ClientTimeout(total=5)
            ) as response:
                if response.status in [200, 202]:
                    student.help_requested = False
                    logger.debug(f"✅ {student.name}: ヘルプ要請停止成功")
                    return True
                else:
                    logger.error(f"❌ {student.name}: ヘルプ要請停止失敗 (HTTP {response.status})")
                    return False
        except Exception as e:
            logger.error(f"❌ {student.name}: ヘルプ要請停止エラー: {e}")
            return False

    async def send_notebook_event(self, student: Student, event_type: str) -> bool:
        """JupyterLab実仕様ノートブックイベント送信"""
        event_data = {
            "eventId": f"notebook_{event_type}_{student.id}_{int(time.time())}",
            "eventType": event_type,  # notebook_opened, notebook_saved, notebook_closed
            "eventTime": datetime.now().isoformat(),
            "emailAddress": student.email,
            "userName": student.name,
            "teamName": student.team,
            "sessionId": student.session_id,
            "notebookPath": student.notebook_id,
            "metadata": {
                "source": "jupyterlab_extension_simulator"
            }
        }
        
        try:
            async with self.session.post(
                f"{self.api_url}/events",
                json=[event_data],
                timeout=aiohttp.ClientTimeout(total=5)
            ) as response:
                if response.status in [200, 202]:
                    logger.debug(f"📓 {student.name}: ノートブック{event_type}送信成功")
                    return True
                else:
                    logger.error(f"❌ {student.name}: ノートブック{event_type}送信失敗 (HTTP {response.status})")
                    return False
        except Exception as e:
            logger.error(f"❌ {student.name}: ノートブック{event_type}送信エラー: {e}")
            return False
    
    async def run_enhanced_load_test(self, duration_minutes: int = None):
        """環境変数対応拡張負荷テスト実行"""
        if duration_minutes is None:
            duration_minutes = config.duration_minutes
            
        self.performance.start_time = time.time()
        
        # 設定内容をログ出力
        config.log_config()
        logger.info(f"🚀 拡張負荷テスト開始 (実行時間: {duration_minutes}分)")
        
        # HTTPセッション作成（受講生数に応じた最適化設定）
        connector = aiohttp.TCPConnector(
            limit=config.student_count + config.instructor_count + 50,  # 動的 + バッファ
            limit_per_host=max(100, config.student_count + 20),
            ttl_dns_cache=300,
            use_dns_cache=True,
            keepalive_timeout=30
        )
        self.session = aiohttp.ClientSession(connector=connector)
        
        try:
            # 受講生・講師作成
            self.create_students()
            self.create_instructors()
            
            # システム監視開始
            monitor_task = asyncio.create_task(self.monitor_system_resources())
            
            if config.gradual_mode and config.student_count >= 50:
                # 段階的負荷増加（本番環境シミュレート）
                logger.info("📈 段階的負荷増加モード")
                
                # Phase 1: 25%でウォームアップ
                phase1_count = max(10, config.student_count // 4)
                phase1_duration = max(2, duration_minutes // 3)
                logger.info(f"🔥 Phase 1: {phase1_count}名ウォームアップ ({phase1_duration}分)")
                phase1_tasks = [
                    self.simulate_enhanced_student_activity(student, phase1_duration)
                    for student in self.students[:phase1_count]
                ]
                await asyncio.gather(*phase1_tasks)
                
                # Phase 2: 50%で中負荷
                phase2_count = max(phase1_count, config.student_count // 2)
                phase2_duration = max(2, duration_minutes // 3)
                logger.info(f"🔥 Phase 2: {phase2_count}名中負荷テスト ({phase2_duration}分)")
                phase2_tasks = [
                    self.simulate_enhanced_student_activity(student, phase2_duration)
                    for student in self.students[:phase2_count]
                ]
                await asyncio.gather(*phase2_tasks)
                
                # Phase 3: 100%フル負荷
                phase3_duration = duration_minutes - phase1_duration - phase2_duration
                logger.info(f"🔥 Phase 3: {config.student_count}名フル負荷テスト ({phase3_duration}分)")
                phase3_tasks = [
                    self.simulate_enhanced_student_activity(student, phase3_duration)
                    for student in self.students
                ]
                await asyncio.gather(*phase3_tasks)
            else:
                # 一括実行モード
                logger.info(f"🔥 一括実行モード: {config.student_count}名 ({duration_minutes}分)")
                all_tasks = [
                    self.simulate_enhanced_student_activity(student, duration_minutes)
                    for student in self.students
                ]
                await asyncio.gather(*all_tasks)
            
            # 監視停止
            monitor_task.cancel()
            
            # 最終結果集計
            self._compile_enhanced_results()
            
        finally:
            await self.session.close()
            
        logger.info(f"✅ {config.student_count}名拡張負荷テスト完了")
        return self._generate_comprehensive_report()
    
    def _generate_realistic_code(self, success: bool) -> str:
        """現実的なコード生成"""
        if success:
            codes = [
                "import pandas as pd\ndf = pd.read_csv('data.csv')\nprint(df.head())",
                "import numpy as np\ndata = np.random.randn(1000)\nresult = np.mean(data)",
                "from sklearn.model_selection import train_test_split\nX_train, X_test = train_test_split(X, test_size=0.2)",
                "import matplotlib.pyplot as plt\nplt.plot([1,2,3,4])\nplt.show()",
                "for i in range(100):\n    if i % 10 == 0:\n        print(f'Progress: {i}%')"
            ]
        else:
            codes = [
                "df = pd.read_csv('missing_file.csv')",  # FileNotFoundError
                "result = undefined_variable + 10",      # NameError
                "data[999999]",                          # IndexError
                "import non_existent_package",           # ImportError
                "1 / 0"                                  # ZeroDivisionError
            ]
        return random.choice(codes)
    
    def _generate_realistic_output(self, success: bool) -> str:
        """現実的な出力生成"""
        if success:
            return "実行成功: データ処理完了"
        else:
            errors = [
                "FileNotFoundError: 'missing_file.csv' not found",
                "NameError: name 'undefined_variable' is not defined",
                "IndexError: list index out of range",
                "ImportError: No module named 'non_existent_package'",
                "ZeroDivisionError: division by zero"
            ]
            return random.choice(errors)
    
    def _update_performance_metrics(self, response_time: float):
        """パフォーマンス指標更新"""
        self.performance.max_response_time = max(self.performance.max_response_time, response_time)
        self.performance.min_response_time = min(self.performance.min_response_time, response_time)
        
        # 移動平均計算
        total_successful = self.performance.events_successful
        current_avg = self.performance.avg_response_time
        self.performance.avg_response_time = (current_avg * (total_successful - 1) + response_time) / total_successful
        
        # 応答時間履歴保存
        self.monitoring_data["response_times"].append({
            "timestamp": time.time(),
            "response_time": response_time
        })
    
    def _compile_enhanced_results(self):
        """拡張結果コンパイル"""
        total_duration = time.time() - self.performance.start_time
        
        # 学生別統計
        student_stats = {}
        total_cells = 0
        total_errors = 0
        
        for student in self.students:
            student_stats[student.email] = {
                "name": student.name,
                "team": student.team,
                "cells_executed": student.cell_count,
                "errors_occurred": student.error_count,
                "avg_response_time": student.total_response_time / max(student.response_count, 1),
                "success_rate": ((student.cell_count - student.error_count) / max(student.cell_count, 1)) * 100
            }
            total_cells += student.cell_count
            total_errors += student.error_count
        
        # システム統計
        self.performance.system_metrics = {
            "total_duration_minutes": total_duration / 60,
            "events_per_second": self.performance.events_sent / total_duration,
            "success_rate": (self.performance.events_successful / max(self.performance.events_sent, 1)) * 100,
            "total_students": len(self.students),
            "total_teams": len(set(s.team for s in self.students)),
            "total_cells_executed": total_cells,
            "total_errors": total_errors,
            "student_stats": student_stats
        }
    
    def _generate_comprehensive_report(self) -> Dict:
        """包括的レポート生成"""
        return {
            "test_info": {
                "start_time": datetime.fromtimestamp(self.performance.start_time).isoformat(),
                "duration_minutes": (time.time() - self.performance.start_time) / 60,
                "students": len(self.students),
                "teams": len(set(s.team for s in self.students)),
                "instructors": len(self.instructors)
            },
            "performance_metrics": {
                "events_sent": self.performance.events_sent,
                "events_successful": self.performance.events_successful,
                "events_failed": self.performance.events_failed,
                "success_rate": (self.performance.events_successful / max(self.performance.events_sent, 1)) * 100,
                "events_per_second": self.performance.system_metrics.get("events_per_second", 0),
                "avg_response_time": self.performance.avg_response_time,
                "max_response_time": self.performance.max_response_time,
                "min_response_time": self.performance.min_response_time if self.performance.min_response_time != float('inf') else 0,
                "help_requests": self.performance.help_requests
            },
            "system_metrics": self.performance.system_metrics,
            "monitoring_data": self.monitoring_data,
            "error_details": self.performance.error_details[:10]  # 最初の10件のみ
        }
    
    def save_results(self, results: Dict, output_dir: str = "test_results"):
        """結果保存"""
        Path(output_dir).mkdir(exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # JSON結果保存
        json_file = Path(output_dir) / f"{config.student_count}_student_test_{timestamp}.json"
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2, default=str)
        
        # レポート生成
        report_file = Path(output_dir) / f"{config.student_count}_student_report_{timestamp}.md"
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(self._generate_markdown_report(results))
        
        logger.info(f"📊 結果保存完了: {json_file}, {report_file}")
        return str(json_file), str(report_file)
    
    def _generate_markdown_report(self, results: Dict) -> str:
        """Markdownレポート生成"""
        test_info = results["test_info"]
        perf = results["performance_metrics"]
        
        report = f"""# 🧪 {config.student_count}名拡張負荷テスト結果レポート

## 📊 テスト概要
- **開始時刻**: {test_info["start_time"]}
- **実行時間**: {test_info["duration_minutes"]:.1f}分
- **受講生数**: {test_info["students"]}名
- **チーム数**: {test_info["teams"]}チーム
- **講師数**: {test_info["instructors"]}名

## 📈 パフォーマンス結果
- **送信イベント数**: {perf["events_sent"]:,}
- **成功イベント数**: {perf["events_successful"]:,}
- **失敗イベント数**: {perf["events_failed"]:,}
- **成功率**: {perf["success_rate"]:.2f}%
- **毎秒処理イベント数**: {perf["events_per_second"]:.1f}
- **ヘルプ要請数**: {perf["help_requests"]:,}

## ⚡ 応答時間
- **平均**: {perf["avg_response_time"]:.3f}秒
- **最大**: {perf["max_response_time"]:.3f}秒
- **最小**: {perf["min_response_time"]:.3f}秒

## 🎯 目標達成度
- **目標処理能力**: 400イベント/秒 → **実測**: {perf["events_per_second"]:.1f}イベント/秒
- **目標成功率**: >99% → **実測**: {perf["success_rate"]:.2f}%
- **目標応答時間**: <100ms → **実測**: {perf["avg_response_time"]*1000:.0f}ms

## 📋 結論
{"✅ **合格**: 全目標を達成" if perf["success_rate"] > 99 and perf["avg_response_time"] < 0.1 and perf["events_per_second"] > 400 else "⚠️ **要改善**: 一部目標未達成"}

## 💡 推奨事項
1. Redis接続プール監視の継続
2. 応答時間スパイク対策の検討
3. エラーハンドリングの更なる強化
"""
        return report

# CLI実行用
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="JupyterLab Cell Monitor Extension 環境変数対応拡張負荷テスト")
    parser.add_argument("--url", default="http://localhost:8000", help="FastAPI サーバーURL")
    parser.add_argument("--duration", type=int, default=10, help="テスト実行時間（分）")
    parser.add_argument("--output-dir", default="test_results", help="結果出力ディレクトリ")
    parser.add_argument("--batch-mode", action="store_true", help="バッチモードで実行")
    
    args = parser.parse_args()
    
    async def main():
        simulator = EnhancedLoadTestSimulator(args.url)
        
        if args.batch_mode:
            logger.info("🚀 バッチモードで実行")
            # バッチテスト実装（将来拡張）
            logger.warning("バッチモードは未実装です。通常モードで実行します。")
            results = await simulator.run_enhanced_load_test(args.duration)
        else:
            logger.info("🚀 通常モードで実行")
            results = await simulator.run_enhanced_load_test(args.duration)
        
        # 結果保存
        json_file, report_file = simulator.save_results(results, args.output_dir)
        
        # サマリー表示
        perf = results["performance_metrics"]
        print(f"\n🎯 テスト完了!")
        print(f"📤 送信イベント: {perf['events_sent']:,}")
        print(f"✅ 成功率: {perf['success_rate']:.2f}%")
        print(f"⚡ 処理能力: {perf['events_per_second']:.1f}イベント/秒")
        print(f"🕐 平均応答時間: {perf['avg_response_time']*1000:.0f}ms")
        print(f"📊 詳細結果: {report_file}")
    
    asyncio.run(main())