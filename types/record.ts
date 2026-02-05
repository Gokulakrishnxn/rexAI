export type IngestionStatus = 'pending' | 'uploading' | 'processing' | 'complete' | 'error';

export interface HealthRecord {
  id: string;
  type: 'lab' | 'prescription' | 'imaging' | 'other';
  title: string;
  date: string;
  summary?: string;
  rawText?: string;
  fileUri?: string;
  extracted?: Record<string, unknown>;
  doctor?: string;
  hospital?: string;

  // Supabase fields
  supabaseUrl?: string;
  storagePath?: string;
  documentId?: string;

  // Ingestion status
  ingestionStatus: IngestionStatus;
  ingestionError?: string;
}
