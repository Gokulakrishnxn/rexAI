/**
 * Cloud sync (Firebase/Supabase) for records and profile.
 */

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

export async function syncRecords(): Promise<void> {
  await fetch(`${API_BASE}/api/sync/records`, { method: 'POST' });
}

export async function syncProfile(): Promise<void> {
  await fetch(`${API_BASE}/api/sync/profile`, { method: 'POST' });
}
