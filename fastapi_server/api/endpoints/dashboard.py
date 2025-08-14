from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta

from db.session import get_db
from crud import crud_student, crud_execution, crud_notebook
from schemas.progress import StudentProgress
from influxdb_client import InfluxDBClient

router = APIRouter()


@router.get("/overview")
async def get_dashboard_overview(
    time_range: str = Query("1h", description="Time range for metrics (1h, 24h, 7d)"),
    db: Session = Depends(get_db),
):
    """
    Get dashboard overview with student activities, metrics, and activity chart
    """
    try:
        # Get active students from PostgreSQL
        students_data = crud_student.get_active_students_with_sessions(db)

        # Transform to dashboard format
        students = []
        for student_data in students_data:
            # Get latest session info (safely handle None case)
            latest_session = student_data.get("latest_session") or {}

            # Determine status - help takes priority
            if student_data.get("is_requesting_help", False):
                status = "help"
            else:
                status = determine_student_status(latest_session)

            students.append(
                {
                    "emailAddress": student_data["email"],
                    "userName": student_data.get(
                        "name", student_data["email"].split("@")[0]
                    ),
                    "teamName": student_data.get(
                        "team_name", "未割り当て"
                    ),  # チーム名を追加
                    "currentNotebook": latest_session.get("notebook_path", "なし"),
                    "lastActivity": format_last_activity(
                        latest_session.get("updated_at")
                    ),
                    "status": status,
                    "isRequestingHelp": student_data.get("is_requesting_help", False),
                    "cellExecutions": latest_session.get("cell_executions", 0),
                    "errorCount": latest_session.get("error_count", 0),
                }
            )

        # Calculate metrics
        total_students = len(students)
        total_active = len([s for s in students if s["status"] == "active"])
        error_count = len([s for s in students if s["status"] == "error"])
        total_executions = sum(s["cellExecutions"] for s in students)

        metrics = {
            "totalStudents": total_students,
            "totalActive": total_active,
            "errorCount": error_count,
            "totalExecutions": total_executions,
            "helpCount": 0,  # Will be updated after getting chart data
        }

        # Get activity chart data from InfluxDB
        activity_chart = await get_activity_chart(time_range)

        # Calculate help count from chart data
        help_count = (
            sum(point.get("helpCount", 0) for point in activity_chart)
            if activity_chart
            else 0
        )
        metrics["helpCount"] = help_count

        return {
            "students": students,
            "metrics": metrics,
            "activityChart": activity_chart,
        }

    except Exception as e:
        print(f"Dashboard overview error: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get dashboard overview: {str(e)}"
        )


