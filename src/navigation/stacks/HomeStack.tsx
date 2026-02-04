import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeDashboardScreen } from '../../screens/Home/HomeDashboardScreen';

export type HomeStackParamList = {
  HomeDashboard: undefined;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeDashboard" component={HomeDashboardScreen} />
    </Stack.Navigator>
  );
}
