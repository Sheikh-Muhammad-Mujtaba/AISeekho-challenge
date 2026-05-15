"""SalesOps Agent Orchestrator.

Implements the autonomous agent loop using the Gemini model via
the OpenAI-compatible chat completions endpoint.

All MCP-compatible tools (ERPNext, Gmail, Google Places, Google Calendar)
are registered here and dispatched when the LLM requests them.
"""

import json
import logging

import openai
from core.config import settings
from mcp_tools.erpnext import create_erpnext_lead, get_chatbot_link, CreateLeadInput
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

async def execute_tool_call(tool_name: str, arguments: dict) -> dict:
    """Route a tool-call request to the correct MCP tool implementation."""
    logger.info("Executing tool: %s  args: %s", tool_name, json.dumps(arguments, default=str))

    match tool_name:
        # ERPNext
        case "create_erpnext_lead":
            return await create_erpnext_lead(CreateLeadInput(**arguments))
        case "get_chatbot_link":
            return await get_chatbot_link(arguments["lead_id"])

        # Gmail
        case "send_email":
            return await send_email(
                arguments["to_email"],
                arguments["subject"],
                arguments["body"],
                arguments.get("simulation_mode", True),
            )

        # Google Places
        case "search_businesses":
            return await search_businesses(SearchBusinessesInput(**arguments))
        case "get_place_details":
            return await get_place_details(GetPlaceDetailsInput(**arguments))

        # Google Calendar
        case "check_availability":
            return await check_availability(CheckAvailabilityInput(**arguments))
        case "create_event":
            return await create_event(CreateEventInput(**arguments))

        case _:
            logger.warning("Unknown tool requested: %s", tool_name)
            return {"error": f"Unknown tool: {tool_name}"}


# ── Orchestration loop ───────────────────────────────────────────────────

MAX_TOOL_ROUNDS = 10  # Safety cap to avoid infinite loops


async def run_orchestrator(messages: list, *, depth: int = 0) -> str:
    """Run the agent orchestration loop using Gemini.

    The LLM decides which tools to call. We execute them and feed the
    results back until the LLM produces a final text response or we
    hit the safety cap.
    """
    if depth >= MAX_TOOL_ROUNDS:
        logger.warning("Hit MAX_TOOL_ROUNDS (%d). Returning partial answer.", MAX_TOOL_ROUNDS)
        return "I've reached the maximum number of tool calls for this request. Here's what I have so far."

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
        messages.append(response_message)

        for tool_call in response_message.tool_calls:
            fn_name = tool_call.function.name
            fn_args = json.loads(tool_call.function.arguments)

            result = await execute_tool_call(fn_name, fn_args)

            messages.append({
                "tool_call_id": tool_call.id,
                "role": "tool",
                "name": fn_name,
                "content": json.dumps(result, default=str),
            })

        return await run_orchestrator(messages, depth=depth + 1)

    # No tool calls → final answer
    return response_message.content
