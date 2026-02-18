import { Response, Router } from 'express';
import { supabase } from '../utils/supabase.js';
import { verifyFirebaseOnly, FirebaseRequest } from '../middleware/firebase_auth.js';
import crypto from 'node:crypto';

const router = Router();

/**
 * POST /api/profile/onboard
 * Creates or updates the user profile in Supabase after Firebase signup
 */
router.post('/onboard', verifyFirebaseOnly as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const firebaseUser = req.firebaseUser!;
        let { name, age, gender, blood_group, emergency_contact, role, abha_number, aadhar_number, qr_uid } = req.body;

        console.log(`[Backend] Onboarding user: ${firebaseUser.email} (${firebaseUser.uid})`);

        // Ensure qr_uid exists
        if (!qr_uid) {
            qr_uid = crypto.randomUUID();
        }

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
                abha_number: abha_number || null,
                aadhar_number: aadhar_number || null,
                qr_uid: qr_uid,
                role: role || 'patient',
                onboarding_completed: false // Force false to show walkthrough
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
        let { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('firebase_uid', firebaseUser.uid)
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // AUTO-GENERATE QR UID if missing (for legacy/existing users)
        if (!data.qr_uid) {
            const newQrUid = crypto.randomUUID();
            console.log(`[Backend] Auto-generating QR UID for user ${firebaseUser.email}`);
            const { data: updatedUser, error: updateError } = await supabase
                .from('users')
                .update({ qr_uid: newQrUid })
                .eq('id', data.id)
                .select()
                .single();

            if (!updateError && updatedUser) {
                data = updatedUser;
            }
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


/**
 * PATCH /api/profile
 * Updates the user profile fields
 */
router.patch('/', verifyFirebaseOnly as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const firebaseUser = req.firebaseUser!;
        const updates = req.body; // Expecting { onboarding_completed: true, ... }

        // Filter allowed fields to prevent arbitrary updates if needed
        // For now, we trust the fields, but strictly mapping them is better
        const allowedUpdates = {
            ...(updates.onboarding_completed !== undefined && { onboarding_completed: updates.onboarding_completed }),
            ...(updates.age !== undefined && { age: parseInt(updates.age) }),
            ...(updates.gender !== undefined && { gender: updates.gender }),
            ...(updates.blood_group !== undefined && { blood_group: updates.blood_group }),
            ...(updates.emergency_contact !== undefined && { emergency_contact: updates.emergency_contact }),
            // Add other fields as necessary
        };

        if (Object.keys(allowedUpdates).length === 0) {
            return res.json({ success: true, message: 'No valid updates provided' });
        }

        const { data, error } = await supabase
            .from('users')
            .update(allowedUpdates)
            .eq('firebase_uid', firebaseUser.uid)
            .select()
            .single();

        if (error) throw error;

        console.log(`[Backend] Profile updated for ${firebaseUser.email}:`, allowedUpdates);
        res.json({ success: true, profile: data });
    } catch (error: any) {
        console.error('[Backend] Update Profile Failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
