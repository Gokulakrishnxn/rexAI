import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileScreen } from '../../screens/Profile/ProfileScreen';
import { QRManagementScreen } from '../../screens/Profile/QRManagementScreen';
import { SettingsScreen } from '../../screens/Profile/SettingsScreen';
import { MedicationListScreen } from '../../screens/Medication/MedicationListScreen';

export type ProfileStackParamList = {
  Profile: undefined;
  QRManagement: undefined;
  Settings: undefined;
  MedicationLibrary: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="QRManagement" component={QRManagementScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="MedicationLibrary" component={MedicationListScreen} />
    </Stack.Navigator>
  );
}
