# SalesOps Agent - Mobile App Implementation Plan (React Native CLI Version)

The backend API is now fully operational. This plan focuses specifically on the **Frontend React Native Mobile App** (Phase 4 of the project), replacing the previous Expo-based approach with a bare React Native CLI implementation to ensure maximum control over native dependencies and avoid peer dependency resolution issues.

## Goal Description
Build a premium, "deep space" dark mode React Native mobile app that serves as the interface for the SalesOps Agent. The app will authenticate users via Neon Auth JWTs and communicate with the FastAPI backend to provide a seamless, agentic chat experience.

## User Review Required
> [!IMPORTANT]
> This plan uses the React Native CLI instead of Expo. This means you will need Android Studio (for Android emulation) and Xcode (for iOS emulation) fully configured on your machine.
> Before starting, ensure you have the React Native environment set up correctly (Node, JDK, Android SDK).

## Proposed Changes

### Phase 1: Initialization & Navigation Setup
- **Initialize React Native CLI Project**: Run `npx @react-native-community/cli init salesopsapp` (or `npx react-native@latest init salesopsapp`). By default, the latest versions generate a TypeScript template automatically.
- **Navigation Dependencies**: Install React Navigation and its required dependencies to replace Expo Router:
  `npm install @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context`
- **Core Dependencies**: Install replacements for Expo libraries:
  `npm install axios react-native-reanimated react-native-vector-icons @react-native-community/blur react-native-keychain react-native-haptic-feedback`
- **Navigation Architecture**: Set up a Navigation Container with a conditional stack depending on auth state (e.g., an `AuthStack` for login and an `AppStack` for the main chat interface).

### Phase 2: Design System & Theming
- **Theme Constants**: Define a strict "Deep Space Dark Mode" color palette (deep blacks `#05050A`, rich indigos, glowing accents).
- **Core UI Components**:
  - `GlassHeader`: A blurred, translucent top navigation bar (using `@react-native-community/blur`).
  - `NeonButton`: Primary actions with subtle glowing borders.
  - `AnimatedInput`: A chat input field that morphs dynamically when typing or submitting.

### Phase 3: Neon Auth Integration
- **Auth Provider Context**: Create `AuthContext.tsx` to handle authentication state.
- **Login Screen**: Implement an elegant sign-in screen using our Glassmorphic theme.
- **Secure Storage**: Use `react-native-keychain` to securely persist the Neon Auth JWT token across app restarts.

### Phase 4: Chat Interface & Backend Integration
- **API Client**: Configure Axios to automatically attach the JWT token to requests via interceptors.
- **Chat Screen**: Implement a `FlatList` for message history, handling keyboard interactions properly with `KeyboardAvoidingView`.
- **Message Bubbles**: Distinct visual styles for User (solid indigo) vs. Agent (glassmorphic dark).
- **Tool Status Indicators**: Real-time pulsing UI indicating when the agent is executing MCP tools (e.g., "Searching Google Places...", "Creating ERPNext Lead...").

### Phase 5: Polish & Animations
- **Transitions**: Add `react-native-reanimated` entry transitions so new messages slide in smoothly from the bottom.
- **Haptic Feedback**: Add `react-native-haptic-feedback` upon message send and tool completion for a tactile, premium feel.

## Verification Plan
### Automated & Manual Verification
- Verify the React Native app builds and boots successfully in the Android Emulator / iOS Simulator (`npm run android` / `npm run ios`).
- Verify the login screen successfully exchanges credentials for a Neon Auth JWT via the FastAPI backend.
- Verify the chat screen successfully POSTs to the backend `http://<your-local-ip>:8000/api/chat/` and displays the agent's response.
- Verify tool execution status logs (like "Searching Places") appear correctly in the UI.
