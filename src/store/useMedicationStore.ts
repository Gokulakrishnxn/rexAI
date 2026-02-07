import { create } from 'zustand';
import { getStored, setStored } from '../services/storageService';
import type { MedicationSchedule } from '../types/medication';
import { scheduleMedicationReminder, cancelMedicationReminder } from '../services/notificationService';

const MED_STORAGE_KEY = 'medication_schedules';

interface MedicationStore {
    medications: MedicationSchedule[];
    loadMedications: () => Promise<void>;
    addMedication: (med: MedicationSchedule) => Promise<void>;
    removeMedication: (id: string) => Promise<void>;
    toggleTaken: (id: string) => void;
    resetDailyAdherence: () => void;
}

export const useMedicationStore = create<MedicationStore>((set, get) => ({
    medications: [],

    loadMedications: async () => {
        try {
            const raw = await getStored(MED_STORAGE_KEY);
            if (raw) {
                const meds = JSON.parse(raw);
                // Reset taken status if it's a new day (simple check)
                // In a real app, this would be more robust
                set({ medications: meds });
            }
        } catch (e) {
            console.error('Failed to load medications', e);
        }
    },

    addMedication: async (med: MedicationSchedule) => {
        const { medications } = get();
        const updated = [...medications, med];
        set({ medications: updated });
        await setStored(MED_STORAGE_KEY, JSON.stringify(updated));

        // Schedule notifications
        await scheduleMedicationReminder(med);
    },

    removeMedication: async (id: string) => {
        const { medications } = get();
        const updated = medications.filter(m => m.id !== id);
        set({ medications: updated });
        await setStored(MED_STORAGE_KEY, JSON.stringify(updated));

        // Cancel notifications
        await cancelMedicationReminder(id);
    },

    toggleTaken: (id: string) => {
        const { medications } = get();
        const updated = medications.map(m => {
            if (m.id === id) {
                return {
                    ...m,
                    takenToday: !m.takenToday,
                    lastTaken: !m.takenToday ? new Date().toISOString() : m.lastTaken
                };
            }
            return m;
        });
        set({ medications: updated });
        // Persist adherence
        setStored(MED_STORAGE_KEY, JSON.stringify(updated));
    },

    resetDailyAdherence: () => {
        const { medications } = get();
        const updated = medications.map(m => ({ ...m, takenToday: false }));
        set({ medications: updated });
        setStored(MED_STORAGE_KEY, JSON.stringify(updated));
    }
}));
