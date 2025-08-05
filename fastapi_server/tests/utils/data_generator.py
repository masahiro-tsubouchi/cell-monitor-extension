"""
100人受講生テスト用データ生成ユーティリティ

既存の186個テストケース成功パターンを活用したリアルなテストデータ生成
AI駆動TDD: 実際の教室環境を模倣したデータ生成
"""

import random
import time
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import json

from schemas.event import EventData


class StudentDataGenerator:
    """学生データ生成クラス"""

    def __init__(self):
        self.event_types = [
            "cell_executed",
            "notebook_opened", 
            "notebook_saved",
            "notebook_closed",
            "help_requested"  # ヘルプ要請イベント
        ]
        
        self.cell_types = ["code", "markdown", "raw"]
        
        # 実際のPythonコード例（教育用）
        self.sample_codes = [
            "print('Hello, World!')",
            "x = 5\ny = 10\nprint(x + y)",
            "import pandas as pd\ndf = pd.DataFrame({'A': [1, 2, 3]})",
            "for i in range(5):\n    print(f'Number: {i}')",
            "def calculate_sum(a, b):\n    return a + b\n\nresult = calculate_sum(3, 7)",
            "import matplotlib.pyplot as plt\nplt.plot([1, 2, 3, 4])\nplt.show()",
            "data = [1, 2, 3, 4, 5]\naverage = sum(data) / len(data)\nprint(f'Average: {average}')",
            "try:\n    result = 10 / 0\nexcept ZeroDivisionError:\n    print('Cannot divide by zero')",
        ]
        
        # エラーを含むコード例
        self.error_codes = [
            "print(undefined_variable)",  # NameError
            "result = 10 / 0",  # ZeroDivisionError
            "my_list = [1, 2, 3]\nprint(my_list[10])",  # IndexError
            "import non_existent_module",  # ImportError
            "x = '5'\ny = 10\nresult = x + y",  # TypeError
        ]

    def generate_realistic_students(self, count: int) -> List[Dict[str, Any]]:
        """リアルな学生データ生成"""
        students = []
        
        for i in range(1, count + 1):
            student = {
                "userId": f"student_{i:03d}",
                "userName": f"Student {i:03d}",
                "sessionId": str(uuid.uuid4()),
                "skill_level": random.choice(["beginner", "intermediate", "advanced"]),
                "learning_style": random.choice(["visual", "auditory", "kinesthetic"]),
                "error_prone": random.random() < 0.3,  # 30%の学生はエラーを起こしやすい
            }
            students.append(student)
        
        return students

    def generate_student_session_events(
        self,
        student_id: str,
        session_duration_minutes: int = 90,
        notebooks_count: int = 3,
        cells_per_notebook: int = 20,
        error_rate: float = 0.15
    ) -> List[Dict[str, Any]]:
        """学生の学習セッションイベント生成"""
        events = []
        session_id = str(uuid.uuid4())
        base_time = datetime.now()
        
        for notebook_idx in range(notebooks_count):
            notebook_path = f"/notebooks/lesson_{notebook_idx + 1}.ipynb"
            
            # ノートブック開始イベント
            events.append(self._create_notebook_event(
                student_id, session_id, notebook_path, "notebook_opened", base_time
            ))
            
            # セル実行イベント群
            for cell_idx in range(cells_per_notebook):
                cell_time = base_time + timedelta(
                    minutes=random.uniform(0, session_duration_minutes)
                )
                
                # エラー発生判定
                has_error = random.random() < error_rate
                code = random.choice(self.error_codes if has_error else self.sample_codes)
                
                event = self._create_cell_execution_event(
                    student_id=student_id,
                    session_id=session_id,
                    notebook_path=notebook_path,
                    cell_index=cell_idx,
                    code=code,
                    has_error=has_error,
                    event_time=cell_time
                )
                events.append(event)
                
                # ヘルプ要請イベント（エラー後の確率）
                if has_error and random.random() < 0.4:  # エラー後40%の確率でヘルプ要請
                    help_event = self._create_help_request_event(
                        student_id, session_id, notebook_path, cell_time
                    )
                    events.append(help_event)
            
            # ノートブック保存・終了イベント
            save_time = base_time + timedelta(
                minutes=session_duration_minutes * (notebook_idx + 1) / notebooks_count
            )
            
            events.append(self._create_notebook_event(
                student_id, session_id, notebook_path, "notebook_saved", save_time
            ))
            
            if notebook_idx == notebooks_count - 1:  # 最後のノートブック
                events.append(self._create_notebook_event(
                    student_id, session_id, notebook_path, "notebook_closed", save_time
                ))
        
        return events

    def generate_lms_integrated_session(
        self,
        student: Dict[str, Any],
        classes: List[Dict[str, Any]],
        assignments: List[Dict[str, Any]],
        session_duration_minutes: int = 60
    ) -> List[Dict[str, Any]]:
        """LMS統合学習セッション生成"""
        events = []
        student_id = student["userId"]
        session_id = str(uuid.uuid4())
        
        # 学生のクラス割り当て
        assigned_class = random.choice(classes)
        class_assignments = [a for a in assignments if a["class_id"] == assigned_class["id"]]
        
        if not class_assignments:
            # クラスに課題がない場合は通常セッション
            return self.generate_student_session_events(
                student_id, session_duration_minutes
            )
        
        # 課題取り組みセッション
        for assignment in class_assignments[:3]:  # 最大3つの課題
            assignment_events = self._generate_assignment_session(
                student_id=student_id,
                session_id=session_id,
                assignment=assignment,
                duration_minutes=session_duration_minutes // len(class_assignments[:3])
            )
            events.extend(assignment_events)
        
        return events

    def generate_websocket_integrated_session(
        self,
        student: Dict[str, Any],
        session_duration_minutes: int = 60,
        realtime_notifications: bool = True
    ) -> List[Dict[str, Any]]:
        """WebSocket統合学習セッション生成"""
        events = self.generate_student_session_events(
            student["userId"], session_duration_minutes
        )
        
        if realtime_notifications:
            # リアルタイム通知用のイベントを追加
            notification_events = self._generate_notification_events(
                student["userId"], len(events)
            )
            events.extend(notification_events)
        
        return events

    def generate_instructor_integrated_session(
        self,
        student: Dict[str, Any],
        instructor: Dict[str, Any],
        session_duration_minutes: int = 75
    ) -> List[Dict[str, Any]]:
        """講師統合学習セッション生成"""
        events = self.generate_student_session_events(
            student["userId"], session_duration_minutes
        )
        
        # 講師割り当てイベントを追加
        instructor_events = self._generate_instructor_assignment_events(
            student["userId"], instructor["id"]
        )
        events.extend(instructor_events)
        
        return events

    def generate_full_classroom_session(
        self,
        student: Dict[str, Any],
        instructor: Dict[str, Any],
        class_info: Dict[str, Any],
        assignments: List[Dict[str, Any]],
        session_duration_minutes: int = 90
    ) -> List[Dict[str, Any]]:
        """完全な教室セッション生成"""
        events = []
        student_id = student["userId"]
        session_id = str(uuid.uuid4())
        
        # 授業開始イベント
        events.append(self._create_session_start_event(
            student_id, session_id, class_info["id"], instructor["id"]
        ))
        
        # LMS統合セッション
        lms_events = self.generate_lms_integrated_session(
            student, [class_info], assignments, session_duration_minutes
        )
        events.extend(lms_events)
        
        # WebSocket統合要素
        websocket_events = self._generate_notification_events(
            student_id, session_duration_minutes // 10  # 10分ごとに通知
        )
        events.extend(websocket_events)
        
        # 講師統合要素
        instructor_events = self._generate_instructor_assignment_events(
            student_id, instructor["id"]
        )
        events.extend(instructor_events)
        
        # 授業終了イベント
        events.append(self._create_session_end_event(
            student_id, session_id, class_info["id"]
        ))
        
        return events

    def generate_100_student_events(self) -> List[Dict[str, Any]]:
        """100人分のイベント一括生成"""
        all_events = []
        students = self.generate_realistic_students(100)
        
        for student in students:
            events = self.generate_student_session_events(
                student["userId"],
                session_duration_minutes=90,
                notebooks_count=3,
                cells_per_notebook=25,
                error_rate=0.15
            )
            all_events.extend(events)
        
        return all_events

    # プライベートメソッド群

    def _create_cell_execution_event(
        self,
        student_id: str,
        session_id: str,
        notebook_path: str,
        cell_index: int,
        code: str,
        has_error: bool,
        event_time: datetime
    ) -> Dict[str, Any]:
        """セル実行イベント作成"""
        execution_duration = random.uniform(100, 5000)  # 100ms-5s
        
        event = {
            "eventId": str(uuid.uuid4()),
            "eventType": "cell_executed",
            "eventTime": event_time.isoformat(),
            "userId": student_id,
            "userName": f"Student {student_id.split('_')[1]}",
            "sessionId": session_id,
            "notebookPath": notebook_path,
            "cellId": f"cell_{cell_index}",
            "cellIndex": cell_index,
            "cellType": "code",
            "code": code,
            "executionCount": cell_index + 1,
            "hasError": has_error,
            "executionDurationMs": execution_duration,
            "metadata": {
                "kernel": "python3",
                "timestamp": event_time.timestamp()
            }
        }
        
        if has_error:
            event["errorMessage"] = self._generate_error_message(code)
            event["result"] = None
        else:
            event["errorMessage"] = None
            event["result"] = self._generate_success_result(code)
        
        return event

    def _create_notebook_event(
        self,
        student_id: str,
        session_id: str,
        notebook_path: str,
        event_type: str,
        event_time: datetime
    ) -> Dict[str, Any]:
        """ノートブックイベント作成"""
        return {
            "eventId": str(uuid.uuid4()),
            "eventType": event_type,
            "eventTime": event_time.isoformat(),
            "userId": student_id,
            "userName": f"Student {student_id.split('_')[1]}",
            "sessionId": session_id,
            "notebookPath": notebook_path,
            "cellId": None,
            "cellIndex": None,
            "cellType": None,
            "code": None,
            "executionCount": None,
            "hasError": False,
            "errorMessage": None,
            "result": None,
            "executionDurationMs": None,
            "metadata": {
                "action": event_type,
                "timestamp": event_time.timestamp()
            }
        }

    def _create_help_request_event(
        self,
        student_id: str,
        session_id: str,
        notebook_path: str,
        event_time: datetime
    ) -> Dict[str, Any]:
        """ヘルプ要請イベント作成"""
        return {
            "eventId": str(uuid.uuid4()),
            "eventType": "help_requested",
            "eventTime": event_time.isoformat(),
            "userId": student_id,
            "userName": f"Student {student_id.split('_')[1]}",
            "sessionId": session_id,
            "notebookPath": notebook_path,
            "cellId": None,
            "cellIndex": None,
            "cellType": None,
            "code": None,
            "executionCount": None,
            "hasError": False,
            "errorMessage": None,
            "result": None,
            "executionDurationMs": None,
            "metadata": {
                "help_type": "error_assistance",
                "urgency": random.choice(["low", "medium", "high"]),
                "timestamp": event_time.timestamp()
            }
        }

    def _create_session_start_event(
        self,
        student_id: str,
        session_id: str,
        class_id: str,
        instructor_id: str
    ) -> Dict[str, Any]:
        """セッション開始イベント作成"""
        return {
            "eventId": str(uuid.uuid4()),
            "eventType": "session_start",
            "eventTime": datetime.now().isoformat(),
            "userId": student_id,
            "userName": f"Student {student_id.split('_')[1]}",
            "sessionId": session_id,
            "notebookPath": None,
            "cellId": None,
            "cellIndex": None,
            "cellType": None,
            "code": None,
            "executionCount": None,
            "hasError": False,
            "errorMessage": None,
            "result": None,
            "executionDurationMs": None,
            "metadata": {
                "class_id": class_id,
                "instructor_id": instructor_id,
                "session_type": "classroom",
                "timestamp": time.time()
            }
        }

    def _create_session_end_event(
        self,
        student_id: str,
        session_id: str,
        class_id: str
    ) -> Dict[str, Any]:
        """セッション終了イベント作成"""
        return {
            "eventId": str(uuid.uuid4()),
            "eventType": "session_end",
            "eventTime": datetime.now().isoformat(),
            "userId": student_id,
            "userName": f"Student {student_id.split('_')[1]}",
            "sessionId": session_id,
            "notebookPath": None,
            "cellId": None,
            "cellIndex": None,
            "cellType": None,
            "code": None,
            "executionCount": None,
            "hasError": False,
            "errorMessage": None,
            "result": None,
            "executionDurationMs": None,
            "metadata": {
                "class_id": class_id,
                "session_type": "classroom",
                "timestamp": time.time()
            }
        }

    def _generate_assignment_session(
        self,
        student_id: str,
        session_id: str,
        assignment: Dict[str, Any],
        duration_minutes: int
    ) -> List[Dict[str, Any]]:
        """課題取り組みセッション生成"""
        events = []
        notebook_path = f"/assignments/{assignment['id']}.ipynb"
        
        # 課題開始
        events.append(self._create_notebook_event(
            student_id, session_id, notebook_path, "notebook_opened", datetime.now()
        ))
        
        # 課題セル実行（難易度に応じてエラー率調整）
        cell_count = random.randint(5, 15)
        error_rate = 0.2  # 課題は少し難しいのでエラー率高め
        
        for cell_idx in range(cell_count):
            has_error = random.random() < error_rate
            code = random.choice(self.error_codes if has_error else self.sample_codes)
            
            event = self._create_cell_execution_event(
                student_id=student_id,
                session_id=session_id,
                notebook_path=notebook_path,
                cell_index=cell_idx,
                code=code,
                has_error=has_error,
                event_time=datetime.now()
            )
            events.append(event)
        
        # 課題提出
        events.append(self._create_notebook_event(
            student_id, session_id, notebook_path, "notebook_saved", datetime.now()
        ))
        
        return events

    def _generate_notification_events(
        self,
        student_id: str,
        count: int
    ) -> List[Dict[str, Any]]:
        """通知イベント生成"""
        events = []
        
        for i in range(count):
            event = {
                "eventId": str(uuid.uuid4()),
                "eventType": "notification",
                "eventTime": datetime.now().isoformat(),
                "userId": student_id,
                "userName": f"Student {student_id.split('_')[1]}",
                "sessionId": str(uuid.uuid4()),
                "notebookPath": None,
                "cellId": None,
                "cellIndex": None,
                "cellType": None,
                "code": None,
                "executionCount": None,
                "hasError": False,
                "errorMessage": None,
                "result": None,
                "executionDurationMs": None,
                "metadata": {
                    "notification_type": random.choice([
                        "progress_update", "achievement", "reminder", "tip"
                    ]),
                    "message": f"Notification {i + 1} for {student_id}",
                    "timestamp": time.time()
                }
            }
            events.append(event)
        
        return events

    def _generate_instructor_assignment_events(
        self,
        student_id: str,
        instructor_id: str
    ) -> List[Dict[str, Any]]:
        """講師割り当てイベント生成"""
        return [{
            "eventId": str(uuid.uuid4()),
            "eventType": "instructor_assignment",
            "eventTime": datetime.now().isoformat(),
            "userId": student_id,
            "userName": f"Student {student_id.split('_')[1]}",
            "sessionId": str(uuid.uuid4()),
            "notebookPath": None,
            "cellId": None,
            "cellIndex": None,
            "cellType": None,
            "code": None,
            "executionCount": None,
            "hasError": False,
            "errorMessage": None,
            "result": None,
            "executionDurationMs": None,
            "metadata": {
                "instructor_id": instructor_id,
                "assignment_type": "help_assistance",
                "priority": random.choice(["low", "medium", "high"]),
                "timestamp": time.time()
            }
        }]

    def _generate_error_message(self, code: str) -> str:
        """エラーメッセージ生成"""
        if "undefined_variable" in code:
            return "NameError: name 'undefined_variable' is not defined"
        elif "/ 0" in code:
            return "ZeroDivisionError: division by zero"
        elif "[10]" in code:
            return "IndexError: list index out of range"
        elif "non_existent_module" in code:
            return "ImportError: No module named 'non_existent_module'"
        elif "x + y" in code and "x = '5'" in code:
            return "TypeError: can only concatenate str (not \"int\") to str"
        else:
            return "SyntaxError: invalid syntax"

    def _generate_success_result(self, code: str) -> str:
        """成功結果生成"""
        if "print(" in code:
            if "Hello, World!" in code:
                return "Hello, World!"
            elif "x + y" in code:
                return "15"
            elif "Number:" in code:
                return "Number: 0\nNumber: 1\nNumber: 2\nNumber: 3\nNumber: 4"
            elif "Average:" in code:
                return "Average: 3.0"
            else:
                return "Output generated"
        elif "return" in code:
            return "10"  # calculate_sum(3, 7)の結果
        elif "plt.show()" in code:
            return "Plot displayed"
        elif "import" in code:
            return "Module imported successfully"
        else:
            return "Code executed successfully"
