import React from 'react';
import { View, Text } from 'tamagui';

export function VoiceAssistantScreen() {
  return (
    <View flex={1} backgroundColor="$background" padding="$4" justifyContent="center">
      <Text fontSize="$6" fontWeight="bold">Voice Assistant</Text>
    </View>
  );
}
