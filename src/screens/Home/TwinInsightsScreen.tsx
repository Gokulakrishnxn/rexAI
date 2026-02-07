import React from 'react';
import { ScrollView, YStack, XStack, Text, Card, Button, Separator, Circle, Progress } from 'tamagui';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTwinStore } from '../../store/useTwinStore';
import { Activity, AlertTriangle, CheckCircle, Info } from 'lucide-react-native';

export function TwinInsightsScreen() {
    const navigation = useNavigation();
    const { twin } = useTwinStore();

    if (!twin) return null;

    const getRiskColor = (level: string) => {
        switch (level) {
            case 'Low': return '$green10';
            case 'Moderate': return '$orange10';
            case 'High': return '$red10';
            default: return '$gray10';
        }
    };

    const riskColor = getRiskColor(twin.riskLevel);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Header */}
                <YStack padding="$4" gap="$2">
                    <XStack justifyContent="space-between" alignItems="center">
                        <Button
                            size="$3"
                            circular
                            chromeless
                            onPress={() => navigation.goBack()}
                            icon={<Ionicons name="arrow-back" size={24} color="white" />}
                        />
                        <Text fontSize="$6" fontWeight="bold" color="white">Twin Insights</Text>
                        <XStack width={40} />
                    </XStack>
                </YStack>

                {/* Risk Score Highlight */}
                <YStack alignItems="center" paddingVertical="$6">
                    <YStack
                        width={180}
                        height={180}
                        borderRadius={999}
                        borderWidth={8}
                        borderColor={riskColor}
                        alignItems="center"
                        justifyContent="center"
                        backgroundColor="rgba(255,255,255,0.05)"
                    >
                        <Activity size={48} color={String(riskColor).replace('$', '') as any} />
                        <Text fontSize="$9" fontWeight="900" color="white" marginTop="$2">
                            {twin.riskScore}
                        </Text>
                        <Text fontSize="$3" color="$gray11" textTransform="uppercase" fontWeight="600">
                            Risk Score
                        </Text>
                    </YStack>
                    <Text fontSize="$7" fontWeight="bold" color={riskColor} marginTop="$4">
                        {twin.riskLevel} Risk
                    </Text>
                    <Text fontSize="$3" color="$gray11" textAlign="center" maxWidth={280} marginTop="$2">
                        Based on your recent activity, vitals, and timeline events.
                    </Text>
                </YStack>

                {/* Key Signals */}
                <YStack paddingHorizontal="$4" marginTop="$4">
                    <Text fontSize="$5" fontWeight="700" color="white" marginBottom="$3">
                        Key Signals
                    </Text>
                    {twin.keySignals.length > 0 ? (
                        <YStack gap="$3">
                            {twin.keySignals.map((signal, index) => (
                                <Card key={index} padding="$4" borderRadius="$6" backgroundColor="$gray2" borderWidth={1} borderColor="$gray4">
                                    <XStack gap="$3" alignItems="center">
                                        <AlertTriangle size={20} color="#F59E0B" />
                                        <Text color="white" fontSize="$4" flex={1}>{signal}</Text>
                                    </XStack>
                                </Card>
                            ))}
                        </YStack>
                    ) : (
                        <Card padding="$4" borderRadius="$6" backgroundColor="$green2" borderWidth={1} borderColor="$green4">
                            <XStack gap="$3" alignItems="center">
                                <CheckCircle size={20} color="#10B981" />
                                <Text color="white" fontSize="$4">No negative signals detected.</Text>
                            </XStack>
                        </Card>
                    )}
                </YStack>

                {/* Smart Nudges */}
                <YStack paddingHorizontal="$4" marginTop="$6">
                    <Text fontSize="$5" fontWeight="700" color="white" marginBottom="$3">
                        Recommended Actions
                    </Text>
                    <YStack gap="$3">
                        {twin.nudges.map((nudge, index) => (
                            <Card key={index} padding="$4" borderRadius="$6" backgroundColor="$blue2" borderWidth={1} borderColor="$blue4">
                                <XStack gap="$3" alignItems="center">
                                    <Info size={20} color="#3B82F6" />
                                    <Text color="white" fontSize="$4" flex={1}>{nudge}</Text>
                                </XStack>
                            </Card>
                        ))}
                    </YStack>
                </YStack>

                <YStack paddingHorizontal="$4" marginTop="$8">
                    <Text fontSize="$2" color="$gray11" textAlign="center">
                        Last updated: {new Date(twin.updatedAt).toLocaleString()}
                    </Text>
                </YStack>

            </ScrollView>
        </SafeAreaView>
    );
}
