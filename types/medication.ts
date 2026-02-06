export interface Medication {
  id: string;
  user_id?: string;
  name: string;
  dosage: string;
  frequency: string;
  time_of_day?: 'Morning' | 'Afternoon' | 'Evening' | 'Night' | 'Scheduled';
  active?: boolean;
  startDate?: string;
  endDate?: string;
  notes?: string;
}
