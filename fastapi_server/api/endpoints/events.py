from fastapi import APIRouter, Depends
from typing import List

from db.redis_client import get_redis_client, NOTIFICATION_CHANNEL
from schemas.event import EventData

router = APIRouter()


@router.post("/events", status_code=202)
async def receive_events(
    events: List[EventData], redis_client=Depends(get_redis_client)
):
    """
    Receives a list of events, validates them, and publishes them to Redis.
    """
    # Log received data for debugging
    for event in events:
        print(
            f"--- Received Event Data ---\n{event.model_dump_json(indent=2)}\n------------------------------------"
        )
        # Here you can add logic to dispatch to different channels based on event.eventType
        await redis_client.publish(NOTIFICATION_CHANNEL, event.model_dump_json())

    return {"message": f"{len(events)} events received and queued for processing."}
