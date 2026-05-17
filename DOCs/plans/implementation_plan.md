# SalesOps Agent - Implementation Plan

## 1. Challenge 1 Interpretation
This challenge requires building an autonomous "content-to-action" agent, moving beyond simple chatbots. The system ingests diverse business signals, extracts insights, makes autonomous decisions within constraints, and executes simulated/real actions across multiple systems (ERPNext, Google Calendar, Gmail) while maintaining full traceability.

## 2. SalesOps Agent Product Concept
A mobile-first sales operations AI agent. Users interact via a React Native app to discover leads, qualify them, and analyze pipelines. The agent autonomously searches Google Places, scores leads, checks duplicates, creates ERPNext CRM records, analyzes follow-ups, sends emails via Gmail, and schedules Google Calendar meetings.

## 3. Main Workflows
1. **Lead Discovery**: Parses query -> Google Places -> Filters/Scores -> Checks ERPNext duplicates -> Creates Leads & ToDos -> Updates Dashboard.
2. **ERPNext Hot Lead Analysis**: Fetches CRM data -> Detects intent/stale leads -> Simulates/executes updates -> Shows state changes.
3. **Meeting & Email Action Chain**: Extracts intent -> Checks Calendar -> Sends confirmation email via Gmail -> Creates ERPNext ToDo/Comm.
4. **Failure Recovery**: Handles API rate limits, duplicate rejections, and partial executions gracefully using fallbacks.

## 4. Mobile App UX Plan
**Stack**: React Native (Expo CLI), TypeScript, React Navigation, Zustand/TanStack Query.
**Authentication**: Firebase Auth (Handling User Authentication and Role Management for Sales Reps vs Sales Managers).
**Screens**: Dashboard, Chat with Agent, Lead Discovery, Action Chain & Scheduler, Simulation Console, Outcome Dashboard, Agent Trace Logs.

## 5. Python FastAPI Backend Architecture
**Stack**: Python 3.12+, FastAPI, Uvicorn, PostgreSQL (Neon), MCP Python SDK (`mcp`), OpenAI Python SDK, Firebase Admin SDK (for token verification and roles).
**Design**:
- **FastAPI** handles REST endpoints and mobile app chat requests.
- **Authentication**: Validates Firebase Auth tokens passed from the mobile app via the Firebase Admin SDK.
- **Agents** are implemented using OpenAI function calling and system prompts, orchestrated in Python.
- **State** is stored in Neon Postgres using SQLAlchemy.
- **Stateless Execution**: Each request rehydrates the agent context from the database and persists the new state.

## 6. MCP-Compatible Tool Architecture
- We will build an internal MCP server or direct MCP tool wrappers in Python using the `mcp` library.
- The FastAPI backend will act as an MCP Client, calling tools provided by our internal adapters for ERPNext, Google, and Gmail.
- Every tool supports a `simulation_mode` flag for safe dry-runs.

## 7. ERPNext Integration Plan
Use Frappe REST API with Token-based auth (API key/secret).
**Specific Endpoints Required**:
- **Create Lead**: `POST /api/resource/Lead`
  - Body: `first_name`, `mobile_no`, `email_id`, `docstatus`, `lead_quot_ct` (child table array).
- **Get Quotation/Chatbot Link**: `GET /api/method/education.education.chatbot_api.get_chatbot_link?lead_id={LEAD_ID}`

## 8. Google & Gmail Integration Plan
- **Google Places API**: Text/Nearby Search strictly for business discovery.
- **Google Calendar API**: Insert events when meeting intent is confirmed.
- **Gmail API**: Send automated emails, follow-ups, and calendar invitations directly from the agent.

## 9. Database/State Design (Postgres via SQLAlchemy)
**Tables**:
- `User` / `Workspace` / `Role` (Synced with Firebase Auth UID and claims)
- `WorkflowRun`: Stores `run_id`, status, overall mode.
- `WorkflowStep`: Bounded tasks within a run.
- `ChatMessage`: Chat history.
- `ToolCallLog`: Auditing every MCP tool invocation.
- `AgentDecision` / `AuditTrace`.

## 10. FastAPI Route Contracts
- `POST /api/runs`: Initialize workflow.
- `POST /api/chat`: Mobile chat endpoint communicating with OpenAI agents.
- `POST /api/workflows/{run_id}/step`: Execute stateful step.
- `POST /api/workflows/{run_id}/simulate`: Dry-run.
- `GET /api/workflows/{run_id}/logs`: Fetch trace.
- `GET /api/workflows/{run_id}/outcome`: Fetch metrics.

## 11. Complete MCP Tool List
**ERPNext Tools**:
- `erpnext.create_lead` (using `POST /api/resource/Lead` with `lead_quot_ct`)
- `erpnext.get_chatbot_link` (using `GET /api/method/education.education.chatbot_api.get_chatbot_link`)
- `erpnext.search_leads`, `erpnext.check_duplicate_lead`, `erpnext.create_todo`, `erpnext.create_opportunity`, `erpnext.create_communication`.
**Google & Gmail Tools**:
- `gmail.send_email`, `gmail.read_thread`
- `google_places.search_businesses`, `google_places.get_place_details`
- `google_calendar.create_event`, `google_calendar.check_availability`
**Local/Simulation Tools**:
- `lead_scoring.calculate`, `noise_filter.deduplicate`, `outcome_report.generate`

## 12. Failure Recovery and Rollback Design
- If Places fails -> use cached demo data.
- If Duplicate check fails -> save to DB as pending review, skip creation.
- If Calendar fails -> fallback to Gmail email send or ERPNext ToDo creation.

## 13. Trace/Logging Strategy for Antigravity Deliverables
- Every agent thought, tool call input/output, and handoff is logged to `AuditTrace`.
- Mobile app has a "Trace" tab rendering these logs to demonstrate the AI's reasoning and MCP API interactions.

## 14. Development Phases (Python Focus)
1. **Phase 1: FastAPI Foundation**: Setup Python env, FastAPI app, SQLAlchemy DB configuration for Neon, Firebase Admin setup.
2. **Phase 2: MCP Tool Implementation**: Build the Python MCP adapters for ERPNext, Gmail, and Google Places.
3. **Phase 3: Agent Brain**: Integrate OpenAI Python SDK, connecting it to the MCP tools.
4. **Phase 4: Frontend**: React Native (Expo CLI) screens, Firebase Auth, state management, API wiring.
5. **Phase 5: Polish**: Simulation toggles, trace UI, edge cases.
