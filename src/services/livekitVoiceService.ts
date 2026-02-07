/**
 * LiveKit realtime voice session — connect to room, start/stop audio.
 * Backend token endpoint can be stubbed; use EXPO_PUBLIC_LIVEKIT_URL and token from env or stub.
 */

import { Room } from 'livekit-client';

const LIVEKIT_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL ?? 'wss://your-project.livekit.cloud';
let activeRoom: Room | null = null;

/**
 * Fetch LiveKit token from backend. Stub: return placeholder; replace with real endpoint later.
 */
export async function getLiveKitToken(roomName: string): Promise<string> {
  const apiBase = process.env.EXPO_PUBLIC_API_URL ?? '';
  if (apiBase) {
    try {
      const res = await fetch(`${apiBase}/api/voice/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) return data.token;
      }
    } catch {
      // fall through to stub
    }
  }
  // Stub for hackathon: backend not deployed yet
  return process.env.EXPO_PUBLIC_LIVEKIT_TOKEN ?? 'stub-token';
}

/**
 * Connect to a LiveKit room. Uses stub token if backend not available.
 */
export async function connectToRoom(roomName?: string): Promise<Room> {
  const name = roomName ?? `rex-voice-${Date.now()}`;
  const token = await getLiveKitToken(name);
  const room = new Room();
  await room.connect(LIVEKIT_URL, token, { autoSubscribe: true });
  activeRoom = room;
  return room;
}

/**
 * Start publishing local microphone. Call after connectToRoom.
 */
export async function startAudioStream(room: Room): Promise<void> {
  await room.localParticipant.setMicrophoneEnabled(true);
}

/**
 * Stop microphone and disconnect from room.
 */
export async function stopAudioStream(room?: Room): Promise<void> {
  const r = room ?? activeRoom;
  if (r) {
    await r.localParticipant.setMicrophoneEnabled(false);
    r.disconnect();
    if (activeRoom === r) activeRoom = null;
  }
}

/**
 * Get current active room (if any).
 */
export function getActiveRoom(): Room | null {
  return activeRoom;
}
