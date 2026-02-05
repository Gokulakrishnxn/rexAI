/**
 * Sessions Route
 * Handles chat session management (CRUD)
 */

import { Request, Response, Router } from 'express';
import { supabase } from '../utils/supabase.js'; // Correct import from utils

const router = Router();

/**
 * GET /api/sessions/:userId
 * List all chat sessions for a user
 */
router.get('/:userId', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { data, error } = await supabase
            .from('chat_sessions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ success: true, sessions: data });
    } catch (error) {
        console.error('List sessions error:', error);
        res.status(500).json({ success: false, error: 'Failed to list sessions' });
    }
});

/**
 * POST /api/sessions
 * Create a new chat session
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { userId, title } = req.body;
        const { data, error } = await supabase
            .from('chat_sessions')
            .insert([{ user_id: userId, title: title || 'New Chat' }])
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, session: data });
    } catch (error) {
        console.error('Create session error:', error);
        res.status(500).json({ success: false, error: 'Failed to create session' });
    }
});

/**
 * GET /api/sessions/messages/:sessionId
 * Fetch all messages for a session
 */
router.get('/messages/:sessionId', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        res.json({ success: true, messages: data });
    } catch (error) {
        console.error('Fetch messages error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch messages' });
    }
});

/**
 * DELETE /api/sessions/:sessionId
 * Delete a session and its messages
 */
router.delete('/:sessionId', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const { error } = await supabase
            .from('chat_sessions')
            .delete()
            .eq('id', sessionId);

        if (error) throw error;

        res.json({ success: true, message: 'Session deleted' });
    } catch (error) {
        console.error('Delete session error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete session' });
    }
});

export default router;
