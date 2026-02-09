export interface Medication {
  id: string;
  user_id?: string;
  name: string;
  drug_name?: string;
  dosage: string;
  frequency: string;
  frequency_text?: string;
  time_of_day?: 'Morning' | 'Afternoon' | 'Evening' | 'Night' | 'Scheduled' | string;
  active?: boolean;
  startDate?: string;
  endDate?: string;
  notes?: string;
  instructions?: string;
  form?: string;
  status?: 'active' | 'inactive' | 'completed';
  confidence_score?: number;
  duration_days?: number;
  created_at?: string;
  prescription_image?: string;
}
