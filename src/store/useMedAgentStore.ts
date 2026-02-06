import { create } from 'zustand';
import { supabase } from '../services/supabase';
import type { Medication } from '../../types/medication';

interface MedAgentState {
  activeMeds: Medication[];
  compliance: Record<string, boolean>;
  loading: boolean;
  fetchMedications: (userId: string) => Promise<void>;
  markTaken: (id: string) => Promise<void>;
}

export const useMedAgentStore = create<MedAgentState>((set, get) => ({
  activeMeds: [],
  compliance: {},
  loading: false,

  fetchMedications: async (userId) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true);

      if (error) throw error;
      set({ activeMeds: data || [], loading: false });
    } catch (error) {
      console.error('Error fetching medications:', error);
      set({ loading: false });
    }
  },

  markTaken: async (id) => {
    // Local update
    set((s) => ({ compliance: { ...s.compliance, [id]: true } }));

    // Log activity in DB
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (userId) {
      await supabase.from('activity_logs').insert([{
        user_id: userId,
        description: `Took medication: ${get().activeMeds.find(m => m.id === id)?.name || id}`,
        activity_type: 'medication'
      }]);
    }
  },
}));
