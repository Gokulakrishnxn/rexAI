import React from 'react';
import { View, Text } from 'tamagui';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TouchableOpacity } from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export function ProfileSetupScreen({ navigation }: Props) {
  const { setOnboarded, user, setUser } = useAuthStore();
  const [loading, setLoading] = React.useState(false);

  const finish = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Profile data is already collected in Signup, 
      // but if we had more fields here we would update them:
      // await supabase.from('users').update({ ... }).eq('id', user.id);

      await setOnboarded(true);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View flex={1} justifyContent="center" alignItems="center" padding="$4" backgroundColor="black">
      <Text fontSize="$8" fontWeight="800" marginBottom="$4" color="white">Profile Setup</Text>
      <Text color="#8E8E93" marginBottom="$6" textAlign="center">
        Your medical profile is being prepared.
      </Text>
      <TouchableOpacity onPress={() => navigation.navigate('QRSetup')}>
        <View backgroundColor="$blue10" padding="$4" borderRadius="$4" marginBottom="$3" width={200} alignItems="center">
          <Text color="white" fontWeight="600">Next: QR Setup</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={finish} disabled={loading}>
        <View backgroundColor="#1C1C1E" padding="$4" borderRadius="$4" width={200} alignItems="center">
          <Text color="white" fontWeight="600">{loading ? 'Saving...' : 'Finish Onboarding'}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}
