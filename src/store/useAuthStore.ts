import { create } from 'zustand';

interface AuthState {
  isOnboarded: boolean;
  isAuthenticated: boolean;
  setOnboarded: (v: boolean) => void;
  setAuthenticated: (v: boolean) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isOnboarded: false,
  isAuthenticated: false,
  setOnboarded: (v) => set({ isOnboarded: v }),
  setAuthenticated: (v) => set({ isAuthenticated: v }),
  signOut: () => set({ isAuthenticated: false }),
}));
