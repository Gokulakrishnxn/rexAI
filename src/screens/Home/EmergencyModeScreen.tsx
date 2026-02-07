import React, { useState, useEffect } from 'react';
import { Linking, Platform, Share, useWindowDimensions } from 'react-native';
import { ScrollView, YStack, XStack, Text, Button, Card, Separator, H2, H4, Paragraph } from 'tamagui';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EMERGENCY_PROTOCOLS, EmergencyProtocol } from '../../constants/emergencyProtocols';
import { useEmergencyStore } from '../../store/useEmergencyStore';
import { useTimelineStore } from '../../store/useTimelineStore';

export function EmergencyModeScreen() {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const [selectedProtocol, setSelectedProtocol] = useState<EmergencyProtocol | null>(null);
  const { primaryContactName, primaryContactPhone, loadContact } = useEmergencyStore();
  const addTimelineEvent = useTimelineStore((s) => s.addEvent);

  useEffect(() => {
    loadContact();
  }, []);

  const handleCallEmergency = () => {
    // Default to 112 (common emergency number) or 911 if no specific contact.
    // In a real app, you might want to call the actual emergency services.
    // Here we prioritize the caretaker if set, otherwise fallback.
    const numberToCall = primaryContactPhone || '112';

    Linking.openURL(`tel:${numberToCall}`).catch(err =>
      console.error('Error launching dialer', err)
    );

    addTimelineEvent({
      id: Date.now().toString(),
      type: 'emergency',
      title: 'Emergency Call Initiated',
      summary: `Called ${primaryContactName || 'Emergency Services'}`,
      timestamp: new Date().toISOString(),
      source: 'manual',
    });
  };

  const handleShareQR = async () => {
    try {
      // In a real app, this would generate a deep link or share an image.
      // For now, we share a text message with a mock link.
      await Share.share({
        message: 'I am in an emergency! Here is my medical profile: https://rex.ai/u/my-profile',
      });

      addTimelineEvent({
        id: Date.now().toString(),
        type: 'emergency',
        title: 'Emergency Info Shared',
        summary: 'Shared medical QR link',
        timestamp: new Date().toISOString(),
        source: 'manual',
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleSelectProtocol = (protocol: EmergencyProtocol) => {
    setSelectedProtocol(protocol);
    addTimelineEvent({
      id: Date.now().toString(),
      type: 'emergency',
      title: 'Emergency Protocol Triggered',
      summary: `Viewed protocol: ${protocol.title}`,
      timestamp: new Date().toISOString(),
      source: 'manual',
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1C1C1E' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <YStack padding="$4" gap="$2">
          <XStack justifyContent="space-between" alignItems="center">
            <H2 color="$red10" fontWeight="bold">EMERGENCY MODE</H2>
            <Button
              size="$3"
              circular
              chromeless
              onPress={() => navigation.goBack()}
              icon={<Ionicons name="close" size={28} color="white" />}
            />
          </XStack>
          <Text color="$gray11">
            Golden Hour Protocol • Offline Ready
          </Text>
        </YStack>

        <Separator borderColor="$gray6" />

        {/* Main Actions */}
        <YStack padding="$4" gap="$4">
          <Button
            size="$5"
            backgroundColor="$red10"
            pressStyle={{ backgroundColor: '$red9' }}
            height={80}
            onPress={handleCallEmergency}
            icon={<Ionicons name="call" size={32} color="white" />}
          >
            <YStack alignItems="center">
              <Text color="white" fontSize="$5" fontWeight="bold">
                CALL NOW
              </Text>
              <Text color="white" fontSize="$3">
                {primaryContactName ? `Call ${primaryContactName}` : 'Call Emergency Services'}
              </Text>
            </YStack>
          </Button>

          <Button
            size="$4"
            theme="active" // Changed from "gray" to valid theme or remove
            onPress={handleShareQR}
            icon={<Ionicons name="qr-code" size={24} color="white" />}
          >
            Share My Medical Card
          </Button>
        </YStack>

        <Separator borderColor="$gray6" />

        {/* Protocol Selector */}
        {!selectedProtocol ? (
          <YStack padding="$4" gap="$3">
            <H4 color="white" marginBottom="$2">Select Emergency Type</H4>
            <XStack flexWrap="wrap" gap="$3">
              {EMERGENCY_PROTOCOLS.map((p) => (
                <Card
                  key={p.id}
                  width={(width - 48) / 2}
                  height={120}
                  padding="$3"
                  borderWidth={1}
                  borderColor="$gray6"
                  pressStyle={{ borderColor: p.color, borderWidth: 2 }}
                  onPress={() => handleSelectProtocol(p)}
                  justifyContent="space-between"
                >
                  <Ionicons
                    name="medical"
                    size={32}
                    color={String(p.color).replace('$', '')} // simplifying for demo, Tamagui handles $ tokens usually but verify
                  />
                  <Text color="white" fontWeight="bold" fontSize="$4">
                    {p.title}
                  </Text>
                </Card>
              ))}
            </XStack>
          </YStack>
        ) : (
          <YStack padding="$4" gap="$4">
            <XStack justifyContent="space-between" alignItems="center">
              <H2 color={selectedProtocol.color as any}>{selectedProtocol.title}</H2>
              <Button size="$3" chromeless onPress={() => setSelectedProtocol(null)}>
                Change
              </Button>
            </XStack>


            <Card borderWidth={1} borderColor="$gray6" backgroundColor="$gray3" padding="$4">
              <H4 color="white" marginBottom="$2">Signs & Symptoms</H4>
              {selectedProtocol.symptoms.map((s, i) => (
                <XStack key={i} gap="$2" marginBottom="$1">
                  <Ionicons name="alert-circle" size={18} color="#FFD60A" />
                  <Text color="white">{s}</Text>
                </XStack>
              ))}
            </Card>

            <Card borderWidth={1} borderColor="$gray6" backgroundColor="$gray3" padding="$4">
              <H4 color="white" marginBottom="$2">Immediate Actions</H4>
              {selectedProtocol.doNowSteps.map((step, i) => (
                <XStack key={i} gap="$3" marginBottom="$3">
                  <Text color="white" fontWeight="bold" fontSize="$5">{i + 1}</Text>
                  <Text color="white" fontSize="$4" flex={1}>{step}</Text>
                </XStack>
              ))}
            </Card>

            <Button
              size="$5"
              backgroundColor={selectedProtocol.color as any}
              onPress={handleCallEmergency}
              marginTop="$2"
            >
              <Text color="white" fontWeight="bold" fontSize="$5">
                {selectedProtocol.callActionText}
              </Text>
            </Button>

          </YStack>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
