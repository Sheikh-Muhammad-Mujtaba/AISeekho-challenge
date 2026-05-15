"""Chat endpoint — mobile app entry point for the SalesOps Agent."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from agents.orchestrator import run_orchestrator
from core.security import get_current_user
from db.models import User

router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    run_id: str | None = None


class ChatResponse(BaseModel):
    message: str
    run_id: str | None = None


SYSTEM_PROMPT = {
    "role": "system",
    "content": (
        "You are the SalesOps Agent, an autonomous AI assistant for sales teams. "
        "You can search Google Places for potential leads, score and deduplicate them, "
        "create leads in ERPNext CRM, fetch quotation links, send emails via Gmail, "
        "check calendar availability, and schedule meetings. "
        "Always default to simulation_mode=true unless the user explicitly says to execute for real."
    ),
}


@router.post("/", response_model=ChatResponse)
async def chat_with_agent(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    """Main entry point for interacting with the SalesOps Agent."""
    try:
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]

        # Inject system prompt if not already present
        if not messages or messages[0].get("role") != "system":
            messages.insert(0, SYSTEM_PROMPT)

        reply = await run_orchestrator(messages)
        return ChatResponse(message=reply, run_id=request.run_id)

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
