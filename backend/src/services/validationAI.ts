import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import { validateMedicalDocumentWithGemini } from './gemini';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export interface ValidationResult {
    is_medical: boolean;
    category: 'prescription' | 'lab_report' | 'discharge_summary' | 'invoice' | 'other' | null;
    confidence: number;
    reason: string;
}

const SYSTEM_PROMPT = `You are a Medical Document Gatekeeper.
Your job is to strictly permit only valid medical documents.

VALID DOCUMENT TYPES:
- Doctor Prescriptions
- Lab Reports (Blood tests, X-Rays, MRI results)
- Discharge Summaries
- Vaccination Records
- Medical Invoices (detailed medical items)

INVALID TYPES (REJECT THESE):
- General receipts (grocery, restaurants)
- Personal letters or emails
- ID cards / Driver Licenses
- Non-medical forms
- Blurry or unreadable text (unless clearly medical layout)

Input Text:
"{EXTRACTED_TEXT_SNIPPET}"

Output Format (JSON only):
{
  "is_medical": boolean,
  "category": "prescription" | "lab_report" | "discharge_summary" | "invoice" | "other" | null,
  "confidence": number (0-1),
  "reason": "concise explanation"
}`;

/**
 * Validates if the text content represents a medical document.
 * @param text The first 1000-2000 chars of the document.
 */
export async function validateMedicalDocument(text: string): Promise<ValidationResult> {
    try {
        const snippet = text.slice(0, 2000); // Analyze first 2k chars

        const response = await openai.chat.completions.create({
            model: 'gpt-4o', // or 'gpt-4o-mini' if available/cheaper
            messages: [
                { role: 'system', content: SYSTEM_PROMPT.replace('{EXTRACTED_TEXT_SNIPPET}', snippet) },
                { role: 'user', content: "Analyze this document text." }
            ],
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content || '{}';
        const result = JSON.parse(content);

        return {
            is_medical: result.is_medical ?? false,
            category: result.category || null,
            confidence: result.confidence || 0,
            reason: result.reason || "No reason provided"
        };

    } catch (error: any) {
        console.warn("OpenAI Validation failed, switching to Gemini Fallback:", error.message);

        try {
            // Cast to any to bypass strict union type check for now, or ensure Gemini returns exact type
            const fallbackResult = await validateMedicalDocumentWithGemini(text);
            return {
                ...fallbackResult,
                category: fallbackResult.category as any
            };
        } catch (geminiError) {
            console.error("Gemini Validation also failed:", geminiError);
            return {
                is_medical: false,
                category: null,
                confidence: 0,
                reason: "AI validation services failed" // Updated reason
            };
        }
    }
}
