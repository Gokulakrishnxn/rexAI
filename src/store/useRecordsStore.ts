import { create } from 'zustand';
import type { HealthRecord } from '../../types/record';
import type { Medication } from '../../types/medication';

interface RecordsState {
  records: HealthRecord[];
  activeMeds: Medication[];
  compliance: Record<string, boolean>;
  setRecords: (records: HealthRecord[]) => void;
  addRecord: (record: HealthRecord) => void;
  updateRecord: (id: string, updates: Partial<HealthRecord>) => void;
  removeRecord: (id: string) => void;
  markTaken: (id: string) => void;
}

export const useRecordsStore = create<RecordsState>((set) => ({
  records: [
    {
      id: '1',
      type: 'lab',
      title: 'Blood Test - CBC',
      date: '2024-01-20',
      summary: 'Normal results for all parameters.',
      doctor: 'Dr. Smith',
      ingestionStatus: 'complete',
    },
    {
      id: '2',
      type: 'prescription',
      title: 'Amoxicillin 500mg',
      date: '2024-01-22',
      summary: 'Take one tablet twice a day for 7 days.',
      doctor: 'Dr. Jones',
      ingestionStatus: 'complete',
    },
    {
      id: '3',
      type: 'imaging',
      title: 'Chest X-Ray',
      date: '2024-01-25',
      summary: 'Clear lungs, no abnormalities detected.',
      doctor: 'Dr. Wilson',
      ingestionStatus: 'complete',
    }
  ],
  activeMeds: [],
  compliance: {},
  setRecords: (records) => set({ records }),
  addRecord: (record) => set((s) => ({ records: [record, ...s.records] })),
  updateRecord: (id, updates) => set((s) => ({
    records: s.records.map((r) => r.id === id ? { ...r, ...updates } : r)
  })),
  removeRecord: (id) => set((s) => ({
    records: s.records.filter((r) => r.id !== id)
  })),
  markTaken: (id) => set((s) => ({
    compliance: { ...s.compliance, [id]: !s.compliance[id] }
  })),
}));
