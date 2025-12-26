# Backend Status Polling

The frontend includes a system to detect and communicate backend cold starts to users. Since the backend runs on Cloud Run with scale-to-zero enabled, the first request after a period of inactivity triggers a cold start that can take 3-5 minutes while ML models load.

## How It Works

1. When a user logs in (or returns to the app with a persisted session), the frontend starts polling `/api/status`
2. The backend endpoint returns `{ "status": "loading" }` while models are loading, or `{ "status": "ready" }` when ready
3. The frontend shows a status indicator and disables the Generate button until ready
4. Polling uses the Page Visibility API to avoid unnecessary requests when the tab is hidden

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| **User logs in fresh** | Polling starts immediately after auth-check succeeds. Status indicator shows "AI system starting up..." |
| **Returning user (already logged in)** | Firebase restores the session on page load, auth-check runs, polling starts automatically - same as fresh login |
| **Backend becomes ready** | Polling stops, status indicator briefly shows "Ready!" then fades out, Generate button enables |
| **User switches to another tab** | Polling stops immediately to save resources and avoid keeping backend alive |
| **User returns to tab (backend was ready)** | Single status check runs. If backend is still ready, nothing changes. If backend went cold, polling restarts |
| **User returns to tab (backend still loading)** | Polling resumes from where it left off |
| **User closes browser, returns hours later** | Treated as returning user - Firebase restores auth, polling starts fresh, backend wakes up again |
| **Tab left open for hours, user returns** | When tab becomes visible, single check runs. If backend went cold, polling restarts with fresh timeout |
| **Mobile Safari app backgrounded** | iOS suspends the page, polling stops automatically. Resumes when app is foregrounded |
| **Polling exceeds 10 minutes** | Polling stops, status shows "Taking longer than expected" with a Retry button |
| **Network error during poll** | Retries automatically. After 3 consecutive failures, shows "Connection issue" with Retry button |

## Implementation Details

### Files

- `src/hooks/useBackendStatus.js` - React hook with polling logic and visibility handling
- `src/auth/AuthContext.jsx` - Integrates the hook and exposes status via context
- `src/App.jsx` - Contains `BackendStatusIndicator` component and updated Generate button

### Key Constants

- **Poll interval**: 5 seconds
- **Max poll duration**: 10 minutes
- **Max consecutive errors**: 3 before showing error state

### Page Visibility API

The hook uses `document.visibilitychange` to detect when the tab becomes visible or hidden:

```javascript
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // Tab became active - check status and resume polling if needed
  } else {
    // Tab became hidden - stop polling
  }
});
```

This ensures:
- No unnecessary network requests when user isn't looking at the tab
- Backend doesn't stay warm due to a forgotten background tab
- Status is re-checked when user returns to ensure accuracy

