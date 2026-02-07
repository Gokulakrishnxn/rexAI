/**
 * Plate scan vision: backend only when EXPO_PUBLIC_API_URL is set (GPT-4o Vision → Gemini server-side).
 * No API keys in app. Offline stub only when no backend URL.
 */

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

export interface NutritionResult {
  foodItems: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  recommendation: string;
}

const STUB_RESULT: NutritionResult = {
  foodItems: [],
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  recommendation: 'Unable to analyze. Ensure backend is running and try again.',
};

/** Offline stub when no API URL (e.g. backend not configured). */
function getOfflineStub(): NutritionResult {
  return {
    foodItems: ['Sample item'],
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    recommendation: 'Connect to backend (set EXPO_PUBLIC_API_URL) for real plate analysis.',
  };
}

/**
 * Analyze plate image. When API_BASE is set, all requests go through backend (no mock, no client Gemini).
 * When backend is unreachable, return stub. When API_BASE is not set, return offline stub.
 */
export async function analyzePlate(imageBase64: string): Promise<NutritionResult> {
  if (!API_BASE) {
    return getOfflineStub();
  }
  try {
    const res = await fetch(`${API_BASE}/api/vision/plate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64 }),
    });
    if (!res.ok) return STUB_RESULT;
    const data = await res.json();
    if (data && typeof data.foodItems !== 'undefined') {
      return data as NutritionResult;
    }
    return STUB_RESULT;
  } catch {
    return STUB_RESULT;
  }
}
