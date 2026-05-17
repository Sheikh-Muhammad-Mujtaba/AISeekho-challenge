"""Custom TracingProcessor — persists tool calls and audit traces to Postgres.

The SDK's TracingProcessor callbacks are **synchronous**, so we schedule
async DB writes on the running event loop via `asyncio.create_task`.

Architecture (from SDK docs):
  - `span.span_data` holds the typed data object (FunctionSpanData, etc.)
  - `span.span_data.type` returns the string discriminator
  - `span.export()` wraps span_data inside `{"span_data": {...}}` — we
    access `.span_data` directly to avoid nesting confusion.

Span types captured:
  function   → ToolCallLog  (individual tool invocation)
  agent      → AuditTrace   (sub-agent delegation record)
  generation → AuditTrace   (LLM reasoning step + tokens/cost)
  handoff    → AuditTrace   (agent hand-off record)
"""

import asyncio
import json
import logging
from contextvars import ContextVar
from datetime import datetime

from agents.tracing import TracingProcessor

from db.models import ToolCallLog, AuditTrace
from db.session import AsyncSessionLocal

logger = logging.getLogger(__name__)

# ── Context variable — set by the orchestrator before each Runner call ───
current_run_id: ContextVar[str | None] = ContextVar("current_run_id", default=None)

# ── Approximate pricing per 1M tokens (USD) ─────────────────────────────
# Source: public pricing pages. Update as needed.
MODEL_PRICING: dict[str, dict[str, float]] = {
    "gemini-2.5-pro":        {"input": 1.25, "output": 10.00},
    "gemini-2.5-flash":      {"input": 0.15, "output": 0.60},
    "gemini-2.5-flash-lite": {"input": 0.075, "output": 0.30},
    "z-ai/glm-4.5-air:free": {"input": 0.0,  "output": 0.0},
}


def _estimate_cost(model: str | None, input_t: int, output_t: int) -> float | None:
    """Estimate USD cost for a generation span."""
    if not model:
        return None
    prices = MODEL_PRICING.get(model)
    if not prices:
        return None
    return round(
        (input_t / 1_000_000) * prices["input"]
        + (output_t / 1_000_000) * prices["output"],
        8,
    )


# ── Sync-safe task scheduler ────────────────────────────────────────────

def _schedule(coro) -> None:
    """Schedule an async coroutine from a synchronous callback."""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(coro)
    except RuntimeError:
        logger.debug("No running event loop — skipping async DB write.")


# ── DB persistence helpers ───────────────────────────────────────────────

def _now() -> datetime:
    """Naive UTC datetime — matches the DB model's default=datetime.utcnow."""
    return datetime.utcnow()


async def _write_tool_call(
    run_id: str,
    tool_name: str,
    input_data: dict | None,
    output_data: dict | str | None,
    error: str | None,
    duration_ms: int | None = None,
) -> None:
    """Insert a ToolCallLog row."""
    try:
        async with AsyncSessionLocal() as session:
            session.add(ToolCallLog(
                run_id=run_id,
                tool_name=tool_name,
                input_data=input_data or {},
                output_data=(
                    output_data if isinstance(output_data, dict)
                    else {"raw": str(output_data)} if output_data else {}
                ),
                error=error,
                duration_ms=duration_ms,
                created_at=_now(),
            ))
            await session.commit()
        logger.info("✓ ToolCallLog: tool=%s run=%s", tool_name, run_id)
    except Exception:
        logger.exception("✗ ToolCallLog failed: tool=%s", tool_name)


async def _write_audit_trace(
    run_id: str,
    agent_name: str,
    thought: str,
    *,
    model_name: str | None = None,
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    cost_usd: float | None = None,
) -> None:
    """Insert an AuditTrace row."""
    try:
        async with AsyncSessionLocal() as session:
            session.add(AuditTrace(
                run_id=run_id,
                agent_name=agent_name,
                thought_process=thought,
                model_name=model_name,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=cost_usd,
                created_at=_now(),
            ))
            await session.commit()
        logger.info("✓ AuditTrace: agent=%s model=%s run=%s", agent_name, model_name, run_id)
    except Exception:
        logger.exception("✗ AuditTrace failed: agent=%s", agent_name)


# ── JSON helpers ─────────────────────────────────────────────────────────

