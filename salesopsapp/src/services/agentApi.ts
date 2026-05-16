/**
 * services/agentApi.ts
 *
 * Connects the mobile UI to the SalesOps Agent backend API.
 * Uses the shared httpClient (axios instance with auth interceptors).
 */

import httpClient from './httpClient';

export const agentApi = {
  /**
   * POST /api/runs
   * Initializes a new workflow run.
   */
  initializeWorkflow: async (prompt: string, isSimulation: boolean) => {
    const response = await httpClient.post('/api/runs', {
      workflow_type: 'chat',
      mode: isSimulation ? 'simulation' : 'real',
    });
    return {
      run_id: response.data.id,
      status: response.data.status,
      simulation_mode: response.data.mode === 'simulation',
    };
  },

  /**
   * POST /api/chat
   * Sends messages to the SalesOps Agent and returns the response.
   */
  chat: async (messages: Array<{ role: string; content: string }>, runId?: string) => {
    const response = await httpClient.post('/api/chat', {
      messages,
      run_id: runId,
    });
    return {
      message: response.data.message,
      run_id: response.data.run_id,
    };
  },

  /**
   * POST /api/workflows/{run_id}/step
   * Executes a stateful step. Currently passes through to chat.
   */
  executeStep: async (runId: string, action: Record<string, unknown>) => {
    const response = await httpClient.post('/api/chat', {
      messages: [{ role: 'user', content: JSON.stringify(action) }],
      run_id: runId,
    });
    return {
      run_id: runId,
      status: 'in_progress',
      step_result: { success: true, message: response.data.message },
    };
  },

  /**
   * GET /api/workflows/{run_id}/logs
   * Fetches the trace logs for the Antigravity Trace Viewer.
   */
  getTraceLogs: async (runId: string) => {
    const response = await httpClient.get(`/api/workflows/${runId}/logs`);
    return response.data;
  },

  /**
   * GET /api/workflows/{run_id}/outcome
   * Fetches the before/after metrics for the Dashboard.
   */
  getOutcomeMetrics: async (runId: string) => {
    const response = await httpClient.get(`/api/workflows/${runId}/outcome`);
    return response.data;
  },
};
