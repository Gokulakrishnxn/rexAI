# Rex.ai — Environment & Setup Checklist

Use this file to configure your local demo and optional services.

---

## Required Right Now (for local demo)

**Nothing mandatory.** Router + local calendar work fully offline.

- Chat routing (Emergency, Triage, Booking, Literacy, General) works without any keys.
- “Book dentist tomorrow 4 pm” saves to local store (SecureStore) and shows on Home Dashboard.
- Voice screen “type to simulate” works and uses the same router; only GENERAL intent uses an optional API (Gemini).

---

## Optional — Gemini fallback (voice GENERAL intent)

When the user says something that doesn’t match Emergency/Triage/Booking/Literacy, the voice screen can show an AI reply. Without a key, they see a static “Voice is offline” message.

| Variable | Example | Where to get it |
|----------|--------|------------------|
| `EXPO_PUBLIC_GEMINI_API_KEY` | `AIza...` | [Google AI Studio](https://aistudio.google.com/) → Get API key → Free tier |

---

## Optional — LiveKit realtime voice

For real “join a room and stream mic” behavior (not just typed simulation), you need a LiveKit project and a token. The app will try to connect on Voice screen load; with a stub/invalid token it fails gracefully and shows “Connecting… (or type below)”.

| Variable | Example | Where to get it |
|----------|--------|------------------|
| `EXPO_PUBLIC_LIVEKIT_URL` | `wss://your-project.livekit.cloud` | [LiveKit Cloud](https://cloud.livekit.io/) → Project → Settings |
| `EXPO_PUBLIC_LIVEKIT_TOKEN` | (temporary) | Your backend: `POST /api/voice/token` with `{ roomName }` → return `{ token }`. Or generate in LiveKit dashboard for testing. |

**Note:** For production, the app should get the token from your backend (`EXPO_PUBLIC_API_URL` + `/api/voice/token`); the client code already calls that when set.

---

## Optional — OpenAI Realtime voice

Realtime speech-to-speech (OpenAI → audio back) requires a **backend worker** that talks to OpenAI. The app does not call OpenAI directly for realtime; it calls your backend.

| Variable | Where | Notes |
|----------|--------|------|
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com/api-keys) | Used by **your backend** (not in the Expo app). |
| `EXPO_PUBLIC_API_URL` | Your backend base URL | If set, the app will `POST` transcript to `/api/voice/realtime`; backend should run OpenAI Realtime and return `{ text }` (and optionally `{ audio }`). |

So: **OpenAI Realtime is “not running” until you deploy a backend** that implements `/api/voice/realtime` and optionally bridges LiveKit ↔ OpenAI.

---

## Optional — Google Calendar

Calendar **insert** is scaffolded. Without OAuth, `insertEvent` fails and the app correctly falls back to **local** booking (SecureStore). Local booking and Dashboard “Upcoming Appointment” work without any Google config.

To eventually use Google Calendar:

1. **Google Cloud Console**
   - Create/select a project.
   - Enable **Google Calendar API**.
   - Create OAuth 2.0 credentials (e.g. Web application or Android/iOS as needed).
   - Optionally create an API key (Calendar API can require OAuth for “primary” calendar; key alone is not enough for user calendars).

2. **Env vars (when you implement OAuth / server-side insert)**

| Variable | Notes |
|----------|--------|
| `EXPO_PUBLIC_GOOGLE_API_KEY` or `GOOGLE_API_KEY` | API key from Google Cloud (used in scaffold; “primary” calendar insert still needs OAuth). |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_ID` | OAuth client ID for “authenticate user later” flow. |

**Summary**

- **Works today offline:** Local booking, persistence, Dashboard.
- **Requires setup later:** Google OAuth + server or client flow for real Calendar insert.

---

## Quick reference — all env vars

| Variable | Required? | Purpose |
|----------|-----------|--------|
| (none) | No | Local router + local calendar |
| `EXPO_PUBLIC_GEMINI_API_KEY` | Optional | Gemini text fallback for voice GENERAL |
| `EXPO_PUBLIC_LIVEKIT_URL` | Optional | LiveKit room URL |
| `EXPO_PUBLIC_LIVEKIT_TOKEN` | Optional | LiveKit token (or use backend `/api/voice/token`) |
| `EXPO_PUBLIC_API_URL` | Optional | Backend base URL (voice token + realtime) |
| `OPENAI_API_KEY` | Backend only | OpenAI Realtime (backend worker) |
| `EXPO_PUBLIC_GOOGLE_API_KEY` / `GOOGLE_API_KEY` | Optional | Google Calendar scaffold |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_ID` | Optional | Google OAuth (for Calendar) |

Put these in `.env` (and load via `expo-env` or your preferred method); do **not** commit real keys.
