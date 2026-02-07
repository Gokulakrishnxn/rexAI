/**
 * SOAP note generation: backend only when EXPO_PUBLIC_API_URL is set (GPT-4o → Gemini server-side).
 * No API keys in app. Offline stub only when no backend URL.
 */

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

import type { SoapNote } from '../types/soap';

function offlineStubNote(source: SoapNote['source']): SoapNote {
  return {
    id: `soap_${Date.now()}`,
    createdAt: new Date().toISOString(),
    source,
    subjective: 'Connect to backend for SOAP generation.',
    objective: '',
    assessment: '',
    plan: '',
  };
}

function unavailableNote(source: SoapNote['source']): SoapNote {
  return {
    id: `soap_${Date.now()}`,
    createdAt: new Date().toISOString(),
    source,
    subjective: 'Backend unavailable.',
    objective: '',
    assessment: 'SOAP generation could not be completed.',
    plan: 'Ensure server is running and try again.',
  };
}

/**
 * Generate SOAP note. When API_BASE is set, all requests go through backend (no mock, no client Gemini).
 * When backend fails or API_BASE is not set, return appropriate stub.
 */
export async function generateSoapNote(
  transcript: string,
  source: SoapNote['source'] = 'chat'
): Promise<SoapNote> {
  if (!API_BASE) {
    return offlineStubNote(source);
  }
  try {
    const res = await fetch(`${API_BASE}/api/soap/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript }),
    });
    if (!res.ok) return unavailableNote(source);
    const data = await res.json();
    if (data && typeof data.subjective === 'string') {
      return {
        id: data.id ?? `soap_${Date.now()}`,
        createdAt: data.createdAt ?? new Date().toISOString(),
        source: data.source ?? source,
        subjective: data.subjective,
        objective: data.objective ?? '',
        assessment: data.assessment ?? '',
        plan: data.plan ?? '',
      };
    }
    return unavailableNote(source);
  } catch {
    return unavailableNote(source);
  }
}
