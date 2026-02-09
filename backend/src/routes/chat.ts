import { Response, Router } from 'express';
import { generateChatResponse, streamChatResponse } from '../services/chatgpt.js';
import { countTokens } from '../services/chunker.js';
import { embedText } from '../services/embeddings.js';
import { searchSimilarChunks } from '../services/vectorStore.js';
import { supabase } from '../utils/supabase.js';
import { verifyFirebaseToken, FirebaseRequest } from '../middleware/firebase_auth.js';

const router = Router();

interface ChatRequest {
    question: string;
    sessionId?: string;
    documentId?: string; // Optional filter
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

router.post('/', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const { question, sessionId, documentId } = req.body as ChatRequest;
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
        const similarChunks = await searchSimilarChunks(userId, queryEmbedding, 6, 0.15, documentId || null);
        console.log(`[RAG] Found ${similarChunks.length} relevant chunks similar to query.`);

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

        const ragContext = similarChunks.length > 0 ? compressContext(similarChunks, 1500) : "[NO RELEVANT DOCUMENTS FOUND]";
        console.log(`[RAG] Constructed context with ${ragContext.length} chars.`);

        const context = (profileContext + ragContext).trim();

        let answer;
        try {
            answer = await generateChatResponse(question, context, history);
        } catch (err) {
            console.error('ChatGPT failed, falling back to Gemini:', err);
            const { generateGeminiChatResponse } = await import('../services/gemini.js');
            answer = await generateGeminiChatResponse(question, context, history);
        }

        // (Debug injection removed)

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

        const context = (profileContext + (similarChunks.length > 0 ? compressContext(similarChunks, 1500) : "[NO RELEVANT DOCUMENTS]")).trim();

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
