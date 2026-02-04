import React from 'react';
import { View, Text } from 'tamagui';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TouchableOpacity } from 'react-native';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export function WelcomeScreen({ navigation }: Props) {
  return (
    <View flex={1} justifyContent="center" alignItems="center" padding="$4" backgroundColor="$background">
      <Text fontSize="$8" fontWeight="bold" marginBottom="$4">Rex Healthify</Text>
      <Text color="$color" marginBottom="$6" textAlign="center">
        Your health records and emergency info, always with you.
      </Text>
      <TouchableOpacity onPress={() => navigation.navigate('Permissions')}>
        <View backgroundColor="$blue10" padding="$4" borderRadius="$4">
          <Text color="white" fontWeight="600">Get Started</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}
