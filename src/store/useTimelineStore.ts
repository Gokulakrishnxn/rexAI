import { create } from 'zustand';
import type { TimelineEvent } from '../types/timeline';
import { getStored, setStored, KEYS } from '../services/storageService';

interface TimelineState {
  events: TimelineEvent[];
  addEvent: (event: TimelineEvent) => Promise<void>;
  loadEvents: () => Promise<void>;
  getRecentEvents: (limit?: number) => TimelineEvent[];
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  events: [],

  addEvent: async (event: TimelineEvent) => {
    set((s) => ({ events: [event, ...s.events] }));
    const { events } = get();
    await setStored(KEYS.TIMELINE_EVENTS, JSON.stringify(events));
  },

  loadEvents: async () => {
    const raw = await getStored(KEYS.TIMELINE_EVENTS);
    const list = raw ? (JSON.parse(raw) as TimelineEvent[]) : [];
    set({ events: list });
  },

  getRecentEvents: (limit = 10) => {
    const { events } = get();
    return events.slice(0, limit);
  },
}));
