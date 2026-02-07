/**
 * Realtime voice agent: OpenAI GPT-4o Realtime (primary) → Gemini 1.5 Flash text (fallback).
 * Flow: Voice → LiveKit → Backend voice worker → OpenAI Realtime → audio back.
 * If OpenAI fails, fallback: Gemini Flash text API → show text reply.
 */

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';
const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

export interface RealtimeReply {
  audio?: ArrayBuffer;
  text: string;
  fromFallback: boolean;
}

/**
 * Request realtime voice response from backend (OpenAI Realtime).
 * Backend pipes: user audio → OpenAI gpt-4o-realtime-preview → audio response.
 * Returns text for fallback display when audio not available.
 */
async function tryOpenAIRealtime(transcript: string): Promise<RealtimeReply | null> {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}/api/voice/realtime`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, model: 'gpt-4o-realtime-preview' }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      text: data.text ?? transcript,
      audio: data.audio ? base64ToBuffer(data.audio) : undefined,
      fromFallback: false,
    };
  } catch {
    return null;
  }
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Fallback: Gemini 1.5 Flash text API (free tier).
 */
async function getGeminiTextReply(userText: string): Promise<string> {
  if (!GEMINI_KEY) {
    return "I'm Rex. Voice is offline right now. Try typing in chat.";
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: userText }] }],
          generationConfig: { maxOutputTokens: 256 },
        }),
      }
    );
    if (!res.ok) throw new Error('Gemini request failed');
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === 'string' ? text.trim() : "I didn't catch that. Can you repeat?";
  } catch {
    return "I'm Rex. I couldn't reach the AI right now. Try again or use chat.";
  }
}

/**
 * Get voice reply: try OpenAI Realtime via backend; on failure use Gemini Flash text.
 */
export async function getRealtimeVoiceReply(transcript: string): Promise<RealtimeReply> {
  const openAI = await tryOpenAIRealtime(transcript);
  if (openAI) return openAI;
  const text = await getGeminiTextReply(transcript);
  return { text, fromFallback: true };
}
