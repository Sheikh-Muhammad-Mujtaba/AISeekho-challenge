# SalesOps Agent - Implementation Plan

## User Review Required
> [!IMPORTANT]
> Please review this comprehensive architecture and development plan for the SalesOps Agent. Once approved, we will begin the implementation phase starting with the backend infrastructure and MCP tool schemas.

## 1. Challenge 1 Interpretation
This challenge requires building an autonomous "content-to-action" agent, moving beyond simple chatbots or form-fillers. The core requirement is a system capable of ingesting diverse business signals (Google Places, ERPNext data), extracting insights, making autonomous decisions within constraints (rate limits, duplicate records, sales capacity), and executing simulated/real actions across multiple systems (ERPNext, Google Calendar) while maintaining full traceability of its decision-making process.

## 2. SalesOps Agent Product Concept
A mobile-first sales operations AI agent that acts as an intelligent assistant for sales teams. Users interact via a React Native app to discover leads, qualify them, and analyze existing pipelines. The agent autonomously searches Google Places, scores leads, checks for duplicates, creates ERPNext CRM records, analyzes follow-ups, and schedules meetings in Google Calendar when intent is detected.

## 3. User Personas
- **Sales Representative**: Needs to quickly discover new leads, understand which existing leads are "hot", and automate data entry and follow-ups.
- **Sales Manager**: Needs to see outcome dashboards (before/after states), ensure lead quality, and monitor agent trace logs to trust the AI's actions.

## 4. Main Workflows
1. **Lead Discovery**: Parses query -> Searches Google Places -> Filters/Scores -> Checks ERPNext duplicates -> Creates Leads & ToDos -> Updates Dashboard.
2. **ERPNext Hot Lead Analysis**: Fetches CRM data -> Detects intent/stale leads -> Creates action chain -> Simulates/executes updates -> Shows state changes.
3. **Meeting Note to Google Calendar**: Extracts intent from notes -> Checks missing details -> Schedules Calendar Event -> Creates linked ERPNext ToDo/Comm -> Handles fallbacks.
4. **Failure Recovery**: Handles API rate limits, duplicate rejections, and partial executions gracefully using fallbacks and retry queues.

## 5. Mobile App UX Plan
**Stack**: React Native (Expo), TypeScript, React Navigation, NativeWind, Zustand/TanStack Query.
**Screens**:
1. Splash / Intro
2. Dashboard (Outcome metrics)
3. Chat with Agent
4. Lead Discovery & Place Candidates
5. ERPNext Lead Analysis & Hot Leads
6. Action Chain & Meeting Scheduler
7. Simulation Console (Toggle real/dry-run)
8. Outcome Dashboard (Before/After visuals)
9. Agent Logs / Antigravity Trace
10. Settings (API keys/Integrations)

## 6. Vercel Stateless Backend Architecture
**Stack**: Next.js API Routes (Serverless), TypeScript, Neon Postgres/Supabase.
**Design**:
- Fully stateless execution. Run state stored in Postgres.
- Resume/retry capability using `run_id` and `step_id`.
- Handlers read state, execute one bounded unit of work (e.g., tool call), write updated state, and return.
- Queue-triggered steps for long-running multi-agent workflows to avoid serverless timeouts.

## 7. OpenAI Agents SDK TypeScript Architecture
- **Agents**: Orchestrator, Lead Discovery, CRM, Lead Scoring, Notes Analysis, Action Planner, Calendar, Failure Recovery, Outcome Reporter, Audit Trace.
- **Features**: Agent handoffs, structured outputs, strict guardrails for simulated vs real writes.
- **State**: State is serialized to the database between steps and rehydrated upon the next client polling or webhook trigger.

## 8. MCP-Compatible Tool Architecture
- Implement tools as pure functions wrapped in MCP-compatible schemas (`name`, `description`, `inputSchema`).
- Vercel API routes will expose these tools via HTTP, simulating a Remote MCP Server pattern.
- Every tool will support a `simulation_mode` flag.

## 9. ERPNext Integration Plan
- Use Frappe REST API via standard HTTP requests.
- Token-based auth (API key/secret).
- Build a generic `FrappeClient` supporting `get`, `get_list`, `insert`, `update`.
- Provide a `MockERPNextAdapter` for local development or when credentials are missing.
- Default to simulation/dry-run by validating input without making the `insert` call unless explicitly approved.

## 10. Google Places and Calendar Integration Plan
- **Google Places**: Use New Places API (Text Search / Nearby Search) strictly for business discovery. Fetch basic fields (name, formatted_address, types, rating).
- **Google Calendar**: Use OAuth2/Service Accounts to insert events when meeting intent is confirmed.
- **Geocoding (Optional)**: Normalize addresses before ERPNext duplicate checks.

## 11. Database/State Design for Serverless (Postgres)
**Tables**:
- `Workspace` / `User` / `IntegrationCredentialReference`
- `WorkflowRun`: Stores `run_id`, status, overall mode.
- `WorkflowStep`: Bounded tasks within a run.
- `ChatMessage`: Chat history.
- `ToolCallLog`: Auditing every MCP tool invocation.
- `AgentDecision` / `FailureRecoveryLog` / `OutcomeMetric` / `AuditTrace`.

## 12. API Route Contracts
- `POST /api/runs`: Initialize workflow.
- `POST /api/chat`: Mobile chat endpoint.
- `POST /api/workflows/{run_id}/step`: Execute stateful step.
- `POST /api/workflows/{run_id}/simulate`: Dry-run.
- `POST /api/workflows/{run_id}/recover`: Recover from failure.
- `GET /api/workflows/{run_id}/logs`: Fetch trace.
- `GET /api/workflows/{run_id}/outcome`: Fetch metrics.
- Tool endpoints: `/api/google/places/search`, `/api/erpnext/create-lead`, etc.

