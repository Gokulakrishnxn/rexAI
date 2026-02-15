import React, { useState } from 'react';
import {
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TouchableOpacity,
  View,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { YStack, XStack, Text, Input } from 'tamagui';
import { Ionicons } from '@expo/vector-icons';
import { auth as firebaseAuth } from '@/services/firebase';
import { onboardUser } from '@/services/api/backendApi';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type RouteParams = {
  CompleteProfile: {
    email?: string;
    name?: string;
    photoURL?: string;
    isGoogleUser: boolean;
  };
};

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export function CompleteProfileScreen({ navigation }: Props) {
  const route = useRoute<RouteProp<RouteParams, 'CompleteProfile'>>();
  const { email: initialEmail, name: initialName, photoURL, isGoogleUser } = route.params || {};

  const [loading, setLoading] = useState(false);

  // Form State
  const [name, setName] = useState(initialName || '');
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const bloodGroupOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const genderOptions = ['Male', 'Female', 'Other'];

  const validateForm = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return false;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email');
      return false;
    }
    if (!isGoogleUser && password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return false;
    }
    if (!age.trim()) {
      Alert.alert('Error', 'Please enter your age');
      return false;
    }
    if (!gender.trim()) {
      Alert.alert('Error', 'Please select your gender');
      return false;
    }
    if (!bloodGroup.trim()) {
      Alert.alert('Error', 'Please select your blood group');
      return false;
    }
    if (!emergencyContact.trim()) {
      Alert.alert('Error', 'Please enter an emergency contact');
      return false;
    }
    return true;
  };

  const handleCompleteProfile = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('No authenticated user found');
      }

      const token = await fbUser.getIdToken();

      // Create record in our 'users' table via backend
      const { success: onboardSuccess, error: onboardError } = await onboardUser({
        name,
        age,
        gender,
        blood_group: bloodGroup,
        emergency_contact: emergencyContact,
        role: 'patient'
      }, token);

      if (!onboardSuccess) {
        throw new Error(onboardError || 'Failed to complete profile');
      }

      // Success! The auth listener in AppNavigator will handle the redirect to Main
      console.log('Profile Completed Successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Decorative Background */}
          <View style={styles.decorativeCircle1} />
          <View style={styles.decorativeCircle2} />

          <YStack flex={1} paddingHorizontal="$6">
            {/* Header */}
            <YStack alignItems="center" marginBottom="$6" marginTop="$4">
              {photoURL ? (
                <Avatar size={80} style={styles.avatar}>
                  <AvatarImage source={{ uri: photoURL }} />
                  <AvatarFallback style={styles.avatarFallback}>
                    <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
                  </AvatarFallback>
                </Avatar>
              ) : (
                <View style={styles.logoContainer}>
                  <Image
                    source={require('../../../assets/rexdark.png')}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                </View>
              )}
              <Text style={styles.title}>Complete Your Profile</Text>
              <Text style={styles.subtitle}>
                Please fill in all the required information to continue
              </Text>
            </YStack>

            {/* Progress */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar} />
            </View>

            {/* Form */}
            <YStack gap="$4" marginTop="$4">
              {/* Full Name */}
              <YStack gap="$2">
                <Text style={styles.inputLabel}>Full Name *</Text>
                <View style={styles.inputContainer}>
                  <Input
                    flex={1}
                    backgroundColor="transparent"
                    borderWidth={0}
                    color="#1A1A1A"
                    placeholder="John Doe"
                    value={name}
                    onChangeText={setName}
                    style={styles.input}
                  />
                </View>
              </YStack>

              {/* Email */}
              <YStack gap="$2">
                <Text style={styles.inputLabel}>Email *</Text>
                <View style={[styles.inputContainer, isGoogleUser && styles.inputDisabled]} pointerEvents={isGoogleUser ? 'none' : 'auto'}>
                  <Input
                    flex={1}
                    backgroundColor="transparent"
                    borderWidth={0}
                    color={isGoogleUser ? "#9CA3AF" : "#1A1A1A"}
                    placeholder="your@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                    style={styles.input}
                  />
                  {isGoogleUser && (
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  )}
                </View>
              </YStack>

              {/* Password (only for non-Google users) */}
              {!isGoogleUser && (
                <YStack gap="$2">
                  <Text style={styles.inputLabel}>Password *</Text>
                  <View style={styles.inputContainer}>
                    <Input
                      flex={1}
                      backgroundColor="transparent"
                      borderWidth={0}
                      color="#1A1A1A"
                      secureTextEntry={!showPassword}
                      placeholder="••••••••"
                      value={password}
                      onChangeText={setPassword}
                      style={styles.input}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color="#6B7280"
                      />
                    </TouchableOpacity>
                  </View>
                </YStack>
              )}

              {/* Age & Gender Row */}
              <XStack gap="$4">
                <YStack gap="$2" flex={1}>
                  <Text style={styles.inputLabel}>Age *</Text>
                  <View style={styles.inputContainer}>
                    <Input
                      flex={1}
                      backgroundColor="transparent"
                      borderWidth={0}
                      color="#1A1A1A"
                      placeholder="25"
                      keyboardType="numeric"
                      value={age}
                      onChangeText={setAge}
                      style={styles.input}
                    />
                  </View>
                </YStack>

                <YStack gap="$2" flex={1}>
                  <Text style={styles.inputLabel}>Gender *</Text>
                  <View style={styles.inputContainer}>
                    <Input
                      flex={1}
                      backgroundColor="transparent"
                      borderWidth={0}
                      color="#1A1A1A"
                      placeholder="Select"
                      value={gender}
                      onChangeText={setGender}
                      style={styles.input}
                    />
                  </View>
                </YStack>
              </XStack>

              {/* Gender Quick Select */}
              <XStack gap="$2">
                {genderOptions.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.optionChip,
                      gender === g && styles.optionChipSelected
                    ]}
                    onPress={() => setGender(g)}
                  >
                    <Text style={[
                      styles.optionChipText,
                      gender === g && styles.optionChipTextSelected
                    ]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </XStack>

              {/* Blood Group */}
              <YStack gap="$2">
                <Text style={styles.inputLabel}>Blood Group *</Text>
                <XStack flexWrap="wrap" gap="$2">
                  {bloodGroupOptions.map((bg) => (
                    <TouchableOpacity
                      key={bg}
                      style={[
                        styles.optionChip,
                        bloodGroup === bg && styles.optionChipSelected
                      ]}
                      onPress={() => setBloodGroup(bg)}
                    >
                      <Text style={[
                        styles.optionChipText,
                        bloodGroup === bg && styles.optionChipTextSelected
                      ]}>{bg}</Text>
                    </TouchableOpacity>
                  ))}
                </XStack>
              </YStack>

              {/* Emergency Contact */}
              <YStack gap="$2">
                <Text style={styles.inputLabel}>Emergency Contact *</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="call-outline" size={20} color="#6B7280" style={{ marginRight: 12 }} />
                  <Input
                    flex={1}
                    backgroundColor="transparent"
                    borderWidth={0}
                    color="#1A1A1A"
                    placeholder="+1 234 567 890"
                    keyboardType="phone-pad"
                    value={emergencyContact}
                    onChangeText={setEmergencyContact}
                    style={styles.input}
                  />
                </View>
              </YStack>

              {/* Complete Button */}
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleCompleteProfile}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Complete Profile</Text>
                    <Ionicons name="checkmark" size={20} color="white" />
                  </>
                )}
              </TouchableOpacity>

              {/* Info Text */}
              <Text style={styles.infoText}>
                All fields marked with * are required. This information will be used for your health records and emergency situations.
              </Text>
            </YStack>
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
    position: 'relative',
  },
  decorativeCircle1: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  decorativeCircle2: {
    position: 'absolute',
    bottom: 100,
    left: -80,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
  },
  avatar: {
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#3B82F6',
  },
  avatarFallback: {
    backgroundColor: '#3B82F6',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '600',
    color: 'white',
  },
  logoContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    width: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  inputLabel: {
    color: '#6B7280',
    fontSize: 14,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
  },
  input: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionChipSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  optionChipText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  optionChipTextSelected: {
    color: 'white',
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
  },
  infoText: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});
