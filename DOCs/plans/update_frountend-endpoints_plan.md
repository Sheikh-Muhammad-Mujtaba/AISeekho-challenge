# Frontend Streaming Integration Plan

This plan outlines the steps to integrate the new backend SSE (Server-Sent Events) streaming endpoint (`/api/chat/stream`) into the React Native mobile app (`salesopsapp`). We will map real-time data events (agent routing, tool calls, token generation) directly to the chat interface.

## User Review Required

> [!IMPORTANT]
> **Streaming via POST in React Native**: Native `EventSource` only supports `GET` requests. Since our `/api/chat/stream` requires a `POST` request with the chat history payload, we will use a raw `XMLHttpRequest` (XHR) implementation with the `onreadystatechange` handler. This is a robust and zero-dependency way to consume streaming chunked responses in React Native.
> Please let me know if you prefer using a third-party polyfill library instead.

## Proposed Changes

### [salesopsapp] Services

#### [MODIFY] `src/services/agentApi.ts`
- Add a new `chatStream` method alongside the existing `chat` method.
- Implement streaming using `XMLHttpRequest` pointing to `/api/chat/stream`.
- Configure the request with `POST`, passing the JSON payload and the `Authorization` header.
- Track `responseText` progressively to emit parsed SSE events (`run_id`, `agent`, `tool`, `token`, `done`, `error`) to a callback function.

### [salesopsapp] UI / Screens

#### [MODIFY] `src/screens/ChatScreen.tsx`
- **Extend Message State**: Update the `Message` type to include streaming metadata:
  ```typescript
  type Message = {
    id: string;
    role: 'user' | 'agent' | 'system';
    content: string;
    isStreaming?: boolean;
    activeAgent?: string;
    activeTool?: string;
  };
  ```
- **Real-time Updates**: Refactor `sendMessage` to call `agentApi.chatStream`. Provide a callback that receives the stream events and updates the last `agent` message in real-time (appending tokens to `content`, updating `activeAgent` and `activeTool`).
- **Dynamic Render**: Enhance `renderMessage` to visually display the agent's thought process.
  - If `isStreaming` is true and `activeAgent` is set, show a pulsating badge: `🤖 {activeAgent} is thinking...`
  - If `activeTool` is set, show a badge: `⚙️ Calling tool: {activeTool}...`
  - Stream the `content` tokens natively into the chat bubble text.

## Verification Plan

### Automated/Manual Verification
- Run the React Native app.
- Send a complex prompt (e.g., "Search the CRM for recent leads").
- Observe the immediate creation of an agent chat bubble.
- Verify that the UI displays the routed agent (e.g., "CRMAgent is thinking...").
- Verify that the UI displays the tool being called (e.g., "Calling tool: search_crm...").
- Verify that the text tokens stream in smoothly without waiting for the full response.
- Verify that the streaming indicators disappear once the `done` event is received.

---

# Google Calendar OAuth Integration Plan

This plan outlines the steps to integrate Google Calendar authentication in the React Native app to support multi-user calendar events orchestration securely.

## User Review Required

> [!IMPORTANT]
> **React Native Google Sign-In**: We will need to use `@react-native-google-signin/google-signin` to handle the native Google OAuth flow. When configuring it, we MUST set `offlineAccess: true` and provide the `webClientId` (which corresponds to our backend's `GOOGLE_CALENDAR_CLIENT_ID`). This is crucial to obtain the `serverAuthCode` which the backend exchanges for a refresh token.

## Proposed Changes

### [salesopsapp] Dependencies
- Install `@react-native-google-signin/google-signin` and configure native iOS/Android client IDs if necessary.

### [salesopsapp] Services

#### [MODIFY] `src/services/calendarApi.ts` (New File)
- Create a new API service for calendar interactions.
- Implement `syncCalendar(authCode: string)`: POST to `/api/calendar/sync`.
- Implement `getCalendarStatus()`: GET from `/api/calendar/status`.
- Implement `disconnectCalendar()`: POST to `/api/calendar/disconnect`.

### [salesopsapp] UI / Screens

#### [MODIFY] `src/screens/ProfileScreen.tsx` (or Settings Screen)
- **Status Indicator**: Fetch and display whether the user's Google Calendar is currently connected (`getCalendarStatus`).
- **Connect Button**: 
  - Trigger `GoogleSignin.signIn()`.
  - Extract the `serverAuthCode` from the user info response.
  - Send the code to `calendarApi.syncCalendar`.
  - Update the UI to show "Connected".
- **Disconnect Button**: 
  - Call `calendarApi.disconnectCalendar()`.
  - Trigger `GoogleSignin.revokeAccess()` (optional, to clear local native session).
  - Update the UI to show "Disconnected".

## Verification Plan (Calendar)
- Navigate to the Settings/Profile screen.
- Click "Connect Google Calendar".
- Authenticate via the native Google prompt and approve permissions.
- Ensure the backend receives the code, exchanges it for a token, and returns success.
- Ensure the UI updates to show the connected state.
- In the ChatScreen, ask the agent "Check my availability for tomorrow" and verify it correctly uses the newly synced token.
