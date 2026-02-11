import { Response, Router } from 'express';
import { supabase } from '../utils/supabase.js';
import { verifyFirebaseToken, FirebaseRequest } from '../middleware/firebase_auth.js';

const router = Router();

/**
 * GET /api/sessions
 * List all chat sessions for the authenticated user
 */
router.get('/', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { data, error } = await supabase
            .from('chat_sessions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, sessions: data });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to list sessions' });
    }
});

/**
 * POST /api/sessions
 * Create a new chat session for the authenticated user
 */
router.post('/', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { title } = req.body;
        const { data, error } = await supabase
            .from('chat_sessions')
            .insert([{ user_id: userId, title: title || 'New Chat' }])
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, session: data });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to create session' });
    }
});

/**
 * GET /api/sessions/messages/:sessionId
 */
router.get('/messages/:sessionId', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const { sessionId } = req.params;
        // Verify session belongs to user
        const { data: session } = await supabase
            .from('chat_sessions')
            .select('user_id')
            .eq('id', sessionId)
            .single();

        if (!session || session.user_id !== req.user!.id) {
            return res.status(403).json({ success: false, error: 'Unauthorized Session' });
        }

        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        res.json({ success: true, messages: data });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch messages' });
    }
});

/**
 * DELETE /api/sessions/:sessionId
 */
router.delete('/:sessionId', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const { sessionId } = req.params;
        // Verify ownership
        const { data: session } = await supabase
            .from('chat_sessions')
            .select('user_id')
            .eq('id', sessionId)
            .single();

        if (!session || session.user_id !== req.user!.id) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        const { error } = await supabase
            .from('chat_sessions')
            .delete()
            .eq('id', sessionId);

        if (error) throw error;
        res.json({ success: true, message: 'Session deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to delete' });
    }
});

/**
 * PATCH /api/sessions/:sessionId
 * Rename a chat session
 */
router.patch('/:sessionId', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const { sessionId } = req.params;
        const { title } = req.body;

        if (!title || typeof title !== 'string') {
            return res.status(400).json({ success: false, error: 'Title is required' });
        }

        // Verify ownership
        const { data: session } = await supabase
            .from('chat_sessions')
            .select('user_id')
            .eq('id', sessionId)
            .single();

        if (!session || session.user_id !== req.user!.id) {
            console.error('[Rename Session] Unauthorized access attempt:', {
                requesterId: req.user!.id,
                sessionOwnerId: session?.user_id,
                sessionId,
                sessionFound: !!session
            });
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        const { data, error } = await supabase
            .from('chat_sessions')
            .update({ title: title.trim() })
            .eq('id', sessionId)
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, session: data });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to rename session' });
    }
});

export default router;
