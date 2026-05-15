"""Dev-only test endpoint — bypasses auth to test the agent loop directly.

⚠️  REMOVE or GATE BEHIND ENV FLAG before production deployment.
"""

import logging
from fastapi import APIRouter
from pydantic import BaseModel

from agents.orchestrator import run_orchestrator

logger = logging.getLogger(__name__)
router = APIRouter()

SYSTEM_PROMPT = {
    "role": "system",
    "content": (
        "You are the SalesOps Agent. You can search Google Places for leads, "
        "score them, create leads in ERPNext, send emails, and schedule meetings. "
        "Always use simulation_mode=true."
    ),
}


class TestChatRequest(BaseModel):
    message: str


@router.post("/agent")
async def test_agent(request: TestChatRequest):
    """Run the full Gemini agent loop in simulation mode — no auth required."""
    messages = [
        SYSTEM_PROMPT,
        {"role": "user", "content": request.message},
    ]
    reply = await run_orchestrator(messages)
    return {"reply": reply}
