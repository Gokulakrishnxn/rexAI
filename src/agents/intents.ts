/**
 * Intent types and keyword-based detection for Router Agent.
 * No model calls — simple rules only.
 */

export type RexIntent =
  | 'EMERGENCY'
  | 'TRIAGE'
  | 'BOOKING'
  | 'LITERACY'
  | 'TODAY_PLAN'
  | 'GENERAL';

const EMERGENCY_KEYWORDS = [
  'chest pain', 'collapsed', 'breathing', 'can\'t breathe', 'unconscious',
  'heart attack', 'stroke', 'severe bleeding', 'emergency',
];
const TRIAGE_KEYWORDS = [
  'fever', 'cough', 'headache', 'cold', 'vomit', 'vomiting', 'pain',
  'symptom', 'symptoms', 'sick', 'unwell', 'dizzy', 'nausea',
];
const BOOKING_KEYWORDS = [
  'doctor', 'appointment', 'dentist', 'book', 'schedule', 'visit',
  'clinic', 'hospital visit', 'see a doctor',
];
const LITERACY_KEYWORDS = [
  'explain', 'what is', 'medicine', 'medication', 'diagnosis',
  'meaning', 'hinglish', 'simple', 'understand',
];
const TODAY_PLAN_KEYWORDS = [
  'what should i do today', 'today plan', 'my day today', 'schedule today',
  'what\'s on today', 'today\'s plan', 'anything today',
];

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

function hasAnyKeyword(text: string, keywords: string[]): boolean {
  const t = normalize(text);
  return keywords.some((kw) => t.includes(kw));
}

/**
 * Detect intent from user message using keyword rules.
 * Order: EMERGENCY first, then TRIAGE, BOOKING, LITERACY, else GENERAL.
 */
export function detectIntent(userText: string): RexIntent {
  const t = normalize(userText);
  if (t.length === 0) return 'GENERAL';
  if (hasAnyKeyword(t, EMERGENCY_KEYWORDS)) return 'EMERGENCY';
  if (hasAnyKeyword(t, TRIAGE_KEYWORDS)) return 'TRIAGE';
  if (hasAnyKeyword(t, BOOKING_KEYWORDS)) return 'BOOKING';
  if (hasAnyKeyword(t, LITERACY_KEYWORDS)) return 'LITERACY';
  if (hasAnyKeyword(t, TODAY_PLAN_KEYWORDS)) return 'TODAY_PLAN';
  return 'GENERAL';
}