@router.get("/students/{email}/activity")
async def get_student_activity(email: str, db: Session = Depends(get_db)):
    """
    Get detailed activity for a specific student
    """
    try:
        student = crud_student.get_student_by_email(db, email)
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

        # Get recent executions
        recent_executions = crud_execution.get_recent_executions(
            db, student.id, limit=50
        )

        # Get session history
        sessions = crud_student.get_student_sessions(db, student.id, limit=10)

        return {
            "student": {
                "emailAddress": student.email,
                "name": student.name,
                "teamName": student.team.team_name if student.team else "未割り当て",
            },
            "recentExecutions": [
                {
                    "cellId": exec.cell_id,
                    "executionTime": exec.duration,
                    "hasError": exec.status == "error",
                    "timestamp": exec.executed_at.isoformat(),
                    "status": exec.status,
                    "output": exec.output,
                    "errorMessage": exec.error_message,
                    "codeContent": exec.code_content,  # セルのコード内容を追加
                    "cellIndex": exec.cell_index,  # セルの位置を追加
                    "cellType": exec.cell_type,  # セルの種類を追加
                    "executionCount": exec.execution_count,  # 実行カウントを追加
                }
                for exec in recent_executions
            ],
            "sessions": [
                {
                    "id": session.id,
                    "sessionId": session.session_id,
                    "startedAt": session.start_time.isoformat(),
                    "endedAt": (
                        session.end_time.isoformat() if session.end_time else None
                    ),
                    "isActive": session.is_active,
                }
                for session in sessions
            ],
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback

        print(f"Student activity error: {e}")
        print(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get student activity: {str(e)}"
        )


@router.get("/metrics")
async def get_class_metrics(
    time_range: str = Query("1h", description="Time range for metrics (1h, 24h, 7d)"),
    db: Session = Depends(get_db),
):
    """
    Get class-wide metrics for specific time range
    """
    try:
        # Calculate time window
        now = datetime.utcnow()
        if time_range == "1h":
            start_time = now - timedelta(hours=1)
        elif time_range == "24h":
            start_time = now - timedelta(days=1)
        elif time_range == "7d":
            start_time = now - timedelta(days=7)
        else:
            start_time = now - timedelta(hours=1)

        # Get metrics from InfluxDB
        activity_data = await get_influxdb_metrics(start_time, now)

        # Get PostgreSQL metrics
        total_students = crud_student.get_total_students_count(db)
        active_sessions = crud_student.get_active_sessions_count(db)

        return {
            "timeRange": time_range,
            "totalStudents": total_students,
            "activeSessions": active_sessions,
            "activityData": activity_data,
            "generatedAt": now.isoformat(),
        }

    except Exception as e:
        print(f"Class metrics error: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get class metrics: {str(e)}"
        )


@router.post("/students/{email}/dismiss-help")
async def dismiss_help_request(email: str, db: Session = Depends(get_db)):
    """
    Dismiss help request for a specific student
    """
    try:
        # Stop help session for this student in JupyterLab
        from core.connection_manager import manager as connection_manager

        # Send dismiss help command to the student's JupyterLab instance
        dismiss_message = {
            "type": "dismiss_help",
            "emailAddress": email,
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Broadcast the dismiss help message to all connected clients (JupyterLab will filter by emailAddress)
        import json

        await connection_manager.broadcast(json.dumps(dismiss_message))

        # Also record a help_stop event in InfluxDB to properly update the help status
        from db.influxdb_client import influx_client, write_api
        from influxdb_client import Point
        from core.config import settings
        import uuid

        try:
            # Create a Point directly for InfluxDB
            help_stop_point = (
                Point("student_progress")
                .tag("emailAddress", email)
                .tag("event", "help_stop")
                .field("eventId", str(uuid.uuid4()))
                .field("userName", email.split("@")[0])
                .field("sessionId", f"dashboard-dismiss-{email}")
                .field("success", True)
                .time(datetime.utcnow())
            )

            write_api.write(bucket=settings.INFLUXDB_BUCKET, record=help_stop_point)
            print(f"Help stop event recorded for email {email}")
        except Exception as e:
            print(f"Failed to record help_stop event: {e}")

        return {
            "success": True,
            "message": f"Help request dismissed for student {email}",
            "emailAddress": email,
        }

    except Exception as e:
        print(f"Dismiss help error: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to dismiss help request: {str(e)}"
        )


# Helper functions


def format_last_activity(timestamp):
    """Format timestamp to relative time string"""
    if not timestamp:
        return "不明"

    if isinstance(timestamp, str):
        timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))

    now = datetime.utcnow().replace(
        tzinfo=timestamp.tzinfo if timestamp.tzinfo else None
    )
    diff = now - timestamp

    if diff.total_seconds() < 60:
        return f"{int(diff.total_seconds())}秒前"
    elif diff.total_seconds() < 3600:
        return f"{int(diff.total_seconds() / 60)}分前"
    elif diff.total_seconds() < 86400:
        return f"{int(diff.total_seconds() / 3600)}時間前"
    else:
        return f"{int(diff.total_seconds() / 86400)}日前"


def determine_student_status(session_data):
    """Determine student status based on session data"""
    if not session_data:
        return "idle"

    last_activity = session_data.get("updated_at")
    error_count = session_data.get("error_count", 0)

    if not last_activity:
        return "idle"

    if isinstance(last_activity, str):
        last_activity = datetime.fromisoformat(last_activity.replace("Z", "+00:00"))

    now = datetime.utcnow().replace(
        tzinfo=last_activity.tzinfo if last_activity.tzinfo else None
    )
    time_diff = (now - last_activity).total_seconds()

    # If recent error and recent activity
    if error_count > 0 and time_diff < 300:  # 5 minutes
        return "error"

    # If very recent activity (within 2 minutes)
    if time_diff < 120:
        return "active"

    # Otherwise idle
    return "idle"


