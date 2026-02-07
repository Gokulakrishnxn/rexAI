/**
 * Unified health timeline event type.
 */

export type TimelineEvent = {
  id: string;
  type: 'appointment' | 'plate_scan' | 'soap_note' | 'emergency' | 'chat';
  title: string;
  summary?: string;
  timestamp: string;
  source: 'chat' | 'voice' | 'system' | 'manual';
};
