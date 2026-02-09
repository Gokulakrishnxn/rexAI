import React, { useMemo, useCallback } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  YStack,
  XStack,
  Card,
  Text,
  Button,
  Checkbox,
} from 'tamagui';
import { Dimensions, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { ScrollView } from '@/components/ui/scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, Plus, Bell, LogOut, ChevronRight, Scan, TrendingUp, Pill, Syringe, ClipboardList, TestTube, Clock, FileText, Sparkles, AlertTriangle, Calendar, Trash2, CalendarDays, Tablets } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated from 'react-native-reanimated';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { useAuthStore } from '../../store/useAuthStore';
import { useMedAgentStore } from '../../store/useMedAgentStore';
import { useQRStore } from '../../store/useQRStore';
import { supabase } from '../../services/supabase';
import { generateQRData } from '../../services/qrService';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { fetchMedicationsList, fetchActivitiesList, analyzeMedication } from '../../services/api/backendApi';
import { scheduleTestNotification } from '../../services/notificationService';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { LinearGradient } from 'expo-linear-gradient';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface ActivityItem {
  id: string;
  time: string;
  description: string;
}

// Medication Card Component
const MedicationCard = React.memo(({ med, index, markTaken }: { med: any, index: number, markTaken: (id: string) => void }) => {
  const animationStyle = useEntranceAnimation(index, 80);

  return (
    <Animated.View style={[animationStyle, { width: '100%', marginBottom: 12 }]}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          markTaken(med.id);
        }}
      >
        <Card
          padding="$4"
          borderRadius="$6"
          backgroundColor="white"
          borderWidth={1}
          borderColor={med.taken ? '#34C759' : '#E5E5EA'}
        >
          <XStack alignItems="center" gap="$3">
            <YStack
              width={44}
              height={44}
              borderRadius={22}
              backgroundColor={med.taken ? '#34C759' : '#007AFF'}
              alignItems="center"
              justifyContent="center"
            >
              {med.taken ? (
                <CheckCircle2 size={24} color="white" />
              ) : (
                <Text fontSize="$6" color="white" fontWeight="bold">💊</Text>
              )}
            </YStack>

            <YStack flex={1} gap="$1">
              <Text
                fontSize="$5"
                fontWeight="700"
                color={med.taken ? '#8E8E93' : '#000000'}
                textDecorationLine={med.taken ? 'line-through' : 'none'}
              >
                {med.drug_name || med.name || 'Medication'}
              </Text>
              <Text fontSize="$3" color="#8E8E93">
                {med.dosage} • {med.frequency_text || med.time_of_day || 'As needed'}
              </Text>
            </YStack>

            <XStack
              paddingHorizontal="$3"
              paddingVertical="$2"
              borderRadius="$9"
              backgroundColor="#007AFF"
            >
              <Text fontSize="$2" fontWeight="700" color="white">
                {med.time_of_day || '9:00 AM'}
              </Text>
            </XStack>
          </XStack>
        </Card>
      </TouchableOpacity>
    </Animated.View>
  );
});

