import React from 'react';
import { Card, Text, YStack, XStack, Progress } from 'tamagui';

interface HealthScoreData {
    overall: number;
    metrics: {
        label: string;
        score: number;
        color: string;
    }[];
}

interface Props {
    data: HealthScoreData;
}

export function HealthScoreGraph({ data }: Props) {
    return (
        <Card borderWidth={1} borderColor="#333" padding="$4" backgroundColor="#1C1C1E" marginTop="$2" marginBottom="$2">
            <YStack gap="$4">
                <XStack justifyContent="space-between" alignItems="center">
                    <Text color="white" fontWeight="700" fontSize="$5">Health Status</Text>
                    <Text color={getScoreColor(data.overall)} fontWeight="800" fontSize="$8">
                        {data.overall}
                    </Text>
                </XStack>

                <YStack gap="$3">
                    {data.metrics.map((metric, index) => (
                        <YStack key={index} gap="$1">
                            <XStack justifyContent="space-between">
                                <Text color="#B0B0B0" fontSize="$3">{metric.label}</Text>
                                <Text color="white" fontWeight="600">{metric.score}/100</Text>
                            </XStack>
                            <Progress value={metric.score} size="$2">
                                <Progress.Indicator backgroundColor={metric.color} />
                            </Progress>
                        </YStack>
                    ))}
                </YStack>
            </YStack>
        </Card>
    );
}

function getScoreColor(score: number): string {
    if (score >= 80) return '#4ADE80'; // Green
    if (score >= 60) return '#FACC15'; // Yellow
    return '#F87171'; // Red
}
