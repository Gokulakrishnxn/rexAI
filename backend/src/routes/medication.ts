import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { verifyFirebaseToken } from '../middleware/firebase_auth.js';
import { analyzeMedicationText } from '../services/medicationAI.js';
import { supabase } from '../utils/supabase.js';
import { extractTextFromImage, extractTextFromPdf } from '../services/ocr.js';
import {
    enrichMedicationWithRxNorm,
    checkInteractions,
    searchDrug,
    getDrugDetails
} from '../services/rxnormApi.js';
import { refreshSchedulerState } from '../services/medicationScheduler.js';

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
            if (!medData) throw new Error('Failed to insert medication');

            // Enrich with RxNorm data
            let rxNormData = null;
            try {
                rxNormData = await enrichMedicationWithRxNorm(med.drug_name);
                if (rxNormData) {
                    // Update medication with RxNorm info
                    await supabase
                        .from('medications')
                        .update({
                            rxcui: rxNormData.rxcui,
                            rxnorm_data: rxNormData
                        })
                        .eq('id', medData.id);
                }
            } catch (rxErr) {
                console.warn('RxNorm enrichment failed:', rxErr);
            }

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

        // Update scheduler state (wake up if needed)
        refreshSchedulerState();

        res.json({ success: true, count: results.length, documentId });
    } catch (error: any) {
        console.error('Confirm medication failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * List Medications
 */
router.get('/list', verifyFirebaseToken, async (req: any, res) => {
    try {
        const userId = req.user.id; // Correct UUID from public.users

        // Fetch medications with schedules
        const { data: meds, error: medError } = await supabase
            .from('medications')
            .select('*, medication_schedules(*)')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (medError) throw medError;

        // Fetch TODAY's intakes for these medications to know what's taken
        const today = new Date().toISOString().split('T')[0];
        const { data: intakes, error: intakeError } = await supabase
            .from('medication_intakes')
            .select('*')
            .eq('user_id', userId)
            .gte('taken_time', `${today}T00:00:00`)
            .lte('taken_time', `${today}T23:59:59`);

        if (intakeError) console.error('Error fetching daily intakes:', intakeError);

        // Merge intakes into medications for easier frontend processing
        const medicationsWithIntakes = meds.map(med => ({
            ...med,
            today_intakes: intakes?.filter(i =>
                // Find intakes linked to this med's schedule
                med.medication_schedules.some((s: any) => s.id === i.schedule_id)
            ) || []
        }));

        res.json({ success: true, medications: medicationsWithIntakes });
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

        // 1. Fetch medication details for snapshot
        const { data: med, error: medError } = await supabase
            .from('medications')
            .select('*')
            .eq('id', medId)
            .eq('user_id', userId)
            .single();

        if (medError || !med) {
            return res.status(404).json({ success: false, error: 'Medication not found' });
        }

        // 2. Insert into medication_intakes with snapshot data
        // We set schedule_id to NULL initially or try to find one, but since we are deleting,
        // we might as well just log it as a historical record.
        // However, if we want to query by schedule later (before delete), we need it.
        // Let's try to get the schedule ID if it exists, otherwise null.
        const { data: schedule } = await supabase
            .from('medication_schedules')
            .select('id')
            .eq('medication_id', medId)
            .single();

        const { error: intakeError } = await supabase
            .from('medication_intakes')
            .insert({
                user_id: userId,
                schedule_id: schedule?.id || null, // Can be null now
                drug_name: med.drug_name,
                dosage: med.dosage,
                form: med.form,
                frequency_text: med.frequency_text,
                scheduled_time: date, // Using taken time as scheduled time for now, or fetch from schedule
                taken_time: date,
                status: 'taken'
            });

        if (intakeError) throw intakeError;

        // 3. Log to activity_logs (keep this for additional audit trail)
        await supabase
            .from('activity_logs')
            .insert({
                user_id: userId,
                activity_type: 'medication_intake',
                description: `Took and cleared: ${med.drug_name} (${med.dosage})`,
                metadata: {
                    medication_id: medId,
                    taken_at: date,
                    action: 'take_and_delete'
                }
            });

        // 4. Delete the medication (Cascades to schedules, and sets intakes.schedule_id to NULL)
        const { error: deleteError } = await supabase
            .from('medications')
            .delete()
            .eq('id', medId)
            .eq('user_id', userId);

        if (deleteError) throw deleteError;

        // Update scheduler state
        refreshSchedulerState();

        res.json({ success: true, message: 'Medication taken and cleared from active list' });

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

/**
 * RxNorm Drug Search
 */
router.get('/rxnorm/search', verifyFirebaseToken, async (req: any, res) => {
    try {
        const { query } = req.query;

        if (!query) {
            return res.status(400).json({ success: false, error: 'Query required' });
        }

        const result = await searchDrug(query);
        const drugs = result ? [result] : [];

        res.json({
            success: true,
            drugs: drugs.map(d => ({
                rxcui: d.rxcui,
                name: d.name,
                genericName: d.genericName
            }))
        });

    } catch (error: any) {
        console.error('RxNorm search failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get RxNorm Drug Details
 */
router.get('/rxnorm/:rxcui', verifyFirebaseToken, async (req: any, res) => {
    try {
        const { rxcui } = req.params;

        const details = await getDrugDetails(rxcui);

        if (!details) {
            return res.status(404).json({ success: false, error: 'Drug not found' });
        }

        res.json({ success: true, drug: details });

    } catch (error: any) {
        console.error('RxNorm details failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Check Drug Interactions
 */
router.post('/interactions', verifyFirebaseToken, async (req: any, res) => {
    try {
        const { rxcuiList } = req.body;
        const userId = req.user.id;

        // If no list provided, check user's active medications
        let rxcuis = rxcuiList;

        if (!rxcuis || rxcuis.length === 0) {
            const { data: meds } = await supabase
                .from('medications')
                .select('rxcui')
                .eq('user_id', userId)
                .eq('status', 'active')
                .not('rxcui', 'is', null);

            rxcuis = meds?.map(m => m.rxcui).filter(Boolean) || [];
        }

        if (rxcuis.length < 2) {
            return res.json({
                success: true,
                interactions: [],
                message: 'Need at least 2 medications to check interactions'
            });
        }

        const interactions = await checkInteractions(rxcuis);

        res.json({
            success: true,
            interactions,
            checkedMedications: rxcuis.length
        });

    } catch (error: any) {
        console.error('Interaction check failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Enrich existing medication with RxNorm data
 */
router.post('/:id/enrich', verifyFirebaseToken, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const medId = req.params.id;

        // Get medication
        const { data: med, error: medError } = await supabase
            .from('medications')
            .select('*')
            .eq('id', medId)
            .eq('user_id', userId)
            .single();

        if (medError || !med) {
            return res.status(404).json({ success: false, error: 'Medication not found' });
        }

        // Enrich with RxNorm
        const rxNormData = await enrichMedicationWithRxNorm(med.drug_name);

        if (!rxNormData) {
            return res.json({
                success: false,
                error: 'Could not find RxNorm data for this medication'
            });
        }

        // Update medication
        const { error: updateError } = await supabase
            .from('medications')
            .update({
                rxcui: rxNormData.rxcui,
                rxnorm_data: rxNormData
            })
            .eq('id', medId);

        if (updateError) throw updateError;

        res.json({
            success: true,
            rxNormData,
            message: 'Medication enriched with RxNorm data'
        });

    } catch (error: any) {
        console.error('Enrich medication failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
