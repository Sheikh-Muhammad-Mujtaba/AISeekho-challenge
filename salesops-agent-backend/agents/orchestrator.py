"""SalesOps Agent Orchestrator.

Implements the autonomous agent loop using the Gemini model via
the OpenAI-compatible chat completions endpoint.

All MCP-compatible tools (ERPNext, Gmail, Google Places, Google Calendar)
are registered here and dispatched when the LLM requests them.

Database logging: every tool call and audit trace is persisted so
the frontend can render the Antigravity Trace Viewer.
"""

import json
import logging
from datetime import datetime

import openai
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from db.models import ToolCallLog, AuditTrace
from mcp_tools.erpnext import (
    create_erpnext_lead,
    get_chatbot_link,
    read_erpnext_lead,
    update_erpnext_lead,
    analyze_crm_data,
    CreateLeadInput,
    ReadLeadInput,
    UpdateLeadInput,
    AnalyzeCrmInput,
)
from mcp_tools.gmail import send_email
from mcp_tools.google_places import (
    search_businesses,
    get_place_details,
    SearchBusinessesInput,
    GetPlaceDetailsInput,
)
from mcp_tools.google_calendar import (
    check_availability,
    create_event,
    CheckAvailabilityInput,
    CreateEventInput,
)

logger = logging.getLogger(__name__)

# ── Gemini client via OpenAI-compatible endpoint ─────────────────────────
client = openai.AsyncOpenAI(
    api_key=settings.GEMINI_API_KEY,
    base_url=settings.GEMINI_BASE_URL,
)


# ── System prompt ────────────────────────────────────────────────────────

SALES_AGENT_SYSTEM_PROMPT = (
    "You are the SalesOps Agent — an autonomous AI sales assistant tightly "
    "integrated with ERPNext CRM. Your job is to help sales teams find, "
    "qualify, and manage leads efficiently.\n\n"
    "## Capabilities\n"
    "- **Lead Discovery**: Search Google Places for potential business leads.\n"
    "- **CRM Read**: Retrieve individual lead details from ERPNext.\n"
    "- **CRM Write**: Create new leads or update existing leads in ERPNext.\n"
    "- **CRM Analytics**: Fetch and analyse aggregated CRM data (lead counts, "
    "status breakdowns, top sources) and present actionable insights.\n"
    "- **Email Outreach**: Draft and send emails via Gmail.\n"
    "- **Calendar**: Check availability and schedule meetings.\n\n"
    "## Rules\n"
    "1. Always default to `simulation_mode=true` unless the user explicitly "
    "says 'execute for real' or 'go live'.\n"
    "2. When the user asks to 'analyze' or 'give insights', use the "
    "`analyze_crm_data` tool first, then interpret the results in plain language.\n"
    "3. When updating a lead, confirm the lead_id with the user before calling "
    "`update_erpnext_lead`.\n"
    "4. Be concise, data-driven, and proactive — suggest next steps after "
    "every action.\n"
    "5. Format monetary values, dates, and phone numbers for a Pakistani audience "
    "(PKR, DD-MMM-YYYY, +92-xxx).\n"
)

