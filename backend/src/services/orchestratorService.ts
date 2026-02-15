import { OpenAI } from 'openai';
import { supabase } from '../utils/supabase.js';
import { generateChatResponse } from './chatgpt.js';
import { embedText } from './embeddings.js';
import { searchSimilarChunks } from './vectorStore.js';
import { countTokens } from './chunker.js';
import { validateMedicalResponse } from './medicalValidationService.js';
import { scheduleMedicationFromVoice } from './voiceMedicationHelper.js';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});


interface VoiceResponse {
    structured_data: any;
    voice_summary: string;
    chat_history_id?: string;
}

/**
 * Orchestrates the Voice Query:
 * 1. Identifies intent (using rule-based or LLM)
 * 2. Fetches Context (RAG, Meds, Profile)
 * 3. Generates specific "Voice Optimized" Response
 */
export const processVoiceQuery = async (
    userId: string,
    transcript: string,
    sessionId?: string
): Promise<VoiceResponse> => {
    console.log(`[Orchestrator] Processing voice query: "${transcript}"`);

    // 1. Fetch User Context (Profile + Meds + Conditions + Insights)
    const [profile, meds, conditions, insights] = await Promise.all([
        fetchUserProfile(userId),
        fetchUserMedications(userId),
        fetchUserConditions(userId),
        fetchRecentInsights(userId)
    ]);

    // 2. RAG Search (Always do it for now, unless explicit command)
    const queryEmbedding = await embedText(transcript);
    const similarChunks = await searchSimilarChunks(userId, queryEmbedding, 5, 0.25);
    const ragContext = compressContext(similarChunks);

    // 3. Construct System Context (COMPRESSED to stay under token limits)
    const profileSummary = profile
        ? `Name: ${profile.name || 'N/A'}, Age: ${profile.age || 'N/A'}, Gender: ${profile.gender || 'N/A'}, Blood: ${profile.blood_group || 'N/A'}`
        : 'No profile data';

    const medsSummary = meds.length > 0
        ? meds.map((m: any) => {
            const schedules = (m.medication_schedules || [])
                .map((s: any) => `${s.time_of_day || s.scheduled_time || 'unscheduled'}`)
                .join(', ');
            return `${m.name} ${m.dosage || ''} (${m.frequency || 'daily'}) [${schedules || 'no schedule'}]`;
        }).join('; ')
        : 'No active medications';

    const conditionsSummary = conditions.length > 0
        ? conditions.map((c: any) => `${c.condition_name || c.name} (${c.status || 'active'})`).join(', ')
        : '';

    const insightsSummary = insights.length > 0
        ? insights.slice(0, 3).map((i: any) => i.summary || i.content || '').join(' | ').slice(0, 500)
        : '';

    let systemContext = `Patient: ${profileSummary}\n`;
    systemContext += `Medications: ${medsSummary}\n`;
    if (conditionsSummary) systemContext += `Conditions: ${conditionsSummary}\n`;
    if (insightsSummary) systemContext += `Insights: ${insightsSummary}\n`;
    if (ragContext) systemContext += `Documents: ${ragContext.slice(0, 1500)}\n`;

    // 4. Generate Response with strict JSON instruction
    const response = await generateVoiceResponse(transcript, systemContext);

    // 5. Medical Validation [NEW]
    const validation = await validateMedicalResponse(response);
    if (!validation.isValid) {
        response.structured_data.flags = validation.flags;
        // Append warning to voice summary if critical
        if (validation.flags.some(f => f.includes('Unknown drug'))) {
            response.voice_summary += " Please verify the drug spelling.";
        }
    }

    // 6. Auto-schedule medication if intent detected
    if (response.structured_data?.type === 'medication_schedule') {
        console.log(`[Orchestrator] Medication schedule intent detected:`, response.structured_data);
        const schedResult = await scheduleMedicationFromVoice(userId, response.structured_data);
        if (schedResult.success) {
            response.voice_summary += ` I've scheduled ${schedResult.drugName} for you.`;
            response.structured_data.scheduled = true;
            console.log(`[Orchestrator] ✅ Auto-scheduled: ${schedResult.drugName}`);
        } else {
            response.voice_summary += ` I couldn't schedule the medication automatically. Please try adding it manually.`;
            console.error(`[Orchestrator] ❌ Auto-schedule failed:`, schedResult.error);
        }
    }

    // 7. Save to Chat History (if session provided)
    if (sessionId) {
        await saveToHistory(sessionId, transcript, response.voice_summary, 'user');
        await saveToHistory(sessionId, response.voice_summary, JSON.stringify(response.structured_data), 'assistant');
    }

    return response;
};

