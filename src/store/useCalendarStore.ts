import { create } from 'zustand';
import type { AppointmentEvent } from '../types/appointment';
import { getStored, setStored, KEYS } from '../services/storageService';

interface CalendarState {
  appointments: AppointmentEvent[];
  addAppointment: (event: AppointmentEvent) => Promise<void>;
  removeAppointment: (id: string) => Promise<void>;
  loadAppointments: () => Promise<void>;
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  appointments: [],

  addAppointment: async (event: AppointmentEvent) => {
    set((s) => ({ appointments: [...s.appointments, event] }));
    const { appointments } = get();
    await setStored(KEYS.CALENDAR_APPOINTMENTS, JSON.stringify(appointments));
  },

  removeAppointment: async (id: string) => {
    set((s) => ({ appointments: s.appointments.filter((a) => a.id !== id) }));
    const { appointments } = get();
    await setStored(KEYS.CALENDAR_APPOINTMENTS, JSON.stringify(appointments));
  },

  loadAppointments: async () => {
    const raw = await getStored(KEYS.CALENDAR_APPOINTMENTS);
    const list = raw ? (JSON.parse(raw) as AppointmentEvent[]) : [];
    set({ appointments: list });
  },
}));
