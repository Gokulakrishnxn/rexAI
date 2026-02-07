/**
 * Google Calendar API — scaffold for hackathon.
 * PRIMARY: Google Calendar insert event.
 * Authenticate user later; env: GOOGLE_CLIENT_ID, EXPO_PUBLIC_GOOGLE_API_KEY (or GOOGLE_API_KEY).
 */

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_API_KEY ?? process.env.GOOGLE_API_KEY ?? '';
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID ?? '';

export interface GoogleCalendarEventInput {
  title: string;
  datetime: string; // ISO
  description?: string;
}

let isAuthenticated = false;

/**
 * Authenticate user with Google (OAuth). Scaffold — implement later.
 */
export async function authenticate(): Promise<boolean> {
  if (!GOOGLE_CLIENT_ID) return false;
  // TODO: OAuth flow, store refresh token
  isAuthenticated = false;
  return isAuthenticated;
}

/**
 * Insert event into Google Calendar. Returns event id if success; throws or returns null on failure.
 */
export async function insertEvent(input: GoogleCalendarEventInput): Promise<string | null> {
  if (!GOOGLE_API_KEY) return null;
  try {
    // TODO: use Calendar API v3 with OAuth token when authenticate() is implemented
    // For scaffold: simulate failure so calendarTool falls back to local
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: input.title,
          description: input.description ?? '',
          start: { dateTime: input.datetime, timeZone: 'UTC' },
          end: {
            dateTime: new Date(new Date(input.datetime).getTime() + 30 * 60 * 1000).toISOString(),
            timeZone: 'UTC',
          },
        }),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (err?.error?.code === 401 || err?.error?.message?.includes('Login Required')) return null;
      throw new Error(err?.error?.message ?? 'Google Calendar failed');
    }
    const data = await res.json();
    return data.id ?? null;
  } catch {
    return null;
  }
}
