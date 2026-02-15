import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { InsightsDashboardScreen } from '../../screens/Insights/InsightsDashboardScreen';
import { MedicalInsightsScreen } from '../../screens/Records/MedicalInsightsScreen';

export type InsightsStackParamList = {
    InsightsDashboard: undefined;
    MedicalInsights: { documentId: string; documentTitle: string; extractedText?: string };
};

const Stack = createNativeStackNavigator<InsightsStackParamList>();

export function InsightsStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="InsightsDashboard" component={InsightsDashboardScreen} />
            <Stack.Screen
                name="MedicalInsights"
                component={MedicalInsightsScreen}
                options={{
                    animation: 'slide_from_right',
                }}
            />
        </Stack.Navigator>
    );
}
