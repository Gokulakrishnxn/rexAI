import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import { extractTextFromPdfWithGemini } from './gemini.js'; // Re-use simpler AI if needed, but for Logic we prefer GPT

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
});

export interface MedicationDraft {
    drug_name: string;
    normalized_name: string;
    dosage: string;
    form: 'tablet' | 'capsule' | 'syrup' | 'injection' | 'drops' | 'cream' | 'other';
    frequency_text: string;
    duration_days: number;
    instructions: string;
    timing_labels: string[]; // ["morning", "night", "after_food"]
    confidence: number;
    recommended_times: string[]; // ["08:00", "20:00"]
}

const SYSTEM_PROMPT = `You are an expert Medical Pharmacist AI.
Your goal is to extract structured medication regimes from Doctor's prescriptions (OCR text).

OUTPUT FORMAT:
Return a JSON object with a "medications" array.
Strictly follow this schema:
{
  "drug_name": "Review raw text",
  "normalized_name": "Standard generic/brand name (fix spelling)",
  "dosage": "e.g., 500mg",
  "form": "tablet" | "capsule" | "syrup" | "injection" | "drops" | "cream" | "other",
  "frequency_text": "e.g., BD, 1-0-1, Twice daily",
  "duration_days": number (default 5 if unknown),
  "instructions": "e.g., After food, Before sleep",
  "timing_labels": ["morning", "afternoon", "night"],
  "confidence": 0.0 to 1.0 (Low if text is garbled)
}

RULES:
1. Normalize "1-0-1", "BD", "Twice" -> timing_labels: ["morning", "night"]
2. Normalize "1-1-1", "TDS" -> timing_labels: ["morning", "afternoon", "night"]
3. Normalize "0-0-1", "HS" -> timing_labels: ["night"]
4. If the generic name is obvious (e.g., "Calpol"), normalized_name should be "Paracetamol".

If the text implies a specific condition (e.g. "Fever", "Infection"), note it but focus on medications.`;

/**
 * Orchestrator: Analyzes text -> Returns Structured Plan
 */
export async function analyzeMedicationText(text: string): Promise<MedicationDraft[]> {
    console.log('[MedicationAI] Analyzing text for prescriptions...');

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: `PRESCRIPTION TEXT:\n${text}` }
            ],
            temperature: 0.1, // Low temp for strict data extraction
            response_format: { type: "json_object" }
        });

        const rawJson = response.choices[0].message.content || '{}';
        const parsed = JSON.parse(rawJson);

        if (!parsed.medications || !Array.isArray(parsed.medications)) {
            console.warn('[MedicationAI] No medications found in AI response.');
            return [];
        }

        // Post-process: Add recommended times (Scheduler Logic)
        const enhancedDrafts: MedicationDraft[] = parsed.medications.map((m: any) => {
            return {
                ...m,
                recommended_times: generateDefaultTimes(m.timing_labels || [])
            };
        });

        return enhancedDrafts;

    } catch (error) {
        console.warn('[MedicationAI] OpenAI Analysis failed, switching to Gemini Fallback:', error);

        try {
            // Lazy import to avoid circular dep if needed, or proper import
            const { analyzeMedicationWithGemini } = await import('./gemini.js');
            const parsed = await analyzeMedicationWithGemini(text);

            if (!parsed.medications || !Array.isArray(parsed.medications)) {
                return [];
            }

            const enhancedDrafts: MedicationDraft[] = parsed.medications.map((m: any) => {
                return {
                    ...m,
                    recommended_times: generateDefaultTimes(m.timing_labels || [])
                };
            });
            return enhancedDrafts;

        } catch (geminiError) {
            console.error('[MedicationAI] Gemini Fallback also failed:', geminiError);
            return [];
        }
    }
}

/**
 * Helper: Convert intuitive labels to specific default times
 * This is the "Scheduler" logic
 */
function generateDefaultTimes(labels: string[]): string[] {
    const times: string[] = [];
    const lowerLabels = labels.map(l => l.toLowerCase());

    if (lowerLabels.includes('morning')) times.push('08:00');
    if (lowerLabels.includes('afternoon') || lowerLabels.includes('noon')) times.push('13:00');
    if (lowerLabels.includes('evening')) times.push('18:00');
    if (lowerLabels.includes('night') || lowerLabels.includes('bedtime')) times.push('21:00');

    // Default fallback if extracting "Twice daily" but no specific times
    if (times.length === 0) {
        if (labels.length === 2) return ['09:00', '21:00'];
        if (labels.length === 3) return ['09:00', '14:00', '21:00'];
        if (labels.length === 1) return ['09:00'];
    }

    return times.sort();
}
