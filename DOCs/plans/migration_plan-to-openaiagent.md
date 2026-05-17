# Migrate Orchestrator to Agents SDK with Custom Tracing

Migrate the manual logging in `salesops-agent-backend` to use a custom `TracingProcessor` native to the OpenAI Agents SDK. This will replace the manual `ToolCallLog` and `AuditTrace` inserts with an automatic, globally registered tracing processor that persists events as they occur natively within the SDK.

## User Review Required

> [!IMPORTANT]
> The OpenAI Agents SDK's `TracingProcessor` methods (`on_span_start`, `on_span_end`, etc.) are **synchronous**. Since our database uses `asyncpg` and `AsyncSession`, we must handle database inserts without blocking the synchronous tracing methods.
> My proposed approach uses `contextvars` to track the current `run_id` and an `asyncio.create_task` (or a background queue) with a dedicated database session to persist the traces asynchronously. 

## Open Questions

> [!WARNING]
> Do you have a preferred global async session factory (e.g., `AsyncSessionLocal`) we can import and use within the background tasks spawned by the synchronous `TracingProcessor`? If not, I will import it from `db.session` or `db.database`.

## Proposed Changes

### Database Tracing Processor Implementation

#### [NEW] `agent_core/tracing.py` (or similar file)
Create a new file containing `DatabaseTracingProcessor(TracingProcessor)`:
- Initialize a global or singleton processor.
- Implement `on_trace_start`, `on_trace_end`, `on_span_start`, `on_span_end`.
- Use a `contextvar` named `current_run_id` to correlate the SDK-generated `trace_id` and `span_id` to the `workflow_runs.id` (`run_id`).
- When `on_span_end` is triggered for a tool call (checking span type or operation name), spawn an asynchronous task to write a `ToolCallLog` record to the database.
- When `on_trace_end` or `on_span_end` (for thought processes) is triggered, write an `AuditTrace` record.

### Orchestrator Updates

#### [MODIFY] `agent_core/orchestrator.py`
- Remove all manual database `db.add(ToolCallLog)` and `db.add(AuditTrace)` logic from `execute_tool_call` and `run_orchestrator`.
- Set the `set_tracing_processor(DatabaseTracingProcessor())` instead of just disabling tracing with `set_tracing_disabled(True)`.
- Before invoking `Runner.run()`, set the `current_run_id` context variable so the `DatabaseTracingProcessor` knows which `run_id` the upcoming traces belong to.

## Verification Plan

### Automated Tests
- Run `python test_sdk.py` or the equivalent test script to simulate a complete flow.
- Verify that `ToolCallLog` and `AuditTrace` entries are successfully inserted into the Postgres database.

### Manual Verification
- Check the database directly using psql or a DB viewer to confirm `run_id` mapping correctly propagates to the traces.
- Ensure no `400 Bad Request` or `401 Unauthorized` errors occur due to the native OpenAI exporter, verifying our custom processor overrides it correctly.