def _safe_json(val: str | dict | None) -> dict | None:
    if val is None:
        return None
    if isinstance(val, dict):
        return val
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return {"raw": str(val)}


# ── DatabaseTracingProcessor ────────────────────────────────────────────

class DatabaseTracingProcessor(TracingProcessor):
    """Intercepts SDK trace/span lifecycle and logs to the database."""

    # ── Trace lifecycle ──────────────────────────────────────────────

    def on_trace_start(self, trace) -> None:
        run_id = current_run_id.get()
        logger.info(
            "[Trace START] trace_id=%s workflow=%s run_id=%s",
            getattr(trace, "trace_id", "?"),
            getattr(trace, "name", "?"),
            run_id,
        )

    def on_trace_end(self, trace) -> None:
        run_id = current_run_id.get()
        if not run_id:
            return
        workflow = getattr(trace, "name", "SalesOpsAgent")
        _schedule(_write_audit_trace(
            run_id=run_id,
            agent_name=workflow,
            thought=f"Trace completed: {getattr(trace, 'trace_id', '?')}",
        ))

    # ── Span lifecycle ───────────────────────────────────────────────

    def on_span_start(self, span) -> None:
        sd = getattr(span, "span_data", None)
        logger.debug(
            "[Span START] type=%s",
            getattr(sd, "type", "?") if sd else "no_span_data",
        )

    def on_span_end(self, span) -> None:
        run_id = current_run_id.get()
        if not run_id:
            return

        sd = getattr(span, "span_data", None)
        if sd is None:
            return

        span_type = getattr(sd, "type", "unknown")
        span_error = getattr(span, "_error", None) or getattr(span, "error", None)

        logger.info(
            "[Span END] type=%s name=%s run_id=%s",
            span_type, getattr(sd, "name", "?"), run_id,
        )

        # ── function → ToolCallLog ───────────────────────────────
        if span_type == "function":
            # Calculate duration from span timestamps
            started = getattr(span, "_started_at", None)
            ended = getattr(span, "_ended_at", None)
            dur = None
            if started and ended:
                try:
                    dur = int((ended - started) * 1000)
                except Exception:
                    pass

            _schedule(_write_tool_call(
                run_id=run_id,
                tool_name=getattr(sd, "name", "unknown_tool"),
                input_data=_safe_json(getattr(sd, "input", None)),
                output_data=_safe_json(
                    str(getattr(sd, "output", None))
                    if getattr(sd, "output", None) is not None
                    else None
                ),
                error=str(span_error) if span_error else None,
                duration_ms=dur,
            ))

        # ── agent → AuditTrace ───────────────────────────────────
        elif span_type == "agent":
            name = getattr(sd, "name", "UnknownAgent")
            tools = getattr(sd, "tools", []) or []
            _schedule(_write_audit_trace(
                run_id=run_id,
                agent_name=name,
                thought=f"Agent '{name}' executed. Tools: {tools}",
            ))

        # ── generation → AuditTrace with tokens + cost ───────────
        elif span_type == "generation":
            model = getattr(sd, "model", None)
            usage = getattr(sd, "usage", {}) or {}
            in_tok = usage.get("input_tokens", 0) or 0
            out_tok = usage.get("output_tokens", 0) or 0
            cost = _estimate_cost(model, in_tok, out_tok)

            _schedule(_write_audit_trace(
                run_id=run_id,
                agent_name=model or "LLM",
                thought=(
                    f"LLM call (model={model}): "
                    f"{in_tok} in / {out_tok} out tokens"
                ),
                model_name=model,
                input_tokens=in_tok,
                output_tokens=out_tok,
                cost_usd=cost,
            ))

        # ── handoff → AuditTrace ─────────────────────────────────
        elif span_type == "handoff":
            from_a = getattr(sd, "from_agent", "?")
            to_a = getattr(sd, "to_agent", "?")
            _schedule(_write_audit_trace(
                run_id=run_id,
                agent_name=from_a,
                thought=f"Handoff: '{from_a}' → '{to_a}'",
            ))

    # ── Required interface methods ───────────────────────────────────

    def shutdown(self) -> None:
        logger.info("DatabaseTracingProcessor shutting down.")

    def force_flush(self) -> None:
        pass
