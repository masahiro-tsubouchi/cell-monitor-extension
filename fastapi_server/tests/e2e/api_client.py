import requests
import time
import asyncio
from typing import List, Dict, Any
from . import e2e_config


class FastAPIClient:
    """Client for interacting with the FastAPI server's test endpoints."""

    def __init__(self, test_id: str):
        self.base_url = e2e_config.FASTAPI_URL
        self.test_id = test_id

    def get_test_events_url(self) -> str:
        return f"{self.base_url}/api/v1/test/events/{self.test_id}"

    async def wait_for_events(
        self, expected_count: int, timeout: int
    ) -> List[Dict[str, Any]]:
        """Polls the test API until the expected number of events are received."""
        print(
            f"⏳ Waiting for {expected_count} event(s) from FastAPI (timeout: {timeout}s)"
        )
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                response = requests.get(self.get_test_events_url(), timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    events = data.get("events", [])
                    if len(events) >= expected_count:
                        print(f"✅ Received {len(events)} event(s).")
                        return events
                else:
                    print(
                        f"... API not ready or error (status: {response.status_code})"
                    )
            except requests.RequestException as e:
                print(f"... API request failed: {e}")
            await asyncio.sleep(e2e_config.API_POLL_INTERVAL)

        print("⏰ Timeout reached waiting for events.")
        return []

    def cleanup_test_data(self):
        """Deletes all events associated with the current test ID."""
        print(f"🧹 Cleaning up test data for test ID: {self.test_id}")
        try:
            response = requests.delete(self.get_test_events_url(), timeout=10)
            if response.status_code == 200:
                print("✅ Test data cleaned up successfully.")
            else:
                print(
                    f"⚠️  Failed to clean up test data (status: {response.status_code})"
                )
        except requests.RequestException as e:
            print(f"⚠️  An error occurred during test data cleanup: {e}")
