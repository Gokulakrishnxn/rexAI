import React, { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { YStack, XStack, Text, Button, Input, ScrollView, Card, Label, Switch } from 'tamagui';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
// DateTimePicker removed - not in package.json
import { useMedicationStore } from '../../store/useMedicationStore';
import { useTimelineStore } from '../../store/useTimelineStore';
import { requestPermissions } from '../../services/notificationService';
import { Trash2 } from 'lucide-react-native';

export function MedicationReminderScreen() {
    const navigation = useNavigation();
    const { medications, addMedication, removeMedication } = useMedicationStore();
    const { addEvent } = useTimelineStore();

    const [name, setName] = useState('');
    const [dosage, setDosage] = useState('');
    const [selectedTimeSlot, setSelectedTimeSlot] = useState('08:00'); // Default 8 AM

    const handleAddById = async () => {
        if (!name || !dosage) {
            Alert.alert('Missing Info', 'Please enter medication name and dosage.');
            return;
        }

        const hasPermission = await requestPermissions();
        if (!hasPermission) {
            Alert.alert('Permission Denied', 'Enable notifications to receive reminders.');
            return;
        }

        const timeStr = selectedTimeSlot;

        await addMedication({
            id: Date.now().toString(),
            name,
            dosage,
            frequency: 'Daily',
            times: [timeStr],
            createdAt: new Date().toISOString(),
            active: true,
            takenToday: false,
        });

        await addEvent({
            id: Date.now().toString(),
            type: 'chat',
            title: `Medication Added: ${name}`,
            summary: `Reminder set for ${timeStr}`,
            timestamp: new Date().toISOString(),
            source: 'system', // Added source
        });

        Alert.alert('Success', 'Medication reminder set!');
        setName('');
        setDosage('');
    };

    const handleDelete = (id: string) => {
        Alert.alert('Remove?', 'Stop reminders for this medication?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => removeMedication(id) },
        ]);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

                {/* Header */}
                <XStack alignItems="center" gap="$3" marginBottom="$6">
                    <Button size="$3" circular chromeless onPress={() => navigation.goBack()} icon={<Ionicons name="arrow-back" size={24} color="white" />} />
                    <Text fontSize="$6" fontWeight="bold" color="white">Medication Reminders</Text>
                </XStack>

                {/* Add New Section */}
                <Card padding="$4" borderRadius="$8" backgroundColor="$gray2" marginBottom="$6" borderWidth={1} borderColor="$gray4">
                    <Text fontSize="$5" fontWeight="600" color="white" marginBottom="$4">Add New Medication</Text>

                    <YStack gap="$4">
                        <YStack>
                            <Label color="$gray11">Medication Name</Label>
                            <Input
                                value={name}
                                onChangeText={setName}
                                placeholder="Ex. Metformin"
                                backgroundColor="$gray3"
                                color="white"
                                borderColor="$gray5"
                            />
                        </YStack>

                        <YStack>
                            <Label color="$gray11">Dosage</Label>
                            <Input
                                value={dosage}
                                onChangeText={setDosage}
                                placeholder="Ex. 500mg"
                                backgroundColor="$gray3"
                                color="white"
                                borderColor="$gray5"
                            />
                        </YStack>

                        <YStack>
                            <YStack>
                                <Label color="$gray11">Reminder Time</Label>
                                <XStack gap="$3">
                                    {['08:00', '12:00', '18:00', '21:00'].map((t) => (
                                        <Button
                                            key={t}
                                            size="$3"
                                            backgroundColor={selectedTimeSlot === t ? '$blue10' : '$gray3'}
                                            onPress={() => setSelectedTimeSlot(t)}
                                        >
                                            <Text color="white" fontWeight={selectedTimeSlot === t ? 'bold' : 'normal'}>
                                                {t}
                                            </Text>
                                        </Button>
                                    ))}
                                </XStack>
                            </YStack>
                        </YStack>

                        <Button
                            backgroundColor="$blue10"
                            onPress={handleAddById}
                            pressStyle={{ opacity: 0.8 }}
                            marginTop="$2"
                        >
                            <Text color="white" fontWeight="bold">Save Reminder</Text>
                        </Button>
                    </YStack>
                </Card>

                {/* List Section */}
                <Text fontSize="$5" fontWeight="600" color="white" marginBottom="$3">Active Reminders</Text>

                {medications.length === 0 ? (
                    <Text color="$gray11" fontStyle="italic">No medications added yet.</Text>
                ) : (
                    <YStack gap="$3">
                        {medications.map(med => (
                            <Card key={med.id} padding="$4" borderRadius="$8" backgroundColor="$gray2" borderWidth={1} borderColor="$gray4">
                                <XStack justifyContent="space-between" alignItems="center">
                                    <YStack>
                                        <Text fontSize="$5" fontWeight="bold" color="white">{med.name}</Text>
                                        <Text fontSize="$3" color="$gray11">{med.dosage} • {med.times.join(', ')}</Text>
                                    </YStack>
                                    <Button
                                        size="$3"
                                        circular
                                        backgroundColor="$red3"
                                        icon={<Trash2 size={18} color="$red10" />}
                                        onPress={() => handleDelete(med.id)}
                                    />
                                </XStack>
                            </Card>
                        ))}
                    </YStack>
                )}

            </ScrollView>
        </SafeAreaView>
    );
}
