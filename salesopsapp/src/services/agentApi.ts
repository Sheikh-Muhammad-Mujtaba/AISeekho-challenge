/**
 * services/agentApi.ts
 *
 * Mocks the backend Next.js Vercel API endpoints described in Hackthon_plan.md.
 * Allows the UI to demonstrate agent capabilities while the backend is being built.
 */

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(() => resolve(), ms));

export const agentApi = {
  /**
   * POST /api/runs
   * Initializes a new workflow run.
   */
  initializeWorkflow: async (prompt: string, isSimulation: boolean) => {
    await delay(800); // Network delay simulation
    return {
      run_id: `run_${Date.now()}`,
      status: 'initialized',
      simulation_mode: isSimulation,
    };
  },

  /**
   * POST /api/workflows/{run_id}/step
   * Executes a stateful step. In this mock, we just pretend it succeeds.
   */
  executeStep: async (runId: string, action: any) => {
    await delay(1200);
    return {
      run_id: runId,
      status: 'in_progress',
      step_result: { success: true, ...action },
    };
  },

  /**
   * GET /api/workflows/{run_id}/logs
   * Fetches the trace logs for the Antigravity Trace Viewer.
   */
  getTraceLogs: async (runId: string) => {
    await delay(500);
    return {
      run_id: runId,
      logs: [
        {
          id: '1',
          timestamp: new Date(Date.now() - 60000).toISOString(),
          agent: 'Orchestrator',
          action: 'plan_workflow',
          details: 'Parsed user prompt: "Find clinics in Gulberg Lahore"',
          status: 'success',
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 55000).toISOString(),
          agent: 'Lead Discovery',
          action: 'google_places.search_businesses',
          details: 'Found 12 candidates matching "Clinics in Gulberg Lahore"',
          status: 'success',
        },
        {
          id: '3',
          timestamp: new Date(Date.now() - 40000).toISOString(),
          agent: 'Lead Scoring',
          action: 'noise_filter.deduplicate_candidates',
          details: 'Filtered 2 duplicates found in ERPNext.',
          status: 'success',
        },
      ],
    };
  },

  /**
   * GET /api/workflows/{run_id}/outcome
   * Fetches the before/after metrics for the Dashboard.
   */
  getOutcomeMetrics: async (runId: string) => {
    await delay(600);
    return {
      run_id: runId,
      metrics: {
        leadsFound: 10,
        duplicatesPrevented: 2,
        meetingsScheduled: 1,
        todosCreated: 5,
      },
    };
  },
};
