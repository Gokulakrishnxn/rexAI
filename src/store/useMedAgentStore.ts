import { create } from 'zustand';
import type { Medication } from '../../types/medication';

interface MedAgentState {
  activeMeds: Medication[];
  compliance: Record<string, boolean>;
  setActiveMeds: (m: Medication[]) => void;
  markTaken: (id: string) => void;
}

export const useMedAgentStore = create<MedAgentState>((set) => ({
  activeMeds: [],
  compliance: {},
  setActiveMeds: (m) => set({ activeMeds: m }),
  markTaken: (id) => set((s) => ({ compliance: { ...s.compliance, [id]: true } })),
}));
