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
    notebook_version
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
api_router.include_router(environment.router, prefix="/v1/environment", tags=["environment"])
api_router.include_router(offline_sync.router, prefix="/v1/offline", tags=["offline"])
api_router.include_router(realtime_progress.router, prefix="/v1/progress", tags=["realtime_progress"])
api_router.include_router(notebook_version.router, prefix="/v1/notebook-version", tags=["notebook_version"])
