import { Response, Router } from 'express';
import { generateChatResponse, streamChatResponse } from '../services/chatgpt.js';
import { countTokens } from '../services/chunker.js';
import { embedText } from '../services/embeddings.js';
import { searchSimilarChunks } from '../services/vectorStore.js';
import { supabase } from '../utils/supabase.js';
import { verifyFirebaseToken, FirebaseRequest } from '../middleware/firebase_auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

interface ChatRequest {
    question: string;
    sessionId?: string;
    documentId?: string; // Optional filter
    skipRag?: boolean;   // Skip RAG check and use general AI knowledge
}

/**
 * Compress context by selecting best chunks up to token limit
 */
function compressContext(
    chunks: Array<{ content: string; document_id: string; similarity: number }>,
    maxTokens: number = 1200
): string {
    const byDocument = new Map<string, typeof chunks>();
    for (const chunk of chunks) {
        const existing = byDocument.get(chunk.document_id) || [];
        existing.push(chunk);
        byDocument.set(chunk.document_id, existing);
    }
    const selectedChunks: typeof chunks = [];
    for (const [docId, docChunks] of byDocument) {
        const topChunks = docChunks.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
        selectedChunks.push(...topChunks);
    }
    selectedChunks.sort((a, b) => b.similarity - a.similarity);
    let context = '';
    let currentTokens = 0;
    for (const chunk of selectedChunks) {
        const chunkTokens = countTokens(chunk.content);
        if (currentTokens + chunkTokens > maxTokens) break;
        context += chunk.content + '\n\n---\n\n';
        currentTokens += chunkTokens;
    }
    return context.trim();
}

/**
 * Fetch active medications and schedules for a user
 */
async function fetchUserMedications(userId: string): Promise<any[]> {
    try {
        const { data: meds, error } = await supabase
            .from('medications')
            .select(`
                *,
                medication_schedules (*)
            `)
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching medications for chat context:', error);
            return [];
        }

        return meds || [];
    } catch (e) {
        console.error('Exception fetching medications:', e);
        return [];
    }
}

