"""Chat endpoint — mobile app entry point for the SalesOps Agent."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agents.orchestrator import run_orchestrator, SALES_AGENT_SYSTEM_PROMPT
from core.security import get_current_user
from db.models import User, WorkflowRun
from db.session import get_db

logger = logging.getLogger(__name__)

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
    "content": SALES_AGENT_SYSTEM_PROMPT,
}


@router.post("/", response_model=ChatResponse)
async def chat_with_agent(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Main entry point for interacting with the SalesOps Agent."""
    logger.info(
        "Chat request from user %s: %d messages",
        current_user.email,
        len(request.messages),
    )

    try:
        # ── Ensure we have a valid WorkflowRun for logging ──────────
        run_id = request.run_id
        if run_id:
            # Validate the client-supplied run_id actually exists in the DB
            result = await db.execute(
                select(WorkflowRun).where(
                    WorkflowRun.id == run_id,
                    WorkflowRun.user_id == current_user.id,
                )
            )
            existing_run = result.scalars().first()
            if not existing_run:
                logger.warning(
                    "Client sent unknown run_id=%s — creating a new run.",
                    run_id,
                )
                run_id = None  # fall through to creation below

        if not run_id:
            db_run = WorkflowRun(
                user_id=current_user.id,
                workflow_type="chat",
                mode="simulation",
                status="running",
            )
            db.add(db_run)
            await db.commit()
            await db.refresh(db_run)
            run_id = db_run.id

        # ── Build messages for the model ────────────────────────────
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]

        # Inject system prompt if not already present
        if not messages or messages[0].get("role") != "system":
            messages.insert(0, SYSTEM_PROMPT)

        reply = await run_orchestrator(messages, run_id=run_id, db=db)
        logger.info("Successfully generated agent response.")

        return ChatResponse(message=reply, run_id=run_id)

    except Exception as exc:
        logger.error("Internal Error in chat_with_agent: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"SalesOps Agent Error: {str(exc)}",
        )
