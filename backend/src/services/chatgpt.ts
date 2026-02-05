/**
 * ChatGPT Service
 * Handles OpenAI API calls for summarization and chat responses
 */

import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

console.log('Initializing OpenAI...');
console.log('Base URL:', process.env.OPENAI_BASE_URL);
console.log('API Key:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 10) + '...' : 'MISSING');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    defaultHeaders: {
        'HTTP-Referer': 'https://github.com/rex-healthify',
        'X-Title': 'Rex Healthify',
    },
});

/**
 * System prompt for medical assistant
 */
export const MEDICAL_SYSTEM_PROMPT = `You are a helpful and intelligent medical assistant.

PRIMARY MISSION:
Answer the user's questions based on their uploaded medical documents (Context).

FLEXIBILITY & THINKING:
- If the exact answer is in the document, quote it accurately.
- If the document mentions a condition or medication but doesn't explain it, you SHOULD use your internal knowledge to explain what it is, provided it matches the context.
- If NO relevant information is found in the documents for a specific question, acknowledge this ("I couldn't find specific details about this in your reports..."), but then provide a helpful general explanation or guidance based on your medical training.
- Never diagnose or prescribe. Always include a disclaimer to consult a doctor.

STYLE:
- Be empathetic and clear.
- Use bullet points for medications and dosages.
- If the user's request is a general health query (not specific to their records), answer it helpfully using your knowledge base while noting you are speaking generally.`;

/**
 * Generate a summary for a document
 */
export async function generateSummary(text: string): Promise<string> {
    const truncatedText = text.slice(0, 6000); // Limit input size

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: `You are a medical document summarizer. Create a brief, informative summary of the following medical document or prescription. 
Focus on:
- Patient information (if present)
- Key diagnoses or conditions
- Medications prescribed (names, dosages, frequency)
- Important dates and follow-up instructions
- Any warnings or precautions

Keep the summary concise (2-3 paragraphs max).`,
                },
                {
                    role: 'user',
                    content: truncatedText,
                },
            ],
            temperature: 0.3,
            max_tokens: 500,
        });

        return response.choices[0]?.message?.content || 'Summary could not be generated.';
    } catch (error) {
        console.error('Summary generation failed:', error);
        throw new Error(`Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Generate a chat response with context
 */
export async function generateChatResponse(
    question: string,
    context: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
    try {
        const messages: OpenAI.ChatCompletionMessageParam[] = [
            { role: 'system', content: MEDICAL_SYSTEM_PROMPT },
        ];

        // Add conversation history if provided
        if (conversationHistory) {
            messages.push(...conversationHistory);
        }

        // Add context and current question
        messages.push({
            role: 'user',
            content: `CONTEXT FROM MEDICAL DOCUMENTS:
${context}

---

USER QUESTION:
${question}`,
        });

        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages,
            temperature: 0.4,
            max_tokens: 1000,
        });

        return response.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';
    } catch (error) {
        console.error('Chat response generation failed:', error);
        throw new Error(`Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Stream a chat response
 */
export async function streamChatResponse(
    question: string,
    context: string,
    onChunk: (text: string) => void,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<void> {
    try {
        const messages: OpenAI.ChatCompletionMessageParam[] = [
            { role: 'system', content: MEDICAL_SYSTEM_PROMPT },
        ];

        if (conversationHistory) {
            messages.push(...conversationHistory);
        }

        messages.push({
            role: 'user',
            content: `CONTEXT FROM MEDICAL DOCUMENTS:
${context}

---

USER QUESTION:
${question}`,
        });

        const stream = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages,
            temperature: 0.4,
            max_tokens: 1000,
            stream: true,
        });

        for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content;
            if (text) {
                onChunk(text);
            }
        }
    } catch (error) {
        console.error('Stream generation failed:', error);
        throw new Error(`Failed to stream response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
