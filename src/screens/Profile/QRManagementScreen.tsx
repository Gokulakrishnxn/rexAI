import React from 'react';
import { View, Text } from 'tamagui';

export function QRManagementScreen() {
  return (
    <View flex={1} backgroundColor="$background" padding="$4">
      <Text fontSize="$6" fontWeight="bold">QR Management</Text>
      <Text color="$color" marginTop="$2">Generate + download QRs</Text>
    </View>
  );
}
