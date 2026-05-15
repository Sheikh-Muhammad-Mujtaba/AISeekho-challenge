"""Google Calendar API MCP tool adapter.

Provides tools to check availability and create calendar events
for the SalesOps agent when meeting intent is detected.
"""

import httpx
import logging
from datetime import datetime, timedelta
from typing import Any
from pydantic import BaseModel, Field
from core.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Input / Output schemas
# ---------------------------------------------------------------------------

class CheckAvailabilityInput(BaseModel):
    """Input schema for checking calendar availability."""
    date: str = Field(..., description="Date to check in YYYY-MM-DD format")
    timezone: str = Field("Asia/Karachi", description="IANA timezone")
    simulation_mode: bool = Field(True)


class CreateEventInput(BaseModel):
    """Input schema for creating a Google Calendar event."""
    summary: str = Field(..., description="Event title, e.g. 'Meeting with Al-Shifa Clinic'")
    description: str = Field("", description="Event description / notes")
    start_datetime: str = Field(..., description="ISO-8601 start, e.g. '2026-05-20T10:00:00'")
    end_datetime: str = Field(..., description="ISO-8601 end, e.g. '2026-05-20T11:00:00'")
    timezone: str = Field("Asia/Karachi", description="IANA timezone")
    attendee_emails: list[str] = Field(default_factory=list, description="Email addresses of attendees")
    simulation_mode: bool = Field(True)


# ---------------------------------------------------------------------------
# Demo data
# ---------------------------------------------------------------------------

DEMO_BUSY_SLOTS = [
    {"start": "09:00", "end": "10:00", "summary": "Team standup"},
    {"start": "14:00", "end": "15:00", "summary": "Product review"},
]


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------

async def check_availability(input_data: CheckAvailabilityInput) -> dict[str, Any]:
    """Check calendar availability for a given date.

    In simulation mode, returns hardcoded busy slots so the agent can
    reason about scheduling without real credentials.
    """
    if input_data.simulation_mode:
        logger.info("check_availability [simulation]: returning demo busy slots for %s", input_data.date)
        return {
            "status": "success",
            "message": f"Simulated availability for {input_data.date}",
            "date": input_data.date,
            "timezone": input_data.timezone,
            "busy_slots": DEMO_BUSY_SLOTS,
            "suggested_free_slots": [
                {"start": "10:00", "end": "12:00"},
                {"start": "15:00", "end": "17:00"},
            ],
        }

    # --- Real Google Calendar FreeBusy query ---
    # Requires a valid OAuth2 access token stored server-side.
    # For the hackathon demo we fall back to simulation.
    return {
        "status": "error",
        "message": "Real Google Calendar integration requires OAuth2 credentials. Falling back to simulation.",
    }


async def create_event(input_data: CreateEventInput) -> dict[str, Any]:
    """Create a Google Calendar event.

    In simulation mode, returns a mock event object. In real mode,
    calls the Google Calendar v3 API.
    """
    if input_data.simulation_mode:
        event_id = f"sim_evt_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        logger.info("create_event [simulation]: created event %s", event_id)
        return {
            "status": "success",
            "message": "Simulated event creation",
            "data": {
                "event_id": event_id,
                "summary": input_data.summary,
                "start": input_data.start_datetime,
                "end": input_data.end_datetime,
                "timezone": input_data.timezone,
                "attendees": input_data.attendee_emails,
                "html_link": f"https://calendar.google.com/calendar/event?eid={event_id}",
            },
        }

    # --- Real Google Calendar v3 insert ---
    # POST https://www.googleapis.com/calendar/v3/calendars/primary/events
    # Requires OAuth2 Bearer token.
    # We would build the event resource and call the API here.
    # For the hackathon MVP we fall back to simulation with a warning.
    return {
        "status": "error",
        "message": "Real Google Calendar integration requires OAuth2 credentials. Falling back to simulation.",
    }
