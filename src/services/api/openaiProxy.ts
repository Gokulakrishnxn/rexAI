/**
 * GPT-4o vision + structured outputs for document extraction.
 * Proxy to your backend to keep API keys server-side.
 */

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

export async function extractFromImage(imageBase64: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/api/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageBase64 }),
  });
  if (!res.ok) throw new Error('Extraction failed');
  return res.json();
}
