import React from 'react';
import { View, Dimensions } from 'react-native';
import { Text, YStack, XStack, Card } from 'tamagui';
import { Svg, Rect, G } from 'react-native-svg';

interface TaskProgressProps {
    total: number;
    completed: number;
}

export function TaskProgressGraph({ total, completed }: TaskProgressProps) {
    const width = Dimensions.get('window').width - 48; // Padding
    const height = 20;
    const percentage = total > 0 ? (completed / total) : 0;
    const barWidth = width * percentage;

    return (
        <Card padding="$4" borderRadius="$8" backgroundColor="$muted" elevation={2}>
            <YStack gap="$2">
                <XStack justifyContent="space-between">
                    <Text fontSize="$4" fontWeight="bold">Daily Goals</Text>
                    <Text fontSize="$4" color="$blue10" fontWeight="bold">
                        {Math.round(percentage * 100)}%
                    </Text>
                </XStack>

                <View style={{ height, backgroundColor: '#E0E0E0', borderRadius: 10, overflow: 'hidden' }}>
                    <View style={{
                        height: '100%',
                        width: `${percentage * 100}%`,
                        backgroundColor: '#007AFF',
                        borderRadius: 10
                    }} />
                </View>

                <XStack justifyContent="space-between">
                    <Text fontSize="$2" color="$gray10">{completed} Completed</Text>
                    <Text fontSize="$2" color="$gray10">{total} Total</Text>
                </XStack>
            </YStack>
        </Card>
    );
}
