import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileScreen } from '../../screens/Profile/ProfileScreen';
import { QRManagementScreen } from '../../screens/Profile/QRManagementScreen';
import { SettingsScreen } from '../../screens/Profile/SettingsScreen';
import { MedicationReminderScreen } from '../../screens/Profile/MedicationReminderScreen';
import { DemoChecklistScreen } from '../../screens/Profile/DemoChecklistScreen';

export type ProfileStackParamList = {
  Profile: undefined;
  QRManagement: undefined;

  Settings: undefined;
  MedicationReminder: undefined;
  DemoChecklist: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="QRManagement" component={QRManagementScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="MedicationReminder" component={MedicationReminderScreen} />
      <Stack.Screen name="DemoChecklist" component={DemoChecklistScreen} />
    </Stack.Navigator>
  );
}
