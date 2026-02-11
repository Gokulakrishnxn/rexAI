import React from 'react';
import { Alert, TouchableOpacity, View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  YStack,
  XStack,
  Card,
  Text,
  ScrollView,
} from 'tamagui';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { useMedAgentStore } from '../../store/useMedAgentStore';
import { ProfileStackParamList } from '../../navigation/stacks/ProfileStack';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList>;

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconBgColor: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
  showBorder?: boolean;
}

function MenuItem({ icon, iconBgColor, iconColor, title, subtitle, onPress, showBorder = true }: MenuItemProps) {
  return (
    <TouchableOpacity 
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.menuItem,
        showBorder && styles.menuItemBorder
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.menuTextContainer}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

export function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user: profile, signOut } = useAuthStore();
  const { activeMeds } = useMedAgentStore();

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            signOut();
          },
        },
      ]
    );
  };

  const handleNavigateToMedications = () => {
    Haptics.selectionAsync();
    navigation.navigate('MedicationLibrary');
  };

  const handleNavigateToQR = () => {
    Haptics.selectionAsync();
    navigation.navigate('QRManagement');
  };

  // Calculate prescription count
  const prescriptionCount = activeMeds.length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <XStack alignItems="center" paddingHorizontal="$4" paddingVertical="$3">
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={{ width: 40 }} />
      </XStack>

      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <YStack alignItems="center" paddingTop="$4" paddingBottom="$6">
          <Avatar size={100} style={styles.avatar}>
            <AvatarImage source={{ uri: profile?.avatar_url }} />
            <AvatarFallback style={styles.avatarFallback}>
              <Text style={styles.avatarText}>
                {profile?.name?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </AvatarFallback>
          </Avatar>
          
          <Text style={styles.userName}>{profile?.name || 'User'}</Text>
          
          <XStack alignItems="center" gap="$3" marginTop="$2">
            {profile?.blood_group && (
              <View style={styles.bloodTypeBadge}>
                <Text style={styles.bloodTypeText}>{profile.blood_group}</Text>
              </View>
            )}
            <Text style={styles.emailText}>{profile?.email || 'email@example.com'}</Text>
          </XStack>
        </YStack>

        {/* Stats Row */}
        <XStack gap="$3" paddingHorizontal="$4" marginBottom="$6">
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>AGE</Text>
            <Text style={styles.statValue}>{profile?.age || '--'} Yrs</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>HEIGHT</Text>
            <Text style={styles.statValue}>{profile?.height || '--'} cm</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>WEIGHT</Text>
            <Text style={styles.statValue}>{profile?.weight || '--'} kg</Text>
          </Card>
        </XStack>

        {/* Medical ID Card */}
        <TouchableOpacity 
          style={styles.medicalIdCard}
          onPress={handleNavigateToQR}
          activeOpacity={0.8}
        >
          <YStack>
            <Text style={styles.medicalIdTitle}>Medical ID</Text>
            <Text style={styles.medicalIdSubtitle}>Scan to share your{'\n'}emergency medical record</Text>
          </YStack>
          <View style={styles.qrIconContainer}>
            <Ionicons name="qr-code" size={32} color="#1A1A1A" />
          </View>
        </TouchableOpacity>

        {/* Health Management Section */}
        <YStack paddingHorizontal="$4" marginTop="$6">
          <Text style={styles.sectionTitle}>HEALTH MANAGEMENT</Text>
          <Card style={styles.menuCard}>
            <MenuItem
              icon="bandage-outline"
              iconBgColor="#EBF4FF"
              iconColor="#3B82F6"
              title="Active Medications"
              subtitle={`${prescriptionCount} Ongoing Prescriptions`}
              onPress={handleNavigateToMedications}
            />
            <MenuItem
              icon="notifications-outline"
              iconBgColor="#FEF3C7"
              iconColor="#F59E0B"
              title="Reminders"
              subtitle="Daily 8:00 AM, 9:00 PM"
              showBorder={false}
            />
          </Card>
        </YStack>

        {/* Settings & Privacy Section */}
        <YStack paddingHorizontal="$4" marginTop="$6">
          <Text style={styles.sectionTitle}>SETTINGS & PRIVACY</Text>
          <Card style={styles.menuCard}>
            <MenuItem
              icon="shield-outline"
              iconBgColor="#F3F4F6"
              iconColor="#374151"
              title="Data & Privacy"
              subtitle="Manage shared permissions"
            />
            <MenuItem
              icon="globe-outline"
              iconBgColor="#F3F4F6"
              iconColor="#374151"
              title="Language"
              subtitle="English (US)"
            />
            <MenuItem
              icon="phone-portrait-outline"
              iconBgColor="#F3F4F6"
              iconColor="#374151"
              title="App Settings"
              subtitle="Notifications, Appearance"
              showBorder={false}
            />
          </Card>
        </YStack>

        {/* Logout Button */}
        <YStack paddingHorizontal="$4" marginTop="$8" marginBottom="$6">
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFC',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  avatar: {
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#E5E7EB',
  },
  avatarFallback: {
    backgroundColor: '#E5E7EB',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '600',
    color: '#6B7280',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  bloodTypeBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bloodTypeText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
  emailText: {
    color: '#6B7280',
    fontSize: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  medicalIdCard: {
    marginHorizontal: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  medicalIdTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  medicalIdSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  qrIconContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  logoutButton: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
});
