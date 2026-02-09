import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeDashboardScreen } from '../../screens/Home/HomeDashboardScreen';
import { MedicationListScreen } from '../../screens/Medication/MedicationListScreen';

export type HomeStackParamList = {
  HomeDashboard: undefined;
  MedicationList: undefined;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeDashboard" component={HomeDashboardScreen} />
      <Stack.Screen name="MedicationList" component={MedicationListScreen} />
    </Stack.Navigator>
  );
}
