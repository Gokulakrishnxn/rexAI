export type MedicationSchedule = {
    id: string;
    name: string;
    dosage: string;
    frequency: string; // e.g. "Once daily", "Twice daily"
    times: string[]; // ["08:00", "20:00"]
    createdAt: string;
    active: boolean;
    takenToday?: boolean; // Ephemeral state for UI, reset daily
    lastTaken?: string;
};
