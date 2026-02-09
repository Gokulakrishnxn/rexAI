import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RecordsDashboardScreen } from '../../screens/Records/RecordsDashboardScreen';
import { AddRecordScreen } from '../../screens/Records/AddRecordScreen';
import { RecordDetailScreen } from '../../screens/Records/RecordDetailScreen';
import { PrescriptionDetailScreen } from '../../screens/Records/PrescriptionDetailScreen';
import { DocumentProcessingScreen } from '../../screens/Records/DocumentProcessingScreen';

export type RecordsStackParamList = {
  RecordsDashboard: undefined;
  AddRecord: undefined;
  RecordDetail: { id: string };
  PrescriptionDetail: { id: string };
  DocumentProcessing: { fileUri: string; fileName: string; mimeType: string; userId: string };
};

const Stack = createNativeStackNavigator<RecordsStackParamList>();

export function RecordsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RecordsDashboard" component={RecordsDashboardScreen} />
      <Stack.Screen name="AddRecord" component={AddRecordScreen} />
      <Stack.Screen name="RecordDetail" component={RecordDetailScreen} />
      <Stack.Screen name="PrescriptionDetail" component={PrescriptionDetailScreen} />
      <Stack.Screen 
        name="DocumentProcessing" 
        component={DocumentProcessingScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
        }}
      />
    </Stack.Navigator>
  );
}
