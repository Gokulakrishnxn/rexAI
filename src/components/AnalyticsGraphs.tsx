import React from 'react';
import { YStack, XStack, Text, Card } from 'tamagui';
import { Dimensions } from 'react-native';
import Svg, { Rect, Line, Circle, Text as SvgText } from 'react-native-svg';

interface AnalyticsGraphsProps {
    completedCount: number;
    totalCount: number;
    weeklyData?: number[]; // 7 days of completion data
}

export const AnalyticsGraphs = ({ completedCount, totalCount, weeklyData = [0, 0, 0, 0, 0, 0, 0] }: AnalyticsGraphsProps) => {
    const { width: windowWidth } = Dimensions.get('window');
    const graphWidth = windowWidth - 48; // Account for padding
    const graphHeight = 150;
    const barWidth = (graphWidth / 7) - 8;
    const maxValue = Math.max(...weeklyData, 1);

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

    return (
        <YStack gap="$4" paddingVertical="$4">
            {/* Completion Rate Card */}
            <Card
                padding="$4"
                borderRadius="$6"
                backgroundColor="$blue10"
            >
                <XStack justifyContent="space-between" alignItems="center">
                    <YStack>
                        <Text fontSize="$3" color="rgba(255,255,255,0.7)" fontWeight="600">Adherence Rate</Text>
                        <Text fontSize="$9" fontWeight="800" color="white">
                            {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%
                        </Text>
                    </YStack>
                    <YStack alignItems="flex-end">
                        <Text fontSize="$2" color="rgba(255,255,255,0.7)">{completedCount} / {totalCount}</Text>
                        <Text fontSize="$2" color="rgba(255,255,255,0.7)">completed</Text>
                    </YStack>
                </XStack>
            </Card>

            {/* Weekly Bar Chart */}
            <Card padding="$4" borderRadius="$9" backgroundColor="$muted">
                <Text fontSize="$6" fontWeight="700" color="$color" marginBottom="$3">
                    Weekly Activity
                </Text>
                <Svg width={graphWidth} height={graphHeight}>
                    {weeklyData.map((value, index) => {
                        const barHeight = (value / maxValue) * (graphHeight - 40);
                        const x = index * (barWidth + 8);
                        const y = graphHeight - barHeight - 20;
                        const isToday = index === todayIndex;

                        return (
                            <React.Fragment key={index}>
                                <Rect
                                    x={x}
                                    y={y}
                                    width={barWidth}
                                    height={barHeight}
                                    fill={isToday ? '#007AFF' : '#2C2C2E'}
                                    rx={4}
                                />
                                <SvgText
                                    x={x + barWidth / 2}
                                    y={graphHeight - 5}
                                    fontSize="10"
                                    fill="#8E8E93"
                                    textAnchor="middle"
                                >
                                    {days[index]}
                                </SvgText>
                                {value > 0 && (
                                    <SvgText
                                        x={x + barWidth / 2}
                                        y={y - 5}
                                        fontSize="12"
                                        fill={isToday ? '#007AFF' : '#FFFFFF'}
                                        textAnchor="middle"
                                        fontWeight="bold"
                                    >
                                        {value}
                                    </SvgText>
                                )}
                            </React.Fragment>
                        );
                    })}
                </Svg>
            </Card>
        </YStack>
    );
};
