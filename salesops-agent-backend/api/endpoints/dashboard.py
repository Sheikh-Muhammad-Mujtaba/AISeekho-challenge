"""Outcome dashboard endpoint — feeds the OutcomeDashboardScreen.

GET /api/workflows/{run_id}/outcome

Returns aggregated impact metrics for a given workflow run:

  { run_id, metrics: { leadsFound, duplicatesPrevented, meetingsScheduled, todosCreated } }
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import get_current_user
from db.models import User, WorkflowRun, ToolCallLog
from db.session import get_db

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Response models ──────────────────────────────────────────────────────

class OutcomeMetrics(BaseModel):
    leadsFound: int = 0
    duplicatesPrevented: int = 0
    meetingsScheduled: int = 0
    todosCreated: int = 0


class OutcomeResponse(BaseModel):
    run_id: str
    metrics: OutcomeMetrics


# ── Endpoint ─────────────────────────────────────────────────────────────

@router.get("/{run_id}/outcome", response_model=OutcomeResponse)
async def get_outcome_metrics(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Compute outcome metrics from tool-call logs for a workflow run."""

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

    # Fetch all tool-call logs for this run
    tool_result = await db.execute(
        select(ToolCallLog).where(ToolCallLog.run_id == run_id)
    )
    tool_logs = tool_result.scalars().all()

    # ── Derive metrics from tool calls ───────────────────────────────
    leads_found = 0
    duplicates_prevented = 0
    meetings_scheduled = 0
    todos_created = 0

    for log in tool_logs:
        name = log.tool_name or ""
        output = log.output_data if isinstance(log.output_data, dict) else {}
        is_success = not log.error and output.get("status") != "error"

        if not is_success:
            continue

        if name == "search_businesses":
            # Count discovered businesses
            data = output.get("data", output.get("results", []))
            if isinstance(data, list):
                leads_found += len(data)
            elif isinstance(data, dict):
                leads_found += data.get("total", 1)

        elif name == "create_erpnext_lead":
            todos_created += 1

        elif name == "analyze_crm_data":
            # If analysis returned duplicate info, count it
            summary = output.get("summary", {})
            if isinstance(summary, dict):
                duplicates_prevented += summary.get("duplicates_found", 0)

        elif name == "create_event":
            meetings_scheduled += 1

    return OutcomeResponse(
        run_id=run_id,
        metrics=OutcomeMetrics(
            leadsFound=leads_found,
            duplicatesPrevented=duplicates_prevented,
            meetingsScheduled=meetings_scheduled,
            todosCreated=todos_created,
        ),
    )
