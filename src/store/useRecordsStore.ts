import { create } from 'zustand';
import type { HealthRecord } from '../../types/record';
import type { Medication } from '../../types/medication';

interface RecordsState {
  records: HealthRecord[];
  medications: Medication[];
  setRecords: (r: HealthRecord[]) => void;
  setMedications: (m: Medication[]) => void;
  addRecord: (r: HealthRecord) => void;
  addMedication: (m: Medication) => void;
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
    },
    {
      id: '2',
      type: 'prescription',
      title: 'Amoxicillin 500mg',
      date: '2024-01-22',
      summary: 'Take one tablet twice a day for 7 days.',
      doctor: 'Dr. Jones',
    },
    {
      id: '3',
      type: 'imaging',
      title: 'Chest X-Ray',
      date: '2024-01-25',
      summary: 'Clear lungs, no abnormalities detected.',
      doctor: 'Dr. Wilson',
    }
  ],
  medications: [],
  setRecords: (r) => set({ records: r }),
  setMedications: (m) => set({ medications: m }),
  addRecord: (r) => set((s) => ({ records: [...s.records, r] })),
  addMedication: (m) => set((s) => ({ medications: [...s.medications, m] })),
}));