async def get_activity_chart(time_range: str):
    """Get activity chart data from InfluxDB"""
    try:
        from db.influxdb_client import query_progress_data
        from core.config import settings

        # Calculate time range for query
        now = datetime.utcnow()
        if time_range == "1h":
            start_time = now - timedelta(hours=1)
            window = "5m"  # 5-minute buckets for 1 hour
        elif time_range == "24h":
            start_time = now - timedelta(hours=24)
            window = "1h"  # 1-hour buckets for 24 hours
        else:  # 7d
            start_time = now - timedelta(days=7)
            window = "4h"  # 4-hour buckets for 7 days

        # InfluxDB Flux query to get cell execution counts and error counts over time
        executions_query = f"""
        from(bucket: "{settings.INFLUXDB_BUCKET}")
          |> range(start: {start_time.strftime("%Y-%m-%dT%H:%M:%SZ")})
          |> filter(fn: (r) => r._measurement == "student_progress")
          |> filter(fn: (r) => r.event == "cell_executed")
          |> aggregateWindow(every: {window}, fn: count, createEmpty: true)
          |> yield(name: "executions")
        """

        errors_query = f"""
        from(bucket: "{settings.INFLUXDB_BUCKET}")
          |> range(start: {start_time.strftime("%Y-%m-%dT%H:%M:%SZ")})
          |> filter(fn: (r) => r._measurement == "student_progress")
          |> filter(fn: (r) => r.event == "cell_executed")
          |> filter(fn: (r) => r._field == "success")
          |> filter(fn: (r) => r._value == false)
          |> aggregateWindow(every: {window}, fn: count, createEmpty: true)
          |> yield(name: "errors")
        """

        help_query = f"""
        from(bucket: "{settings.INFLUXDB_BUCKET}")
          |> range(start: {start_time.strftime("%Y-%m-%dT%H:%M:%SZ")})
          |> filter(fn: (r) => r._measurement == "student_progress")
          |> filter(fn: (r) => r.event == "help")
          |> aggregateWindow(every: {window}, fn: count, createEmpty: true)
          |> yield(name: "help")
        """

        # Execute queries
        executions_result = query_progress_data(executions_query)
        errors_result = query_progress_data(errors_query)
        help_result = query_progress_data(help_query)

        # Process execution counts
        execution_data = {}
        for table in executions_result:
            for record in table:
                time_key = record.get_time().isoformat()
                execution_count = (
                    record.get_value() if record.get_value() is not None else 0
                )
                execution_data[time_key] = execution_count

        # Process error counts
        error_data = {}
        for table in errors_result:
            for record in table:
                time_key = record.get_time().isoformat()
                error_count = (
                    record.get_value() if record.get_value() is not None else 0
                )
                error_data[time_key] = error_count

        # Process help counts
        help_data = {}
        for table in help_result:
            for record in table:
                time_key = record.get_time().isoformat()
                help_count = record.get_value() if record.get_value() is not None else 0
                help_data[time_key] = help_count

        # Combine data
        chart_data = []
        all_times = (
            set(execution_data.keys()) | set(error_data.keys()) | set(help_data.keys())
        )
        for time_key in sorted(all_times):
            chart_data.append(
                {
                    "time": time_key,
                    "executionCount": execution_data.get(time_key, 0),
                    "errorCount": error_data.get(time_key, 0),
                    "helpCount": help_data.get(time_key, 0),
                }
            )

        # If no real data, provide empty data structure instead of mock data
        if not chart_data:
            print(
                f"No InfluxDB data found for time range {time_range}, returning empty data"
            )
            # Generate time points with zero values
            if time_range == "1h":
                for i in range(12):
                    time_point = now - timedelta(minutes=5 * (11 - i))
                    chart_data.append(
                        {
                            "time": time_point.isoformat(),
                            "executionCount": 0,
                            "errorCount": 0,
                            "helpCount": 0,
                        }
                    )
            else:
                # Simplified for longer ranges
                for i in range(10):
                    time_point = now - timedelta(hours=2 * (9 - i))
                    chart_data.append(
                        {
                            "time": time_point.isoformat(),
                            "executionCount": 0,
                            "errorCount": 0,
                            "helpCount": 0,
                        }
                    )

        return chart_data

    except Exception as e:
        print(f"Activity chart error: {e}")
        # Fallback to empty data instead of mock data
        return []


