/**
 * Chat Route
 * Handles RAG-based chat: Embed query → Retrieve → Compress → Generate
 */

import { Request, Response, Router } from 'express';
import { generateChatResponse, streamChatResponse } from '../services/chatgpt.js';
import { countTokens } from '../services/chunker.js';
import { embedText } from '../services/embeddings.js';
import { searchSimilarChunks } from '../services/vectorStore.js';
import { supabase } from '../utils/supabase.js';

const router = Router();

interface ChatRequest {
    userId: string;
    question: string;
    sessionId?: string; // Changed from conversationId to sessionId for consistency
}

/**
 * Compress context by selecting best chunks up to token limit
 */
function compressContext(
    chunks: Array<{ content: string; document_id: string; similarity: number }>,
    maxTokens: number = 1200
): string {
    // Group by document
    const byDocument = new Map<string, typeof chunks>();
    for (const chunk of chunks) {
        const existing = byDocument.get(chunk.document_id) || [];
        existing.push(chunk);
        byDocument.set(chunk.document_id, existing);
    }

    // Pick top 2-3 chunks per document
    const selectedChunks: typeof chunks = [];
    for (const [docId, docChunks] of byDocument) {
        // Sort by similarity and take top 3
        const topChunks = docChunks
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 3);
        selectedChunks.push(...topChunks);
    }

    // Sort all selected by similarity
    selectedChunks.sort((a, b) => b.similarity - a.similarity);

    // Build context respecting token limit
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
 * POST /api/chat
 * Process a chat message with RAG
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { userId, question, sessionId } = req.body as ChatRequest;

        // Validate input
        if (!userId || !question) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, question',
            });
        }

        console.log(`Chat query from ${userId}: ${question.substring(0, 50)}...`);

        // Step 0: Save user message if sessionId is provided
        if (sessionId) {
            await supabase.from('chat_messages').insert([{
                session_id: sessionId,
                role: 'user',
                content: question
            }]);
        }

        // Step 1: Fetch recent history for context
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

        // Step 2: Embed the question
        const queryEmbedding = await embedText(question);

        // 3. Search similar chunks
        const similarChunks = await searchSimilarChunks(userId, queryEmbedding, 6, 0.15);
        console.log(`Found ${similarChunks.length} potentially relevant chunks`);

        // 4. Generate response
        let answer;
        const context = similarChunks.length > 0
            ? compressContext(similarChunks, 1500)
            : "[NO SOURCE DATA FOUND FOR THIS QUERY]";

        try {
            // Pass history to LLM
            answer = await generateChatResponse(question, context, history);
            console.log('ChatGPT response generated (Flexible)');
        } catch (err) {
            console.error('ChatGPT failed, falling back to Gemini:', err);
            try {
                const { generateGeminiChatResponse } = await import('../services/gemini.js');
                answer = await generateGeminiChatResponse(question, context, history);
                console.log('Gemini response generated (Fallback - Flexible)');
            } catch (geminiErr) {
                console.error('Gemini also failed:', geminiErr);
                answer = "I apologize, but I'm currently unable to access my medical knowledge base. Please try again in a few moments.";
            }
        }

        // Step 5: Save assistant message if sessionId is provided
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
                metadata: (c as any).metadata || {},
                similarity: c.similarity
            })),
        });

    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Chat failed',
        });
    }
});

/**
 * POST /api/chat/stream
 * Stream a chat response
 */
router.post('/stream', async (req: Request, res: Response) => {
    try {
        const { userId, question, sessionId } = req.body as ChatRequest;

        if (!userId || !question) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, question',
            });
        }

        // Set headers for streaming
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Transfer-Encoding', 'chunked');

        // Step 0: Save user message if sessionId is provided
        if (sessionId) {
            await supabase.from('chat_messages').insert([{
                session_id: sessionId,
                role: 'user',
                content: question
            }]);
        }

        // Step 1: Fetch recent history for context
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

        // Step 2: Embed query
        const queryEmbedding = await embedText(question);

        // 3. Search similar chunks
        const similarChunks = await searchSimilarChunks(userId, queryEmbedding, 6, 0.15);
        console.log(`Found ${similarChunks.length} potentially relevant chunks for stream`);

        // 4. Compress & stream with fallback
        const context = similarChunks.length > 0
            ? compressContext(similarChunks, 1500)
            : "[NO SOURCE DATA FOUND FOR THIS QUERY]";

        let fullResonse = "";

        try {
            await streamChatResponse(question, context, (chunk) => {
                res.write(chunk);
                fullResonse += chunk;
            }, history);
            console.log('ChatGPT stream completed (Flexible)');
        } catch (err) {
            console.error('ChatGPT stream failed, falling back to Gemini:', err);
            try {
                // gemini.ts is already imported or can be imported
                const { streamGeminiChatResponse } = await import('../services/gemini.js');
                await streamGeminiChatResponse(question, context, (chunk) => {
                    res.write(chunk);
                    fullResonse += chunk;
                }, history);
                console.log('Gemini stream completed (Fallback - Flexible)');
            } catch (geminiErr) {
                console.error('Gemini stream also failed:', geminiErr);
                res.write("\n\n[System: Backup AI service also failed. Please check your account credits or API configuration.]");
            }
        }

        // Step 5: Save assistant message if sessionId is provided
        if (sessionId && fullResonse) {
            await supabase.from('chat_messages').insert([{
                session_id: sessionId,
                role: 'assistant',
                content: fullResonse
            }]);
        }

        res.end();

    } catch (error) {
        console.error('Stream error:', error);
        res.status(500).end('Error generating response');
    }
});

export default router;
