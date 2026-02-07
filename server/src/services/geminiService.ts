import { config } from '../config';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = 'gemini-1.5-pro';

function getApiKey(): string {
  const key = config.gemini.apiKey;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  return key;
}

export function isGeminiAvailable(): boolean {
  return !!config.gemini.apiKey;
}

interface GeminiTextPart {
  text: string;
}
interface GeminiInlineDataPart {
  inlineData: { mimeType: string; data: string };
}

/**
 * Chat completion with Gemini Pro. Used as fallback when OpenAI fails.
 */
export async function chatCompletion(
  message: string,
  context: { role: 'user' | 'assistant'; content: string }[] = [],
  extra: string = ''
): Promise<string> {
  const apiKey = getApiKey();
  const parts: GeminiTextPart[] = [];
  if (extra?.trim()) parts.push({ text: `Context: ${extra}\n\n` });
  if (context?.length) {
    const history = context
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');
    parts.push({ text: `Recent conversation:\n${history}\n\n` });
  }
  parts.push({ text: `User: ${message}` });

  const res = await fetch(
    `${GEMINI_BASE}/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Gemini request failed');
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string' || !text.trim()) throw new Error('Empty Gemini response');
  return text.trim();
}

/**
 * SOAP note from transcript via Gemini.
 */
export async function generateSoapFromTranscript(transcript: string): Promise<{
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}> {
  const apiKey = getApiKey();
  const prompt =
    `Given this patient conversation transcript, output ONLY a JSON object (no markdown) with keys: subjective, objective, assessment, plan. Each value a short clinical sentence.\n\nTranscript:\n${transcript}\n\nJSON:`;

  const res = await fetch(
    `${GEMINI_BASE}/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 512, temperature: 0.2 },
      }),
    }
  );

  if (!res.ok) throw new Error('Gemini SOAP request failed');
  const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error('Empty Gemini response');
  const cleaned = raw.replace(/```json?\s*|\s*```/g, '').trim();
  const parsed = JSON.parse(cleaned) as Record<string, string>;
  return {
    subjective: parsed.subjective ?? '',
    objective: parsed.objective ?? '',
    assessment: parsed.assessment ?? '',
    plan: parsed.plan ?? '',
  };
}

/**
 * Plate image analysis via Gemini Vision.
 */
export async function analyzePlateImage(imageBase64: string): Promise<{
  foodItems: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  recommendation: string;
}> {
  const apiKey = getApiKey();
  const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const res = await fetch(
    `${GEMINI_BASE}/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: base64 } } as GeminiInlineDataPart,
              {
                text:
                  'Analyze this food plate image. Reply with ONLY a JSON object (no markdown): ' +
                  '{"foodItems": ["item1"], "calories": number, "protein": number, "carbs": number, "fat": number, "recommendation": "one short sentence"}',
              },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 512, temperature: 0.2 },
      }),
    }
  );

  if (!res.ok) throw new Error('Gemini vision request failed');
  const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error('Empty Gemini response');
  const cleaned = raw.replace(/```json?\s*|\s*```/g, '').trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  return {
    foodItems: Array.isArray(parsed.foodItems) ? (parsed.foodItems as string[]) : [],
    calories: typeof parsed.calories === 'number' ? parsed.calories : 0,
    protein: typeof parsed.protein === 'number' ? parsed.protein : 0,
    carbs: typeof parsed.carbs === 'number' ? parsed.carbs : 0,
    fat: typeof parsed.fat === 'number' ? parsed.fat : 0,
    recommendation: typeof parsed.recommendation === 'string' ? parsed.recommendation : '',
  };
}

/**
 * Text reply from transcript (voice fallback).
 */
export async function getTextReplyFromTranscript(transcript: string): Promise<string> {
  const apiKey = getApiKey();
  const res = await fetch(
    `${GEMINI_BASE}/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: transcript }] }],
        generationConfig: { maxOutputTokens: 256 },
      }),
    }
  );
  if (!res.ok) throw new Error('Gemini request failed');
  const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === 'string' && text.trim() ? text.trim() : "I didn't catch that. Can you repeat?";
}
