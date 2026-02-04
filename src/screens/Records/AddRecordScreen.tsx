import React from 'react';
import { View, Text } from 'tamagui';

export function AddRecordScreen() {
  return (
    <View flex={1} justifyContent="center" alignItems="center" backgroundColor="$background" padding="$4">
      <Text fontSize="$6" fontWeight="bold">Add Record</Text>
      <Text color="$color" marginTop="$2">Sheet + camera + extraction</Text>
    </View>
  );
}
