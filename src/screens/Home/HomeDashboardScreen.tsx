import React, { useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  YStack,
  XStack,
  Card,
  Text,
  Button,
  Checkbox,
} from 'tamagui';
import { Dimensions } from 'react-native';
import { ScrollView } from '@/components/ui/scroll-view';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { HeaderWave } from '@/components/ui/HeaderWave';
import { ResponsiveContainer } from '@/components/ui/ResponsiveContainer';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertCircle, CheckCircle2, Info, ArrowRight, Pill, Calendar } from 'lucide-react-native';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import Animated from 'react-native-reanimated';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { useUserStore } from '../../store/useUserStore';
import { useMedAgentStore } from '../../store/useMedAgentStore';
import { useQRStore } from '../../store/useQRStore';
import { useCalendarStore } from '../../store/useCalendarStore';
import { generateQRData } from '../../services/qrService';
import type { RootStackParamList } from '../../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface ActivityItem {
  id: string;
  time: string;
  description: string;
}

export function HomeDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { profile, setProfile } = useUserStore();
  const { activeMeds, compliance, markTaken } = useMedAgentStore();
  const { currentQR, setCurrentQR } = useQRStore();
  const { appointments, loadAppointments } = useCalendarStore();

  React.useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const { width: windowWidth } = Dimensions.get('window');
  const insightCardWidth = windowWidth * 0.8;

  // Initialize mock user data if none exists (for demo)
  React.useEffect(() => {
    if (!profile) {
      setProfile({
        id: '1',
        name: 'Alex',
        bloodType: 'O+',
        allergies: ['Penicillin', 'Peanuts'],
        emergencyContact: '+1 (555) 123-4567',
      });
    }
  }, [profile, setProfile]);

  // Generate greeting based on time
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Sync QR data when profile is available
  React.useEffect(() => {
    if (profile && !currentQR?.fullUrl) {
      setCurrentQR(generateQRData(profile));
    }
  }, [profile, currentQR?.fullUrl, setCurrentQR]);


  // Today's medications (mock data if none)
  const todaysMeds = useMemo(() => {
    if (activeMeds.length > 0) {
      return activeMeds.slice(0, 4).map((med) => ({
        ...med,
        time: 'Morning',
        taken: compliance[med.id] || false,
      }));
    }
    return [
      { id: '1', name: 'Metformin', dosage: '500mg', frequency: 'Twice daily', time: 'Morning', taken: false },
      { id: '2', name: 'Aspirin', dosage: '81mg', frequency: 'Once daily', time: 'Evening', taken: false },
    ];
  }, [activeMeds, compliance]);

  // AI Insights (mock data)
  const insights = [
    {
      id: '1',
      title: 'Glucose trend rising',
      message: 'Consider low-GI lunch options today',
      variant: 'warning' as const,
    },
    {
      id: '2',
      title: 'Medication compliance excellent',
      message: 'You\'ve taken all medications on time this week',
      variant: 'success' as const,
    },
  ];


  // Next upcoming appointment (from calendar store)
  const nextAppointment = useMemo(() => {
    const now = new Date().toISOString();
    const upcoming = appointments
      .filter((a) => a.datetime >= now)
      .sort((a, b) => a.datetime.localeCompare(b.datetime));
    return upcoming[0] ?? null;
  }, [appointments]);

  // Recent Activity (mock data)
  const activities: ActivityItem[] = [
    { id: '1', time: '8:00 AM', description: 'Medication taken' },
    { id: '2', time: 'Yesterday', description: 'Lab report added' },
    { id: '3', time: '2 days ago', description: 'Prescription updated' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <ResponsiveContainer>
          {/* Header Greeting Card with Blue Wave */}
          <YStack
            margin="$4"
            borderRadius="$12"
            position="relative"
            backgroundColor="#003B7D"
            overflow="hidden"
            shadowColor="rgba(0,0,0,0.3)"
            shadowOffset={{ width: 0, height: 10 }}
            shadowOpacity={0.2}
            shadowRadius={20}
            elevation={5}
          >
            <HeaderWave height={200} />
            <YStack paddingTop="$8" paddingHorizontal="$6" paddingBottom="$7" zIndex={1}>
              <XStack alignItems="center" justifyContent="space-between">
                <YStack flex={1}>
                  <Text fontSize="$3" fontWeight="600" color="rgba(255, 255, 255, 0.7)" textTransform="uppercase" letterSpacing={1.2}>
                    {greeting}
                  </Text>
                  <Text fontSize="$9" fontWeight="800" color="#FFFFFF" marginTop="$1" letterSpacing={-0.5}>
                    {profile?.name || 'Alex'} 👋
                  </Text>
                </YStack>
                <Avatar size={52} style={{ borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.4)' }}>
                  <AvatarImage source={{ uri: undefined }} />
                  <AvatarFallback>
                    {profile?.name?.charAt(0).toUpperCase() || 'A'}
                  </AvatarFallback>
                </Avatar>
              </XStack>
            </YStack>
          </YStack>


          {/* Upcoming Appointment */}
          {nextAppointment && (
            <YStack paddingHorizontal="$6" paddingTop="$4" paddingBottom="$2">
              <XStack alignItems="center" gap="$2" marginBottom="$3">
                <Calendar size={22} color="#007AFF" />
                <Text fontSize="$7" fontWeight="700" color="$color" letterSpacing={-0.5}>
                  Upcoming Appointment
                </Text>
              </XStack>
              <Card
                padding="$4"
                borderRadius="$9"
                backgroundColor="$muted"
                borderWidth={1}
                borderColor="$border"
              >
                <YStack gap="$2">
                  <Text fontSize="$5" fontWeight="600" color="$color">
                    {nextAppointment.specialty}
                  </Text>
                  <Text fontSize="$3" color="$mutedForeground">
                    {format(new Date(nextAppointment.datetime), 'EEE, MMM d · h a')}
                  </Text>
                </YStack>
              </Card>
            </YStack>
          )}

          {/* Today's Medications */}
          <YStack paddingHorizontal="$6" paddingTop="$6" paddingBottom="$2">
            <XStack justifyContent="space-between" alignItems="center" marginBottom="$4">
              <XStack alignItems="center" gap="$2">
                <Pill size={22} color="$blue10" />
                <Text fontSize="$7" fontWeight="700" color="$color" letterSpacing={-0.5}>
                  Medications
                </Text>
              </XStack>
              <Button
                size="$2"
                borderRadius="$full"
                backgroundColor="$blue10"
                pressStyle={{ backgroundColor: '$blue11', scale: 0.95 }}
              >
                <Text fontSize="$2" fontWeight="700" color="white">VIEW ALL</Text>
              </Button>
            </XStack>

            {todaysMeds.length > 0 ? (
              <XStack flexWrap="wrap" marginHorizontal="$-2" paddingBottom="$2">
                {todaysMeds.map((med, index) => {
                  const animationStyle = useEntranceAnimation(index, 100);
                  return (
                    <YStack
                      key={med.id}
                      padding="$2"
                      width="100%"
                      $gtSm={{ width: '50%' }}
                    >
                      <Animated.View style={animationStyle}>
                        <Card
                          padding="$4"
                          borderRadius="$9"
                          backgroundColor="$muted"
                          pressStyle={{ scale: 0.98, backgroundColor: '$background' }}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            markTaken(med.id);
                          }}
                        >
                          <XStack alignItems="center" gap="$4">
                            <Checkbox
                              checked={med.taken}
                              onCheckedChange={() => markTaken(med.id)}
                              size="$6"
                              borderRadius="$full"
                              backgroundColor={med.taken ? '$healthSuccess' : 'transparent'}
                              borderColor={med.taken ? '$healthSuccess' : '$border'}
                            >
                              <Checkbox.Indicator>
                                <CheckCircle2 size={18} color="white" />
                              </Checkbox.Indicator>
                            </Checkbox>
                            <YStack flex={1} gap="$1">
                              <XStack alignItems="center" gap="$2">
                                <Text fontSize="$5" fontWeight="600" color={med.taken ? '$mutedForeground' : '$color'} textDecorationLine={med.taken ? 'line-through' : 'none'}>
                                  {med.name}
                                </Text>
                                <XStack
                                  paddingHorizontal="$2"
                                  paddingVertical="$0.5"
                                  borderRadius="$full"
                                  backgroundColor="$blue10"
                                >
                                  <Text fontSize="$1" fontWeight="700" color="white">
                                    {med.time}
                                  </Text>
                                </XStack>
                              </XStack>
                              <Text fontSize="$3" color="$mutedForeground">
                                {med.dosage} • {med.frequency}
                              </Text>
                            </YStack>
                            {med.taken && (
                              <CheckCircle2 size={24} color="#32D74B" />
                            )}
                          </XStack>
                        </Card>
                      </Animated.View>
                    </YStack>
                  );
                })}
              </XStack>
            ) : (
              <Card
                padding="$8"
                borderRadius="$6"
                backgroundColor="$muted"
                alignItems="center"
                borderStyle="dashed"
              >
                <Info size={32} color="#8E8E93" />
                <Text fontSize="$4" fontWeight="500" color="$mutedForeground" marginTop="$3" textAlign="center">
                  All caught up for today
                </Text>
              </Card>
            )}
          </YStack>

          {/* AI Insights - Adaptive Layout */}
          {insights.length > 0 && (
            <YStack paddingHorizontal="$6" paddingTop="$6" paddingBottom="$2">
              <Text fontSize="$7" fontWeight="700" color="$color" marginBottom="$4" letterSpacing={-0.5}>
                AI Health Briefing
              </Text>

              {/* Mobile: Horizontal Scroll */}
              <YStack $gtSm={{ display: 'none' }}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 16, paddingRight: 24 }}
                  snapToInterval={insightCardWidth + 16}
                  decelerationRate="fast"
                >
                  {insights.map((insight, index) => {
                    const animationStyle = useEntranceAnimation(index, 150);
                    return (
                      <Animated.View key={`scroll-${insight.id}`} style={animationStyle}>
                        <Card
                          width={insightCardWidth}
                          padding="$5"
                          borderRadius="$9"
                          backgroundColor="$muted"
                          onPress={() => Haptics.selectionAsync()}
                        >
                          <YStack gap="$3">
                            <XStack alignItems="center" justifyContent="space-between">
                              {insight.variant === 'success' ? <CheckCircle2 size={20} color="#32D74B" /> :
                                insight.variant === 'warning' ? <AlertCircle size={20} color="#FF9F0A" /> :
                                  <Info size={20} color="#FFFFFF" />}
                              <ArrowRight size={16} color="#8E8E93" />
                            </XStack>
                            <YStack gap="$1">
                              <Text fontSize="$5" fontWeight="700" color="$color">
                                {insight.title}
                              </Text>
                              <Text fontSize="$3" color="$mutedForeground" lineHeight={20}>
                                {insight.message}
                              </Text>
                            </YStack>
                          </YStack>
                        </Card>
                      </Animated.View>
                    );
                  })}
                </ScrollView>
              </YStack>

              {/* Desktop/Tablet: Grid */}
              <XStack
                display="none"
                $gtSm={{ display: 'flex', flexWrap: 'wrap' }}
                marginHorizontal="$-2"
              >
                {insights.map((insight, index) => {
                  const animationStyle = useEntranceAnimation(index, 150);
                  return (
                    <YStack key={`grid-${insight.id}`} padding="$2" width="50%">
                      <Animated.View style={animationStyle}>
                        <Card
                          padding="$5"
                          borderRadius="$9"
                          backgroundColor="$muted"
                          onPress={() => Haptics.selectionAsync()}
                        >
                          <YStack gap="$3">
                            <XStack alignItems="center" justifyContent="space-between">
                              {insight.variant === 'success' ? <CheckCircle2 size={20} color="#32D74B" /> :
                                insight.variant === 'warning' ? <AlertCircle size={20} color="#FF9F0A" /> :
                                  <Info size={20} color="#FFFFFF" />}
                              <ArrowRight size={16} color="#8E8E93" />
                            </XStack>
                            <YStack gap="$1">
                              <Text fontSize="$5" fontWeight="700" color="$color">
                                {insight.title}
                              </Text>
                              <Text fontSize="$3" color="$mutedForeground" lineHeight={20}>
                                {insight.message}
                              </Text>
                            </YStack>
                          </YStack>
                        </Card>
                      </Animated.View>
                    </YStack>
                  );
                })}
              </XStack>
            </YStack>
          )}


          {/* Recent Activity */}
          {activities.length > 0 && (
            <YStack paddingHorizontal="$6" paddingTop="$6" paddingBottom="$8">
              <Text fontSize="$7" fontWeight="700" color="$color" marginBottom="$4" letterSpacing={-0.5}>
                Timeline
              </Text>
              <YStack gap="$0">
                {activities.map((activity, index) => (
                  <XStack key={activity.id} gap="$4" paddingVertical="$3">
                    <YStack alignItems="center">
                      <XStack
                        width={12}
                        height={12}
                        borderRadius="$full"
                        backgroundColor={index === 0 ? '$color' : '$muted'}
                        borderWidth={2}
                        borderColor={index === 0 ? '$color' : '$border'}
                        marginTop="$1.5"
                      />
                      {index < activities.length - 1 && (
                        <XStack width={2} flex={1} backgroundColor="$border" marginVertical="$1" />
                      )}
                    </YStack>
                    <YStack flex={1} gap="$0.5">
                      <XStack justifyContent="space-between">
                        <Text fontSize="$4" fontWeight="600" color="$color">
                          {activity.description}
                        </Text>
                        <Text fontSize="$2" fontWeight="500" color="$mutedForeground">
                          {activity.time}
                        </Text>
                      </XStack>
                    </YStack>
                  </XStack>
                ))}
              </YStack>
            </YStack>
          )}
        </ResponsiveContainer>
      </ScrollView>
    </SafeAreaView>
  );
}
