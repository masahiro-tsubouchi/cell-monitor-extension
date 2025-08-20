from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Boolean,
    Text,
    ForeignKey,
    Float,
    Enum,
    Index,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import enum
from sqlalchemy.sql import func
import uuid

from db.base import Base

# 教室MAP関連モデルをインポート
from .models_classroom import ClassroomMap, TeamPosition


class Team(Base):
    """チーム情報"""

    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    team_name = Column(
        String, unique=True, index=True, nullable=False
    )  # チームA, チームB, etc.
    description = Column(Text, nullable=True)  # チームの説明
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # リレーションシップ
    students = relationship("Student", back_populates="team")


class Student(Base):
    """生徒/ユーザーモデル"""

    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(
        String, unique=True, index=True, nullable=False
    )  # メールアドレスを主キーに変更
    name = Column(String, index=True, nullable=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)  # チーム情報
    is_requesting_help = Column(Boolean, default=False, nullable=False)  # ヘルプ要求ステータス
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # リレーションシップ
    team = relationship("Team", back_populates="students")
    sessions = relationship("Session", back_populates="student")
    classes = relationship("StudentClass", back_populates="student")
    notebooks = relationship("NotebookAccess", back_populates="student")
    cell_executions = relationship("CellExecution", back_populates="student")


class Session(Base):
    """JupyterLabセッション"""

    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(
        String,
        unique=True,
        index=True,
        nullable=False,
        default=lambda: str(uuid.uuid4()),
    )
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)

    # リレーションシップ
    student = relationship("Student", back_populates="sessions")
    cell_executions = relationship("CellExecution", back_populates="session")


class Notebook(Base):
    """Jupyterノートブック"""

    __tablename__ = "notebooks"

    id = Column(Integer, primary_key=True, index=True)
    path = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_modified = Column(DateTime(timezone=True), nullable=True)
    notebook_metadata = Column(Text, nullable=True)  # JSON形式のメタデータを格納

    # リレーションシップ
    cells = relationship("Cell", back_populates="notebook")
    student_accesses = relationship("NotebookAccess", back_populates="notebook")
    class_assignments = relationship("ClassAssignment", back_populates="notebook")


class Cell(Base):
    """ノートブックのセル"""

    __tablename__ = "cells"

    id = Column(Integer, primary_key=True, index=True)
    cell_id = Column(
        String, index=True, nullable=False
    )  # ノートブック内でのセルの一意のID
    notebook_id = Column(Integer, ForeignKey("notebooks.id"), nullable=False)
    cell_type = Column(String, nullable=False)  # code, markdown, raw, etc.
    position = Column(Integer, nullable=True)  # ノートブック内での位置
    content = Column(Text, nullable=True)  # セルのコンテンツ
    cell_metadata = Column(Text, nullable=True)  # JSON形式のメタデータ

    # リレーションシップ
    notebook = relationship("Notebook", back_populates="cells")
    executions = relationship("CellExecution", back_populates="cell")


