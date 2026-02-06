import React from 'react';
import { View, YStack, XStack, Text, Button, Card, Circle } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/useAuthStore';
import { useQRStore } from '../../store/useQRStore';
import { QRDisplay } from '../../components/qr/QRDisplay';
import { Linking } from 'react-native';

export function EmergencyModeScreen() {
  const navigation = useNavigation();
  const { user: profile } = useAuthStore();
  const { currentQR } = useQRStore();

  const handleCallEmergency = () => {
    if (profile?.emergency_contact) {
      Linking.openURL(`tel:${profile.emergency_contact}`);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#7F1D1D' }}>
      <YStack flex={1} padding="$4" gap="$4">
        {/* Header */}
        <XStack justifyContent="space-between" alignItems="center">
          <Button
            size="$4"
            circular
            backgroundColor="rgba(255,255,255,0.2)"
            onPress={() => navigation.goBack()}
            icon={<Ionicons name="close" size={24} color="white" />}
          />
          <Text fontSize="$6" fontWeight="bold" color="white">Medical ID</Text>
          <View width={48} />
        </XStack>

        <YStack flex={1} gap="$4" justifyContent="center">
          {/* Main Info Card */}
          <Card backgroundColor="white" padding="$5" borderRadius="$9" elevation={5}>
            <YStack gap="$4" alignItems="center">
              <Circle size={80} backgroundColor="#FEE2E2">
                <Ionicons name="medkit" size={40} color="#7F1D1D" />
              </Circle>

              <YStack alignItems="center" gap="$1">
                <Text fontSize="$8" fontWeight="bold" color="#111827">
                  {profile?.name || 'Emergency Profile'}
                </Text>
                <XStack gap="$2" alignItems="center">
                  <View paddingHorizontal="$3" paddingVertical="$1" backgroundColor="#FEE2E2" borderRadius="$4">
                    <Text color="#7F1D1D" fontWeight="bold">{profile?.blood_group || 'Unknown Blood Group'}</Text>
                  </View>
                </XStack>
              </YStack>

              <YStack width="100%" gap="$3" marginTop="$2">
                <YStack gap="$1">
                  <Text fontSize="$3" fontWeight="bold" color="#6B7280" textTransform="uppercase">Allergies</Text>
                  <Text fontSize="$5" color="#111827" fontWeight="500">
                    {profile?.allergies?.join(', ') || 'No known allergies reported'}
                  </Text>
                </YStack>

                <YStack gap="$1">
                  <Text fontSize="$3" fontWeight="bold" color="#6B7280" textTransform="uppercase">Emergency Contact</Text>
                  <Text fontSize="$5" color="#111827" fontWeight="500">
                    {profile?.emergency_contact || 'None set'}
                  </Text>
                </YStack>
              </YStack>
            </YStack>
          </Card>

          {/* QR Code Section */}
          <Card backgroundColor="white" padding="$5" borderRadius="$9" alignItems="center">
            <Text fontSize="$5" fontWeight="bold" color="#111827" marginBottom="$4">
              Scan for full medical history
            </Text>
            <View padding="$3" backgroundColor="white" borderRadius="$4" borderWidth={1} borderColor="#E5E7EB">
              <QRDisplay value={currentQR?.fullUrl || 'https://rexhealthify.app'} size={180} />
            </View>
            <Text fontSize="$3" color="#6B7280" marginTop="$3" textAlign="center">
              All data is end-to-end encrypted
            </Text>
          </Card>
        </YStack>

        {/* Action Button */}
        <Button
          size="$6"
          backgroundColor="white"
          borderRadius="$9"
          onPress={handleCallEmergency}
          pressStyle={{ scale: 0.98, opacity: 0.9 }}
          icon={<Ionicons name="call" size={24} color="#7F1D1D" />}
        >
          <Text fontSize="$5" fontWeight="bold" color="#7F1D1D">
            Call Emergency Contact
          </Text>
        </Button>
      </YStack>
    </SafeAreaView>
  );
}
