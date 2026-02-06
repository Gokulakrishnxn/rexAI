/**
 * Emergency JSON + full URL generation for QR codes.
 */

import type { QRData } from '../store/useQRStore';

export type QRProfile = {
  name?: string;
  blood_group?: string;
  allergies?: string[];
  emergency_contact?: string;
};

export function buildEmergencyJson(profile: QRProfile): string {
  return JSON.stringify({
    name: profile.name || 'Anonymous User',
    bloodType: profile.blood_group,
    allergies: profile.allergies ?? [],
    emergencyContact: profile.emergency_contact,
    updatedAt: Date.now(),
  });
}

export function buildFullUrl(emergencyJson: string): string {
  const base = process.env.EXPO_PUBLIC_APP_URL ?? 'https://rexhealthify.app';
  return `${base}/e?q=${encodeURIComponent(emergencyJson)}`;
}

export function generateQRData(profile: QRProfile): QRData {
  const emergencyJson = buildEmergencyJson(profile);
  return {
    emergencyJson,
    fullUrl: buildFullUrl(emergencyJson),
    updatedAt: Date.now(),
  };
}
