/**
 * Gemini Service (New GenAI SDK)
 * Handles Google Gemini API calls for summarization and chat responses
 * Uses @google/genai SDK and gemini-3-flash-preview
 */

import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import { MEDICAL_SYSTEM_PROMPT } from './chatgpt';

dotenv.config();

console.log('Initializing Gemini (GenAI SDK) with gemini-3-flash-preview...');
console.log('Gemini API Key:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 10) + '...' : 'MISSING');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL_PRIORITY = [
    'gemini-3-flash-preview',
    'gemini-3-flash-preview',
];

/**
 * Helper to execute an AI call with model fallback
 */
async function executeWithFallback<T>(
    operation: (modelName: string) => Promise<T>
): Promise<T> {
    let lastError: any = null;

    for (const modelName of MODEL_PRIORITY) {
        try {
            console.log(`[Gemini] Attempting with model: ${modelName}`);
            return await operation(modelName);
        } catch (error: any) {
            lastError = error;
            const message = error.message || String(error);
            console.warn(`[Gemini] Model ${modelName} failed. Error: ${message.substring(0, 100)}...`);

            // Simple retry/fallback logic
            if (message.includes('429') || message.includes('503') || message.includes('GoogleGenerativeAI Error')) {
                continue;
            }
            throw error;
        }
    }

    throw new Error(`All Gemini models failed. Last error: ${lastError?.message || lastError}`);
}

/**
 * Generate a summary for a document using Gemini
 */
export async function generateGeminiSummary(text: string): Promise<string> {
    return executeWithFallback(async (modelName) => {
        const truncatedText = text.slice(0, 30000);

        const response = await ai.models.generateContent({
            model: modelName,
            contents: [
                {
                    role: 'user',
                    parts: [{
                        text: `You are a medical document summarizer. Create a brief, informative summary of the following medical document or prescription. 
Focus on:
- Patient information (if present)
- Key diagnoses or conditions
- Medications prescribed (names, dosages, frequency)
- Important dates and follow-up instructions
- Any warnings or precautions

Keep the summary concise (2-3 paragraphs max).

DOCUMENT TEXT:
${truncatedText}`
                    }]
                }
            ],
            config: {
                maxOutputTokens: 500,
                temperature: 0.3,
            }
        });

        return response.text || 'Summary could not be generated.';
    });
}

/**
 * Generate a chat response with context using Gemini
 */
export async function generateGeminiChatResponse(
    question: string,
    context: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
    return executeWithFallback(async (modelName) => {
        const systemInstruction = `
${MEDICAL_SYSTEM_PROMPT}

CONTEXT FROM MEDICAL DOCUMENTS:
${context}
`;

        // Map history to new SDK format
        // The new SDK usually takes 'contents' as a list of messages
        const historyParts = conversationHistory ? conversationHistory.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        })) : [];

        // Add user question
        const contents = [
            ...historyParts,
            {
                role: 'user',
                parts: [{ text: question }]
            }
        ];

        // For system instructions, some models support 'systemInstruction' param, 
        // fallback is to prepend to first message or use specific config.
        // gemini-1.5+ supports systemInstruction.

        const response = await ai.models.generateContent({
            model: modelName,
            contents: contents, // Conversation history + current question
            config: {
                systemInstruction: systemInstruction,
                maxOutputTokens: 8192,
                temperature: 0.4,
            }
        });

        return response.text || 'I apologize, but I could not generate a response.';
    });
}

/**
 * Stream a chat response using Gemini
 * Note: Check if streaming is supported by new SDK in the same way
 */
export async function streamGeminiChatResponse(
    question: string,
    context: string,
    onChunk: (text: string) => void,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<void> {
    return executeWithFallback(async (modelName) => {
        const systemInstruction = `
${MEDICAL_SYSTEM_PROMPT}

CONTEXT FROM MEDICAL DOCUMENTS:
${context}
`;

        const historyParts = conversationHistory ? conversationHistory.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        })) : [];

        const contents = [
            ...historyParts,
            { role: 'user', parts: [{ text: question }] }
        ];

        const result = await ai.models.generateContentStream({
            model: modelName,
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                maxOutputTokens: 8192,
                temperature: 0.4,
            }
        });

        for await (const chunk of result) {
            const chunkText = chunk.text;
            if (chunkText) {
                onChunk(chunkText);
            }
        }
    });
}

/**
 * Extract text from a PDF using Gemini Flash (Multimodal OCR)
 */
export async function extractTextFromPdfWithGemini(pdfBuffer: Buffer): Promise<string> {
    // gemini-3-flash-preview might work, or fallback to 1.5-flash
    return executeWithFallback(async (modelName) => {
        console.log(`[Gemini OCR] Starting PDF extraction with ${modelName}...`);

        const data = pdfBuffer.toString('base64');

        const response = await ai.models.generateContent({
            model: modelName,
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: "Extract ALL text from this medical document preserving the layout structure. Do not summarize. Just allow me to copy-paste the text." },
                        {
                            inlineData: {
                                mimeType: 'application/pdf',
                                data: data
                            }
                        }
                    ]
                }
            ],
            config: {
                maxOutputTokens: 8192,
                temperature: 0.1,
            }
        });

        const text = response.text;
        console.log(`[Gemini OCR] Success! Extracted ${text?.length || 0} characters.`);
        return text || '';
    });
}