router.post('/', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const { question, sessionId, documentId, skipRag } = req.body as ChatRequest;
        const userId = req.user!.id;

        if (!question) {
            return res.status(400).json({ success: false, error: 'Missing question' });
        }

        if (sessionId) {
            await supabase.from('chat_messages').insert([{
                session_id: sessionId,
                role: 'user',
                content: question
            }]);
        }

        let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
        if (sessionId) {
            const { data } = await supabase
                .from('chat_messages')
                .select('role, content')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: false })
                .limit(5);
            history = (data || []).reverse() as Array<{ role: 'user' | 'assistant'; content: string }>;
        }

        const queryEmbedding = await embedText(question);
        console.log(`[RAG] Embedding generated. Searching for chunks... Filter: ${documentId || 'None'}`);

        // 1. GLOBAL SEARCH: Always search for similar chunks across ALL documents (or filtered if RPC supported it, but we do manual merge)
        // We look for broader context: "Does this conflict with my other meds?"
        let similarChunks = skipRag ? [] : await searchSimilarChunks(userId, queryEmbedding, 6, 0.25, null);

        // 2. TARGETED SEARCH: If a specific document is requested, FORCE fetch its chunks to ensure context
        if (documentId && !skipRag) {
            console.log(`[RAG] Specific document requested: ${documentId}. Fetching targeted chunks...`);
            const { getChunksByDocumentId } = await import('../services/vectorStore.js');
            const targetedChunks = await getChunksByDocumentId(documentId, 15); // enhanced limit for specific doc

            // Combine with global chunks, simple de-duplication by ID
            const seenIds = new Set(similarChunks.map(c => c.id));
            for (const chunk of targetedChunks) {
                if (!seenIds.has(chunk.id)) {
                    similarChunks.push(chunk);
                    seenIds.add(chunk.id);
                }
            }
            console.log(`[RAG] Merged context: ${similarChunks.length} chunks.`);
        }

        console.log(`[RAG] Found ${similarChunks.length} relevant chunks (after merge).`);

        // Secondary check: Best match must be > 0.35 to be considered a true "match"
        // IF we have a documentID, we assume match is relevant because user explicitly asked for it (similarity=1.0)
        const bestMatchScore = similarChunks.length > 0 ? similarChunks[0].similarity : 0;
        console.log(`[RAG] Best match score: ${bestMatchScore}`);

        // If specific document is targeted, we trust the user's intent to query it even if similarity is low
        const threshold = documentId ? 0.0 : 0.35; // 0.0 because targeted chunks have sim=1.0
        const noRagMatch = !skipRag && (similarChunks.length === 0 || bestMatchScore < threshold);

        let ragContext: string = "";

        // If no RAG match and not skipping, assume we need confirmation UNLESS it's a general medical question OR greeting
        if (noRagMatch) {
            console.log('[Chat] No direct RAG match. Checking if query is medical-related or greeting...');

            try {
                // Swift classification
                const classification = await generateChatResponse(
                    `Classify the following question into one of these categories: MEDICAL, GREETING, OTHER.\n
                    - MEDICAL: Related to health, biology, fitness, mental well-being, drugs, conditions.\n
                    - GREETING: Simple pleasantries, hello, hi, thank you, who are you.\n
                    - OTHER: General knowledge, politics, coding, random facts unrelated to health or the user.\n
                    Question: "${question}"\nOutput only the category name.`,
                    "You are a strict classifier. Output only MEDICAL, GREETING, or OTHER.",
                    []
                );

                const category = classification.trim().toUpperCase();
                console.log(`[Chat] Query Category: ${category}`);

                if (category.includes('MEDICAL')) {
                    ragContext = `[User's medical records contained no results. Answer this general medical question accurately based on your general knowledge.\nIMPORTANT: You MUST append the following disclaimer at the very end of your response:\n"\n\n**Disclaimer:** I am an AI assistant, not a doctor. Please consult a healthcare professional for personalized medical advice."\n]`;
                } else if (category.includes('GREETING')) {
                    ragContext = `[User is engaging in conversation/pleasantries. Respond politely, briefly, and helpfully as a health coach assistant. Do NOT add disclaimers for simple greetings.]`;
                } else {
                    console.log('[Chat] Not medical/greeting and no RAG match. Returning confirmation prompt.');
                    return res.json({
                        success: true,
                        answer: '',
                        noRagMatch: true,
                        sources: [],
                    });
                }
            } catch (classError) {
                console.warn('[Chat] Classification failed, defaulting to confirmation:', classError);
                return res.json({
                    success: true,
                    answer: '',
                    noRagMatch: true,
                    sources: [],
                });
            }
        }

        // Handle other cases if ragContext not set yet
        if (!ragContext) {
            if (skipRag) {
                ragContext = "[USER CONFIRMED: Answer from your general medical knowledge. No document context needed.]";
            } else {
                ragContext = similarChunks.length > 0 ? compressContext(similarChunks, 1500) : "[NO RELEVANT DOCUMENTS FOUND]";
            }
        }
        console.log(`[RAG] Constructed context with ${ragContext.length} chars.`);

        // Fetch user profile for context
        let profileContext = "";
        const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (profile) {
            profileContext = `User Profile:
- Name: ${profile.name || 'Unknown'}
- Age: ${profile.age || 'Not shared'}
- Gender: ${profile.gender || 'Not shared'}
- Blood Group: ${profile.blood_group || 'Not shared'}
- Allergies: ${profile.allergies?.join(', ') || 'None reported'}
\n`;
        }

        // --- CONTEXT INJECTION FOR MEDICATIONS ---
        let medicationContext = "";
        const keywords = ['medication', 'medicine', 'pill', 'dose', 'drug', 'schedule', 'prescription', 'taking', 'book', 'remind', 'reminder', 'add'];
        const shouldFetchMeds = keywords.some(k => question.toLowerCase().includes(k));

        if (shouldFetchMeds) {
            console.log('[Chat] Keyword detected. Fetching medication data...');
            const meds = await fetchUserMedications(userId);
            if (meds.length > 0) {
                medicationContext = `\n\nCURRENT MEDICATIONS (Active & Scheduled):\n${JSON.stringify(meds, null, 2)}\n\n`;
            }
        }

        const context = (profileContext + ragContext + medicationContext).trim();

        let answer;
        try {
            answer = await generateChatResponse(question, context, history);
        } catch (err) {
            console.error('ChatGPT failed, falling back to Gemini:', err);
            const { generateGeminiChatResponse } = await import('../services/gemini.js');
            answer = await generateGeminiChatResponse(question, context, history);
        }

        // --- AUTO-SCHEDULE MEDICATION POST-PROCESSING ---
        // If the AI response contains a medication_scheduled JSON, auto-save to DB
        try {
            let scheduledJson = '';
            const fencedMatch = answer.match(/```json\s*(\{[\s\S]*?\})\s*```/);
            if (fencedMatch && fencedMatch[1]) {
                scheduledJson = fencedMatch[1];
            } else {
                const startIdx = answer.indexOf('{"type":');
                const endIdx = answer.lastIndexOf('}');
                if (startIdx !== -1 && endIdx > startIdx) {
                    scheduledJson = answer.substring(startIdx, endIdx + 1);
                }
            }

            if (scheduledJson) {
                const parsed = JSON.parse(scheduledJson);
                if (parsed.type === 'medication_scheduled' && parsed.data) {
                    const med = parsed.data;
                    console.log('[Chat] Auto-scheduling medication:', med.drug_name);

                    // Insert into medications table
                    const { data: medData, error: medError } = await supabase
                        .from('medications')
                        .insert({
                            user_id: userId,
                            drug_name: med.drug_name,
                            normalized_name: (med.drug_name || '').toLowerCase().trim(),
                            form: med.form || 'tablet',
                            dosage: med.dosage,
                            frequency_text: med.frequency_text,
                            duration_days: med.duration_days || 7,
                            instructions: med.instructions || null,
                            confidence_score: 1.0,
                            status: 'active'
                        })
                        .select()
                        .single();

                    if (medError) {
                        console.error('[Chat] Auto-schedule insert medication failed:', medError);
                    } else if (medData) {
                        // Insert schedule
                        const times = med.recommended_times || ['09:00'];
                        const { error: schedError } = await supabase
                            .from('medication_schedules')
                            .insert({
                                medication_id: medData.id,
                                user_id: userId,
                                start_date: new Date().toISOString(),
                                times_per_day: times.length,
                                exact_times: times
                            });

                        if (schedError) {
                            console.error('[Chat] Auto-schedule insert schedule failed:', schedError);
                        } else {
                            console.log('[Chat] Medication auto-scheduled successfully:', medData.id);
                        }
                    }
                }
            }
        } catch (schedParseErr) {
            // Not a medication_scheduled response or parse failed - that's fine
            console.debug('[Chat] No auto-schedule JSON found (expected for non-medication queries)');
        }

        if (sessionId) {
            await supabase.from('chat_messages').insert([{
                session_id: sessionId,
                role: 'assistant',
                content: answer
            }]);
        }

        return res.json({
            success: true,
            answer,
            sources: similarChunks.map(c => ({
                id: c.document_id,
                text: c.content,
                similarity: c.similarity
            })),
        });

    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ success: false, error: 'Chat failed' });
    }
});

