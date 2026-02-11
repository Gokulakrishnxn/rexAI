import React from 'react';
import { View, Dimensions } from 'react-native';
import { Card, Text, YStack, XStack } from 'tamagui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface HealthScoreData {
    overall: number;
    metrics: {
        label: string;
        score: number;
        color: string;
    }[];
    // Optional weekly data - only show weekly chart if this is provided
    weeklyData?: {
        day: string;
        value: number;
    }[];
}

interface Props {
    data: HealthScoreData;
}

export function HealthScoreGraph({ data }: Props) {
    const getScoreColor = (score: number): string => {
        if (score >= 80) return '#10B981'; // Green
        if (score >= 60) return '#F59E0B'; // Amber
        if (score >= 40) return '#3B82F6'; // Blue
        return '#EF4444'; // Red
    };

    const overallColor = getScoreColor(data.overall);

    // Only show weekly chart if weeklyData is explicitly provided
    const hasWeeklyData = data.weeklyData && data.weeklyData.length > 0;

    if (hasWeeklyData) {
        // Vertical Bar Chart (Weekly Adherence Style) - Only with real data
        const maxValue = Math.max(...data.weeklyData!.map(d => d.value), 100);
        
        return (
            <Card 
                borderWidth={1} 
                borderColor="#E5E7EB" 
                padding="$4" 
                backgroundColor="white" 
                marginTop="$2" 
                marginBottom="$2"
                borderRadius={16}
                shadowColor="#000"
                shadowOffset={{ width: 0, height: 2 }}
                shadowOpacity={0.05}
                shadowRadius={8}
                elevation={2}
            >
                <YStack gap="$4">
                    {/* Header */}
                    <XStack justifyContent="space-between" alignItems="flex-start">
                        <YStack>
                            <XStack alignItems="center" gap="$2" marginBottom="$1">
                                <View style={{ 
                                    width: 20, 
                                    height: 20, 
                                    borderRadius: 10, 
                                    backgroundColor: '#EBF4FF', 
                                    alignItems: 'center', 
                                    justifyContent: 'center' 
                                }}>
                                    <Text fontSize={10}>✦</Text>
                                </View>
                                <Text color="#3B82F6" fontSize={12} fontWeight="600">CLINICAL AI</Text>
                            </XStack>
                            <Text color="#1A1A1A" fontWeight="700" fontSize={18}>Weekly Adherence</Text>
                        </YStack>
                        <YStack alignItems="flex-end">
                            <Text color="#9CA3AF" fontSize={11}>AVERAGE</Text>
                            <Text color={overallColor} fontWeight="800" fontSize={28}>
                                {data.overall}%
                            </Text>
                        </YStack>
                    </XStack>

                    {/* Vertical Bars - Real Data Only */}
                    <YStack marginTop="$2">
                        <XStack justifyContent="space-between" alignItems="flex-end" height={100} paddingHorizontal="$2">
                            {data.weeklyData!.map((dayData, index) => {
                                const barHeight = (dayData.value / maxValue) * 100;
                                const isHighlighted = dayData.value >= 80;
                                return (
                                    <YStack key={index} alignItems="center" gap={8}>
                                        <View 
                                            style={{ 
                                                width: 28, 
                                                height: barHeight, 
                                                backgroundColor: isHighlighted ? '#3B82F6' : '#93C5FD',
                                                borderRadius: 4,
                                            }} 
                                        />
                                        <Text color="#9CA3AF" fontSize={12}>{dayData.day}</Text>
                                    </YStack>
                                );
                            })}
                        </XStack>
                    </YStack>

                    {/* Footer */}
                    <Text color="#9CA3AF" fontSize={11} marginTop="$2">
                        Based on your actual medication records
                    </Text>
                </YStack>
            </Card>
        );
    }

    // Horizontal Progress Bars (Health Metrics Style) - Default view with real metrics
    return (
        <Card 
            borderWidth={1} 
            borderColor="#E5E7EB" 
            padding="$4" 
            backgroundColor="white" 
            marginTop="$2" 
            marginBottom="$2"
            borderRadius={16}
            shadowColor="#000"
            shadowOffset={{ width: 0, height: 2 }}
            shadowOpacity={0.05}
            shadowRadius={8}
            elevation={2}
        >
            <YStack gap="$4">
                {/* Header */}
                <XStack justifyContent="space-between" alignItems="flex-start">
                    <YStack>
                        <XStack alignItems="center" gap="$2" marginBottom="$1">
                            <View style={{ 
                                width: 20, 
                                height: 20, 
                                borderRadius: 10, 
                                backgroundColor: '#EBF4FF', 
                                alignItems: 'center', 
                                justifyContent: 'center' 
                            }}>
                                <Text fontSize={10}>✦</Text>
                            </View>
                            <Text color="#3B82F6" fontSize={12} fontWeight="600">CLINICAL AI</Text>
                        </XStack>
                        <Text color="#1A1A1A" fontWeight="700" fontSize={18}>Health Status</Text>
                    </YStack>
                    <YStack alignItems="flex-end">
                        <Text color="#9CA3AF" fontSize={11}>OVERALL SCORE</Text>
                        <Text color={overallColor} fontWeight="800" fontSize={28}>
                            {data.overall}
                        </Text>
                    </YStack>
                </XStack>

                {/* Metrics - Real Data Only */}
                <YStack gap="$3">
                    {data.metrics.map((metric, index) => (
                        <YStack key={index} gap={6}>
                            <XStack justifyContent="space-between" alignItems="center">
                                <Text color="#374151" fontSize={14} fontWeight="500">{metric.label}</Text>
                                <XStack alignItems="baseline" gap={4}>
                                    <Text color="#1A1A1A" fontWeight="700" fontSize={16}>{metric.score}</Text>
                                    <Text color="#9CA3AF" fontSize={12}>/100</Text>
                                </XStack>
                            </XStack>
                            <View style={{ height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                                <View 
                                    style={{ 
                                        height: '100%', 
                                        width: `${Math.min(metric.score, 100)}%`, 
                                        backgroundColor: metric.color,
                                        borderRadius: 4,
                                    }} 
                                />
                            </View>
                        </YStack>
                    ))}
                </YStack>

                {/* Footer */}
                <XStack justifyContent="space-between" alignItems="center" marginTop="$2">
                    <Text color="#9CA3AF" fontSize={11}>
                        Based on your health records
                    </Text>
                    <View style={{ 
                        paddingHorizontal: 8, 
                        paddingVertical: 4, 
                        backgroundColor: '#ECFDF5', 
                        borderRadius: 12 
                    }}>
                        <Text color="#10B981" fontSize={11} fontWeight="600">Verified</Text>
                    </View>
                </XStack>
            </YStack>
        </Card>
    );
}
