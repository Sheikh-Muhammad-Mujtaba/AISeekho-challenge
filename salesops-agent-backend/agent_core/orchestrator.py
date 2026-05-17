"""SalesOps Agent Orchestrator.

Implements the autonomous agent loop using the official openai-agents SDK.

Model routing:
  Heavy  (gemini-2.5-pro)           → SalesOpsOrchestrator
  Medium (gemini-2.5-flash)         → LeadGenAgent, OutreachAgent
  Light  (OpenRouter glm-4.5-air)   → CRMAgent

Tracing is handled by DatabaseTracingProcessor (agent_core/tracing.py)
which persists ToolCallLog and AuditTrace rows automatically.
"""

import logging
from typing import AsyncGenerator

from agents import (
    Agent,
    Runner,
    function_tool,
    RunContextWrapper,
    ItemHelpers,
    AsyncOpenAI,
    OpenAIChatCompletionsModel,
)
from agents.tracing import set_trace_processors

from core.config import settings
from agent_core.tracing import DatabaseTracingProcessor, current_run_id, flush_pending_writes

logger = logging.getLogger(__name__)

# ── Tracing ──────────────────────────────────────────────────────────────

set_trace_processors([DatabaseTracingProcessor()])

# ── Model factory ────────────────────────────────────────────────────────


def _make_model(api_key: str, base_url: str, model_name: str):
    """Create an OpenAI-compatible model instance."""
    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    return OpenAIChatCompletionsModel(model=model_name, openai_client=client)


# Gemini tiers
model_heavy = _make_model(
    settings.GEMINI_API_KEY,
    settings.GEMINI_BASE_URL,
    settings.GEMINI_MODEL_HEAVY,
)
model_medium = _make_model(
    settings.GEMINI_API_KEY,
    settings.GEMINI_BASE_URL,
    settings.GEMINI_MODEL_MEDIUM,
)

# OpenRouter (CRM agent) — falls back to Gemini light if no key is set
if settings.OPENROUTER_API_KEY:
    model_openrouter = _make_model(
        settings.OPENROUTER_API_KEY,
        settings.OPENROUTER_BASE_URL,
        settings.OPENROUTER_MODEL,
    )
    logger.info("CRM agent using OpenRouter: %s", settings.OPENROUTER_MODEL)
else:
    model_openrouter = _make_model(
        settings.GEMINI_API_KEY,
        settings.GEMINI_BASE_URL,
        settings.GEMINI_MODEL_LIGHT,
    )
    logger.info(
        "No OPENROUTER_API_KEY — CRM agent falling back to %s",
        settings.GEMINI_MODEL_LIGHT,
    )


# ── Agent Context ────────────────────────────────────────────────────────

from dataclasses import dataclass


@dataclass
class AgentContext:
    run_id: str
    google_refresh_token: str | None = None


# ── Tool wrappers ────────────────────────────────────────────────────────

from mcp_tools.erpnext import (
    create_erpnext_lead, read_erpnext_lead, update_erpnext_lead,
    analyze_crm_data, get_chatbot_link,
    CreateLeadInput, ReadLeadInput, UpdateLeadInput, AnalyzeCrmInput,
)
from mcp_tools.gmail import send_email
from mcp_tools.google_places import (
    search_businesses, search_leads_multi, get_place_details,
    SearchBusinessesInput, SearchLeadsMultiInput, GetPlaceDetailsInput,
)
from mcp_tools.google_calendar import (
    check_availability, create_event,
    CheckAvailabilityInput, CreateEventInput,
)


