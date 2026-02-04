import React from 'react';
import { View, Text } from 'tamagui';
import { TouchableOpacity } from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';

export function QRSetupScreen() {
  const { setOnboarded, setAuthenticated } = useAuthStore();

  const finish = () => {
    setOnboarded(true);
    setAuthenticated(true);
  };

  return (
    <View flex={1} justifyContent="center" alignItems="center" padding="$4" backgroundColor="$background">
      <Text fontSize="$6" fontWeight="bold" marginBottom="$4">QR Setup</Text>
      <Text color="$color" marginBottom="$6" textAlign="center">
        Generate and download your emergency QR cards.
      </Text>
      <TouchableOpacity onPress={finish}>
        <View backgroundColor="$blue10" padding="$4" borderRadius="$4">
          <Text color="white" fontWeight="600">Done</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}
