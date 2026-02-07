import OpenAI from 'openai';
import { config } from '../config';

const openai = config.openai.apiKey
  ? new OpenAI({ apiKey: config.openai.apiKey })
  : null;

export function isOpenAIAvailable(): boolean {
  return !!openai;
}

/**
 * Chat completion with GPT-4o. Throws on failure.
 */
export async function chatCompletion(
  message: string,
  context: { role: 'user' | 'assistant'; content: string }[] = [],
  extra: string = ''
): Promise<string> {
  if (!openai) throw new Error('OPENAI_API_KEY not set');

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content:
        'You are Rex, a friendly health assistant. Be concise, supportive, and avoid medical claims. ' +
        (extra ? `Context: ${extra}` : ''),
    },
  ];

  for (const m of context) {
    messages.push({ role: m.role, content: m.content });
  }
  messages.push({ role: 'user', content: message });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    max_tokens: 1024,
    temperature: 0.7,
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error('Empty OpenAI response');
  return text.trim();
}

/**
 * SOAP note from transcript via GPT-4o. Returns structured fields.
 */
export async function generateSoapFromTranscript(transcript: string): Promise<{
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}> {
  if (!openai) throw new Error('OPENAI_API_KEY not set');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are a clinical assistant. Given a patient conversation transcript, output a SOAP note. ' +
          'Reply with ONLY a JSON object with keys: subjective, objective, assessment, plan. Each value one short clinical sentence. No markdown.',
      },
      {
        role: 'user',
        content: `Transcript:\n${transcript}\n\nJSON:`,
      },
    ],
    max_tokens: 512,
    temperature: 0.2,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty OpenAI response');
  const cleaned = raw.replace(/```json?\s*|\s*```/g, '').trim();
  const parsed = JSON.parse(cleaned) as { subjective?: string; objective?: string; assessment?: string; plan?: string };
  return {
    subjective: typeof parsed.subjective === 'string' ? parsed.subjective : '',
    objective: typeof parsed.objective === 'string' ? parsed.objective : '',
    assessment: typeof parsed.assessment === 'string' ? parsed.assessment : '',
    plan: typeof parsed.plan === 'string' ? parsed.plan : '',
  };
}

/**
 * Plate image analysis (nutrition) via GPT-4o Vision.
 */
export async function analyzePlateImage(imageBase64: string): Promise<{
  foodItems: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  recommendation: string;
}> {
  if (!openai) throw new Error('OPENAI_API_KEY not set');

  const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'Analyze this food plate image. Reply with ONLY a JSON object (no markdown) with this exact structure: ' +
              '{"foodItems": ["item1", "item2"], "calories": number, "protein": number, "carbs": number, "fat": number, "recommendation": "one short sentence"}',
          },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64}` },
          },
        ],
      },
    ],
    max_tokens: 512,
    temperature: 0.2,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty OpenAI response');
  const cleaned = raw.replace(/```json?\s*|\s*```/g, '').trim();
  const parsed = JSON.parse(cleaned) as {
    foodItems?: string[];
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    recommendation?: string;
  };
  return {
    foodItems: Array.isArray(parsed.foodItems) ? parsed.foodItems : [],
    calories: typeof parsed.calories === 'number' ? parsed.calories : 0,
    protein: typeof parsed.protein === 'number' ? parsed.protein : 0,
    carbs: typeof parsed.carbs === 'number' ? parsed.carbs : 0,
    fat: typeof parsed.fat === 'number' ? parsed.fat : 0,
    recommendation: typeof parsed.recommendation === 'string' ? parsed.recommendation : '',
  };
}

/**
 * Generic document/image extraction (GPT-4o Vision). Returns key-value style data.
 */
export async function extractFromImage(imageBase64: string): Promise<Record<string, unknown>> {
  if (!openai) throw new Error('OPENAI_API_KEY not set');

  const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'Extract any visible text and structured data from this image (e.g. prescriptions, lab results, forms). ' +
              'Reply with ONLY a JSON object with keys and values. No markdown.',
          },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64}` },
          },
        ],
      },
    ],
    max_tokens: 1024,
    temperature: 0.2,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return {};
  const cleaned = raw.replace(/```json?\s*|\s*```/g, '').trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return { rawText: raw };
  }
}

/**
 * Text reply from transcript (e.g. for voice). No audio; text only for MVP.
 */
export async function getTextReplyFromTranscript(transcript: string): Promise<string> {
  if (!openai) throw new Error('OPENAI_API_KEY not set');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are Rex, a friendly health assistant. Reply briefly.' },
      { role: 'user', content: transcript },
    ],
    max_tokens: 256,
    temperature: 0.7,
  });

  const text = completion.choices[0]?.message?.content;
  return (text && text.trim()) || "I didn't catch that. Can you repeat?";
}
