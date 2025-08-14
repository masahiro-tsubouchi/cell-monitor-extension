from fastapi import APIRouter
from api.endpoints import (
    events,
    test_events,
    websocket,
    cell_monitor,
    progress,
    classes,
    assignments,
    submissions,
    offline_sync,
    environment,
    realtime_progress,
    notebook_version,
    auth,
    instructor_websocket,
    instructors,
    instructor_status,
    dashboard,
    dashboard_websocket,
    classroom,
)

api_router = APIRouter()

api_router.include_router(events.router, prefix="", tags=["events"])
api_router.include_router(websocket.router, prefix="/v1", tags=["websocket"])
api_router.include_router(test_events.router, prefix="/v1/test", tags=["testing"])
api_router.include_router(progress.router, prefix="/progress", tags=["progress"])
api_router.include_router(cell_monitor.router, prefix="/v1", tags=["cell_monitor"])
api_router.include_router(classes.router, prefix="/classes", tags=["lms"])
api_router.include_router(assignments.router, prefix="/assignments", tags=["lms"])
api_router.include_router(submissions.router, prefix="/submissions", tags=["lms"])
api_router.include_router(
    environment.router, prefix="/v1/environment", tags=["environment"]
)
api_router.include_router(offline_sync.router, prefix="/v1/offline", tags=["offline"])
api_router.include_router(
    realtime_progress.router, prefix="/v1/progress", tags=["realtime_progress"]
)
api_router.include_router(
    notebook_version.router, prefix="/v1/notebook-version", tags=["notebook_version"]
)
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(
    instructor_websocket.router, prefix="/instructor", tags=["instructor_websocket"]
)
api_router.include_router(
    instructors.router, prefix="/instructors", tags=["instructor_management"]
)
api_router.include_router(
    instructor_status.router, prefix="/instructor_status", tags=["instructor_status"]
)
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(
    dashboard_websocket.router, prefix="/dashboard", tags=["dashboard_websocket"]
)
api_router.include_router(classroom.router, prefix="/classroom", tags=["classroom"])
