import { create } from 'zustand';
import { getStored, setStored } from '../services/storageService';
import type { DigitalTwinState } from '../types/twin';
import type { TimelineEvent } from '../types/timeline';
import { differenceInDays, parseISO } from 'date-fns';
import { useMedicationStore } from './useMedicationStore';

const TWIN_STORAGE_KEY = 'digital_twin_state';

interface TwinStore {
    twin: DigitalTwinState | null;
    loadTwin: () => Promise<void>;
    recomputeTwin: (events: TimelineEvent[]) => Promise<void>;
}

export const useTwinStore = create<TwinStore>((set, get) => ({
    twin: null,

    loadTwin: async () => {
        try {
            const raw = await getStored(TWIN_STORAGE_KEY);
            if (raw) {
                set({ twin: JSON.parse(raw) });
            }
        } catch (e) {
            console.error('Failed to load twin', e);
        }
    },

    recomputeTwin: async (events: TimelineEvent[]) => {
        // 1. Calculate Score
        let score = 0;
        const signals: string[] = [];
        const now = new Date();

        // +30 if emergency event exists in last 7 days
        const recentEmergency = events.find(e =>
            e.type === 'emergency' && differenceInDays(now, parseISO(e.timestamp)) <= 7
        );
        if (recentEmergency) {
            score += 30;
            signals.push('Recent emergency event detected');
        }

        // +30 if no events at all in last 30 days (inactivity) but we check if we have events
        if (events.length === 0) {
            // base risk for new/empty profile
        } else {
            const lastActivity = parseISO(events[0].timestamp);
            if (differenceInDays(now, lastActivity) > 3) {
                score += 5;
                signals.push('No activity logged in 3+ days');
            }
        }

        // +15 if no appointments/checkups in 30 days (mock logic: check for 'appointment' type or similar)
        // For MVP we just check if any event is 'appointment' in last 30 days
        const recentAppointment = events.find(e =>
            (e.type === 'appointment' || e.type === 'soap_note') && differenceInDays(now, parseISO(e.timestamp)) <= 30
        );
        if (!recentAppointment && events.length > 0) {
            score += 15;
            signals.push('No checkups in last 30 days');
        }

        // Medication Adherence Logic (New Feature 10)
        const meds = useMedicationStore.getState().medications;
        if (meds.length === 0) {
            // No medication plan might be a risk ONLY if they have conditions (but we don't know conds).
            // As per feature spec: +5 "No adherence plan found" (assuming everyone should have one for this demo or general wellness)
            score += 5;
            // signals.push('No medication adherence plan'); // Maybe too noisy
        } else {
            const activeMeds = meds.filter(m => m.active);
            if (activeMeds.length > 0) {
                // Reward for having a plan
                score -= 5;
                signals.push('Medication adherence active');
            }
        }

        // Cap score
        score = Math.min(score, 100);

        // 2. Determine Level
        let level: 'Low' | 'Moderate' | 'High' = 'Low';
        if (score > 70) level = 'High';
        else if (score > 30) level = 'Moderate';

        // 3. Generate Nudges
        const nudges: string[] = [];
        if (level === 'Low') {
            nudges.push('Great job maintaining your health logging.');
            nudges.push('Keep hydrated and active today.');
        } else if (level === 'Moderate') {
            nudges.push('Consider booking a checkup soon.');
            nudges.push('Review your recent activity for irregularities.');
        } else { // High
            nudges.push('Immediate attention recommended.');
            nudges.push('Please review your emergency contacts.');
            nudges.push('Consider sharing your data with a specialist.');
        }

        // 4. Update State
        const newTwin: DigitalTwinState = {
            updatedAt: now.toISOString(),
            riskScore: score,
            riskLevel: level,
            keySignals: signals,
            nudges: nudges.slice(0, 3), // Max 3
        };

        set({ twin: newTwin });
        await setStored(TWIN_STORAGE_KEY, JSON.stringify(newTwin));
    },
}));
