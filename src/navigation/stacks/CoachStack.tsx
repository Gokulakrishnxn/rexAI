import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CoachChatScreen } from '../../screens/Coach/CoachChatScreen';
import { VoiceAssistantScreen } from '../../screens/Coach/VoiceAssistantScreen';

export type CoachStackParamList = {
  CoachChat: { documentId?: string; documentTitle?: string } | undefined;
  VoiceAssistant: undefined;
};

const Stack = createNativeStackNavigator<CoachStackParamList>();

export function CoachStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CoachChat" component={CoachChatScreen} />
      <Stack.Screen name="VoiceAssistant" component={VoiceAssistantScreen} />
    </Stack.Navigator>
  );
}
