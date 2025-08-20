from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc, case
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from db import models
from schemas import student as student_schema


def get_student_by_email(db: Session, email: str) -> models.Student | None:
    return db.query(models.Student).filter(models.Student.email == email).first()


def create_student(
    db: Session, email: str, name: str = None, team_name: str = None
) -> models.Student:
    # チーム名からTeamを取得または作成
    team = None
    if team_name:
        team = db.query(models.Team).filter(models.Team.team_name == team_name).first()
        if not team:
            team = models.Team(team_name=team_name, description=f"{team_name}の説明")
            db.add(team)
            db.commit()
            db.refresh(team)

    db_student = models.Student(
        email=email, name=name, team_id=team.id if team else None
    )
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    return db_student


def get_or_create_student(
    db: Session, email: str, name: str = None, team_name: str = None
) -> models.Student:
    db_student = get_student_by_email(db, email=email)
    if not db_student:
        db_student = create_student(db, email=email, name=name, team_name=team_name)
    return db_student


def get_active_students_with_sessions(db: Session) -> List[Dict[str, Any]]:
    """Get active students with their latest session information"""
    from datetime import datetime, timedelta

    # Check for recent help requests (within last 5 minutes)
    help_threshold = datetime.utcnow() - timedelta(minutes=5)

    # Get students with their session statistics aggregated
    students_with_sessions = (
        db.query(
            models.Student.id,  # IDを追加
            models.Student.email,
            models.Student.name,
            models.Team.team_name,
            func.max(models.Session.start_time).label("latest_session_start"),
            func.count(models.CellExecution.id.distinct()).label(
                "total_cell_executions"
            ),
            func.sum(case((models.CellExecution.status == "error", 1), else_=0)).label(
                "total_error_count"
            ),
        )
        .outerjoin(models.Team, models.Team.id == models.Student.team_id)
        .outerjoin(models.Session, models.Session.student_id == models.Student.id)
        .outerjoin(
            models.CellExecution, models.CellExecution.student_id == models.Student.id
        )
        .group_by(
            models.Student.id,
            models.Student.email,
            models.Student.name,
            models.Team.team_name,
        )
        .all()
    )

    # For each student, get their most recent notebook and check help status
    result = []
    help_students = []  # Track students needing help

    for row in students_with_sessions:
        # Get the most recent notebook for this student
        recent_notebook = (
            db.query(models.Notebook.path)
            .join(
                models.CellExecution,
                models.CellExecution.notebook_id == models.Notebook.id,
            )
            .filter(
                models.CellExecution.student_id
                == db.query(models.Student.id)
                .filter(models.Student.email == row.email)
                .scalar()
            )
            .order_by(models.CellExecution.executed_at.desc())
            .first()
        )

        # Check if student has recent help events (from InfluxDB via InfluxDB client)
        is_requesting_help = check_recent_help_status(row.email, help_threshold)

        student_data = {
            "id": row.id,  # IDを追加
            "email": row.email,
            "name": row.name
            or row.email.split("@")[0],  # Fallback to email prefix if name is None
            "team_name": row.team_name,
            "is_requesting_help": is_requesting_help,
            "latest_session": (
                {
                    "notebook_path": (
                        recent_notebook.path if recent_notebook else "/unknown"
                    ),
                    "started_at": row.latest_session_start,
                    "ended_at": None,  # We don't track session end times currently
                    "updated_at": row.latest_session_start,
                    "cell_executions": row.total_cell_executions or 0,
                    "error_count": row.total_error_count or 0,
                }
                if row.latest_session_start
                else None
            ),
        }

        if is_requesting_help:
            help_students.append(student_data)
        else:
            result.append(student_data)

    # Return help students first, then others
    return help_students + result


def check_recent_help_status(email: str, help_threshold: datetime) -> bool:
    """Check if user has recent help events in InfluxDB"""
    try:
        from db.influxdb_client import query_progress_data
        from core.config import settings

        # Query InfluxDB for recent help and help_stop events from this user
        help_events_query = f"""
        from(bucket: "{settings.INFLUXDB_BUCKET}")
          |> range(start: {help_threshold.strftime("%Y-%m-%dT%H:%M:%SZ")})
          |> filter(fn: (r) => r._measurement == "student_progress")
          |> filter(fn: (r) => r.event == "help" or r.event == "help_stop")
          |> filter(fn: (r) => r.emailAddress == "{email}")
          |> sort(columns: ["_time"], desc: true)
          |> limit(n: 10)
        """

        result = query_progress_data(help_events_query)

        # Debug: Print query result
        print(f"Help status query result for email {email}:")

        # Check the most recent help-related event
        recent_events = []
        for table in result:
            for record in table:
                event_type = record.values.get("event")
                timestamp = record.get_time()
                recent_events.append((event_type, timestamp))

        # Sort by timestamp to ensure we get the most recent
        recent_events.sort(key=lambda x: x[1], reverse=True)

        if recent_events:
            latest_event, latest_time = recent_events[0]
            print(f"  Latest Event: {latest_event}, Time: {latest_time}")
            if latest_event == "help":
                print(f"  Returning True (help active) for email {email}")
                return True  # Last event was help request
            elif latest_event == "help_stop":
                print(f"  Returning False (help stopped) for email {email}")
                return False  # Last event was help stop
        else:
            print(f"  No help events found for email {email}")

        return False

    except Exception as e:
        print(f"Error checking help status for email {email}: {e}")
        return False


def get_total_students_count(db: Session) -> int:
    """Get total number of students"""
    return db.query(models.Student).count()


def get_active_sessions_count(db: Session, time_threshold: int = 300) -> int:
    """Get number of active sessions (updated within time_threshold seconds)"""
    threshold_time = datetime.utcnow() - timedelta(seconds=time_threshold)
    return (
        db.query(models.Session)
        .filter(
            models.Session.end_time.is_(None),
            models.Session.start_time >= threshold_time,
        )
        .count()
    )


def get_or_create_active_session(db: Session, student_id: int) -> models.Session:
    """Get or create an active session for the student"""
    # 既存のアクティブセッションを探す
    active_session = (
        db.query(models.Session)
        .filter(
            models.Session.student_id == student_id,
            models.Session.end_time.is_(None),
            models.Session.is_active == True,
        )
        .first()
    )

    if active_session:
        return active_session

    # 新しいセッションを作成
    new_session = models.Session(student_id=student_id, is_active=True)
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session


def get_student_sessions(
    db: Session, student_id: int, limit: int = 10
) -> List[models.Session]:
    """指定された学生のセッション履歴を取得する"""
    return (
        db.query(models.Session)
        .filter(models.Session.student_id == student_id)
        .order_by(models.Session.start_time.desc())
        .limit(limit)
        .all()
    )


def set_help_request_status(db: Session, student_id: int, is_requesting: bool) -> bool:
    """学生のヘルプ要求ステータスを設定する"""
    try:
        student = db.query(models.Student).filter(models.Student.id == student_id).first()
        if student:
            student.is_requesting_help = is_requesting
            student.updated_at = datetime.utcnow()
            db.commit()
            return True
        return False
    except Exception as e:
        print(f"Error setting help request status: {e}")
        db.rollback()
        return False
