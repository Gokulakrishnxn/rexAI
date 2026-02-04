/**
 * Helpers for encrypting sensitive health data at rest.
 */

export function encrypt(data: string, key: string): string {
  // TODO: use expo-crypto or native module
  return data;
}

export function decrypt(encrypted: string, key: string): string {
  return encrypted;
}