async def _call(tool_name: str, arguments: dict, context: AgentContext = None) -> dict:
    """Route a tool-call request to the correct MCP tool implementation."""
    try:
        logger.info("Executing tool: %s", tool_name)
        # Inject context-aware tokens if needed
        if tool_name in ["check_availability", "create_event"] and context:
            arguments["refresh_token"] = context.google_refresh_token

        match tool_name:
            case "create_erpnext_lead":
                return await create_erpnext_lead(CreateLeadInput(**arguments))
            case "read_erpnext_lead":
                return await read_erpnext_lead(ReadLeadInput(**arguments))
            case "update_erpnext_lead":
                return await update_erpnext_lead(UpdateLeadInput(**arguments))
            case "analyze_crm_data":
                return await analyze_crm_data(AnalyzeCrmInput(**arguments))
            case "get_chatbot_link":
                return await get_chatbot_link(arguments["lead_id"])
            case "send_email":
                return await send_email(
                    arguments["to_email"], arguments["subject"],
                    arguments["body"], arguments.get("simulation_mode", True),
                )
            case "search_businesses":
                return await search_businesses(SearchBusinessesInput(**arguments))
            case "search_leads_multi":
                return await search_leads_multi(SearchLeadsMultiInput(**arguments))
            case "get_place_details":
                return await get_place_details(GetPlaceDetailsInput(**arguments))
            case "check_availability":
                return await check_availability(CheckAvailabilityInput(**arguments))
            case "create_event":
                return await create_event(CreateEventInput(**arguments))
            case _:
                return {"error": f"Unknown tool: {tool_name}"}
    except Exception as exc:
        logger.error("Tool failed [%s]: %s", tool_name, exc, exc_info=True)
        return {"error": str(exc)}


# ── Function Tools (SDK-registered) ──────────────────────────────────────

@function_tool
async def create_erpnext_lead_tool(
    wrapper: RunContextWrapper[AgentContext],
    first_name: str, mobile_no: str, email_id: str,
    simulation_mode: bool = True,
) -> dict:
    """Creates a lead in ERPNext CRM with optional quotation line items."""
    return await _call("create_erpnext_lead", {
        "first_name": first_name, "mobile_no": mobile_no,
        "email_id": email_id, "simulation_mode": simulation_mode,
    }, context=wrapper.context)


@function_tool
async def read_erpnext_lead_tool(
    wrapper: RunContextWrapper[AgentContext],
    lead_id: str, simulation_mode: bool = True,
) -> dict:
    """Retrieves lead details from ERPNext CRM by Lead ID."""
    return await _call("read_erpnext_lead", {
        "lead_id": lead_id, "simulation_mode": simulation_mode,
    }, context=wrapper.context)


@function_tool
async def update_erpnext_lead_tool(
    wrapper: RunContextWrapper[AgentContext],
    lead_id: str, status: str = None, lead_name: str = None,
    notes: str = None, phone: str = None, email_id: str = None,
    simulation_mode: bool = True,
) -> dict:
    """Updates an existing lead in ERPNext CRM."""
    return await _call("update_erpnext_lead", {
        "lead_id": lead_id, "status": status, "lead_name": lead_name,
        "notes": notes, "phone": phone, "email_id": email_id,
        "simulation_mode": simulation_mode,
    }, context=wrapper.context)


@function_tool
async def analyze_crm_data_tool(
    wrapper: RunContextWrapper[AgentContext],
    doctype: str = "Lead", limit: int = 20,
    simulation_mode: bool = True,
) -> dict:
    """Fetches and summarises CRM data from ERPNext."""
    return await _call("analyze_crm_data", {
        "doctype": doctype, "limit": limit, "simulation_mode": simulation_mode,
    }, context=wrapper.context)


@function_tool
async def get_chatbot_link_tool(
    wrapper: RunContextWrapper[AgentContext], lead_id: str,
) -> dict:
    """Fetches the quotation / chatbot link for a given Lead ID."""
    return await _call("get_chatbot_link", {"lead_id": lead_id}, context=wrapper.context)


@function_tool
async def send_email_tool(
    wrapper: RunContextWrapper[AgentContext],
    to_email: str, subject: str, body: str,
    simulation_mode: bool = True,
) -> dict:
    """Sends an email to a lead or attendee using Gmail."""
    return await _call("send_email", {
        "to_email": to_email, "subject": subject,
        "body": body, "simulation_mode": simulation_mode,
    }, context=wrapper.context)


@function_tool
async def search_businesses_tool(
    wrapper: RunContextWrapper[AgentContext],
    query: str, max_results: int = 20, simulation_mode: bool = True,
) -> dict:
    """Search for businesses using Google Places."""
    return await _call("search_businesses", {
        "query": query, "max_results": max_results,
        "simulation_mode": simulation_mode,
    }, context=wrapper.context)


