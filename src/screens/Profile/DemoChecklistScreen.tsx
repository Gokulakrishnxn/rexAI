import React from 'react';
import { ScrollView, YStack, XStack, Text, Button, Card, Separator } from 'tamagui';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CheckCircle2, PlayCircle, Settings } from 'lucide-react-native';
import { seedDemoData } from '../../utils/demoUtils';
import { DEMO_MODE } from '../../constants/config';

export function DemoChecklistScreen() {
    const navigation = useNavigation<any>();

    const features = [
        { id: 1, name: 'Secure Auth & ABHA Integration', done: true, route: 'Profile' },
        { id: 2, name: 'Timeline & Medical Records', done: true, route: 'Timeline' },
        { id: 3, name: 'LiveKit Voice Agent', done: true, route: 'VoiceChat' },
        { id: 4, name: 'Router Agent (Intents)', done: true, route: 'Coach' },
        { id: 5, name: 'Google Calendar Integration', done: true, route: 'Timeline' },
        { id: 6, name: 'Auto-SOAP Note Generation', done: true, route: 'Timeline' }, // view soap
        { id: 7, name: 'AI Plate Nutrition Scanner', done: true, route: 'Coach' },
        { id: 8, name: 'Golden Hour Emergency Mode', done: true, route: 'EmergencyMode' },
        { id: 9, name: 'Digital Twin + Nudges', done: true, route: 'TwinInsights' },
        { id: 10, name: 'Medication Reminders', done: true, route: 'MedicationReminder' },
    ];

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

                {/* Header */}
                <XStack alignItems="center" justifyContent="space-between" marginBottom="$6">
                    <XStack alignItems="center" gap="$3">
                        <Button size="$3" circular chromeless onPress={() => navigation.goBack()} icon={<Ionicons name="arrow-back" size={24} color="white" />} />
                        <Text fontSize="$6" fontWeight="bold" color="white">Demo Checklist</Text>
                    </XStack>
                    {DEMO_MODE && (
                        <YStack paddingHorizontal="$2" paddingVertical="$1" backgroundColor="$yellow4" borderRadius="$4">
                            <Text color="black" fontWeight="bold" fontSize="$2" textTransform="uppercase">Demo Mode</Text>
                        </YStack>
                    )}
                </XStack>

                {/* Action Panel */}
                <Card padding="$4" borderRadius="$8" backgroundColor="$gray2" marginBottom="$6" borderWidth={1} borderColor="$gray4">
                    <Text fontSize="$5" fontWeight="600" color="white" marginBottom="$3">Quick Setup</Text>
                    <Button
                        backgroundColor="$blue10"
                        icon={<PlayCircle size={20} color="white" />}
                        onPress={seedDemoData}
                    >
                        <Text color="white" fontWeight="bold">Seed Demo Data</Text>
                    </Button>
                    <Text fontSize="$2" color="$gray11" marginTop="$2">
                        Populates Timeline, Meds, and triggers Twin analysis.
                    </Text>
                </Card>

                {/* Feature List */}
                <Text fontSize="$5" fontWeight="600" color="white" marginBottom="$4">10/10 Features Ready</Text>

                <YStack gap="$3">
                    {features.map((f) => (
                        <Card
                            key={f.id}
                            padding="$4"
                            borderRadius="$8"
                            backgroundColor="$gray2"
                            borderWidth={1}
                            borderColor="$gray4"
                            pressStyle={{ opacity: 0.8 }}
                            onPress={() => {
                                if (f.route === 'Timeline') navigation.navigate('Main', { screen: 'RecordsTab' }); // Approximation
                                else if (f.route === 'Coach') navigation.navigate('Main', { screen: 'CoachTab' });
                                else if (f.route === 'Profile') navigation.navigate('Main', { screen: 'ProfileTab' });
                                else navigation.navigate(f.route as any);
                            }}
                        >
                            <XStack alignItems="center" gap="$3">
                                <CheckCircle2 size={24} color="#32D74B" />
                                <YStack flex={1}>
                                    <Text color="white" fontSize="$4" fontWeight="600">{f.id}. {f.name}</Text>
                                </YStack>
                                <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                            </XStack>
                        </Card>
                    ))}
                </YStack>

            </ScrollView>
        </SafeAreaView>
    );
}
