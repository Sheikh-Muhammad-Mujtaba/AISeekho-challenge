"""Chat endpoints — SalesOps Agent entry points (standard + SSE streaming)."""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agent_core.orchestrator import (
    run_orchestrator,
    run_orchestrator_stream,
    SALES_AGENT_SYSTEM_PROMPT,
)
from core.security import get_current_user, decrypt_token
from db.models import User, WorkflowRun
from db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter()

SYSTEM_PROMPT = {"role": "system", "content": SALES_AGENT_SYSTEM_PROMPT}


# ── Schemas ──────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    run_id: str | None = None


class ChatResponse(BaseModel):
    message: str
    run_id: str | None = None


# ── Helpers ──────────────────────────────────────────────────────────────

async def _resolve_run_id(
    run_id: str | None,
    user_id: str,
    db: AsyncSession,
) -> str:
    """Validate or create a WorkflowRun and return its id."""
    if run_id:
        result = await db.execute(
            select(WorkflowRun).where(
                WorkflowRun.id == run_id,
                WorkflowRun.user_id == user_id,
            )
        )
        if result.scalars().first():
            return run_id
        logger.warning("Unknown run_id=%s — creating new run.", run_id)

    db_run = WorkflowRun(
        user_id=user_id,
        workflow_type="chat",
        mode="simulation",
        status="running",
    )
    db.add(db_run)
    await db.commit()
    await db.refresh(db_run)
    return db_run.id


def _build_messages(request: ChatRequest) -> list[dict]:
    """Convert request messages and inject system prompt."""
    msgs = [{"role": m.role, "content": m.content} for m in request.messages]
    if not msgs or msgs[0].get("role") != "system":
        msgs.insert(0, SYSTEM_PROMPT)
    return msgs


# ── POST /chat — non-streaming (backward compat) ────────────────────────

@router.post("/", response_model=ChatResponse)
async def chat_with_agent(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Standard request/response chat endpoint."""
    try:
        run_id = await _resolve_run_id(request.run_id, current_user.id, db)
        messages = _build_messages(request)
        reply = await run_orchestrator(
            messages,
            run_id=run_id,
            google_refresh_token=decrypt_token(current_user.google_refresh_token)
        )
        return ChatResponse(message=reply, run_id=run_id)
    except Exception as exc:
        logger.error("chat_with_agent error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Something went wrong while processing your request.",
        )


# ── POST /chat/stream — SSE streaming ───────────────────────────────────

@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Server-Sent Events streaming endpoint.

    Each SSE line is a JSON object:
      {"type": "agent",       "agent": "AgentName"}
      {"type": "tool",        "tool": "tool_name"}
      {"type": "tool_output", "content": "..."}
      {"type": "token",       "content": "partial text"}
      {"type": "message",     "content": "full message"}
      {"type": "done",        "content": "final output"}
      {"type": "error",       "content": "error msg"}
    """
    run_id = await _resolve_run_id(request.run_id, current_user.id, db)
    messages = _build_messages(request)

    async def event_generator():
        try:
            # Send run_id as first event so the client can track the conversation
            yield f"data: {json.dumps({'type': 'run_id', 'run_id': run_id})}\n\n"
            async for event in run_orchestrator_stream(
                messages,
                run_id=run_id,
                google_refresh_token=decrypt_token(current_user.google_refresh_token)
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as exc:
            logger.error("SSE stream error for run=%s: %s", run_id, exc, exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'content': 'Something went wrong. Please try again.'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
