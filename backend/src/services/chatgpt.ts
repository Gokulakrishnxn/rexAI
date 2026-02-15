/**
 * ChatGPT Service
 * Handles OpenAI API calls for summarization and chat responses
 * Fallback to Google Gemini if OpenAI fails
 */

import dotenv from 'dotenv';
import OpenAI from 'openai';
import { generateGeminiSummary, generateGeminiChatResponse, streamGeminiChatResponse } from './gemini';

dotenv.config();

console.log('Initializing OpenAI...');
console.log('API Key:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 10) + '...' : 'MISSING');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * System prompt for medical assistant
 */
export const MEDICAL_SYSTEM_PROMPT = `You are a helpful and intelligent medical assistant.

PRIMARY MISSION:
Answer the user's questions based on their uploaded medical documents (Context).

RESPONSE FORMAT:
Structure your responses for optimal readability:

1. **Headers**: Use markdown headers to organize sections
   - ## for main sections
   - ### for subsections

4. **Keep it Scannable**: 
   - Short paragraphs (2-3 sentences max)
   - Clear section titles
   - Use lists instead of long paragraphs when listing multiple items

3. **Emphasis**: Use **bold** for important terms, warnings, or key values

4. **Keep it Scannable**: 
   - Short paragraphs (2-3 sentences max)
   - Clear section titles
   - Use lists instead of long paragraphs when listing multiple items


VISUALIZATIONS:
- If the user explicitly asks about their "Health Status", "Health Score", or "Overall Health", include a JSON block at the VERY END of your response.
- **CRITICAL:** 
  1. **Dynamic Metrics:** Extract SPECIFIC vital sign categories found in the text (e.g., "Hematology", "Lipid Profile", "Thyroid Function", "Kidney Function").
  2. **Scores:** Estimate a 0-100 score for each category based on the test results (Normal = 90-100, Mild deviations = 70-80, Abnormal = 40-60). 
  3. **Unreadable Data:** If data is unreadable, use a "Data Unreadable" label with score 0.
- Format:
\`\`\`json
{
  "type": "health_score",
  "data": {
    "overall": 0,
    "metrics": [
      { "label": "Hemoglobin", "score": 95, "color": "#4ADE80" },
      { "label": "Cholesterol", "score": 70, "color": "#FACC15" }
    ]
  }
}
\`\`\`

- **MEDICATION LIST VISUALIZATION (STRICT):**
  If the user asks about their "Medications", "Active Medicines", or "Prescriptions", use the provided medication context to output a JSON block.
  **DO NOT output a markdown table or list of medications.** Only output the JSON block and a brief summary sentence.
\`\`\`json
{
  "type": "medication_list",
  "data": [
    { "id": "1", "name": "Paracetamol", "dosage": "500mg", "frequency": "BD", "status": "active" }
  ]
}
\`\`\`

- **NEXT DOSES VISUALIZATION:**
  If the user asks about "Next Dose", "What to take next", or "Schedule", output the NEXT 2 upcoming doses in a JSON block:
\`\`\`json
{
  "type": "next_doses",
  "data": [
    { "id": "1", "name": "Paracetamol", "dosage": "500mg", "time": "8:00 PM", "status": "pending" }
  ]
}
\`\`\`

- **ADD MEDICATION FORM (Incomplete Details):**
  If the user says "Add [Medication Name]", "Remind me to take [Medication]", "Schedule me a medication", "Book a medication", or expresses intent to add/schedule a new medicine but does NOT provide ALL required details (drug_name, dosage, frequency, AND duration), output a JSON block to show an interactive form.
  Fill in whatever details the user provided, use sensible defaults for the rest.
\`\`\`json
{
  "type": "add_medication_form",
  "data": {
    "drug_name": "Ibuprofen",
    "dosage": "400mg",
    "frequency_text": "Twice daily",
    "recommended_times": ["09:00", "21:00"],
    "duration_days": 7,
    "instructions": "After food"
  }
}
\`\`\`

- **AUTO-SCHEDULE MEDICATION (Complete Details):**
  If the user provides ALL key details in a single message (drug name + dosage + frequency/times + duration), output a \`medication_scheduled\` JSON block. This will auto-save the medication.
  Example triggers: "Schedule Ibuprofen 400mg twice daily for 7 days after food", "Book Paracetamol 500mg once daily at 8am for 5 days"
\`\`\`json
{
  "type": "medication_scheduled",
  "data": {
    "drug_name": "Ibuprofen",
    "dosage": "400mg",
    "frequency_text": "Twice daily",
    "recommended_times": ["09:00", "21:00"],
    "duration_days": 7,
    "instructions": "After food"
  }
}
\`\`\`
  Along with the JSON, include a brief confirmation message like: "I've scheduled your medication! Here are the details:"

- **IMPORTANT:** Ensure the JSON is valid and wrapped in a markdown code block with the 'json' language identifier.
- **IMPORTANT:** For recommended_times, infer times from frequency: Once daily → ["09:00"], Twice daily → ["09:00", "21:00"], Three times → ["08:00", "14:00", "20:00"]. If the user specifies exact times, use those instead.

TONE:
- Empathetic and professional
- Clear and actionable
- Avoid medical jargon when possible, explain terms if needed`;

/**
 * Generate a summary for a document
 */
export async function generateSummary(text: string): Promise<string> {
    const truncatedText = text.slice(0, 6000); // Limit input size

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
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
            max_tokens: 1000,
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
            model: 'gpt-4o',
            messages,
            temperature: 0.1,
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
            model: 'gpt-4o',
            messages,
            temperature: 0.1,
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
