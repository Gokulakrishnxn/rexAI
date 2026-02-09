import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { fetchMedicationsList, deleteMedication as deleteMedicationApi } from '../services/api/backendApi';
import type { Medication } from '../../types/medication';

interface MedAgentState {
  activeMeds: Medication[];
  compliance: Record<string, boolean>;
  completionTimers: Record<string, NodeJS.Timeout>;
  loading: boolean;
  fetchMedications: (userId: string) => Promise<void>;
  markTaken: (id: string) => Promise<void>;
  removeMedication: (id: string) => void;
  deleteMedication: (id: string) => Promise<boolean>;
}

export const useMedAgentStore = create<MedAgentState>((set, get) => ({
  activeMeds: [],
  compliance: {},
  completionTimers: {},
  loading: false,

  fetchMedications: async (userId) => {
    set({ loading: true });
    try {
      // Use Backend API Proxy (Bypasses RLS issues)
      const response = await fetchMedicationsList();

      if (response.success && response.medications) {
        set({ activeMeds: response.medications, loading: false });
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Error fetching medications:', error);
      set({ loading: false });
    }
  },

  markTaken: async (id) => {
    // Local update
    set((s) => ({ compliance: { ...s.compliance, [id]: true } }));

    // Log to activity_logs (optional)
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (userId) {
        await supabase.from('activity_logs').insert([{
          user_id: userId,
          description: `Took medication: ${get().activeMeds.find(m => m.id === id)?.drug_name || id}`,
          activity_type: 'medication_intake'
        }]);
      }
    } catch (error) {
      console.log('Activity log failed (non-critical):', error);
    }

    // Set timer to auto-delete after 5 minutes
    const timer = setTimeout(() => {
      get().removeMedication(id);
    }, 300000);

    set((s) => ({
      completionTimers: { ...s.completionTimers, [id]: timer }
    }));
  },

  removeMedication: (id) => {
    // Clear timer if exists
    const timer = get().completionTimers[id];
    if (timer) {
      clearTimeout(timer);
    }

    // Remove from state
    set((s) => ({
      activeMeds: s.activeMeds.filter(m => m.id !== id),
      compliance: Object.fromEntries(
        Object.entries(s.compliance).filter(([key]) => key !== id)
      ),
      completionTimers: Object.fromEntries(
        Object.entries(s.completionTimers).filter(([key]) => key !== id)
      ),
    }));
  },

  deleteMedication: async (id) => {
    try {
      // Delete from database first
      const result = await deleteMedicationApi(id);
      
      if (result.success) {
        // Then remove from local state
        get().removeMedication(id);
        return true;
      } else {
        console.error('Failed to delete medication:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Delete medication error:', error);
      return false;
    }
  },
}));
