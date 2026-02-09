import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { verifyFirebaseToken } from '../middleware/firebase_auth.js';
import { analyzeMedicationText } from '../services/medicationAI.js';
import { supabase } from '../utils/supabase.js';
import { extractTextFromImage, extractTextFromPdf } from '../services/ocr.js';

const router = express.Router();

/**
 * Analyze Document -> Return Draft Medication Plan
 * Input: { documentId } OR { text } OR { imageUrl }
 */
router.post('/analyze', verifyFirebaseToken, async (req: any, res) => {
    try {
        const { documentId, text, imageUrl, imageBase64 } = req.body;
        const userId = req.user.id;

        let finalText = text || '';

        // If analyzing an existing document
        if (documentId) {
            // Fetch doc context from vector store or storage?
            // For now, let's assume client sends text or we re-fetch
            // Simpler: Client sends the OCR text they already have
        }

        // Prioritize: Text > Document > Image (Base64/URL)
        if (!finalText && imageBase64) {
            console.log('[Medication] Processing Image Base64...');
            const buffer = Buffer.from(imageBase64, 'base64');
            const ocrResult = await extractTextFromImage(buffer);
            finalText = ocrResult;
        } else if (!finalText && imageUrl) {
            console.log('[Medication] Processing Image URL...');
            const ocrResult = await extractTextFromImage(imageUrl);
            finalText = ocrResult;
        }

        if (!finalText) {
            return res.status(400).json({ success: false, error: 'No text or image provided' });
        }

        // 1. Run AI Analysis
        const drafts = await analyzeMedicationText(finalText);

        res.json({
            success: true,
            drafts
        });

    } catch (error: any) {
        console.error('Medication analysis failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Confirm Plan -> Save to DB (Medications + Schedules)
 */
router.post('/confirm', verifyFirebaseToken, async (req: any, res) => {
    try {
        const { medications } = req.body; // Array of confirmed drafts
        const userId = req.user.id;

        if (!medications || !Array.isArray(medications)) {
            return res.status(400).json({ success: false, error: 'Invalid data' });
        }

        const results = [];
        let documentId: string | null = null;

        // Check if there's a prescription image to store as a document
        const prescriptionImage = medications[0]?.prescription_image;
        if (prescriptionImage) {
            try {
                // Upload prescription image to Supabase Storage
                const fileName = `prescription_${uuidv4()}.jpg`;
                const filePath = `prescriptions/${userId}/${fileName}`;
                const buffer = Buffer.from(prescriptionImage, 'base64');

                const { error: uploadError } = await supabase.storage
                    .from('medical-records')
                    .upload(filePath, buffer, {
                        contentType: 'image/jpeg',
                        upsert: false
                    });

                if (uploadError) {
                    console.warn('Failed to upload prescription image:', uploadError.message);
                } else {
                    // Get public URL
                    const { data: urlData } = supabase.storage
                        .from('medical-records')
                        .getPublicUrl(filePath);

                    const fileUrl = urlData?.publicUrl || filePath;

                    // Create document record with category 'prescription'
                    const drugNames = medications.map((m: any) => m.drug_name).join(', ');
                    const { data: docData, error: docError } = await supabase
                        .from('documents')
                        .insert({
                            user_id: userId,
                            file_url: fileUrl,
                            file_name: `Prescription - ${drugNames.substring(0, 50)}`,
                            file_type: 'image/jpeg',
                            validation_status: 'verified',
                            doc_category: 'prescription',
                            parsing_method: 'medication_scan',
                            validation_confidence: 0.95,
                            summary: `Prescription containing: ${drugNames}`
                        })
                        .select()
                        .single();

                    if (docError) {
                        console.warn('Failed to create document record:', docError.message);
                    } else {
                        documentId = docData?.id;
                        console.log('Prescription document created:', documentId);
                    }
                }
            } catch (uploadErr: any) {
                console.warn('Prescription storage error:', uploadErr.message);
            }
        }

        // Transaction-like insert
        for (const med of medications) {
            // 1. Insert Medication
            const { data: medData, error: medError } = await supabase
                .from('medications')
                .insert({
                    user_id: userId,
                    drug_name: med.drug_name,
                    normalized_name: med.normalized_name,
                    form: med.form,
                    dosage: med.dosage,
                    frequency_text: med.frequency_text,
                    duration_days: med.duration_days || 5,
                    instructions: med.instructions,
                    confidence_score: med.confidence || 1.0,
                    status: 'active',
                    prescription_image: med.prescription_image || null
                })
                .select()
                .single();

            if (medError) throw medError;

            // 2. Insert Schedule
            const { error: schedError } = await supabase
                .from('medication_schedules')
                .insert({
                    medication_id: medData.id,
                    user_id: userId,
                    start_date: new Date().toISOString(), // Starts today
                    times_per_day: med.recommended_times?.length || 1,
                    exact_times: med.recommended_times || ['09:00']
                });

            if (schedError) throw schedError;

            results.push(medData);
        }

        res.json({ success: true, count: results.length, documentId });
    try {
        const userId = req.user.id; // Correct UUID from public.users

        const { data, error } = await supabase
            .from('medications')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active') // Fixed: Column name is 'status', not 'active'
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ success: true, medications: data });
    } catch (error: any) {
        console.error('Fetch medications failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Take Medication (Log Activity)
 */
router.post('/:id/take', verifyFirebaseToken, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const medId = req.params.id;
        const { date = new Date().toISOString() } = req.body;

        // Verify medication exists for user
        const { data: med, error: medError } = await supabase
            .from('medications')
            .select('drug_name, dosage')
            .eq('id', medId)
            .eq('user_id', userId)
            .single();

        if (medError || !med) {
            return res.status(404).json({ success: false, error: 'Medication not found' });
        }

        // Log to activity_logs
        const { error: logError } = await supabase
            .from('activity_logs')
            .insert({
                user_id: userId,
                activity_type: 'medication_intake',
                description: `Took ${med.drug_name} (${med.dosage})`,
                metadata: { medication_id: medId, taken_at: date }
            });

        if (logError) throw logError;

        res.json({ success: true, message: 'Medication logged as taken' });

    } catch (error: any) {
        console.error('Take medication failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Delete Medication (and associated schedules)
 */
router.delete('/:id', verifyFirebaseToken, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const medId = req.params.id;

        // Verify medication exists for user
        const { data: med, error: medError } = await supabase
            .from('medications')
            .select('id, drug_name')
            .eq('id', medId)
            .eq('user_id', userId)
            .single();

        if (medError || !med) {
            return res.status(404).json({ success: false, error: 'Medication not found' });
        }

        // Delete associated schedules first
        await supabase
            .from('medication_schedules')
            .delete()
            .eq('medication_id', medId);

        // Delete the medication
        const { error: deleteError } = await supabase
            .from('medications')
            .delete()
            .eq('id', medId)
            .eq('user_id', userId);

        if (deleteError) throw deleteError;

        // Log activity
        await supabase
            .from('activity_logs')
            .insert({
                user_id: userId,
                activity_type: 'medication_deleted',
                description: `Deleted medication: ${med.drug_name}`,
                metadata: { medication_id: medId }
            });

        res.json({ success: true, message: 'Medication deleted successfully' });

    } catch (error: any) {
        console.error('Delete medication failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
