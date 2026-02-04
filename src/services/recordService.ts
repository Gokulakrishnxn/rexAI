/**
 * Upload + extraction pipeline for health records.
 */

import { extractFromImage } from './api/openaiProxy';

export async function uploadAndExtract(imageUri: string): Promise<Record<string, unknown>> {
  // TODO: convert imageUri to base64 and call extractFromImage
  return extractFromImage('stub');
}