@function_tool
async def search_leads_multi_tool(
    wrapper: RunContextWrapper[AgentContext],
    industry: str, location: str,
    max_results_per_query: int = 10, simulation_mode: bool = True,
) -> dict:
    """Primary lead discovery tool with parallel search + dedup."""
    return await _call("search_leads_multi", {
        "industry": industry, "location": location,
        "max_results_per_query": max_results_per_query,
        "simulation_mode": simulation_mode,
    }, context=wrapper.context)


@function_tool
async def get_place_details_tool(
    wrapper: RunContextWrapper[AgentContext],
    place_id: str, simulation_mode: bool = True,
) -> dict:
    """Fetch detailed information about a place by Google Place ID."""
    return await _call("get_place_details", {
        "place_id": place_id, "simulation_mode": simulation_mode,
    }, context=wrapper.context)


@function_tool
async def check_availability_tool(
    wrapper: RunContextWrapper[AgentContext],
    date: str, timezone: str = "Asia/Karachi",
) -> dict:
    """Check calendar availability for a given date."""
    return await _call("check_availability", {
        "date": date, "timezone": timezone,
    }, context=wrapper.context)


@function_tool
async def create_event_tool(
    wrapper: RunContextWrapper[AgentContext],
    summary: str, start_datetime: str, end_datetime: str = None,
    description: str = "", timezone: str = "Asia/Karachi",
    attendee_emails: list[str] = None,
) -> dict:
    """Create a Google Calendar event."""
    return await _call("create_event", {
        "summary": summary, "start_datetime": start_datetime,
        "end_datetime": end_datetime, "description": description,
        "timezone": timezone, "attendee_emails": attendee_emails or [],
    }, context=wrapper.context)


# ── Sub-agents (each with its own model tier) ────────────────────────────

lead_gen_agent = Agent[AgentContext](
    name="LeadGenAgent",
    model=model_medium,  # gemini-2.5-flash
    instructions=(
        "You are a specialized Lead Generation Agent. Your job is to discover and enrich leads. "
        "1. Use `search_leads_multi_tool` for broad discovery based on industry and location. "
        "2. Rank results by rating and review count. "
        "3. Enrich top prospects using `get_place_details_tool`. "
        "Always output structured and concise data. Ensure simulation_mode=true unless specified."
    ),
    tools=[search_leads_multi_tool, search_businesses_tool, get_place_details_tool],
)

crm_agent = Agent[AgentContext](
    name="CRMAgent",
    model=model_openrouter,  # OpenRouter z-ai/glm-4.5-air:free (or Gemini-lite fallback)
    instructions=(
        "You are a specialized CRM Management Agent operating ERPNext. "
        "1. Create leads using `create_erpnext_lead_tool` and update them with `update_erpnext_lead_tool`. "
        "2. Read lead details with `read_erpnext_lead_tool`. "
        "3. Analyze pipeline health and insights with `analyze_crm_data_tool`. "
        "Ensure simulation_mode=true unless specified."
    ),
    tools=[
        create_erpnext_lead_tool, read_erpnext_lead_tool,
        update_erpnext_lead_tool, analyze_crm_data_tool, get_chatbot_link_tool,
    ],
)

outreach_agent = Agent[AgentContext](
    name="OutreachAgent",
    model=model_medium,  # gemini-2.5-flash
    instructions=(
        "You are a specialized Outreach Agent focused on communications and scheduling. "
        "Email Strategy: "
        "1. Draft and send emails using `send_email_tool`. "
        "Calendar & Scheduling Strategy: "
        "1. ALWAYS check calendar availability with `check_availability_tool` for the specific date before scheduling, to avoid conflicts. "
        "2. When creating an event, use `create_event_tool`. You MUST provide `start_datetime` and `end_datetime` in strict ISO-8601 format (e.g., 'YYYY-MM-DDTHH:MM:SS'). "
        "3. If meeting duration is unspecified, assume 1 hour. Include all relevant `attendee_emails` and a detailed `summary` and `description`. "
        "Ensure simulation_mode=true unless specified otherwise."
    ),
    tools=[send_email_tool, check_availability_tool, create_event_tool],
)

