import { create } from 'zustand';
import { getStored, setStored } from '../services/storageService';

const EMERGENCY_CONTACT_KEY = 'emergency_contact';

interface EmergencyState {
    primaryContactName: string | null;
    primaryContactPhone: string | null;
    setContact: (name: string, phone: string) => Promise<void>;
    loadContact: () => Promise<void>;
}

export const useEmergencyStore = create<EmergencyState>((set) => ({
    primaryContactName: null,
    primaryContactPhone: null,

    setContact: async (name: string, phone: string) => {
        set({ primaryContactName: name, primaryContactPhone: phone });
        await setStored(EMERGENCY_CONTACT_KEY, JSON.stringify({ name, phone }));
    },

    loadContact: async () => {
        try {
            const raw = await getStored(EMERGENCY_CONTACT_KEY);
            if (raw) {
                const { name, phone } = JSON.parse(raw);
                set({ primaryContactName: name, primaryContactPhone: phone });
            }
        } catch (e) {
            console.error('Failed to load emergency contact', e);
        }
    },
}));
