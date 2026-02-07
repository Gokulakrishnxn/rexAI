/**
 * Voice reply: backend only when EXPO_PUBLIC_API_URL is set (GPT-4o → Gemini server-side).
 * No API keys in app. When backend unreachable, return offline message.
 */

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

export interface RealtimeReply {
  audio?: ArrayBuffer;
  text: string;
  fromFallback: boolean;
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

const OFFLINE_MESSAGE = "I'm Rex. Voice AI needs the backend. Set EXPO_PUBLIC_API_URL and run the server, or use chat.";

/**
 * Get voice reply via backend only. Backend uses OpenAI then Gemini fallback.
 * When backend is unreachable, return offline message (no client-side Gemini).
 */
export async function getRealtimeVoiceReply(transcript: string): Promise<RealtimeReply> {
  if (!API_BASE) {
    return { text: OFFLINE_MESSAGE, fromFallback: true };
  }
  try {
    const res = await fetch(`${API_BASE}/api/voice/realtime`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript }),
    });
    if (!res.ok) return { text: "I'm Rex. Voice AI is unavailable. Try chat.", fromFallback: true };
    const data = await res.json();
    const text = data?.text ?? "I didn't catch that. Can you repeat?";
    const audio = data?.audio ? base64ToBuffer(data.audio) : undefined;
    return { text, audio, fromFallback: false };
  } catch {
    return { text: "I'm Rex. I couldn't reach the backend. Try chat.", fromFallback: true };
  }
}
