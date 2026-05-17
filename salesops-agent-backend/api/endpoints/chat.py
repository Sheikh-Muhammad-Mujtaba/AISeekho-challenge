"""Chat endpoints — SalesOps Agent entry points.

POST /chat        → simple response (backward compat)
POST /chat/stream → structured JSON with all phases (agent thinking, tool
                    calls, final answer) so the frontend can render a
                    ChatGPT/Claude-style experience with animations.
GET  /chat/history → returns conversation history for a given run_id.

NOTE: Vercel's Python runtime buffers responses — true SSE streaming is
not possible.  Instead we collect every event during the agent run and
return them as a single JSON body.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agent_core.orchestrator import (
    run_orchestrator,
    run_orchestrator_with_events,
    SALES_AGENT_SYSTEM_PROMPT,
)
from core.security import get_current_user, decrypt_token
from db.models import User, WorkflowRun, ChatMessageLog
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


class ChatHistoryMessage(BaseModel):
    id: str
    role: str
    content: str
    created_at: str


class ChatHistoryResponse(BaseModel):
    run_id: str
    messages: list[ChatHistoryMessage]


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


def _extract_last_user_message(request: ChatRequest) -> str | None:
    """Extract the last user message from the request."""
    for msg in reversed(request.messages):
        if msg.role == "user":
            return msg.content
    return None


async def _save_message(
    db: AsyncSession,
    run_id: str,
    role: str,
    content: str,
) -> None:
    """Persist a single chat message to the database."""
    try:
        msg = ChatMessageLog(
            run_id=run_id,
            role=role,
            content=content,
        )
        db.add(msg)
        await db.commit()
    except Exception as exc:
        logger.error(
            "Failed to save %s message for run=%s: %s",
            role, run_id, exc,
        )
        # Don't fail the request if message persistence fails
        await db.rollback()


# ── POST /chat — simple response (backward compat) ──────────────────────

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

        # Save the user message
        user_text = _extract_last_user_message(request)
        if user_text:
            await _save_message(db, run_id, "user", user_text)

        reply = await run_orchestrator(
            messages,
            run_id=run_id,
            google_refresh_token=decrypt_token(current_user.google_refresh_token)
        )

        # Save the assistant response
        await _save_message(db, run_id, "assistant", reply)

        return ChatResponse(message=reply, run_id=run_id)
    except Exception as exc:
        logger.error("chat_with_agent error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Something went wrong while processing your request.",
        )


# ── POST /chat/stream — structured JSON with all phases ─────────────────

@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns a structured JSON response with all agent phases.

    Response shape:
    {
      "run_id": "uuid",
      "status": "completed" | "failed",
      "steps": [
        {"type": "agent",       "agent": "SalesOpsOrchestrator"},
        {"type": "tool_start",  "tool":  "search_leads_multi"},
        {"type": "tool_result", "tool":  "search_leads_multi",
                                "content": "preview..."},
        {"type": "agent",       "agent": "SalesOpsOrchestrator"},
      ],
      "message": "Here are the results..."
    }

    The frontend can render `steps` sequentially with animations
    (thinking indicator, tool badges, etc.) and display `message`
    with a typewriter effect — giving a ChatGPT/Claude experience
    without requiring true SSE streaming.
    """
    try:
        run_id = await _resolve_run_id(request.run_id, current_user.id, db)
        messages = _build_messages(request)

        # Save the user message
        user_text = _extract_last_user_message(request)
        if user_text:
            await _save_message(db, run_id, "user", user_text)

        result = await run_orchestrator_with_events(
            messages,
            run_id=run_id,
            google_refresh_token=decrypt_token(
                current_user.google_refresh_token
            ),
        )

        final_message = result["message"]

        # Save the assistant response
        await _save_message(db, run_id, "assistant", final_message)

        return {
            "run_id": run_id,
            "status": "completed",
            "steps": result["steps"],
            "message": final_message,
        }

    except Exception as exc:
        logger.error(
            "chat_stream error: %s", exc, exc_info=True
        )
        raise HTTPException(
            status_code=500,
            detail="Something went wrong while processing your request.",
        )


# ── GET /chat/history — conversation history for a run ───────────────────

@router.get("/history", response_model=ChatHistoryResponse)
async def get_chat_history(
    run_id: str = Query(..., description="The workflow run ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the full conversation history (user + assistant messages) for a run."""
    try:
        # Verify ownership
        run_result = await db.execute(
            select(WorkflowRun).where(
                WorkflowRun.id == run_id,
                WorkflowRun.user_id == current_user.id,
            )
        )
        run = run_result.scalars().first()
        if not run:
            raise HTTPException(status_code=404, detail="Run not found")

        # Fetch messages ordered by time
        msg_result = await db.execute(
            select(ChatMessageLog)
            .where(ChatMessageLog.run_id == run_id)
            .order_by(ChatMessageLog.created_at.asc())
        )
        rows = msg_result.scalars().all()

        return ChatHistoryResponse(
            run_id=run_id,
            messages=[
                ChatHistoryMessage(
                    id=row.id,
                    role=row.role,
                    content=row.content,
                    created_at=row.created_at.isoformat() if row.created_at else "",
                )
                for row in rows
            ],
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "get_chat_history failed for run_id=%s: %s",
            run_id, exc, exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve chat history.",
        )
