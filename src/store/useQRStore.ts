import { create } from 'zustand';

export interface QRData {
  emergencyJson: string;
  fullUrl: string;
  updatedAt: number;
}

interface QRState {
  currentQR: QRData | null;
  setCurrentQR: (q: QRData | null) => void;
}

export const useQRStore = create<QRState>((set) => ({
  currentQR: null,
  setCurrentQR: (q) => set({ currentQR: q }),
}));
