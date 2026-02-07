import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RecordsDashboardScreen } from '../../screens/Records/RecordsDashboardScreen';
import { AddRecordScreen } from '../../screens/Records/AddRecordScreen';
import { RecordDetailScreen } from '../../screens/Records/RecordDetailScreen';
import { PrescriptionDetailScreen } from '../../screens/Records/PrescriptionDetailScreen';
import { PlateScanScreen } from '../../screens/Records/PlateScanScreen';
import { SoapNoteScreen } from '../../screens/Records/SoapNoteScreen';

export type RecordsStackParamList = {
  RecordsDashboard: undefined;
  AddRecord: undefined;
  RecordDetail: { id: string };
  PrescriptionDetail: { id: string };
  PlateScan: undefined;
  SoapNote: { noteId?: string };
};

const Stack = createNativeStackNavigator<RecordsStackParamList>();

export function RecordsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RecordsDashboard" component={RecordsDashboardScreen} />
      <Stack.Screen name="AddRecord" component={AddRecordScreen} />
      <Stack.Screen name="RecordDetail" component={RecordDetailScreen} />
      <Stack.Screen name="PrescriptionDetail" component={PrescriptionDetailScreen} />
      <Stack.Screen name="PlateScan" component={PlateScanScreen} />
      <Stack.Screen name="SoapNote" component={SoapNoteScreen} />
    </Stack.Navigator>
  );
}
