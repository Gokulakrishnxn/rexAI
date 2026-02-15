import { supabase } from '../utils/supabase.js';
import { enrichMedicationWithRxNorm } from '../services/rxnormApi.js';
import { refreshSchedulerState } from './medicationScheduler.js';

interface VoiceMedData {
    drug_name: string;
    dosage?: string;
    form?: string;
    frequency_text?: string;
    duration_days?: number;
    timing_labels?: string[];
    instructions?: string;
}

/**
 * Convert timing labels (morning, night, etc.) to clock times.
 * Mirrors the logic in medicationAI.ts generateDefaultTimes().
 */
function generateDefaultTimes(labels: string[]): string[] {
    const times: string[] = [];
    const lower = labels.map(l => l.toLowerCase());

    if (lower.includes('morning')) times.push('08:00');
    if (lower.includes('afternoon') || lower.includes('noon')) times.push('13:00');
    if (lower.includes('evening')) times.push('18:00');
    if (lower.includes('night') || lower.includes('bedtime')) times.push('21:00');

    if (times.length === 0) {
        if (labels.length === 3) return ['09:00', '14:00', '21:00'];
        if (labels.length === 2) return ['09:00', '21:00'];
        return ['09:00'];
    }

    return times.sort();
}

/**
 * Auto-schedule a medication from a voice command.
 * Inserts into `medications` + `medication_schedules`, enriches with RxNorm,
 * and refreshes the scheduler.
 */
export async function scheduleMedicationFromVoice(
    userId: string,
    data: VoiceMedData
): Promise<{ success: boolean; drugName: string; error?: string }> {
    const drugName = data.drug_name;

    if (!drugName) {
        return { success: false, drugName: '', error: 'No drug name provided' };
    }

    try {
        console.log(`[VoiceMedHelper] Scheduling "${drugName}" for user ${userId}`);

        // 1. Insert Medication
        const { data: medData, error: medError } = await supabase
            .from('medications')
            .insert({
                user_id: userId,
                drug_name: drugName,
                normalized_name: drugName,
                form: data.form || 'tablet',
                dosage: data.dosage || '',
                frequency_text: data.frequency_text || 'Once daily',
                duration_days: data.duration_days || 5,
                instructions: data.instructions || '',
                confidence_score: 0.9,
                status: 'active',
            })
            .select()
            .single();

        if (medError) throw medError;
        if (!medData) throw new Error('Failed to insert medication');

        // 2. Generate schedule times
        const recommendedTimes = generateDefaultTimes(data.timing_labels || ['morning']);

        // 3. Insert Schedule
        const { error: schedError } = await supabase
            .from('medication_schedules')
            .insert({
                medication_id: medData.id,
                user_id: userId,
                start_date: new Date().toISOString(),
                times_per_day: recommendedTimes.length,
                exact_times: recommendedTimes,
            });

        if (schedError) throw schedError;

        // 4. RxNorm enrichment (non-blocking)
        enrichMedicationWithRxNorm(drugName)
            .then(rxData => {
                if (rxData) {
                    supabase
                        .from('medications')
                        .update({ rxcui: rxData.rxcui, rxnorm_data: rxData })
                        .eq('id', medData.id)
                        .then(() => console.log(`[VoiceMedHelper] RxNorm enriched: ${drugName}`));
                }
            })
            .catch(err => console.warn('[VoiceMedHelper] RxNorm enrichment skipped:', err));

        // 5. Refresh scheduler
        refreshSchedulerState();

        // 6. Log activity
        await supabase.from('activity_logs').insert({
            user_id: userId,
            activity_type: 'medication_scheduled_voice',
            description: `Voice-scheduled: ${drugName} (${data.dosage || 'unspecified'})`,
            metadata: { medication_id: medData.id, source: 'voice' },
        });

        console.log(`[VoiceMedHelper] ✅ Scheduled "${drugName}" at [${recommendedTimes.join(', ')}]`);
        return { success: true, drugName };

    } catch (error: any) {
        console.error('[VoiceMedHelper] Failed:', error);
        return { success: false, drugName, error: error.message };
    }
}
