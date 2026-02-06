import { Request, Response, NextFunction } from 'express';
import { supabase } from '../utils/supabase.js';

export interface AuthRequest extends Request {
    user?: {
        id: string; // Internal User UUID (public.users.id)
        auth_uid: string; // Supabase Auth UUID
        email: string;
        role: string;
    };
}

export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];

        // 1. Verify Supabase JWT
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !authUser) {
            return res.status(401).json({ success: false, error: 'Invalid or expired token' });
        }

        // 2. Fetch Internal Identity & Check Session
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, email, role, auth_uid')
            .eq('auth_uid', authUser.id)
            .single();

        if (userError || !userData) {
            return res.status(401).json({ success: false, error: 'User identity not found' });
        }

        // 3. Attach to request
        req.user = {
            id: userData.id,
            auth_uid: userData.auth_uid,
            email: userData.email,
            role: userData.role
        };

        next();
    } catch (error) {
        console.error('Auth Middleware Error:', error);
        res.status(500).json({ success: false, error: 'Authentication internal error' });
    }
};