SALES_AGENT_SYSTEM_PROMPT = """\
Role: SalesOps Orchestrator — autonomous lead-gen specialist + ERPNext CRM operator.

You manage specialized agents:
- lead_generation: Discover and enrich leads.
- crm_management: Manage and analyze CRM data.
- outreach: Draft emails and schedule meetings.

# Strategy
1. Delegate broad discovery requests to `lead_generation`.
2. Delegate CRM tasks (creating leads, pipeline analysis) to `crm_management`.
3. Delegate communications to `outreach`.

# Ambiguity Protocol
IF intent unclear OR missing params (industry, city, lead-ID):
  → Ask ONE targeted clarification question. Do NOT guess or hallucinate parameters.

# Time & Date Resolution
- You will receive the 'Current Date and Time' in the [System Context] of your input.
- Always resolve relative dates (e.g., "tomorrow", "next week") to absolute dates (e.g., "2026-05-18") BEFORE delegating to any sub-agents.
- If no date/time is provided for an action that requires one, assume the current or next upcoming suitable time based on the context.

# Output Rules
- Currency: PKR. Dates: DD-MMM-YYYY. Phone: +92-xxx.
- Always end with a "Next Best Action" suggestion.
- Be concise; use tables for multi-row data.
"""

orchestrator_agent = Agent[AgentContext](
    name="SalesOpsOrchestrator",
    model=model_heavy,  # gemini-2.5-pro — complex multi-step reasoning
    instructions=SALES_AGENT_SYSTEM_PROMPT,
    tools=[
        lead_gen_agent.as_tool(
            tool_name="lead_generation",
            tool_description="Discover and enrich leads",
        ),
        crm_agent.as_tool(
            tool_name="crm_management",
            tool_description="Manage and analyze CRM data",
        ),
        outreach_agent.as_tool(
            tool_name="outreach",
            tool_description="Draft emails and schedule meetings",
        ),
    ],
)


# ── Helper: build full prompt from message history ───────────────────────

from datetime import datetime

def _get_current_datetime_context() -> str:
    """Returns the current date and time formatted for the agent."""
    now = datetime.now()
    # E.g., 'Monday, 2026-05-17 03:45 PM'
    formatted = now.strftime("%A, %Y-%m-%d %I:%M %p")
    return (
        f"\n[System Context]\n"
        f"Current Date and Time: {formatted}\n"
        f"Use this current date/time to resolve any relative time references in the user's request "
        f"(e.g., 'tomorrow', 'next Monday', 'in 2 days').\n"
    )

def _build_input(messages: list[dict]) -> str:
    """Serialize conversation history into a single prompt string."""
    last_user_msg = ""
    for msg in reversed(messages):
        role = msg.get("role", "") if isinstance(msg, dict) else getattr(msg, "role", "")
        content = msg.get("content", "") if isinstance(msg, dict) else getattr(msg, "content", "")
        if role == "user":
            last_user_msg = content
            break

    history = "\n".join(
        f"{m['role'] if isinstance(m, dict) else m.role}: "
        f"{m['content'] if isinstance(m, dict) else m.content}"
        for m in messages
    )
    
    time_context = _get_current_datetime_context()
    return f"Conversation History:\n{history}\n{time_context}\nUser Request: {last_user_msg}"


# ── Public API: non-streaming ────────────────────────────────────────────

async def _update_run_status(run_id: str, status: str) -> None:
    """Update the WorkflowRun row status (completed / failed)."""
    try:
        async with AsyncSessionLocal() as session:
            from sqlalchemy import update
            from db.models import WorkflowRun
            await session.execute(
                update(WorkflowRun)
                .where(WorkflowRun.id == run_id)
                .values(status=status)
            )
            await session.commit()
            logger.info("WorkflowRun %s → %s", run_id, status)
    except Exception:
        logger.exception("Failed to update run status for %s", run_id)