export function HomeDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user: profile, signOut } = useAuthStore();
  const { activeMeds, compliance, markTaken, fetchMedications, deleteMedication } = useMedAgentStore();
  const { currentQR, setCurrentQR } = useQRStore();
  const [activities, setActivities] = React.useState<ActivityItem[]>([]);
  const [loadingActivities, setLoadingActivities] = React.useState(false);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [deletingMedId, setDeletingMedId] = React.useState<string | null>(null);

  const { width: windowWidth } = Dimensions.get('window');

  // Calculate Progress
  const totalMeds = activeMeds.length;
  const completedMeds = activeMeds.filter(m => compliance[m.id]).length;
  const progressPercent = totalMeds > 0 ? Math.round((completedMeds / totalMeds) * 100) : 0;

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const fetchActivities = useCallback(async () => {
    if (!profile?.id) return;
    setLoadingActivities(true);
    try {
      const response = await fetchActivitiesList();

      if (response.success && response.activities) {
        const formatted = response.activities.map((item: any) => ({
          id: item.id,
          time: formatTimeAgo(new Date(item.created_at)),
          description: item.description
        }));
        setActivities(formatted);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoadingActivities(false);
    }
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      if (profile?.id) {
        fetchMedications(profile.id);
        fetchActivities();
      }

      return () => {
        isActive = false;
      };
    }, [profile?.id, fetchMedications, fetchActivities])
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const handleScanPrescription = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      let base64 = asset.base64;
      if (!base64) {
        base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
      }

      // Navigate to analyzing screen
      navigation.navigate('AnalyzingPrescription' as any, {
        imageBase64: base64,
        imageUri: asset.uri,
      });
    } catch (error) {
      console.error('Scan Error:', error);
      alert('Error selecting image.');
    }
  };

  React.useEffect(() => {
    if (profile && !currentQR?.fullUrl) {
      setCurrentQR(generateQRData(profile));
    }
  }, [profile, currentQR?.fullUrl, setCurrentQR]);

  const getMedicationIcon = (index: number) => {
    const icons = [
      { Icon: Pill, color: '#2196F3', bg: '#E3F2FD' },
      { Icon: Tablets, color: '#4CAF50', bg: '#E8F5E9' },
      { Icon: Syringe, color: '#9C27B0', bg: '#F3E5F5' },
      { Icon: TestTube, color: '#FF9800', bg: '#FFF3E0' },
    ];
    return icons[index % icons.length];
  };

  const todaysMeds = useMemo(() => {
    return activeMeds.map((med) => ({
      ...med,
      taken: compliance[med.id] || false,
    }));
  }, [activeMeds, compliance]);

  return (
    <LinearGradient
      colors={['#E8F4FF', '#F5F9FF', '#FFFFFF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.5, y: 0.6 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        {isAnalyzing && (
          <YStack position="absolute" top={0} left={0} right={0} bottom={0} backgroundColor="rgba(0,0,0,0.8)" zIndex={999} justifyContent="center" alignItems="center">
            <ActivityIndicator size="large" color="#007AFF" />
            <Text color="white" fontWeight="bold" marginTop="$4">Analyzing Prescription...</Text>
          </YStack>
        )}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Modern Header - Reference Design */}
          <YStack paddingHorizontal="$4" paddingTop="$4" paddingBottom="$4">
            {/* Top Row: Welcome + Avatar + Bell */}
            <XStack alignItems="center" justifyContent="space-between" marginBottom="$4">
              <XStack alignItems="center" gap="$3">
                <TouchableOpacity
                  onPress={() => {
                    Haptics.selectionAsync();
                    setShowProfileMenu(!showProfileMenu);
                  }}
                >
                  <YStack
                    width={44}
                    height={44}
                    borderRadius={22}
                    backgroundColor="#007AFF"
                    alignItems="center"
                    justifyContent="center"
                    overflow="hidden"
                  >
                    <Text fontSize={18} fontWeight="700" color="white">
                      {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </Text>
                  </YStack>
                </TouchableOpacity>
                <YStack>
                  <Text fontSize={12} color="#8E8E93" fontWeight="400">
                    Welcome back,
                  </Text>
                  <Text fontSize={14} fontWeight="600" color="#1C1C1E">
                    {profile?.name || 'User'}
                  </Text>
                </YStack>
              </XStack>
              <TouchableOpacity onPress={() => Haptics.selectionAsync()}>
                <YStack
                  width={40}
                  height={40}
                  borderRadius={20}
                  backgroundColor="white"
                  alignItems="center"
                  justifyContent="center"
                  borderWidth={1}
                  borderColor="#E5E5EA"
                >
                  <Bell size={18} color="#1C1C1E" />
                </YStack>
              </TouchableOpacity>
            </XStack>

            {showProfileMenu && (
              <Card
                position="absolute"
                top={70}
                left={24}
                padding="$3"
                backgroundColor="white"
                borderRadius="$4"
                borderWidth={1}
                borderColor="#E5E5EA"
                shadowColor="rgba(0,0,0,0.1)"
                shadowOffset={{ width: 0, height: 2 }}
                shadowOpacity={0.2}
                shadowRadius={8}
                elevation={10}
                zIndex={1000}
                minWidth={160}
              >
                <TouchableOpacity
                  onPress={async () => {
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setShowProfileMenu(false);
                    await signOut();
                    navigation.navigate('Auth' as any);
                  }}
                >
                  <XStack alignItems="center" gap="$3" padding="$2">
                    <LogOut size={18} color="#FF3B30" />
                    <Text color="#FF3B30" fontWeight="600">Logout</Text>
                  </XStack>
                </TouchableOpacity>
              </Card>
            )}

            {/* Large Greeting */}
            <YStack marginBottom="$4">
              <Text fontSize={28} fontWeight="700" color="#1C1C1E" marginBottom="$1">
                {greeting}, {profile?.name?.split(' ')[0] || 'User'}
              </Text>
              <Text fontSize={14} color="#8E8E93">
                Here's your medication plan for today.
              </Text>
            </YStack>

            {/* Next Dose - Featured Medication Card with Real Image */}
            {todaysMeds.length > 0 && !todaysMeds[0].taken && (
              <Card
                padding="$0"
                borderRadius={20}
                backgroundColor="white"
                marginBottom="$5"
                borderWidth={0}
                overflow="hidden"
                shadowColor="#000"
                shadowOffset={{ width: 0, height: 4 }}
                shadowOpacity={0.12}
                shadowRadius={12}
              >
                {/* Image with Gradient Overlay */}
                <YStack position="relative" height={160}>
                  <Image
                    source={{ uri: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80' }}
                    style={{
                      width: '100%',
                      height: 160,
                      position: 'absolute',
                      top: 0,
                      left: 0,
                    }}
                    resizeMode="cover"
                  />
                  {/* Gradient Overlay */}
                  <LinearGradient
                    colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.4)']}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                    }}
                  />
                  {/* Urgent Badge */}
                  <YStack
                    position="absolute"
                    top={12}
                    left={12}
                    paddingHorizontal={12}
                    paddingVertical={6}
                    borderRadius={6}
                    backgroundColor="#FF3B30"
                  >
                    <Text fontSize={11} fontWeight="700" color="white">Urgent</Text>
                  </YStack>
                </YStack>

                {/* Content */}
                <YStack padding="$4" gap="$2" backgroundColor="white">
                  <XStack alignItems="center" gap="$2">
                    <YStack
                      width={22}
                      height={22}
                      borderRadius={6}
                      backgroundColor="#E3F2FD"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Calendar size={12} color="#007AFF" strokeWidth={2.5} />
                    </YStack>
                    <Text fontSize={11} fontWeight="700" color="#007AFF" textTransform="uppercase" letterSpacing={1}>
                      NEXT DOSE
                    </Text>
                  </XStack>

                  <YStack gap="$1">
                    <Text fontSize={20} fontWeight="700" color="#1C1C1E">
                      {todaysMeds[0].name || 'Amoxicillin'}
                    </Text>
                    <Text fontSize={13} color="#8E8E93">
                      {todaysMeds[0].dosage || '500mg'} Capsule • Take with food
                    </Text>
                  </YStack>

                  <XStack alignItems="center" gap="$2" marginTop="$1">
                    <XStack alignItems="center" gap="$2">
                      <YStack
                        width={24}
                        height={24}
                        borderRadius={12}
                        backgroundColor="#F2F7FF"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Clock size={13} color="#007AFF" strokeWidth={2.5} />
                      </YStack>
                      <Text fontSize={14} fontWeight="600" color="#007AFF">
                        {todaysMeds[0].time_of_day || '8:00 AM'}
                      </Text>
                    </XStack>
                    <Text fontSize={13} color="#8E8E93">Due in 30 mins</Text>
                  </XStack>

                  <Button
                    backgroundColor="#007AFF"
                    borderRadius={12}
                    height={50}
                    marginTop="$3"
                    pressStyle={{ backgroundColor: '#0056B3' }}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      markTaken(todaysMeds[0].id);
                    }}
                  >
                    <XStack alignItems="center" gap="$2">
                      <CheckCircle2 size={20} color="white" />
                      <Text fontSize={16} fontWeight="600" color="white">Mark as Taken</Text>
                    </XStack>
                  </Button>
                </YStack>
              </Card>
            )}

            {/* Quick Actions Section */}
            <YStack marginBottom="$5">
              <Text fontSize={18} fontWeight="700" color="#1C1C1E" marginBottom="$3">Quick Actions</Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  navigation.navigate('CoachTab', { screen: 'CoachChat', params: { mode: 'scan' } } as any);
                }}
              >
                <Card
                  padding="$4"
                  borderRadius={18}
                  backgroundColor="white"
                  borderWidth={0}
                  shadowColor="#000"
                  shadowOffset={{ width: 0, height: 4 }}
                  shadowOpacity={0.08}
                  shadowRadius={16}
                >
                  <XStack alignItems="center" justifyContent="space-between">
                    <XStack alignItems="center" gap="$3">
                      <YStack
                        width={52}
                        height={52}
                        borderRadius={14}
                        backgroundColor="#F0F7FF"
                        alignItems="center"
                        justifyContent="center"
                        borderWidth={1.5}
                        borderColor="#007AFF"
                      >
                        <Scan size={24} color="#007AFF" strokeWidth={2} />
                      </YStack>
                      <YStack>
                        <Text fontSize={15} fontWeight="600" color="#1C1C1E">Scan New Prescription</Text>
                        <Text fontSize={12} color="#8E8E93" marginTop={2}>Use AI analysis to auto-fill details instantly</Text>
                      </YStack>
                    </XStack>
                    <ChevronRight size={20} color="#C7C7CC" />
                  </XStack>
                </Card>
              </TouchableOpacity>
            </YStack>

            {/* AI Health Insights Section */}
            <YStack marginBottom="$5">
              <XStack alignItems="center" gap="$2" marginBottom="$3">
                <Sparkles size={18} color="#007AFF" fill="#007AFF" />
                <Text fontSize={18} fontWeight="700" color="#1C1C1E">AI Health Insights</Text>
              </XStack>
              <Card
                padding="$4"
                borderRadius={16}
                backgroundColor="white"
                borderWidth={1}
                borderColor="#F0F0F0"
              >
                <XStack alignItems="center" gap="$3">
                  <YStack
                    width={48}
                    height={48}
                    borderRadius={12}
                    backgroundColor="#E3F2FD"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Sparkles size={22} color="#007AFF" fill="#007AFF" />
                  </YStack>
                  <YStack flex={1}>
                    <XStack alignItems="center" gap="$2" marginBottom={4}>
                      <Text fontSize={15} fontWeight="600" color="#1C1C1E">Adherence: {progressPercent}% this week</Text>
                      <YStack paddingHorizontal={8} paddingVertical={3} borderRadius={4} backgroundColor="#34C759">
                        <Text fontSize={10} fontWeight="700" color="white">GREAT</Text>
                      </YStack>
                    </XStack>
                    <Text fontSize={12} color="#8E8E93" numberOfLines={2} lineHeight={16}>
                      Consistency is key for your {todaysMeds.length > 0 ? (todaysMeds[0].name || 'Lisinopril') : 'medications'} efficacy. You're doing great keeping your blood pressure in check.
                    </Text>
                  </YStack>
                </XStack>
              </Card>
            </YStack>

            {/* Active Medications Section - Horizontal Scroll */}
            <YStack marginBottom="$4">
              <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
                <Text fontSize={18} fontWeight="700" color="#1C1C1E">Active Medications</Text>
                <TouchableOpacity onPress={() => navigation.navigate('MedicationList' as any)}>
                  <Text fontSize={14} fontWeight="600" color="#007AFF">See All</Text>
                </TouchableOpacity>
              </XStack>

              {todaysMeds.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingRight: 24 }}
                >
                  {todaysMeds.map((med, index) => {
                    const iconConfig = getMedicationIcon(index);
                    const IconComponent = iconConfig.Icon;
                    const isDeleting = deletingMedId === med.id;
                    
                    // Calculate time until due (simulated)
                    const timeSlots = ['8:00 AM', '12:00 PM', '6:00 PM', '9:00 PM'];
                    const scheduledTime = med.time_of_day || timeSlots[index % timeSlots.length];
                    
                    const handleDelete = async (e: any) => {
                      e.stopPropagation();
                      setDeletingMedId(med.id);
                      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                      const success = await deleteMedication(med.id);
                      if (!success) {
                        alert('Failed to delete medication');
                      }
                      setDeletingMedId(null);
                    };
                    
                    return (
                      <TouchableOpacity
                        key={med.id}
                        activeOpacity={0.7}
                        onPress={() => {
                          if (!med.taken) {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            markTaken(med.id);
                          }
                        }}
                        style={{ marginRight: 14, width: 185 }}
                      >
                        <Card
                          padding="$0"
                          borderRadius={16}
                          backgroundColor="white"
                          borderWidth={1}
                          borderColor={med.taken ? '#34C759' : '#F0F0F0'}
                          height={210}
                          overflow="hidden"
                        >
                          {/* Card Content */}
                          <YStack padding="$3" flex={1}>
                            {/* Top Row: Icon + Status */}
                            <XStack justifyContent="space-between" alignItems="flex-start">
                              <YStack
                                width={52}
                                height={52}
                                borderRadius={14}
                                backgroundColor={med.taken ? '#E8F5E9' : iconConfig.bg}
                                alignItems="center"
                                justifyContent="center"
                              >
                                {med.taken ? (
                                  <CheckCircle2 size={26} color="#34C759" strokeWidth={2} />
                                ) : (
                                  <IconComponent size={26} color={iconConfig.color} strokeWidth={2} />
                                )}
                              </YStack>
                              
                              <YStack
                                paddingHorizontal={8}
                                paddingVertical={4}
                                borderRadius={10}
                                backgroundColor={med.taken ? '#E8F5E9' : '#E3F2FD'}
                              >
                                <Text fontSize={10} fontWeight="600" color={med.taken ? '#34C759' : '#007AFF'}>
                                  {med.taken ? 'Taken' : 'Active'}
                                </Text>
                              </YStack>
                            </XStack>
                            
                            {/* Medication Name */}
                            <YStack marginTop="$3" flex={1}>
                              <Text
                                fontSize={16}
                                fontWeight="700"
                                color={med.taken ? '#8E8E93' : '#1C1C1E'}
                                textDecorationLine={med.taken ? 'line-through' : 'none'}
                                numberOfLines={1}
                              >
                                {med.drug_name || med.name || 'Medication'}
                              </Text>
                              <Text fontSize={13} color="#666" marginTop={3} numberOfLines={1}>
                                {med.dosage || '10mg'} • {med.frequency_text || med.frequency || 'Daily'}
                              </Text>
                              
                              {/* Time with Calendar Icon */}
                              <XStack alignItems="center" gap="$1" marginTop={10}>
                                <CalendarDays size={13} color="#8E8E93" strokeWidth={2} />
                                <Text fontSize={12} color="#8E8E93">
                                  {scheduledTime}
                                </Text>
                              </XStack>
                            </YStack>
                            
                            {/* Action Button */}
                            {!med.taken && (
                              <TouchableOpacity
                                style={{
                                  backgroundColor: '#F0F7FF',
                                  paddingVertical: 12,
                                  borderRadius: 10,
                                  alignItems: 'center',
                                  flexDirection: 'row',
                                  justifyContent: 'center',
                                  marginTop: 10,
                                }}
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                  markTaken(med.id);
                                }}
                              >
                                <Sparkles size={15} color="#007AFF" strokeWidth={2} />
                                <Text fontSize={13} fontWeight="600" color="#007AFF" marginLeft={6}>
                                  Tap to Take
                                </Text>
                              </TouchableOpacity>
                            )}
                          </YStack>
                        </Card>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleScanPrescription}
                    style={{ width: 120 }}
                  >
                    <Card
                      padding="$4"
                      borderRadius={16}
                      backgroundColor="white"
                      borderWidth={1}
                      borderColor="#007AFF"
                      borderStyle="dashed"
                      height={210}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <YStack
                        width={48}
                        height={48}
                        borderRadius={24}
                        backgroundColor="#007AFF"
                        alignItems="center"
                        justifyContent="center"
                        marginBottom="$3"
                      >
                        <Plus size={24} color="white" strokeWidth={2.5} />
                      </YStack>
                      <Text fontSize={13} fontWeight="600" color="#007AFF" textAlign="center">Add New</Text>
                      <Text fontSize={10} color="#8E8E93" textAlign="center" marginTop={4}>Scan or Enter</Text>
                    </Card>
                  </TouchableOpacity>
                </ScrollView>
              ) : (
                <Card
                  padding="$6"
                  borderRadius={16}
                  backgroundColor="white"
                  alignItems="center"
                  borderWidth={1}
                  borderColor="#F0F0F0"
                >
                  <Text fontSize={16} fontWeight="600" color="#8E8E93">No medications for today</Text>
                  <Text fontSize={13} color="#AEAEB2" marginTop="$2">Tap + to add new medication</Text>
                </Card>
              )}
            </YStack>
          </YStack>
        </ScrollView>

      </SafeAreaView>
    </LinearGradient>
  );
}
