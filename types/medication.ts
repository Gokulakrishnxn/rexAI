export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}
