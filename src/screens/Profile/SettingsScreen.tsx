import React from 'react';
import { View, Text } from 'tamagui';

export function SettingsScreen() {
  return (
    <View flex={1} backgroundColor="$background" padding="$4">
      <Text fontSize="$6" fontWeight="bold">Settings</Text>
    </View>
  );
}
