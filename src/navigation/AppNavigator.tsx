import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/useAuthStore';
import { TabNavigator } from './TabNavigator';
import { WelcomeScreen } from '../screens/Onboarding/WelcomeScreen';
import { PermissionsScreen } from '../screens/Onboarding/PermissionsScreen';
import { ProfileSetupScreen } from '../screens/Onboarding/ProfileSetupScreen';
import { QRSetupScreen } from '../screens/Onboarding/QRSetupScreen';
import { EmergencyModeScreen } from '../screens/Home/EmergencyModeScreen';

import { LoginScreen } from '../screens/Auth/LoginScreen';
import { SignupScreen } from '../screens/Auth/SignupScreen';
import { CompleteProfileScreen } from '../screens/Auth/CompleteProfileScreen';
import { ActivityIndicator, View } from 'react-native';

export type RootStackParamList = {
  Auth: undefined;
  Onboarding: undefined;
  Main: undefined;
  EmergencyMode: undefined;
  VoiceChat: undefined;
  CoachChat: undefined;
  AnalyzingPrescription: { imageBase64: string; imageUri: string };
  MedicationReview: { preloadedDrafts?: any[]; imageUri?: string; imageBase64?: string };
  CompleteProfile: { email?: string; name?: string; photoURL?: string; isGoogleUser: boolean };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const OnboardingStack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();

function AuthStackScreen() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
      <AuthStack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
    </AuthStack.Navigator>
  );
}

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
  const { isOnboarded, isAuthenticated, loading, initialize } = useAuthStore();

  React.useEffect(() => {
    initialize();

    // Safety timeout: if auth takes > 10s, force stop loading
    const timer = setTimeout(() => {
      if (useAuthStore.getState().loading) {
        console.warn('Auth initialization timed out');
        useAuthStore.setState({ loading: false });
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthStackScreen} />
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
          <Stack.Screen
            name="MedicationReview"
            component={require('../screens/Medication/MedicationReviewScreen').MedicationReviewScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen
            name="AnalyzingPrescription"
            component={require('../screens/Medication/AnalyzingPrescriptionScreen').AnalyzingPrescriptionScreen}
            options={{ presentation: 'fullScreenModal', animation: 'fade' }}
          />

        </>
      )}
    </Stack.Navigator>
  );
}