async def get_influxdb_metrics(start_time: datetime, end_time: datetime):
    """Get metrics from InfluxDB"""
    try:
        from db.influxdb_client import query_progress_data
        from core.config import settings

        # Query for total cell executions
        executions_query = f"""
        from(bucket: "{settings.INFLUXDB_BUCKET}")
          |> range(start: {start_time.strftime("%Y-%m-%dT%H:%M:%SZ")}, stop: {end_time.strftime("%Y-%m-%dT%H:%M:%SZ")})
          |> filter(fn: (r) => r._measurement == "student_progress")
          |> filter(fn: (r) => r.event == "cell_executed")
          |> count()
        """

        # Query for execution durations (for average calculation)
        duration_query = f"""
        from(bucket: "{settings.INFLUXDB_BUCKET}")
          |> range(start: {start_time.strftime("%Y-%m-%dT%H:%M:%SZ")}, stop: {end_time.strftime("%Y-%m-%dT%H:%M:%SZ")})
          |> filter(fn: (r) => r._measurement == "student_progress")
          |> filter(fn: (r) => r.event == "cell_executed")
          |> filter(fn: (r) => r._field == "duration")
          |> filter(fn: (r) => r._value > 0)
          |> mean()
        """

        # Query for error rate
        error_query = f"""
        from(bucket: "{settings.INFLUXDB_BUCKET}")
          |> range(start: {start_time.strftime("%Y-%m-%dT%H:%M:%SZ")}, stop: {end_time.strftime("%Y-%m-%dT%H:%M:%SZ")})
          |> filter(fn: (r) => r._measurement == "student_progress")
          |> filter(fn: (r) => r.event == "cell_executed")
          |> filter(fn: (r) => r._field == "success")
          |> filter(fn: (r) => r._value == false)
          |> count()
        """

        # Query for active users
        users_query = f"""
        from(bucket: "{settings.INFLUXDB_BUCKET}")
          |> range(start: {start_time.strftime("%Y-%m-%dT%H:%M:%SZ")}, stop: {end_time.strftime("%Y-%m-%dT%H:%M:%SZ")})
          |> filter(fn: (r) => r._measurement == "student_progress")
          |> filter(fn: (r) => r.event == "cell_executed")
          |> distinct(column: "emailAddress")
          |> count()
        """

        # Execute queries
        total_executions = 0
        average_duration = 0.0
        error_count = 0
        active_users = 0

        try:
            # Get total executions
            exec_result = query_progress_data(executions_query)
            for table in exec_result:
                for record in table:
                    if record.get_value():
                        total_executions = int(record.get_value())
                        break
        except Exception as e:
            print(f"Error querying executions: {e}")

        try:
            # Get average duration
            dur_result = query_progress_data(duration_query)
            for table in dur_result:
                for record in table:
                    if record.get_value():
                        average_duration = (
                            float(record.get_value()) / 1000
                        )  # Convert ms to seconds
                        break
        except Exception as e:
            print(f"Error querying duration: {e}")

        try:
            # Get error count
            err_result = query_progress_data(error_query)
            for table in err_result:
                for record in table:
                    if record.get_value():
                        error_count = int(record.get_value())
                        break
        except Exception as e:
            print(f"Error querying errors: {e}")

        try:
            # Get active users count
            users_result = query_progress_data(users_query)
            for table in users_result:
                for record in table:
                    if record.get_value():
                        active_users = int(record.get_value())
                        break
        except Exception as e:
            print(f"Error querying users: {e}")

        # Calculate error rate
        error_rate = (error_count / total_executions) if total_executions > 0 else 0.0

        return {
            "totalExecutions": total_executions,
            "averageExecutionTime": round(average_duration, 2),
            "errorRate": round(error_rate, 3),
            "activeUsers": active_users,
        }

    except Exception as e:
        print(f"InfluxDB metrics error: {e}")
        return {
            "totalExecutions": 0,
            "averageExecutionTime": 0,
            "errorRate": 0,
            "activeUsers": 0,
        }
