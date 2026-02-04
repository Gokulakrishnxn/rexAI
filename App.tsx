import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { TamaguiProvider, ToastProvider, ToastViewport } from 'tamagui';
import { PortalProvider } from '@tamagui/portal';
import { NavigationContainer } from '@react-navigation/native';
import config from './tamagui.config';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <TamaguiProvider config={config} defaultTheme="dark">
        <PortalProvider>
          <ToastProvider>
            <NavigationContainer>
              <AppNavigator />
            </NavigationContainer>

            <ToastViewport
              top="$4"
              left={0}
              right={0}
              alignItems="center"
            />
            <StatusBar style="light" />
          </ToastProvider>
        </PortalProvider>
      </TamaguiProvider>
    </ErrorBoundary>
  );
}