# ── Tool schemas exposed to function-calling ─────────────────────────────
AVAILABLE_TOOLS = [
    # ── ERPNext ──
    {
        "type": "function",
        "function": {
            "name": "create_erpnext_lead",
            "description": "Creates a lead in ERPNext CRM with optional quotation line items.",
            "parameters": {
                "type": "object",
                "properties": {
                    "first_name": {"type": "string", "description": "Lead first name"},
                    "mobile_no": {"type": "string", "description": "Mobile phone number"},
                    "email_id": {"type": "string", "description": "Email address"},
                    "simulation_mode": {"type": "boolean", "default": True},
                },
                "required": ["first_name", "mobile_no", "email_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_erpnext_lead",
            "description": "Retrieves the full details of a single lead from ERPNext CRM by its Lead ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "lead_id": {"type": "string", "description": "ERPNext Lead ID, e.g. CRM-LEAD-2026-00001"},
                    "simulation_mode": {"type": "boolean", "default": True},
                },
                "required": ["lead_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_erpnext_lead",
            "description": (
                "Updates an existing lead in ERPNext CRM. "
                "Can modify status, lead_name, notes, phone, or email_id."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "lead_id": {"type": "string", "description": "ERPNext Lead ID to update"},
                    "status": {"type": "string", "description": "New status (Open, Replied, Opportunity, Converted, Do Not Contact)"},
                    "lead_name": {"type": "string", "description": "Updated lead name"},
                    "notes": {"type": "string", "description": "Notes to add/replace on the lead"},
                    "phone": {"type": "string", "description": "Updated phone number"},
                    "email_id": {"type": "string", "description": "Updated email"},
                    "simulation_mode": {"type": "boolean", "default": True},
                },
                "required": ["lead_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "analyze_crm_data",
            "description": (
                "Fetches and summarises CRM data from ERPNext. "
                "Returns record counts, status breakdowns, top sources, and recent records. "
                "Use this when the user asks for lead analytics, pipeline health, or CRM insights."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "doctype": {"type": "string", "default": "Lead", "description": "ERPNext DocType to query (Lead, Opportunity, etc.)"},
                    "limit": {"type": "integer", "default": 20, "description": "Max records to fetch"},
                    "simulation_mode": {"type": "boolean", "default": True},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_chatbot_link",
            "description": "Fetches the quotation / chatbot link for a given Lead ID from ERPNext.",
            "parameters": {
                "type": "object",
                "properties": {
                    "lead_id": {"type": "string", "description": "ERPNext Lead ID, e.g. CRM-LEAD-2026-00001"},
                },
                "required": ["lead_id"],
            },
        },
    },
    # ── Gmail ──
    {
        "type": "function",
        "function": {
            "name": "send_email",
            "description": "Sends an email to a lead or attendee using Gmail.",
            "parameters": {
                "type": "object",
                "properties": {
                    "to_email": {"type": "string"},
                    "subject": {"type": "string"},
                    "body": {"type": "string"},
                    "simulation_mode": {"type": "boolean", "default": True},
                },
                "required": ["to_email", "subject", "body"],
            },
        },
    },
    # ── Google Places ──
    {
        "type": "function",
        "function": {
            "name": "search_businesses",
            "description": (
                "Search for businesses using Google Places. "
                "Returns names, addresses, ratings, phone numbers, and websites. "
                "Use this to discover potential leads in a given area."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query, e.g. 'clinics in Gulberg Lahore'"},
                    "max_results": {"type": "integer", "default": 20, "description": "Max results (1-60)"},
                    "simulation_mode": {"type": "boolean", "default": True},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_place_details",
            "description": "Fetch detailed information about a single place by its Google Place ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "place_id": {"type": "string", "description": "Google Place ID"},
                    "simulation_mode": {"type": "boolean", "default": True},
                },
                "required": ["place_id"],
            },
        },
    },
    # ── Google Calendar ──
    {
        "type": "function",
        "function": {
            "name": "check_availability",
            "description": "Check calendar availability for a given date. Returns busy and free time slots.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "Date in YYYY-MM-DD format"},
                    "timezone": {"type": "string", "default": "Asia/Karachi"},
                    "simulation_mode": {"type": "boolean", "default": True},
                },
                "required": ["date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_event",
            "description": (
                "Create a Google Calendar event. "
                "Use this when meeting intent is detected in lead notes or conversation."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "summary": {"type": "string", "description": "Event title"},
                    "description": {"type": "string", "default": ""},
                    "start_datetime": {"type": "string", "description": "ISO-8601 start datetime"},
                    "end_datetime": {"type": "string", "description": "ISO-8601 end datetime"},
                    "timezone": {"type": "string", "default": "Asia/Karachi"},
                    "attendee_emails": {
                        "type": "array",
                        "items": {"type": "string"},
                        "default": [],
                        "description": "Attendee email addresses",
                    },
                    "simulation_mode": {"type": "boolean", "default": True},
                },
                "required": ["summary", "start_datetime", "end_datetime"],
            },
        },
    },
]


# ── Tool dispatcher ──────────────────────────────────────────────────────

async def execute_tool_call(
    tool_name: str,
    arguments: dict,
    *,
    run_id: str | None = None,
    db: AsyncSession | None = None,
) -> dict:
    """Route a tool-call request to the correct MCP tool implementation.

    Persists a ToolCallLog record when *run_id* and *db* are provided.
    """
    try:
        logger.info("Executing tool: %s  args: %s", tool_name, json.dumps(arguments, default=str))

        match tool_name:
            # ERPNext
            case "create_erpnext_lead":
                result = await create_erpnext_lead(CreateLeadInput(**arguments))
            case "read_erpnext_lead":
                result = await read_erpnext_lead(ReadLeadInput(**arguments))
            case "update_erpnext_lead":
                result = await update_erpnext_lead(UpdateLeadInput(**arguments))
            case "analyze_crm_data":
                result = await analyze_crm_data(AnalyzeCrmInput(**arguments))
            case "get_chatbot_link":
                result = await get_chatbot_link(arguments["lead_id"])

            # Gmail
            case "send_email":
                result = await send_email(
                    arguments["to_email"],
                    arguments["subject"],
                    arguments["body"],
                    arguments.get("simulation_mode", True),
                )

            # Google Places
            case "search_businesses":
                result = await search_businesses(SearchBusinessesInput(**arguments))
            case "get_place_details":
                result = await get_place_details(GetPlaceDetailsInput(**arguments))

            # Google Calendar
            case "check_availability":
                result = await check_availability(CheckAvailabilityInput(**arguments))
            case "create_event":
                result = await create_event(CreateEventInput(**arguments))

            case _:
                logger.warning("Unknown tool requested: %s", tool_name)
                result = {"error": f"Unknown tool: {tool_name}"}

        # ── Persist ToolCallLog (best-effort) ────────────────────────
        if run_id and db:
            try:
                log_entry = ToolCallLog(
                    run_id=run_id,
                    tool_name=tool_name,
                    input_data=arguments,
                    output_data=result,
                    error=result.get("error") if isinstance(result, dict) else None,
                    created_at=datetime.utcnow(),
                )
                db.add(log_entry)
                await db.commit()
            except Exception as log_exc:
                logger.warning("Failed to persist ToolCallLog: %s", log_exc)
                await db.rollback()

        return result

    except Exception as exc:
        logger.error("Tool execution failed [%s]: %s", tool_name, exc, exc_info=True)

        # Log the failure too (best-effort)
        if run_id and db:
            try:
                log_entry = ToolCallLog(
                    run_id=run_id,
                    tool_name=tool_name,
                    input_data=arguments,
                    output_data=None,
                    error=str(exc),
                    created_at=datetime.utcnow(),
                )
                db.add(log_entry)
                await db.commit()
            except Exception as log_exc:
                logger.warning("Failed to persist error ToolCallLog: %s", log_exc)
                await db.rollback()

        return {"error": str(exc)}


# ── Orchestration loop ───────────────────────────────────────────────────

MAX_TOOL_ROUNDS = 10  # Safety cap to avoid infinite loops


async def run_orchestrator(
    messages: list,
    *,
    run_id: str | None = None,
    db: AsyncSession | None = None,
    depth: int = 0,
) -> str:
    """Run the agent orchestration loop using Gemini.

    Args:
        messages: Conversation history in OpenAI message format.
        run_id: Optional WorkflowRun.id to correlate logs.
        db: Optional async DB session for persisting logs.
        depth: Internal recursion counter.
    """
    try:
        if depth >= MAX_TOOL_ROUNDS:
            logger.warning("Hit MAX_TOOL_ROUNDS (%d). Returning partial answer.", MAX_TOOL_ROUNDS)
            return "I've reached the maximum number of tool calls for this request. Here's what I have so far."

        logger.info("Calling Gemini model (depth=%d)...", depth)
        response = await client.chat.completions.create(
            model=settings.GEMINI_MODEL,
            messages=messages,
            tools=AVAILABLE_TOOLS,
            tool_choice="auto",
            temperature=0.2,
        )

        response_message = response.choices[0].message

        # If the model wants to call tools, execute them and recurse
        if response_message.tool_calls:
            logger.info("Gemini requested %d tool calls", len(response_message.tool_calls))
            messages.append(response_message)

            for tool_call in response_message.tool_calls:
                fn_name = tool_call.function.name
                fn_args = json.loads(tool_call.function.arguments)

                # Persist an audit trace for the tool-call decision (best-effort)
                if run_id and db:
                    try:
                        trace = AuditTrace(
                            run_id=run_id,
                            agent_name="Orchestrator",
                            thought_process=f"Decided to call tool '{fn_name}' with args: {json.dumps(fn_args, default=str)[:500]}",
                            created_at=datetime.utcnow(),
                        )
                        db.add(trace)
                        await db.commit()
                    except Exception as log_exc:
                        logger.warning("Failed to persist AuditTrace: %s", log_exc)
                        await db.rollback()

                result = await execute_tool_call(fn_name, fn_args, run_id=run_id, db=db)

                messages.append({
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "name": fn_name,
                    "content": json.dumps(result, default=str),
                })

            return await run_orchestrator(messages, run_id=run_id, db=db, depth=depth + 1)

        # No tool calls → final answer
        logger.info("Gemini provided final response.")
        final_text = response_message.content or "I processed your request but didn't generate a text response."

        # Persist audit trace for the final response (best-effort)
        if run_id and db:
            try:
                trace = AuditTrace(
                    run_id=run_id,
                    agent_name="Orchestrator",
                    thought_process=f"Final response generated (length={len(final_text)} chars)",
                    created_at=datetime.utcnow(),
                )
                db.add(trace)
                await db.commit()
            except Exception as log_exc:
                logger.warning("Failed to persist final AuditTrace: %s", log_exc)
                await db.rollback()

        return final_text

    except Exception as exc:
        logger.error("Orchestration loop error: %s", exc, exc_info=True)
        raise exc