async def run_orchestrator(
    messages: list,
    *,
    run_id: str | None = None,
    google_refresh_token: str | None = None,
) -> str:
    """Run the agent orchestration loop (non-streaming)."""
    token = current_run_id.set(run_id)
    try:
        context = AgentContext(
            run_id=run_id or "",
            google_refresh_token=google_refresh_token
        )
        result = await Runner.run(
            starting_agent=orchestrator_agent,
            input=_build_input(messages),
            context=context,
        )
        output = result.final_output or "I processed your request but didn't generate a text response."
        # Flush all queued tracing writes before the response returns
        await flush_pending_writes()
        if run_id:
            await _update_run_status(run_id, "completed")
        return output
    except Exception:
        if run_id:
            await _update_run_status(run_id, "failed")
        await flush_pending_writes()
        raise
    finally:
        current_run_id.reset(token)


# ── Public API: streaming ────────────────────────────────────────────────

from openai.types.responses import ResponseTextDeltaEvent
from db.session import AsyncSessionLocal


async def run_orchestrator_stream(
    messages: list,
    *,
    run_id: str | None = None,
    google_refresh_token: str | None = None,
) -> AsyncGenerator[dict, None]:
    """Run the agent orchestration loop with streaming SSE events.

    Event contract (no duplicate content):
      {"type": "run_id",      "run_id": "..."}          — first event
      {"type": "agent",       "agent": "AgentName"}     — thinking / agent switch
      {"type": "tool_start",  "tool": "tool_name"}      — tool is being called
      {"type": "tool_result", "tool": "tool_name",
                              "content": "preview..."}  — tool finished
      {"type": "token",       "content": "delta text"}  — streamed text delta
      {"type": "done"}                                  — stream finished
      {"type": "error",       "content": "msg"}         — something broke
    """
    token = current_run_id.set(run_id)
    current_tool_name = "unknown"
    try:
        context = AgentContext(
            run_id=run_id or "",
            google_refresh_token=google_refresh_token,
        )
        result = Runner.run_streamed(
            starting_agent=orchestrator_agent,
            input=_build_input(messages),
            context=context,
        )

        logger.info("SSE stream started for run_id=%s", run_id)

        async for event in result.stream_events():
            # ── Token deltas (real-time text) ────────────────────────
            if event.type == "raw_response_event":
                if isinstance(event.data, ResponseTextDeltaEvent):
                    delta = event.data.delta
                    if delta:
                        yield {"type": "token", "content": delta}

            # ── Agent hand-off (thinking indicator) ──────────────────
            elif event.type == "agent_updated_stream_event":
                agent_name = event.new_agent.name
                logger.info("Agent hand-off → %s (run=%s)", agent_name, run_id)
                yield {"type": "agent", "agent": agent_name}

            # ── Tool lifecycle events ────────────────────────────────
            elif event.type == "run_item_stream_event":
                item = event.item

                if item.type == "tool_call_item":
                    current_tool_name = getattr(
                        item, "name",
                        getattr(
                            getattr(item, "raw_item", None), "name", "unknown"
                        ),
                    )
                    logger.info("Tool call: %s (run=%s)", current_tool_name, run_id)
                    yield {"type": "tool_start", "tool": current_tool_name}

                elif item.type == "tool_call_output_item":
                    output_preview = str(item.output)[:300]
                    yield {
                        "type": "tool_result",
                        "tool": current_tool_name,
                        "content": output_preview,
                    }

                # NOTE: message_output_item is intentionally skipped.
                # It contains the full accumulated text which has already
                # been streamed to the client via "token" deltas above.

        # Stream fully consumed — flush tracing writes & update status
        await flush_pending_writes()
        logger.info("SSE stream completed for run_id=%s", run_id)

        if run_id:
            await _update_run_status(run_id, "completed")

        # Signal completion — no content (client already has it from tokens)
        yield {"type": "done"}

    except Exception as exc:
        logger.error("Streaming error (run=%s): %s", run_id, exc, exc_info=True)
        await flush_pending_writes()
        if run_id:
            await _update_run_status(run_id, "failed")
        yield {"type": "error", "content": "Something went wrong. Please try again."}
    finally:
        current_run_id.reset(token)

