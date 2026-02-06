import React, { useState } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated from 'react-native-reanimated';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { ScrollView } from '@/components/ui/scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  YStack,
  XStack,
  Card,
  Text,
  Button,
  Accordion,
  Switch,
  Dialog,
} from 'tamagui';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ResponsiveContainer } from '@/components/ui/ResponsiveContainer';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { useMedAgentStore } from '../../store/useMedAgentStore';
import { useQRStore } from '../../store/useQRStore';
import { QRDisplay } from '../../components/qr/QRDisplay';
import { generateQRData } from '../../services/qrService';

export function ProfileScreen() {
  const { user: profile } = useAuthStore();
  const { activeMeds } = useMedAgentStore();
  const { currentQR, setCurrentQR } = useQRStore();
  const { signOut } = useAuthStore();
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [dataSyncEnabled, setDataSyncEnabled] = useState(true);

  // Generate QR codes
  const emergencyQR = currentQR?.fullUrl || (profile ? generateQRData(profile).fullUrl : '');
  const fullRecordsQR = emergencyQR; // In real app, this would be different

  const handleRegenerateQR = () => {
    if (profile) {
      const newQR = generateQRData(profile);
      setCurrentQR(newQR);
      setShowRegenerateDialog(false);
      Alert.alert('Success', 'QR codes regenerated successfully');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            signOut();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <ResponsiveContainer maxWidth={1000}>
          <YStack padding="$4" gap="$6">
            {/* Profile Header */}
            <Animated.View style={useEntranceAnimation(0, 100)}>
              <Card
                padding="$5"
                borderRadius="$9"
                backgroundColor="$background"
              >
                <XStack alignItems="center" gap="$4">
                  <Avatar size={64}>
                    <AvatarImage source={{ uri: undefined }} />
                    <AvatarFallback>
                      {profile?.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <YStack flex={1} gap="$1">
                    <Text fontSize="$7" fontWeight="700" color="$color">
                      {profile?.name || 'User'}
                    </Text>
                    <Text fontSize="$4" color="$color10">
                      {profile?.blood_group ? `Health ID: ${profile.blood_group}` : 'No Health ID set'}
                    </Text>
                  </YStack>
                  <Button
                    size="$3"
                    borderRadius="$4"
                    backgroundColor="transparent"
                    icon={<Ionicons name="pencil" size={16} color="#64748B" />}
                  >
                    <Text fontSize="$3" color="$color">
                      Edit
                    </Text>
                  </Button>
                </XStack>
              </Card>
            </Animated.View>

            {/* Personal Info Card */}
            <Animated.View style={useEntranceAnimation(1, 100)}>
              <Card
                padding="$4"
                borderRadius="$8"
                backgroundColor="$background"
                pressStyle={{ opacity: 0.8 }}
                onPress={() => Haptics.selectionAsync()}
              >
                <XStack alignItems="center" justifyContent="space-between">
                  <YStack gap="$2">
                    <Text fontSize="$5" fontWeight="700" color="$color">
                      Personal Information
                    </Text>
                    <YStack gap="$1">
                      <XStack alignItems="center" gap="$2">
                        <Ionicons name="calendar" size={16} color="#64748B" />
                        <Text fontSize="$3" color="$color10">
                          Age: {profile?.age || 'Not set'}
                        </Text>
                      </XStack>
                      {profile?.blood_group && (
                        <XStack alignItems="center" gap="$2">
                          <Ionicons name="water" size={16} color="#64748B" />
                          <Text fontSize="$3" color="$color10">
                            Blood Group: {profile.blood_group}
                          </Text>
                        </XStack>
                      )}
                      {profile?.emergency_contact && (
                        <XStack alignItems="center" gap="$2">
                          <Ionicons name="call" size={16} color="#64748B" />
                          <Text fontSize="$3" color="$color10">
                            Emergency: {profile.emergency_contact}
                          </Text>
                        </XStack>
                      )}
                    </YStack>
                  </YStack>
                  <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                </XStack>
              </Card>
            </Animated.View>

            {/* QR Health Card Section */}
            <Animated.View style={useEntranceAnimation(2, 100)}>
              <Card
                padding="$4"
                borderRadius="$8"
                backgroundColor="$background"
              >
                <Text fontSize="$6" fontWeight="700" color="$color" marginBottom="$4">
                  My QR Health Card
                </Text>

                <YStack gap="$4">
                  {/* Emergency QR */}
                  <YStack alignItems="center" gap="$3">
                    <Text fontSize="$4" fontWeight="600" color="$color">
                      Emergency QR
                    </Text>
                    <Card
                      padding="$4"
                      borderRadius="$8"
                      backgroundColor="white"
                      borderWidth={2}
                      borderColor="$red9"
                      alignItems="center"
                    >
                      <QRDisplay value={emergencyQR} size={160} />
                      <Text fontSize="$2" color="$color10" marginTop="$2" textAlign="center">
                        Show to first responders
                      </Text>
                    </Card>
                  </YStack>

                  {/* Full Records QR */}
                  <YStack alignItems="center" gap="$3">
                    <Text fontSize="$4" fontWeight="600" color="$color">
                      Full Records QR
                    </Text>
                    <Card
                      padding="$4"
                      borderRadius="$8"
                      backgroundColor="white"
                      alignItems="center"
                    >
                      <QRDisplay value={fullRecordsQR} size={160} />
                      <Text fontSize="$2" color="$color10" marginTop="$2" textAlign="center">
                        Complete medical history
                      </Text>
                    </Card>
                  </YStack>

                  {/* QR Actions */}
                  <XStack gap="$2" flexWrap="wrap">
                    <Button
                      flex={1}
                      size="$4"
                      borderRadius="$8"
                      backgroundColor="$blue10"
                      minWidth={120}
                    >
                      <Text fontSize="$3" fontWeight="600" color="white">
                        View Full Size
                      </Text>
                    </Button>
                    <Button
                      flex={1}
                      size="$4"
                      borderRadius="$8"
                      backgroundColor="transparent"
                      borderWidth={1}
                      borderColor="$borderColor"
                      minWidth={120}
                    >
                      <Text fontSize="$3" fontWeight="600" color="$color">
                        Download
                      </Text>
                    </Button>
                    <Button
                      flex={1}
                      size="$4"
                      borderRadius="$8"
                      backgroundColor="transparent"
                      minWidth={120}
                      onPress={() => setShowRegenerateDialog(true)}
                    >
                      <Text fontSize="$3" fontWeight="600" color="$red9">
                        Regenerate
                      </Text>
                    </Button>
                  </XStack>
                </YStack>
              </Card>
            </Animated.View>

            {/* Accordion Sections */}
            <Animated.View style={useEntranceAnimation(3, 100)}>
              <Accordion type="multiple" width="100%">
                {/* Active Medications */}
                <Accordion.Item value="medications">
                  <Accordion.Trigger
                    flexDirection="row"
                    justifyContent="space-between"
                    padding="$4"
                    borderRadius="$8"
                    backgroundColor="$background"
                    borderWidth={1}
                    borderColor="$borderColor"
                  >
                    <XStack alignItems="center" gap="$3">
                      <Ionicons name="medical" size={20} color="#007AFF" />
                      <Text fontSize="$5" fontWeight="600" color="$color">
                        Active Medications
                      </Text>
                    </XStack>
                    <Accordion.Content>
                      <Ionicons name="chevron-down" size={20} color="#64748B" />
                    </Accordion.Content>
                  </Accordion.Trigger>
                  <Accordion.Content padding="$4" backgroundColor="$gray1">
                    <YStack gap="$3">
                      {activeMeds.length > 0 ? (
                        activeMeds.map((med) => (
                          <XStack
                            key={med.id}
                            alignItems="center"
                            justifyContent="space-between"
                            padding="$3"
                            borderRadius="$6"
                            backgroundColor="$background"
                          >
                            <YStack>
                              <Text fontSize="$4" fontWeight="600" color="$color">
                                {med.name}
                              </Text>
                              <Text fontSize="$3" color="$color10">
                                {med.dosage} • {med.frequency}
                              </Text>
                            </YStack>
                            <Text fontSize="$3" color="$blue10" fontWeight="600">
                              {med.time_of_day || 'Scheduled'}
                            </Text>
                          </XStack>
                        ))
                      ) : (
                        <Text fontSize="$4" color="$color10" textAlign="center" padding="$4">
                          No active medications
                        </Text>
                      )}
                    </YStack>
                  </Accordion.Content>
                </Accordion.Item>

                {/* Data & Privacy */}
                <Accordion.Item value="privacy" marginTop="$3">
                  <Accordion.Trigger
                    flexDirection="row"
                    justifyContent="space-between"
                    padding="$4"
                    borderRadius="$8"
                    backgroundColor="$background"
                    borderWidth={1}
                    borderColor="$borderColor"
                  >
                    <XStack alignItems="center" gap="$3">
                      <Ionicons name="lock-closed" size={20} color="#007AFF" />
                      <Text fontSize="$5" fontWeight="600" color="$color">
                        Data & Privacy
                      </Text>
                    </XStack>
                    <Accordion.Content>
                      <Ionicons name="chevron-down" size={20} color="#64748B" />
                    </Accordion.Content>
                  </Accordion.Trigger>
                  <Accordion.Content padding="$4" backgroundColor="$gray1">
                    <YStack gap="$4">
                      <XStack alignItems="center" justifyContent="space-between">
                        <YStack flex={1}>
                          <Text fontSize="$4" fontWeight="600" color="$color">
                            Cloud Sync
                          </Text>
                          <Text fontSize="$3" color="$color10">
                            Sync data across devices
                          </Text>
                        </YStack>
                        <Switch
                          checked={dataSyncEnabled}
                          onCheckedChange={setDataSyncEnabled}
                          size="$4"
                        />
                      </XStack>
                      <Button
                        size="$4"
                        borderRadius="$8"
                        backgroundColor="transparent"
                        borderWidth={1}
                        borderColor="$borderColor"
                      >
                        <Text fontSize="$4" fontWeight="600" color="$color">
                          Export All Data
                        </Text>
                      </Button>
                      <Button
                        size="$4"
                        borderRadius="$8"
                        backgroundColor="transparent"
                        borderWidth={1}
                        borderColor="$red9"
                      >
                        <Text fontSize="$4" fontWeight="600" color="$red9">
                          Delete Account
                        </Text>
                      </Button>
                    </YStack>
                  </Accordion.Content>
                </Accordion.Item>

                {/* App Settings */}
                <Accordion.Item value="settings" marginTop="$3">
                  <Accordion.Trigger
                    flexDirection="row"
                    justifyContent="space-between"
                    padding="$4"
                    borderRadius="$8"
                    backgroundColor="$background"
                    borderWidth={1}
                    borderColor="$borderColor"
                  >
                    <XStack alignItems="center" gap="$3">
                      <Ionicons name="settings" size={20} color="#007AFF" />
                      <Text fontSize="$5" fontWeight="600" color="$color">
                        App Settings
                      </Text>
                    </XStack>
                    <Accordion.Content>
                      <Ionicons name="chevron-down" size={20} color="#64748B" />
                    </Accordion.Content>
                  </Accordion.Trigger>
                  <Accordion.Content padding="$4" backgroundColor="$gray1">
                    <YStack gap="$4">
                      <XStack alignItems="center" justifyContent="space-between">
                        <YStack flex={1}>
                          <Text fontSize="$4" fontWeight="600" color="$color">
                            Notifications
                          </Text>
                          <Text fontSize="$3" color="$color10">
                            Medication reminders and alerts
                          </Text>
                        </YStack>
                        <Switch
                          checked={notificationsEnabled}
                          onCheckedChange={setNotificationsEnabled}
                          size="$4"
                        />
                      </XStack>
                      <Button
                        size="$4"
                        borderRadius="$8"
                        backgroundColor="transparent"
                        borderWidth={1}
                        borderColor="$borderColor"
                      >
                        <Text fontSize="$4" fontWeight="600" color="$color">
                          Language: English
                        </Text>
                      </Button>
                    </YStack>
                  </Accordion.Content>
                </Accordion.Item>
              </Accordion>
            </Animated.View>

            {/* Logout Button */}
            <Animated.View style={useEntranceAnimation(4, 100)}>
              <Button
                size="$5"
                borderRadius="$9"
                backgroundColor="transparent"
                borderWidth={1.5}
                borderColor="$red9"
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  handleLogout();
                }}
                marginTop="$4"
              >
                <Text fontSize="$5" fontWeight="600" color="$red9">
                  Logout
                </Text>
              </Button>
            </Animated.View>
          </YStack>
        </ResponsiveContainer>
      </ScrollView>

      {/* Regenerate QR Dialog */}
      <Dialog modal open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content
            padding="$5"
            borderRadius="$6"
            backgroundColor="$background"
            borderWidth={1}
            borderColor="$borderColor"
            maxWidth={400}
          >
            <Dialog.Title fontSize="$6" fontWeight="700" color="$color" marginBottom="$3">
              Regenerate QR Codes?
            </Dialog.Title>
            <Dialog.Description fontSize="$4" color="$color10" marginBottom="$4">
              This will invalidate your current QR codes. You'll need to download and print new ones. This action cannot be undone.
            </Dialog.Description>
            <XStack gap="$3" justifyContent="flex-end">
              <Button
                size="$4"
                borderRadius="$5"
                backgroundColor="transparent"
                borderWidth={1}
                borderColor="$borderColor"
                onPress={() => setShowRegenerateDialog(false)}
              >
                <Text fontSize="$4" fontWeight="600" color="$color">
                  Cancel
                </Text>
              </Button>
              <Button
                size="$4"
                borderRadius="$5"
                backgroundColor="$red9"
                onPress={handleRegenerateQR}
              >
                <Text fontSize="$4" fontWeight="600" color="white">
                  Regenerate
                </Text>
              </Button>
            </XStack>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </SafeAreaView>
  );
}
