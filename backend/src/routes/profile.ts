import { Response, Router } from 'express';
import { supabase } from '../utils/supabase.js';
import { verifyFirebaseOnly, FirebaseRequest } from '../middleware/firebase_auth.js';

const router = Router();

/**
 * POST /api/profile/onboard
 * Creates or updates the user profile in Supabase after Firebase signup
 */
router.post('/onboard', verifyFirebaseOnly as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const firebaseUser = req.firebaseUser!;
        const { name, age, gender, blood_group, emergency_contact, role } = req.body;

        console.log(`[Backend] Onboarding user: ${firebaseUser.email} (${firebaseUser.uid})`);

        const { data, error } = await supabase
            .from('users')
            .upsert({
                firebase_uid: firebaseUser.uid,
                email: firebaseUser.email,
                name: name || firebaseUser.name || 'User',
                age: age ? parseInt(age) : null,
                gender: gender || null,
                blood_group: blood_group || null,
                emergency_contact: emergency_contact || null,
                role: role || 'patient'
            }, {
                onConflict: 'firebase_uid'
            })
            .select()
            .single();

        if (error) {
            console.error('[Backend] Supabase Upsert Error:', error);
            throw error;
        }

        console.log('[Backend] Upsert successful. Returned data:', data);
        res.json({ success: true, profile: data });
    } catch (error: any) {
        console.error('[Backend] Onboarding Failed:', error);
        res.status(500).json({ success: false, error: error.message || 'Onboarding failed' });
    }
});

/**
 * GET /api/profile
 * Fetches the user profile based on Firebase UID
 */
router.get('/', verifyFirebaseOnly as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const firebaseUser = req.firebaseUser!;
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('firebase_uid', firebaseUser.uid)
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({ success: true, profile: data });
    } catch (error: any) {
        console.error('[Backend] Fetch Profile Failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/profile/activities
 * Fetches recent activity logs
 */
router.get('/activities', verifyFirebaseOnly as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const firebaseUser = req.firebaseUser!;

        // Use Supabase Service Role to bypass RLS if needed, or just standard query via join
        // First get the user ID
        const { data: user } = await supabase.from('users').select('id').eq('firebase_uid', firebaseUser.uid).single();

        if (!user) return res.json({ success: true, activities: [] });

        const { data, error } = await supabase
            .from('activity_logs')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        res.json({ success: true, activities: data });
    } catch (error: any) {
        console.error('[Backend] Fetch Activities Failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
