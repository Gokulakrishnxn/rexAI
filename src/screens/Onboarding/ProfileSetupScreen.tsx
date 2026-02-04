import React from 'react';
import { View, Text } from 'tamagui';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TouchableOpacity } from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export function ProfileSetupScreen({ navigation }: Props) {
  const { setOnboarded, setAuthenticated } = useAuthStore();

  const finish = () => {
    setOnboarded(true);
    setAuthenticated(true);
  };

  return (
    <View flex={1} justifyContent="center" alignItems="center" padding="$4" backgroundColor="$background">
      <Text fontSize="$6" fontWeight="bold" marginBottom="$4">Profile Setup</Text>
      <Text color="$color" marginBottom="$6" textAlign="center">
        Add your name and emergency details.
      </Text>
      <TouchableOpacity onPress={() => navigation.navigate('QRSetup')}>
        <View backgroundColor="$blue10" padding="$4" borderRadius="$4" marginBottom="$3">
          <Text color="white" fontWeight="600">Next: QR Setup</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={finish}>
        <View backgroundColor="$gray8" padding="$4" borderRadius="$4">
          <Text color="white" fontWeight="600">Skip to App</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}
