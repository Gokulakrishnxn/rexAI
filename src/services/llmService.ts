/**
 * LLM Service — all requests go through backend (GPT-4o primary, Gemini fallback server-side).
 * No API keys in app. When backend is unreachable, show offline message.
 */

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

export interface LLMContext {
  recentMessages?: { role: 'user' | 'assistant'; content: string }[];
  extra?: string;
}

/**
 * Get AI response via backend only. Backend uses OpenAI GPT-4o then Gemini fallback.
 * When EXPO_PUBLIC_API_URL is set, we never call OpenAI/Gemini from the app.
 */
export async function getAIResponse(
  userText: string,
  context: LLMContext = {}
): Promise<string> {
  if (!API_BASE) {
    return "I'm Rex. Set EXPO_PUBLIC_API_URL and run the backend to use live AI.";
  }
  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userText,
        context: context.recentMessages ?? [],
        extra: context.extra ?? '',
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return "I'm Rex. The AI service returned an error. Please try again.";
    }
    const data = await res.json();
    const text = data?.reply ?? data?.message ?? data?.text;
    if (typeof text === 'string' && text.trim()) return text.trim();
    return "I'm Rex. I didn't get a valid reply. Try again.";
  } catch {
    return "I'm Rex. I couldn't reach the backend. Make sure the server is running and EXPO_PUBLIC_API_URL is correct.";
  }
}