router.post('/stream', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const { question, sessionId } = req.body as ChatRequest;
        const userId = req.user!.id;

        if (!question) return res.status(400).json({ success: false });

        res.setHeader('Content-Type', 'text/plain');

        if (sessionId) {
            await supabase.from('chat_messages').insert([{
                session_id: sessionId,
                role: 'user',
                content: question
            }]);
        }

        let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
        if (sessionId) {
            const { data } = await supabase
                .from('chat_messages')
                .select('role, content')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: false })
                .limit(5);
            history = (data || []).reverse() as Array<{ role: 'user' | 'assistant'; content: string }>;
        }

        const queryEmbedding = await embedText(question);
        const similarChunks = await searchSimilarChunks(userId, queryEmbedding, 6, 0.15);

        // Fetch user profile for context
        const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        let profileContext = "";
        if (profile) {
            profileContext = `User Profile:
- Name: ${profile.name || 'Unknown'}
- Age: ${profile.age || 'Not shared'}
- Gender: ${profile.gender || 'Not shared'}
- Blood Group: ${profile.blood_group || 'Not shared'}
- Allergies: ${profile.allergies?.join(', ') || 'None reported'}
\n`;
        }


        // --- CONTEXT INJECTION FOR MEDICATIONS ---
        const keywords = ['medication', 'medicine', 'pill', 'dose', 'drug', 'schedule', 'prescription', 'taking'];
        const shouldFetchMeds = keywords.some(k => question.toLowerCase().includes(k));
        let medicationContext = "";

        if (shouldFetchMeds) {
            const meds = await fetchUserMedications(userId);
            if (meds.length > 0) {
                medicationContext = `\n\nCURRENT MEDICATIONS (Active & Scheduled):\n${JSON.stringify(meds, null, 2)}\n\n`;
            }
        }

        const context = (profileContext + (similarChunks.length > 0 ? compressContext(similarChunks, 1500) : "[NO RELEVANT DOCUMENTS]") + medicationContext).trim();

        let fullResonse = "";
        await streamChatResponse(question, context, (chunk) => {
            res.write(chunk);
            fullResonse += chunk;
        }, history);

        if (sessionId && fullResonse) {
            await supabase.from('chat_messages').insert([{
                session_id: sessionId,
                role: 'assistant',
                content: fullResonse
            }]);
        }
        res.end();
    } catch (error) {
        res.status(500).end();
    }
});

export default router;
