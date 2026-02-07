import React, { useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { YStack, XStack, Card, Text, Button, ScrollView } from 'tamagui';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import type { TimelineEvent } from '../../types/timeline';
import { useTimelineStore } from '../../store/useTimelineStore';
import type { HomeStackParamList } from '../../navigation/stacks/HomeStack';

type NavigationProp = NativeStackNavigationProp<HomeStackParamList, 'Timeline'>;

function getIconForType(type: TimelineEvent['type']) {
  switch (type) {
    case 'appointment':
      return 'calendar';
    case 'plate_scan':
      return 'nutrition';
    case 'soap_note':
      return 'document-text';
    case 'emergency':
      return 'warning';
    case 'chat':
      return 'chatbubble';
    default:
      return 'ellipse';
  }
}

export function TimelineScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { events, loadEvents, getRecentEvents } = useTimelineStore();

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const sortedEvents = getRecentEvents(100);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      <YStack flex={1} backgroundColor="#000000">
        <XStack paddingHorizontal="$4" paddingVertical="$3" alignItems="center">
          <Button
            size="$3"
            circular
            chromeless
            icon={<Ionicons name="arrow-back" size={24} color="white" />}
            onPress={() => navigation.goBack()}
          />
          <Text fontSize="$6" fontWeight="700" color="white" marginLeft="$2">
            Health Timeline
          </Text>
        </XStack>

        <ScrollView flex={1} paddingHorizontal="$4" paddingBottom="$8">
          {sortedEvents.length === 0 ? (
            <YStack padding="$8" alignItems="center">
              <Ionicons name="time" size={48} color="#8E8E93" />
              <Text fontSize="$4" color="#8E8E93" marginTop="$3" textAlign="center">
                No events yet. Book appointments, scan plates, or generate SOAP notes to see them here.
              </Text>
            </YStack>
          ) : (
            <YStack gap="$3" paddingBottom="$6">
              {sortedEvents.map((event) => (
                <Card
                  key={event.id}
                  backgroundColor="#1C1C1E"
                  borderRadius="$6"
                  padding="$4"
                  borderWidth={1}
                  borderColor="#2C2C2E"
                >
                  <XStack gap="$3" alignItems="flex-start">
                    <XStack
                      width={44}
                      height={44}
                      borderRadius="$4"
                      backgroundColor="#2C2C2E"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Ionicons name={getIconForType(event.type) as any} size={22} color="#3B82F6" />
                    </XStack>
                    <YStack flex={1} gap="$1">
                      <Text fontSize="$4" fontWeight="600" color="white">
                        {event.title}
                      </Text>
                      {event.summary ? (
                        <Text fontSize="$3" color="#8E8E93" numberOfLines={2}>
                          {event.summary}
                        </Text>
                      ) : null}
                      <Text fontSize="$2" color="#6B7280">
                        {format(new Date(event.timestamp), 'MMM d, h:mm a')}
                      </Text>
                    </YStack>
                  </XStack>
                </Card>
              ))}
            </YStack>
          )}
        </ScrollView>
      </YStack>
    </SafeAreaView>
  );
}
