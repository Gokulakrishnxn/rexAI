/**
 * Gemini Service
 * Handles Google Gemini API calls for summarization and chat responses
 * Used as a fallback when OpenAI/OpenRouter fails
 * 
 * Documentation: https://ai.google.dev/gemini-api/docs/quickstart?lang=node
 */

import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { MEDICAL_SYSTEM_PROMPT } from './chatgpt';

dotenv.config();

console.log('Initializing Gemini (Modern SDK) with multi-model fallback...');
console.log('Gemini API Key:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 10) + '...' : 'MISSING');

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

/**
 * List of models to try in order of preference.
 * The gemini-3 models might have restricted quota (limit: 0) on some free accounts.
 * Falling back down to 1.5-flash ensures maximal availability.
 */
const MODEL_PRIORITY = [
    // 'gemini-3-pro-preview',
    'gemini-3-flash-preview',
    'gemini-2.0-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash'
];

/**
 * Helper to execute an AI call with model fallback
 * Retries on 404 (Not Found) or 429 (Quota Exceeded)
 */
async function executeWithFallback<T>(
    operation: (modelName: string) => Promise<T>
): Promise<T> {
    let lastError: any = null;

    for (const modelName of MODEL_PRIORITY) {
        try {
            return await operation(modelName);
        } catch (error: any) {
            lastError = error;
            const message = error.message || String(error);
            const isQuotaError = message.includes('429') || message.includes('RESOURCE_EXHAUSTED');
            const isNotFoundError = message.includes('404') || message.includes('not found');

            if (isQuotaError || isNotFoundError) {
                console.warn(`Gemini model ${modelName} failed (${isQuotaError ? 'Quota' : 'Not Found'}). Trying next model...`);
                continue;
            }
            // If it's another type of error, throw it immediately
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
        const prompt = `${MEDICAL_SYSTEM_PROMPT}

CONTEXT FROM MEDICAL DOCUMENTS:
${context}

---

USER QUESTION:
${question}`;

        const contents = [];

        // Add history if present
        if (conversationHistory) {
            for (const msg of conversationHistory) {
                contents.push({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }]
                });
            }
        }

        // Add current question
        contents.push({
            role: 'user',
            parts: [{ text: prompt }]
        });

        const response = await ai.models.generateContent({
            model: modelName,
            contents: contents,
            config: {
                maxOutputTokens: 1000,
                temperature: 0.4,
            }
        });

        return response.text || 'I apologize, but I could not generate a response.';
    });
}

/**
 * Stream a chat response using Gemini
 */
export async function streamGeminiChatResponse(
    question: string,
    context: string,
    onChunk: (text: string) => void,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<void> {
    return executeWithFallback(async (modelName) => {
        const prompt = `${MEDICAL_SYSTEM_PROMPT}

CONTEXT FROM MEDICAL DOCUMENTS:
${context}

---

USER QUESTION:
${question}`;

        const contents = [];

        if (conversationHistory) {
            for (const msg of conversationHistory) {
                contents.push({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }]
                });
            }
        }

        contents.push({ role: 'user', parts: [{ text: prompt }] });

        const stream = await ai.models.generateContentStream({
            model: modelName,
            contents: contents,
            config: {
                maxOutputTokens: 1000,
                temperature: 0.4,
            }
        });

        for await (const chunk of stream) {
            const chunkText = chunk.text;
            if (chunkText) {
                onChunk(chunkText);
            }
        }
    });
}
