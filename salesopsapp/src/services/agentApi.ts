import httpClient from './httpClient';
import { API_BASE, getAuthToken } from './httpClient';

export type StreamEventType =
  | 'run_id'
  | 'agent'
  | 'tool'
  | 'token'
  | 'done'
  | 'error';

export interface StreamEvent {
  type: StreamEventType;
  data: string;
}

export type StreamCallback = (event: StreamEvent) => void;
function splitConcatenatedJson(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        parts.push(text.slice(start, i + 1));
        start = i + 1;
      }
    }
  }

  return parts.length > 0 ? parts : [text];
}

function parseJsonEvent(jsonStr: string): StreamEvent | null {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') return null;

    switch (parsed.type) {
      case 'run_id':
        return { type: 'run_id', data: String(parsed.run_id ?? '') };
      case 'agent':
        return { type: 'agent', data: String(parsed.agent ?? '') };
      case 'tool':
        return { type: 'tool', data: String(parsed.tool ?? '') };
      case 'token':
        return { type: 'token', data: String(parsed.content ?? '') };
      case 'message':
        return null;
      case 'done':
        return { type: 'done', data: String(parsed.content ?? '') };
      case 'error':
        return {
          type: 'error',
          data: String(
            parsed.message ?? parsed.content ?? JSON.stringify(parsed),
          ),
        };
      default:
        if (parsed.content != null) {
          return { type: 'token', data: String(parsed.content) };
        }
        return null;
    }
  } catch {
    return { type: 'token', data: jsonStr };
  }
}

function parseSSEChunk(
  raw: string,
  bufferRef: { value: string },
): StreamEvent[] {
  const events: StreamEvent[] = [];
  bufferRef.value += raw;

  const eventBlocks = bufferRef.value.split('\n\n');
  bufferRef.value = eventBlocks.pop() ?? '';

  for (const block of eventBlocks) {
    const lines = block.split('\n');
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        dataLines.push(line.slice(6));
      }
    }

    if (dataLines.length === 0) continue;

    const jsonStr = dataLines.join('\n');

    if (jsonStr.trim() === '[DONE]') {
      events.push({ type: 'done', data: '' });
      continue;
    }

    for (const part of splitConcatenatedJson(jsonStr)) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const evt = parseJsonEvent(trimmed);
      if (evt) events.push(evt);
    }
  }

  return events;
}

export const agentApi = {
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

  chat: async (
    messages: Array<{ role: string; content: string }>,
    runId?: string,
  ) => {
    const response = await httpClient.post('/api/chat', {
      messages,
      run_id: runId,
    });
    return {
      message: response.data.message,
      run_id: response.data.run_id,
    };
  },

  chatStream: (
    messages: Array<{ role: string; content: string }>,
    onEvent: StreamCallback,
    runId?: string,
  ): (() => void) => {
    const xhr = new XMLHttpRequest();
    let lastIndex = 0;
    const bufferRef = { value: '' };
    let doneSent = false;

    xhr.open('POST', `${API_BASE}/chat/stream`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream');
    const token = getAuthToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.onreadystatechange = () => {
      if (xhr.readyState >= 3 && xhr.responseText) {
        const newText = xhr.responseText.slice(lastIndex);
        lastIndex = xhr.responseText.length;
        if (__DEV__) console.log('[SSE] raw chunk:', newText);

        const events = parseSSEChunk(newText, bufferRef);
        if (__DEV__ && events.length) console.log('[SSE] parsed events:', events);
        for (const evt of events) {
          if (evt.type === 'done' || evt.type === 'error') doneSent = true;
          onEvent(evt);
        }
      }

      if (xhr.readyState === 4) {
        if (bufferRef.value.trim()) {
          const events = parseSSEChunk('\n\n', bufferRef);
          for (const evt of events) {
            if (evt.type === 'done' || evt.type === 'error') doneSent = true;
            onEvent(evt);
          }
        }
        if (!doneSent) {
          if (__DEV__) console.log('[SSE] synthetic done emitted');
          onEvent({ type: 'done', data: '' });
        }
      }
    };

    xhr.onerror = () => {
      if (__DEV__) console.log('[SSE] network error');
      onEvent({ type: 'error', data: 'Network error during stream.' });
    };

    xhr.ontimeout = () => {
      if (__DEV__) console.log('[SSE] timeout');
      onEvent({ type: 'error', data: 'Stream request timed out.' });
    };

    xhr.timeout = 120_000;

    xhr.send(JSON.stringify({ messages, run_id: runId }));

    return () => {
      try {
        xhr.abort();
      } catch (_) {
      }
    };
  },

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

  getTraceLogs: async (runId: string) => {
    const response = await httpClient.get(`/api/workflows/${runId}/logs`);
    return response.data;
  },

  getOutcomeMetrics: async (runId: string) => {
    const response = await httpClient.get(`/api/workflows/${runId}/outcome`);
    return response.data;
  },
};
