import { useTimelineStore } from '../store/useTimelineStore';
import { useMedicationStore } from '../store/useMedicationStore';
import { useCalendarStore } from '../store/useCalendarStore'; // Assuming this exists or we mock it via timeline events
import { Alert } from 'react-native';

export async function seedDemoData() {
    const { addEvent } = useTimelineStore.getState();
    const { addMedication } = useMedicationStore.getState();

    // Clear existing? Maybe not for safety, just append.

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    // 1. Appointment Booked
    await addEvent({
        id: 'demo-apt-1',
        type: 'appointment',
        title: 'Cardiology Checkup',
        summary: 'Scheduled with Dr. Smith for next Tuesday.',
        timestamp: threeDaysAgo.toISOString(),
        source: 'system' // valid source: system
    });

    // 2. Plate Scan
    await addEvent({
        id: 'demo-plate-1',
        type: 'plate_scan',
        title: 'Lunch: Grilled Chicken Salad',
        summary: '520 kcal • 38g Protein • Balanced meal.',
        timestamp: twoDaysAgo.toISOString(),
        source: 'system' // valid source: system (simulated vision)
    });

    // 3. SOAP Note
    await addEvent({
        id: 'demo-soap-1',
        type: 'soap_note',
        title: 'Consultation Note: Migraine',
        summary: 'Subjective: Patient reports throbbing headache. Assessment: Likely tension headache. Plan: Rest and fluids.',
        timestamp: oneDayAgo.toISOString(),
        source: 'voice' // valid source: voice
    });

    // 4. Emergency Trigger (Historical)
    await addEvent({
        id: 'demo-emg-1',
        type: 'emergency',
        title: 'Emergency: Chest Pain',
        summary: 'User activated Heart Attack protocol.',
        timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
        source: 'system' // valid source: system
    });

    // 5. Medication Schedule
    await addMedication({
        id: 'demo-med-1',
        name: 'Amoxicillin',
        dosage: '500mg',
        frequency: 'Tweice daily',
        times: ['08:00', '20:00'],
        createdAt: now.toISOString(),
        active: true,
        takenToday: false,
    });

    await addEvent({
        id: 'demo-med-log-1',
        type: 'chat',
        title: 'Medication Added: Amoxicillin',
        summary: 'Reminder set for 08:00, 20:00',
        timestamp: now.toISOString(),
        source: 'system'
    });

    Alert.alert('Demo Data Seeded', 'Timeline and Medications have been populated.');
}
