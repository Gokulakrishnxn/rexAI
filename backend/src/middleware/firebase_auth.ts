import { Request, Response, NextFunction } from 'express';
import { auth } from '../utils/firebase.js';
import { supabase } from '../utils/supabase.js';
import { DecodedIdToken } from 'firebase-admin/auth';

export interface FirebaseRequest extends Request {
    user?: {
        id: string; // Internal Supabase User ID
        firebase_uid: string;
        email?: string;
        role: string;
    };
    firebaseUser?: DecodedIdToken;
}

/**
 * Middleware to verify Firebase ID Token and attach Supabase user identity
 */
export const verifyFirebaseToken = async (req: FirebaseRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
        // 1. Verify token with Firebase Admin
        const decodedToken = await auth.verifyIdToken(idToken);
        const firebaseUid = decodedToken.uid;

        // 2. Fetch/Verify identity in Supabase
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, email, role, firebase_uid')
            .eq('firebase_uid', firebaseUid)
            .single();

        if (userError || !userData) {
            console.error('Firebase user not found in Supabase:', userError);
            return res.status(403).json({
                error: 'User not registered in identity layer',
                code: 'USER_NOT_MAPPED'
            });
        }

        // 3. Attach identity to request
        req.user = {
            id: userData.id,
            firebase_uid: userData.firebase_uid,
            email: userData.email,
            role: userData.role
        };

        next();
    } catch (error) {
        console.error('Firebase Auth Error:', error);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

/**
 * Middleware to verify Firebase ID Token ONLY (doesn't require Supabase mapping)
 * Useful for onboarding/first-time registration
 */
export const verifyFirebaseOnly = async (req: any, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        req.firebaseUser = decodedToken;
        next();
    } catch (error) {
        console.error('Firebase Only Auth Error:', error);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};