/**
 * Extract text from an Image using Gemini Flash (Multimodal OCR)
 */
export async function extractTextFromImageWithGemini(
    imageBuffer: Buffer,
    mimeType: string = 'image/png'
): Promise<string> {
    return executeWithFallback(async (modelName) => {
        console.log(`[Gemini OCR] Starting Image extraction with ${modelName}...`);

        const data = imageBuffer.toString('base64');

        const response = await ai.models.generateContent({
            model: modelName,
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: "Extract ALL text from this medical image. Preserving the structure if possible. Output ONLY the extracted text." },
                        {
                            inlineData: {
                                mimeType: mimeType,
                                data: data
                            }
                        }
                    ]
                }
            ],
            config: {
                maxOutputTokens: 2000,
                temperature: 0.1,
            }
        });

        const text = response.text;
        console.log(`[Gemini OCR] Image Success! Extracted ${text?.length || 0} characters.`);
        return text || '';
    });
}

/**
 * Analyze Medication Text using Gemini (JSON Mode)
 */
export async function analyzeMedicationWithGemini(text: string): Promise<any> {
    const SYSTEM_PROMPT = `You are an expert Medical Pharmacist AI.
Your goal is to extract structured medication regimes from Doctor's prescriptions (OCR text).

OUTPUT FORMAT:
Return a PURE JSON object with a "medications" array. 

{
  "medications": [
    {
      "drug_name": "Review raw text",
      "normalized_name": "Standard generic/brand name (fix spelling)",
      "dosage": "e.g., 500mg",
      "form": "tablet" | "capsule" | "syrup" | "injection" | "drops" | "cream" | "other",
      "frequency_text": "e.g., BD, 1-0-1, Twice daily",
      "duration_days": number (default 5 if unknown),
      "instructions": "e.g., After food, Before sleep",
      "timing_labels": ["morning", "afternoon", "night"],
      "confidence": 0.0 to 1.0
    }
  ]
}

RULES:
1. Normalize "1-0-1", "BD", "Twice" -> timing_labels: ["morning", "night"]
2. Normalize "1-1-1", "TDS" -> timing_labels: ["morning", "afternoon", "night"]
3. Normalize "0-0-1", "HS" -> timing_labels: ["night"]
4. If the generic name is obvious (e.g., "Calpol"), normalized_name should be "Paracetamol".`;

    return executeWithFallback(async (modelName) => {
        console.log(`[Gemini MedAI] Analyzing with ${modelName}...`);

        const response = await ai.models.generateContent({
            model: modelName,
            contents: [
                {
                    role: 'user',
                    parts: [{ text: `${SYSTEM_PROMPT}\n\nPRESCRIPTION TEXT:\n${text}` }]
                }
            ],
            config: {
                responseMimeType: "application/json"
            }
        });

        const rawText = response.text || '{}';
        // Clean markdown if present
        const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            return JSON.parse(cleanJson);
        } catch (e) {
            console.error('[Gemini MedAI] JSON Parse Failed:', rawText);
            throw new Error('Invalid JSON from Gemini');
        }
    });
}

/**
 * Validate Document using Gemini (Fallback for ValidationAI)
 */
export async function validateMedicalDocumentWithGemini(text: string): Promise<{ is_medical: boolean; category: string | null; confidence: number; reason: string }> {
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
`;

    return executeWithFallback(async (modelName) => {
        console.log(`[Gemini Validation] Analyzing with ${modelName}...`);

        const snippet = text.slice(0, 2000);

        const response = await ai.models.generateContent({
            model: modelName,
            contents: [
                {
                    role: 'user',
                    parts: [{ text: `${SYSTEM_PROMPT}\n\nInput Text:\n"${snippet}"\n\nOutput Format (JSON only):\n{\n  "is_medical": boolean,\n  "category": "prescription" | "lab_report" | "discharge_summary" | "invoice" | "other" | null,\n  "confidence": number (0-1),\n  "reason": "concise explanation"\n}` }]
                }
            ],
            config: {
                responseMimeType: "application/json"
            }
        });

        const rawText = response.text || '{}';

        try {
            const json = JSON.parse(rawText);
            return {
                is_medical: json.is_medical ?? false,
                category: json.category || null,
                confidence: json.confidence || 0,
                reason: json.reason || "Gemini validation"
            };
        } catch (e) {
            console.error('[Gemini Validation] JSON Parse Failed:', rawText);
            return {
                is_medical: false, category: null, confidence: 0, reason: "Invalid JSON from Gemini"
            };
        }
    });
}
