/**
 * Emergency JSON + full URL generation for QR codes.
 */

import type { QRData } from '../store/useQRStore';

export function buildEmergencyJson(profile: { name: string; bloodType?: string; allergies?: string[] }): string {
  return JSON.stringify({
    name: profile.name,
    bloodType: profile.bloodType,
    allergies: profile.allergies ?? [],
    updatedAt: Date.now(),
  });
}

export function buildFullUrl(emergencyJson: string): string {
  const base = process.env.EXPO_PUBLIC_APP_URL ?? 'https://rexhealthify.app';
  return `${base}/e?q=${encodeURIComponent(emergencyJson)}`;
}

export function generateQRData(profile: { name: string; bloodType?: string; allergies?: string[] }): QRData {
  const emergencyJson = buildEmergencyJson(profile);
  return {
    emergencyJson,
    fullUrl: buildFullUrl(emergencyJson),
    updatedAt: Date.now(),
  };
}
