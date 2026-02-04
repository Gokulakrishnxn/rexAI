import React from 'react';
import { View, Text } from 'tamagui';

export function EmergencyModeScreen() {
  return (
    <View flex={1} justifyContent="center" alignItems="center" backgroundColor="$red9" padding="$4">
      <Text fontSize="$8" fontWeight="bold" color="white">Emergency Mode</Text>
      <Text color="white" marginTop="$2">Full-screen emergency info + QR</Text>
    </View>
  );
}
