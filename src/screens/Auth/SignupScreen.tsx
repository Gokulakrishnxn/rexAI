import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { YStack, XStack, Text, Input, Progress } from 'tamagui';
import { Ionicons } from '@expo/vector-icons';
import { auth as firebaseAuth } from '@/services/firebase';
import { onboardUser } from '@/services/api/backendApi';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

WebBrowser.maybeCompleteAuthSession();

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export function SignupScreen({ navigation }: Props) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Step 1: Account
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 2: Profile
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  const extra = Constants.expoConfig?.extra;

  // Google Auth Configuration
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: extra?.googleWebClientId,
    androidClientId: extra?.googleAndroidClientId,
    iosClientId: extra?.googleIosClientId,
    scopes: ['profile', 'email', 'https://www.googleapis.com/auth/calendar.readonly'],
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      handleGoogleSignUp(id_token);
    }
  }, [response]);

  const handleGoogleSignUp = async (idToken: string) => {
    setGoogleLoading(true);
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(firebaseAuth, credential);

      // Navigate to profile completion screen
      navigation.navigate('CompleteProfile', {
        email: userCredential.user.email,
        name: userCredential.user.displayName,
        photoURL: userCredential.user.photoURL,
        isGoogleUser: true,
      });
    } catch (error: any) {
      Alert.alert('Google Sign-Up Error', error.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const validateStep1 = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return false;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email');
      return false;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!age.trim()) {
      Alert.alert('Error', 'Please enter your age');
      return false;
    }
    if (!gender.trim()) {
      Alert.alert('Error', 'Please enter your gender');
      return false;
    }
    if (!bloodGroup.trim()) {
      Alert.alert('Error', 'Please enter your blood group');
      return false;
    }
    if (!emergencyContact.trim()) {
      Alert.alert('Error', 'Please enter an emergency contact');
      return false;
    }
    return true;
  };

  const handleSignup = async () => {
    if (!validateStep2()) return;

    setLoading(true);
    try {
      // 1. Firebase Auth Signup
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      const fbUser = userCredential.user;
      const token = await fbUser.getIdToken();

      // 2. Create record in our 'users' table via backend
      const { success: onboardSuccess, error: onboardError } = await onboardUser({
        name,
        age,
        gender,
        blood_group: bloodGroup,
        emergency_contact: emergencyContact,
        role: 'patient'
      }, token);

      if (!onboardSuccess) {
        // If onboarding fails, rollback authentication
        await firebaseAuth.signOut();
        throw new Error(onboardError || 'Failed to sync profile');
      }

      // Success! The auth listener in AppNavigator will handle the redirect to Main
      console.log('Signup and Onboarding Successful');
    } catch (error: any) {
      // Ensure we don't leave a ghost session
      if (firebaseAuth.currentUser) {
        await firebaseAuth.signOut();
      }
      Alert.alert('Signup Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const genderOptions = ['Male', 'Female', 'Other'];
  const bloodGroupOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const renderStep1 = () => (
    <YStack gap="$4">
      <Text style={styles.stepTitle}>Create Account</Text>

      {/* Full Name */}
      <YStack gap="$2">
        <Text style={styles.inputLabel}>Full Name</Text>
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
        <Text style={styles.inputLabel}>Email</Text>
        <View style={styles.inputContainer}>
          <Input
            flex={1}
            backgroundColor="transparent"
            borderWidth={0}
            color="#1A1A1A"
            placeholder="your@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />
        </View>
      </YStack>

      {/* Password */}
      <YStack gap="$2">
        <Text style={styles.inputLabel}>Password</Text>
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

      {/* Next Button */}
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => validateStep1() && setStep(2)}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>Next: Health Profile</Text>
        <Ionicons name="arrow-forward" size={18} color="white" />
      </TouchableOpacity>

    </YStack>
  );

  const renderStep2 = () => (
    <YStack gap="$4">
      <XStack alignItems="center" gap="$3" marginBottom="$2">
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setStep(1)}
        >
          <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.stepTitle}>Health Profile</Text>
      </XStack>

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
              placeholder="Male/Female"
              value={gender}
              onChangeText={setGender}
              style={styles.input}
            />
          </View>
        </YStack>
      </XStack>

      {/* Blood Group */}
      <YStack gap="$2">
        <Text style={styles.inputLabel}>Blood Group *</Text>
        <View style={styles.inputContainer}>
          <Input
            flex={1}
            backgroundColor="transparent"
            borderWidth={0}
            color="#1A1A1A"
            placeholder="O+, AB-, etc."
            value={bloodGroup}
            onChangeText={setBloodGroup}
            style={styles.input}
          />
        </View>
        <XStack flexWrap="wrap" gap="$2" marginTop="$2">
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

      {/* Complete Signup Button */}
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleSignup}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.primaryButtonText}>Complete Signup</Text>
        )}
      </TouchableOpacity>
    </YStack>
  );

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
          {/* Decorative Background Elements */}
          <View style={styles.decorativeCircle1} />
          <View style={styles.decorativeCircle2} />

          <YStack flex={1} justifyContent="center" paddingHorizontal="$6">
            {/* Logo Section */}
            <YStack alignItems="center" marginBottom="$6">
              <View style={styles.logoContainer}>
                <Ionicons name="medical" size={40} color="white" />
              </View>
              <Text style={styles.appName}>Rex.ai</Text>
              <Text style={styles.tagline}>Your Personal Health Intelligence</Text>
            </YStack>

            {/* Progress Indicator */}
            <YStack marginBottom="$6">
              <Text style={styles.stepIndicator}>Step {step} of 2</Text>
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: step === 1 ? '50%' : '100%' }]} />
              </View>
            </YStack>

            {step === 1 ? renderStep1() : renderStep2()}

            {/* Login Link */}
            <XStack justifyContent="center" marginTop="$6" gap="$2">
              <Text style={styles.footerText}>Already have an account?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>Login</Text>
              </TouchableOpacity>
            </XStack>
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
    paddingVertical: 24,
    position: 'relative',
  },
  decorativeCircle1: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  decorativeCircle2: {
    position: 'absolute',
    bottom: -50,
    left: -100,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  appName: {
    fontSize: 36,
    fontWeight: '300',
    color: '#1A1A1A',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  stepIndicator: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'right',
    marginBottom: 8,
  },
  progressContainer: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 3,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
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
  input: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
    shadowColor: '#3B82F6',
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    color: '#9CA3AF',
    fontSize: 13,
    paddingHorizontal: 16,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  googleButtonText: {
    color: '#1A1A1A',
    fontSize: 15,
    fontWeight: '600',
  },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
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
    fontSize: 13,
    fontWeight: '500',
  },
  optionChipTextSelected: {
    color: 'white',
  },
  footerText: {
    color: '#6B7280',
    fontSize: 15,
  },
  loginLink: {
    color: '#3B82F6',
    fontSize: 15,
    fontWeight: '700',
  },
});
