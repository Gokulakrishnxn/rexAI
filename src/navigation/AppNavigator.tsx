import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/useAuthStore';
import { TabNavigator } from './TabNavigator';
import { WelcomeScreen } from '../screens/Onboarding/WelcomeScreen';
import { PermissionsScreen } from '../screens/Onboarding/PermissionsScreen';
import { ProfileSetupScreen } from '../screens/Onboarding/ProfileSetupScreen';
import { QRSetupScreen } from '../screens/Onboarding/QRSetupScreen';
import { EmergencyModeScreen } from '../screens/Home/EmergencyModeScreen';
import { SoapNoteScreen } from '../screens/Records/SoapNoteScreen';

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  EmergencyMode: undefined;
  VoiceChat: undefined;
  SoapNote: { noteId?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const OnboardingStack = createNativeStackNavigator();

function OnboardingStackScreen() {
  return (
    <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
      <OnboardingStack.Screen name="Welcome" component={WelcomeScreen} />
      <OnboardingStack.Screen name="Permissions" component={PermissionsScreen} />
      <OnboardingStack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      <OnboardingStack.Screen name="QRSetup" component={QRSetupScreen} />
    </OnboardingStack.Navigator>
  );
}

export function AppNavigator() {
  const { isOnboarded, isAuthenticated } = useAuthStore();
  const showMain = isOnboarded && isAuthenticated;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!showMain ? (
        <Stack.Screen name="Onboarding" component={OnboardingStackScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen
            name="EmergencyMode"
            component={EmergencyModeScreen}
            options={{ presentation: 'fullScreenModal' }}
          />
          <Stack.Screen
            name="VoiceChat"
            component={require('../screens/Coach/VoiceChatScreen').VoiceChatScreen}
            options={{
              presentation: 'fullScreenModal',
              animation: 'fade_from_bottom',
            }}
          />
          <Stack.Screen name="SoapNote" component={SoapNoteScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