class CellExecution(Base):
    """セル実行履歴"""

    __tablename__ = "cell_executions"

    id = Column(Integer, primary_key=True, index=True)
    execution_id = Column(
        String, unique=True, nullable=False, default=lambda: str(uuid.uuid4())
    )
    notebook_id = Column(Integer, ForeignKey("notebooks.id"), nullable=False)
    cell_id = Column(Integer, ForeignKey("cells.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    executed_at = Column(DateTime(timezone=True), server_default=func.now())
    execution_count = Column(Integer, nullable=True)
    status = Column(String, nullable=False)  # success, error, etc.
    duration = Column(Float, nullable=True)  # 実行時間（秒）
    error_message = Column(Text, nullable=True)
    output = Column(Text, nullable=True)  # JSON形式の出力結果
    code_content = Column(Text, nullable=True)  # 実行されたセルのコード内容
    cell_index = Column(Integer, nullable=True)  # ノートブック内でのセル位置
    cell_type = Column(String, nullable=True)  # セルの種類 (code, markdown, etc.)
    
    # 連続エラー検出用フィールド
    consecutive_error_count = Column(Integer, default=0)
    is_significant_error = Column(Boolean, default=False)

    # リレーションシップ
    notebook = relationship("Notebook")
    cell = relationship("Cell", back_populates="executions")
    student = relationship("Student", back_populates="cell_executions")
    session = relationship("Session", back_populates="cell_executions")


class Class(Base):
    """授業/クラス"""

    __tablename__ = "classes"

    id = Column(Integer, primary_key=True, index=True)
    class_code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    instructor_id = Column(Integer, ForeignKey("instructors.id"), nullable=True)
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # リレーションシップ
    instructor = relationship("Instructor", back_populates="classes")
    students = relationship("StudentClass", back_populates="class_")
    assignments = relationship("ClassAssignment", back_populates="class_")


class StudentClass(Base):
    """生徒とクラスの関連付け（多対多）"""

    __tablename__ = "student_classes"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    role = Column(String, default="student")  # student, assistant, etc.

    # リレーションシップ
    student = relationship("Student", back_populates="classes")
    class_ = relationship("Class", back_populates="students")


class ClassAssignment(Base):
    """クラスに割り当てられたノートブック課題"""

    __tablename__ = "class_assignments"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    notebook_id = Column(Integer, ForeignKey("notebooks.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    points = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # リレーションシップ
    class_ = relationship("Class", back_populates="assignments")
    notebook = relationship("Notebook", back_populates="class_assignments")
    submissions = relationship("AssignmentSubmission", back_populates="assignment")


class AssignmentSubmission(Base):
    """課題提出"""

    __tablename__ = "assignment_submissions"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("class_assignments.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, default="submitted")  # submitted, graded, returned
    grade = Column(Float, nullable=True)
    feedback = Column(Text, nullable=True)

    # リレーションシップ
    assignment = relationship("ClassAssignment", back_populates="submissions")
    student = relationship("Student")


class NotebookAccess(Base):
    """生徒のノートブックアクセス履歴"""

    __tablename__ = "notebook_accesses"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    notebook_id = Column(Integer, ForeignKey("notebooks.id"), nullable=False)
    accessed_at = Column(DateTime(timezone=True), server_default=func.now())
    action = Column(String, nullable=False)  # open, save, close, etc.

    # リレーションシップ
    student = relationship("Student", back_populates="notebooks")
    notebook = relationship("Notebook", back_populates="student_accesses")


class InstructorStatus(enum.Enum):
    """講師のステータス"""

    AVAILABLE = "available"  # 利用可能
    IN_SESSION = "in_session"  # セッション中
    BREAK = "break"  # 休憩中
    OFFLINE = "offline"  # オフライン


class Instructor(Base):
    """講師テーブル"""

    __tablename__ = "instructors"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(String(50), default="instructor")
    is_active = Column(Boolean, default=True)

    status = Column(
        Enum(InstructorStatus), default=InstructorStatus.OFFLINE, nullable=False
    )
    current_session_id = Column(Integer, ForeignKey("sessions.id"), nullable=True)
    status_updated_at = Column(DateTime(timezone=True), server_default=func.now())

    last_login_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # リレーションシップ
    classes = relationship("Class", back_populates="instructor")
    status_history = relationship(
        "InstructorStatusHistory", back_populates="instructor"
    )
    current_session = relationship("Session", foreign_keys=[current_session_id])


class InstructorStatusHistory(Base):
    """講師ステータス履歴テーブル"""

    __tablename__ = "instructor_status_history"

    id = Column(Integer, primary_key=True, index=True)
    instructor_id = Column(Integer, ForeignKey("instructors.id"), nullable=False)
    status = Column(Enum(InstructorStatus), nullable=False)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)
    duration_minutes = Column(Integer, nullable=True)  # 自動計算される継続時間

    # リレーションシップ
    instructor = relationship("Instructor", back_populates="status_history")


class SystemSetting(Base):
    """システム設定テーブル - 設定値の動的管理"""
    __tablename__ = "system_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    setting_key = Column(String, unique=True, nullable=False, index=True)
    setting_value = Column(Text, nullable=False)
    setting_type = Column(String, nullable=False)  # int, str, bool, json
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