## 13. Agent Roles and Handoff Design
- **Orchestrator** receives prompt -> plans steps -> hands off to **Lead Discovery** -> hands off to **Lead Scoring** -> hands off to **ERPNext CRM Agent** -> hands off to **Outcome Reporter**.
- Handoffs are managed by returning a special `handoff` instruction in the structured output, which the state machine (running on Vercel) uses to trigger the next agent.

## 14. Complete MCP Tool List with Schemas
*(All tools include idempotency keys, retry policies, and `simulation_mode` inputs)*
**ERPNext Tools**:
- `erpnext.search_leads`, `erpnext.get_lead`, `erpnext.list_opportunities`, `erpnext.list_quotations`, `erpnext.list_communications`, `erpnext.list_todos`, `erpnext.check_duplicate_lead`, `erpnext.create_lead`, `erpnext.update_lead`, `erpnext.create_opportunity`, `erpnext.create_todo`, `erpnext.create_communication`, `erpnext.create_quotation_draft`, `erpnext.rollback_record`, `erpnext.get_sales_summary`, `erpnext.get_hot_lead_candidates`
**Google Tools**:
- `google_places.search_businesses`, `google_places.get_place_details`, `google_calendar.create_event`, `google_calendar.check_availability`, `google_geocoding.normalize_address`
**Local/Simulation Tools**:
- `lead_scoring.calculate`, `noise_filter.deduplicate_candidates`, `constraint_checker.validate_action_plan`, `workflow_state.update`, `workflow_logger.write`, `outcome_report.generate`, `failure_recovery.retry_or_fallback`, `trace_export.generate_json`

## 15. Lead Scoring and Duplicate Detection Logic
- **Scoring**: Base (0-100). Hot (80+), Warm (60-79), Nurture (40-59), Cold (<40). Factors: category match (+20), rating > 4.0 (+10), quotation intent (+30), meeting intent (+40).
- **Duplicate Detection**: Query ERPNext by `name`, `phone_no`, `website`, and `custom_google_place_id`. Exact match drops candidate. Partial match flags for human review.

## 16. Constraint Handling Design
- **Rate Limits**: Queue requests if approaching Google API limits.
- **Sales Capacity**: Hard cap daily lead creation (e.g., max 50/day).
- **Simulation Default**: All `real_write` tools require an explicit user `confirm` boolean.

## 17. Failure Recovery and Rollback Design
- If Places fails -> use cached demo data.
- If Duplicate check fails -> save to DB as pending review, skip creation.
- If Calendar fails -> fallback to ERPNext ToDo creation.
- **Rollback**: Store ERPNext record IDs created in current run; support `erpnext.rollback_record` to delete/cancel them if subsequent critical steps fail.

## 18. Before/After Outcome Dashboard Design
- **Before Panel**: Total existing leads, pending follow-ups, empty pipeline.
- **After Panel**: Delta of new qualified leads, ToDos created, Calendar events scheduled, duplicate noise filtered.
- Rendered via React Native charts.

## 19. Trace/Logging Strategy for Antigravity Deliverables
- Every agent thought, tool call input/output, and handoff is logged to the `ToolCallLog` and `AuditTrace` tables.
- Mobile app has a dedicated "Antigravity Trace" tab rendering these logs as a clean, chronological timeline, demonstrating the AI's reasoning, failure handling, and API interactions.

## 20. Demo Video Script (3-5 mins)
1. **[0:00]** Open mobile dashboard showing empty/stale state.
2. **[0:30]** Ask agent: "Find 20 clinics in Gulberg Lahore and add qualified leads to ERPNext."
3. **[1:00]** Show Google Places candidates appearing, duplicate filtering, and scoring in real-time.
4. **[1:30]** Show simulated ERPNext lead creation and approval.
5. **[2:00]** Ask agent: "Analyze hot ERPNext leads and schedule meetings where notes mention meeting intent."
6. **[2:30]** Show Calendar event creation and fallback handling for missing emails.
7. **[3:00]** Present the Before/After Dashboard.
8. **[3:30]** Deep dive into the "Antigravity Trace" logs to prove autonomous reasoning.

## 21. MVP Roadmap
- **Week 1**: Core backend infra (Next.js, DB setup), ERPNext & Google MCP adapters.
- **Week 2**: OpenAI Agents implementation (Orchestrator, Discovery, CRM), basic React Native setup.
- **Week 3**: Mobile UI integration, complex workflows (Notes analysis, Calendar), failure recovery.
- **Week 4**: Dashboards, trace viewers, polishing, demo recording.

## 22. Risks and Fallback Plan
- **Risk**: Vercel function timeout (10s/60s). **Fallback**: Step-based execution storing state in Postgres; UI polls for completion.
- **Risk**: ERPNext instance goes down. **Fallback**: `MockERPNextAdapter` steps in automatically so the demo doesn't fail.

## 23. Development Phases
1. **Phase 1: Foundation**: Schema definition, DB provisioning, Next.js API boilerplate.
2. **Phase 2: Integrations**: Google Places, Google Calendar, Frappe REST API clients.
3. **Phase 3: Agent Brain**: OpenAI setup, prompt engineering, handoff logic.
4. **Phase 4: Frontend**: React Native screens, state management, API wiring.
5. **Phase 5: Polish**: Simulation toggles, trace UI, edge cases.

## 24. What to Build First
1. **Database Schema & ORM (Prisma/Drizzle)** for state management.
2. **MCP Tool Wrappers** for ERPNext and Google Places to ensure the agent has reliable primitives to work with.
