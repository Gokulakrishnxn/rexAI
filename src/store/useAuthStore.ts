import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { auth as firebaseAuth } from '../services/firebase';
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  role: 'patient' | 'doctor' | 'admin';
  firebase_uid: string;
  age?: number;
  gender?: string;
  blood_group?: string;
  allergies?: string[];
  emergency_contact?: string;
  height?: number;
  weight?: number;
  avatar_url?: string;
  abha_number?: string;
  aadhar_number?: string;
  onboarding_completed?: boolean;
}

interface AuthState {
  isOnboarded: boolean;
  isAuthenticated: boolean;
  user: UserProfile | null;
  firebaseUser: User | null;
  loading: boolean;
  setOnboarded: (v: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => void;
  setProfile: (profile: UserProfile) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isOnboarded: false,
  isAuthenticated: false,
  user: null,
  firebaseUser: null,
  loading: true,

  setOnboarded: async (v) => {
    const { user } = get();
    if (user) {
      // Use backend API to bypass RLS
      const { updateUserProfile } = await import('../services/api/backendApi');
      await updateUserProfile({ onboarding_completed: v });
    }
    set({ isOnboarded: v });
  },

  signOut: async () => {
    await firebaseSignOut(firebaseAuth);
    set({ isAuthenticated: false, user: null, firebaseUser: null, isOnboarded: false });
  },

  initialize: () => {
    // Listen for Firebase Auth changes
    onAuthStateChanged(firebaseAuth, async (fbUser) => {
      if (fbUser) {
        try {
          // Get token immediately to avoid race condition
          const token = await fbUser.getIdToken();

          // Fetch custom user profile from Supabase using Backend (Bypasses RLS)
          const { success, profile: userData, error: userError } = await import('../services/api/backendApi')
            .then(mod => mod.fetchUserProfile(token));

          if (userData) {
            set({
              firebaseUser: fbUser,
              user: userData,
              isAuthenticated: true,
              isOnboarded: userData.onboarding_completed || false,
              loading: false
            });
          } else {
            // User authenticated in Firebase but no profile in Supabase yet
            set({
              firebaseUser: fbUser,
              user: null,
              isAuthenticated: true,
              isOnboarded: false,
              loading: false
            });
          }
        } catch (error) {
          console.error('Error fetching profile during init:', error);
          set({ firebaseUser: fbUser, loading: false });
        }
      } else {
        set({ firebaseUser: null, user: null, isAuthenticated: false, loading: false });
      }
    });
  },

  setProfile: (profile) => {
    set({
      user: profile,
      isAuthenticated: true,
      isOnboarded: profile.onboarding_completed || false,
      loading: false
    });
  }
}));
