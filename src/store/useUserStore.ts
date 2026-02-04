import { create } from 'zustand';

export interface UserProfile {
  id: string;
  name: string;
  bloodType?: string;
  allergies?: string[];
  emergencyContact?: string;
}

interface UserState {
  profile: UserProfile | null;
  setProfile: (p: UserProfile | null) => void;
}

export const useUserStore = create<UserState>((set) => ({
  profile: null,
  setProfile: (p) => set({ profile: p }),
}));
