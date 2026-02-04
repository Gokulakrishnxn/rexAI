import React from 'react';
import { View, Text } from 'tamagui';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TouchableOpacity } from 'react-native';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export function PermissionsScreen({ navigation }: Props) {
  return (
    <View flex={1} justifyContent="center" alignItems="center" padding="$4" backgroundColor="$background">
      <Text fontSize="$6" fontWeight="bold" marginBottom="$4">Permissions</Text>
      <Text color="$color" marginBottom="$6" textAlign="center">
        Allow camera for document capture and notifications for medication reminders.
      </Text>
      <TouchableOpacity onPress={() => navigation.navigate('ProfileSetup')}>
        <View backgroundColor="$blue10" padding="$4" borderRadius="$4">
          <Text color="white" fontWeight="600">Continue</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}
