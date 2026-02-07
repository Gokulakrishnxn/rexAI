/**
 * SecureStore + SQLite for offline-first data.
 */

import * as SecureStore from 'expo-secure-store';

const KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_PROFILE: 'user_profile',
  CALENDAR_APPOINTMENTS: 'calendar_appointments',
};

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.AUTH_TOKEN);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.AUTH_TOKEN, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.AUTH_TOKEN);
}

/** Generic get/set for offline data (e.g. calendar). */
export async function getStored(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function setStored(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export { KEYS };
