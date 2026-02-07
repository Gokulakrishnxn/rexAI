/**
 * SOAP note type for clinical summary generation.
 */

export type SoapNote = {
  id: string;
  createdAt: string;
  source: 'chat' | 'voice' | 'call';
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};
