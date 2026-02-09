import { create } from 'zustand';
import type { HealthRecord } from '../../types/record';
import type { Medication } from '../../types/medication';
import { fetchUserDocuments } from '../services/api/backendApi';

interface RecordsState {
  records: HealthRecord[];
  activeMeds: Medication[];
  compliance: Record<string, boolean>;
  setRecords: (records: HealthRecord[]) => void;
  addRecord: (record: HealthRecord) => void;
  updateRecord: (id: string, updates: Partial<HealthRecord>) => void;
  removeRecord: (id: string) => void;
  markTaken: (id: string) => void;
  fetchRecords: () => Promise<void>;
}

export const useRecordsStore = create<RecordsState>((set) => ({
  records: [], // Default to empty
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
  fetchRecords: async () => {
    const docs = await fetchUserDocuments();
    if (docs) {
      // Map backend docs to HealthRecord shape
      const formatted: HealthRecord[] = docs.map((d: any) => ({
        id: d.id,
        type: d.doc_category || 'other', // Use the new category
        title: d.file_name,
        date: new Date(d.created_at).toISOString().split('T')[0],
        summary: d.summary || 'No summary available',
        doctor: 'Unknown', // Backend doesn't store this yet
        ingestionStatus: d.validation_status === 'verified' ? 'complete' : 'pending',
        supabaseUrl: d.file_url,
        documentId: d.id,
      }));
      set({ records: formatted });
    }
  }
}));
