export type DigitalTwinState = {
    updatedAt: string;
    riskScore: number; // 0–100
    riskLevel: 'Low' | 'Moderate' | 'High';
    keySignals: string[];
    nudges: string[];
};