// --- Helpers ---

async function fetchUserProfile(userId: string) {
    const { data } = await supabase.from('users').select('*').eq('id', userId).single();
    return data || {};
}

async function fetchUserMedications(userId: string) {
    const { data } = await supabase
        .from('medications')
        .select('*, medication_schedules(*)')
        .eq('user_id', userId)
        .eq('status', 'active');
    return data || [];
}

async function fetchUserConditions(userId: string) {
    try {
        const { data } = await supabase
            .from('conditions')
            .select('*')
            .eq('user_id', userId);
        return data || [];
    } catch {
        return [];
    }
}

async function fetchRecentInsights(userId: string) {
    try {
        const { data } = await supabase
            .from('insights')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);
        return data || [];
    } catch {
        return [];
    }
}

function compressContext(chunks: any[], maxTokens = 1000): string {
    return chunks.map(c => c.content).join('\n\n---\n\n').slice(0, 3000); // Simple slice for now
}

async function saveToHistory(sessionId: string, text: string, metadata: string, role: 'user' | 'assistant') {
    await supabase.from('chat_messages').insert({
        session_id: sessionId,
        role,
        content: text,
        // metadata: metadata // If we had a metadata column, for now we save text
    });
}

/**
 * Specialized LLM call for Voice
 * Asks for specific JSON structure + Spoken Summary
 */
async function generateVoiceResponse(query: string, context: string): Promise<VoiceResponse> {
    const systemPrompt = `You are Rex AI, a Voice-First Medical Assistant with access to the user's complete health profile.
    
    INPUT CONTEXT:
    ${context}

    You have access to these data sources about the user:
    - **User Profile**: Name, age, gender, blood group, emergency contact, health details
    - **Current Medications**: Active prescriptions with dosage schedules (times, frequency)
    - **Diagnosed Conditions**: Known health conditions
    - **Recent Health Insights**: AI-generated health analysis from uploaded documents
    - **Medical Documents**: RAG-retrieved context from uploaded prescriptions, reports, and lab results

    TASK:
    Analyze the user's voice query using ALL available context and return a valid JSON object with:
    1. "voice_summary": A SHORT, natural, personalized spoken response (max 2-3 sentences). Use the user's name if available. Talk like a caring nurse who knows this patient well.
    2. "structured_data": Any relevant data for UI display. If no data, use {}.

    EXAMPLE 1 - General query:
    {
      "voice_summary": "Hi Gokul, you have 3 active medications. Your next dose of Metformin 500mg is after dinner tonight.",
      "structured_data": { "medications_count": 3 }
    }

    EXAMPLE 2 - Scheduling a medication (IMPORTANT):
    When the user says things like "schedule", "add", "book", "log", "remind me to take", or "start taking" a medication, you MUST set structured_data.type to "medication_schedule" with these fields:
    {
      "voice_summary": "Sure, I'll schedule Paracetamol 500mg for morning and night.",
      "structured_data": {
        "type": "medication_schedule",
        "drug_name": "Paracetamol",
        "dosage": "500mg",
        "form": "tablet",
        "frequency_text": "Twice daily",
        "duration_days": 5,
        "timing_labels": ["morning", "night"],
        "instructions": "After food"
      }
    }
    Valid timing_labels: "morning", "afternoon", "evening", "night", "bedtime".
    Default duration_days to 5 if not specified. Default form to "tablet" if not specified.
    
    CRITICAL RULES:
    - ALWAYS personalize responses using the user's profile and medication data.
    - If user asks about their medications, reference their ACTUAL prescriptions.
    - If user asks about their health, reference their conditions and insights.
    - If the user wants to schedule/add/book/log a medication, you MUST use type "medication_schedule" in structured_data.
    - If the user mentions a drug but not enough details (no dosage), ask for dosage in voice_summary. Do NOT set type to "medication_schedule" without at least drug_name.
    - Never make up medication names, dosages, or conditions not present in the context.
    `;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: query }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1
        });

        const content = completion.choices[0].message.content || "{}";
        return JSON.parse(content) as VoiceResponse;
    } catch (e) {
        console.error("Orchestrator LLM failed:", e);
        return {
            voice_summary: "I'm having trouble processing that right now. Please try again.",
            structured_data: {}
        };
    }
}
