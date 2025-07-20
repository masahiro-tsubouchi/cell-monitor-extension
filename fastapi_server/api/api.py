from fastapi import APIRouter
from api.endpoints import (
    cell_monitor,
    events,
    progress,
    test_events,
    websocket,
    classes,
    assignments,
    submissions,
)

api_router = APIRouter()

api_router.include_router(events.router, prefix="/v1", tags=["events"])
api_router.include_router(websocket.router, prefix="/v1", tags=["websocket"])
api_router.include_router(test_events.router, prefix="/v1/test", tags=["testing"])
api_router.include_router(progress.router, prefix="/v1", tags=["progress"])
api_router.include_router(cell_monitor.router, prefix="/v1", tags=["cell_monitor"])
api_router.include_router(classes.router, prefix="/classes", tags=["lms"])
api_router.include_router(assignments.router, prefix="/assignments", tags=["lms"])
api_router.include_router(submissions.router, prefix="/submissions", tags=["lms"])
