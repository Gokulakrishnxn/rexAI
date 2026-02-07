import { create } from 'zustand';
import type { SoapNote } from '../types/soap';
import { getStored, setStored, KEYS } from '../services/storageService';

interface SoapState {
  notes: SoapNote[];
  addNote: (note: SoapNote) => Promise<void>;
  loadNotes: () => Promise<void>;
  getLatestNote: () => SoapNote | null;
}

export const useSoapStore = create<SoapState>((set, get) => ({
  notes: [],

  addNote: async (note: SoapNote) => {
    set((s) => ({ notes: [note, ...s.notes] }));
    const { notes } = get();
    await setStored(KEYS.SOAP_NOTES, JSON.stringify(notes));
  },

  loadNotes: async () => {
    const raw = await getStored(KEYS.SOAP_NOTES);
    const list = raw ? (JSON.parse(raw) as SoapNote[]) : [];
    set({ notes: list });
  },

  getLatestNote: () => {
    const { notes } = get();
    return notes.length > 0 ? notes[0] : null;
  },
}));
