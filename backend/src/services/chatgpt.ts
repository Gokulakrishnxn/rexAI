/**
 * ChatGPT Service
 * Handles OpenAI API calls for summarization and chat responses
 * Fallback to Google Gemini if OpenAI/OpenRouter fails
 */

import dotenv from 'dotenv';
import OpenAI from 'openai';
import { generateGeminiSummary, generateGeminiChatResponse, streamGeminiChatResponse } from './gemini';

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

VISUALIZATIONS:
- If the user explicitly asks about their "Health Status", "Health Score", or "Overall Health", you MUST include a JSON block at the VERY END of your response.
- **CRITICAL:** 
  1. **Dynamic Metrics:** Do NOT use generic labels like "Cardiac" or "Respiratory" unless the document supports them. Instead, extract SPECIFIC vital sign categories found in the text (e.g., "Hematology", "Lipid Profile", "Thyroid Function", "Kidney Function").
  2. **Scores:** Estimate a 0-100 score for each category based on the test results (Normal = 90-100, Mild deviations = 70-80, Abnormal = 40-60). 
  3. **Unreadable Data:** If the chunk text is garbled (e.g., "AHEEE..."), use a "Data Unreadable" label with score 0.
- Format:
\`\`\`json
{
  "type": "health_score",
  "data": {
    "overall": 0, // Calculate average of valid metrics, or 0 if unreadable
    "metrics": [
      // Example of DYNAMIC outputs (Only generate what exists in context):
      { "label": "Hemoglobin", "score": 95, "color": "#4ADE80" },
      { "label": "Cholesterol", "score": 70, "color": "#FACC15" },
      { "label": "Thyroid", "score": 0, "color": "#F87171" } // 0 if bad result
    ]
  }
}
\`\`\`
- Do NOT skip this block if the user asks for "Health Status".
- **IMPORTANT:** Ensure the JSON is valid. Ensure it is wrapped in a markdown code block with the 'json' language identifier.

STYLE & FORMATTING:
- Use clear paragraphs. 
- Do NOT use markdown bolding (**) for headers.
- Use simple bullet points (-) for lists.
- Avoid complex markdown tables.
- Keep the tone empathetic and professional.`;

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
                    content: `You are a medical document summarizer.Create a brief, informative summary of the following medical document or prescription. 
Focus on:
- Patient information(if present)
    - Key diagnoses or conditions
        - Medications prescribed(names, dosages, frequency)
            - Important dates and follow - up instructions
                - Any warnings or precautions

Keep the summary concise(2 - 3 paragraphs max).`,
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
    } catch (error: any) {
        console.warn('OpenAI Summary failed, switching to Gemini Fallback:', error.message);
        try {
            return await generateGeminiSummary(text);
        } catch (geminiError: any) {
            console.error('Gemini Summary also failed:', geminiError);
            throw new Error(`Failed to generate summary(Both Providers failed): ${error.message} | ${geminiError.message} `);
        }
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
        // REINFORCEMENT: Add the visualization instruction here to ensure it's fresh in context
        messages.push({
            role: 'user',
            content: `CONTEXT FROM MEDICAL DOCUMENTS:
${context}

---

USER QUESTION:
${question}

**SYSTEM INSTRUCTION:** If the user asked about Health Status/Score, you MUST append the 'health_score' JSON block at the end.`,
        });

        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages,
            temperature: 0.4,
            max_tokens: 1000,
        });

        const answer = response.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';
        console.log('[ChatGPT] Raw Response len:', answer.length);
        console.log('[ChatGPT] Contains JSON?', answer.includes('"type": "health_score"'));

        return answer;
    } catch (error: any) {
        console.warn('OpenAI Chat failed, switching to Gemini Fallback:', error.message);
        try {
            return await generateGeminiChatResponse(question, context, conversationHistory);
        } catch (geminiError) {
            console.error('Gemini Chat also failed:', geminiError);
            throw error; // Throw original error roughly or composite
        }
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
${question} `,
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
    } catch (error: any) {
        console.warn('OpenAI Stream failed, switching to Gemini Fallback:', error.message);
        try {
            await streamGeminiChatResponse(question, context, onChunk, conversationHistory);
        } catch (geminiError) {
            console.error('Gemini Stream also failed:', geminiError);
            throw error;
        }
    }
}
