from fastapi import APIRouter

from api.endpoints import websocket, events

api_router = APIRouter()
api_router.include_router(events.router, tags=["events"])
api_router.include_router(websocket.router, tags=["websocket"])
