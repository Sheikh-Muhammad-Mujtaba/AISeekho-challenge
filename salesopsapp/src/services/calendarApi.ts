import httpClient from './httpClient';

export interface CalendarStatus {
  connected: boolean;
  email?: string;
  lastSynced?: string;
}

export const calendarApi = {
  syncCalendar: async (authCode: string): Promise<{ success: boolean; email?: string }> => {
    const response = await httpClient.post('/calendar/sync', {
      auth_code: authCode,
    });
    return {
      success: response.data.success ?? true,
      email: response.data.email,
    };
  },

  getCalendarStatus: async (): Promise<CalendarStatus> => {
    const response = await httpClient.get('/calendar/status');
    return {
      connected: response.data.connected ?? false,
      email: response.data.email,
      lastSynced: response.data.last_synced,
    };
  },

  disconnectCalendar: async (): Promise<{ success: boolean }> => {
    const response = await httpClient.post('/calendar/disconnect');
    return { success: response.data.success ?? true };
  },
};
