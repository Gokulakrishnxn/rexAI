import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeDashboardScreen } from '../../screens/Home/HomeDashboardScreen';
import { TimelineScreen } from '../../screens/Home/TimelineScreen';
import { TwinInsightsScreen } from '../../screens/Home/TwinInsightsScreen';

export type HomeStackParamList = {
  HomeDashboard: undefined;
  Timeline: undefined;
  TwinInsights: undefined;
};


const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeDashboard" component={HomeDashboardScreen} />
      <Stack.Screen name="Timeline" component={TimelineScreen} />
      <Stack.Screen name="TwinInsights" component={TwinInsightsScreen} />
    </Stack.Navigator>
  );
}
