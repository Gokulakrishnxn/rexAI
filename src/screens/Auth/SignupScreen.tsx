import React, { useState } from 'react';
import { SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { YStack, XStack, Text, Input, Button, Card, Progress } from 'tamagui';
import { Ionicons } from '@expo/vector-icons';
import { auth as firebaseAuth } from '@/services/firebase';
import { onboardUser } from '@/services/api/backendApi';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuthStore } from '@/store/useAuthStore';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = {
    navigation: NativeStackNavigationProp<any>;
};

export function SignupScreen({ navigation }: Props) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const { loading: authLoading } = useAuthStore();

    // Step 1: Account
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');

    // Step 2: Profile
    const [age, setAge] = useState('');
    const [gender, setGender] = useState('');
    const [bloodGroup, setBloodGroup] = useState('');
    const [emergencyContact, setEmergencyContact] = useState('');

    const handleSignup = async () => {
        if (!email || !password || !name) {
            Alert.alert('Error', 'Please fill in all required fields');
            return;
        }

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

    const renderStep1 = () => (
        <YStack gap="$4">
            <Text fontSize="$8" fontWeight="800" color="white" marginBottom="$2">Create Account</Text>
            <YStack gap="$3">
                <Text color="#8E8E93" marginLeft="$1">Full Name</Text>
                <Input
                    backgroundColor="#1C1C1E"
                    borderColor="#2C2C2E"
                    color="white"
                    placeholder="John Doe"
                    value={name}
                    onChangeText={setName}
                />
            </YStack>
            <YStack gap="$3">
                <Text color="#8E8E93" marginLeft="$1">Email</Text>
                <Input
                    backgroundColor="#1C1C1E"
                    borderColor="#2C2C2E"
                    color="white"
                    placeholder="your@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                />
            </YStack>
            <YStack gap="$3">
                <Text color="#8E8E93" marginLeft="$1">Password</Text>
                <Input
                    backgroundColor="#1C1C1E"
                    borderColor="#2C2C2E"
                    color="white"
                    secureTextEntry
                    placeholder="••••••••"
                    value={password}
                    onChangeText={setPassword}
                />
            </YStack>
            <Button
                marginTop="$4"
                backgroundColor="$blue10"
                onPress={() => setStep(2)}
                iconAfter={<Ionicons name="arrow-forward" size={18} color="white" />}
            >
                Next: Health Profile
            </Button>
        </YStack>
    );

    const renderStep2 = () => (
        <YStack gap="$4">
            <XStack alignItems="center" gap="$2" marginBottom="$2">
                <Button
                    circular
                    size="$3"
                    icon={<Ionicons name="arrow-back" size={20} color="white" />}
                    onPress={() => setStep(1)}
                    chromeless
                />
                <Text fontSize="$8" fontWeight="800" color="white">Health Profile</Text>
            </XStack>

            <XStack gap="$4">
                <YStack gap="$3" flex={1}>
                    <Text color="#8E8E93" marginLeft="$1">Age</Text>
                    <Input
                        backgroundColor="#1C1C1E"
                        borderColor="#2C2C2E"
                        color="white"
                        placeholder="25"
                        keyboardType="numeric"
                        value={age}
                        onChangeText={setAge}
                    />
                </YStack>
                <YStack gap="$3" flex={1}>
                    <Text color="#8E8E93" marginLeft="$1">Gender</Text>
                    <Input
                        backgroundColor="#1C1C1E"
                        borderColor="#2C2C2E"
                        color="white"
                        placeholder="M/F/O"
                        value={gender}
                        onChangeText={setGender}
                    />
                </YStack>
            </XStack>

            <YStack gap="$3">
                <Text color="#8E8E93" marginLeft="$1">Blood Group</Text>
                <Input
                    backgroundColor="#1C1C1E"
                    borderColor="#2C2C2E"
                    color="white"
                    placeholder="O+ / AB-"
                    value={bloodGroup}
                    onChangeText={setBloodGroup}
                />
            </YStack>

            <YStack gap="$3">
                <Text color="#8E8E93" marginLeft="$1">Emergency Contact (Phone)</Text>
                <Input
                    backgroundColor="#1C1C1E"
                    borderColor="#2C2C2E"
                    color="white"
                    placeholder="+1 234 567 890"
                    keyboardType="phone-pad"
                    value={emergencyContact}
                    onChangeText={setEmergencyContact}
                />
            </YStack>

            <Button
                marginTop="$4"
                backgroundColor="$blue10"
                onPress={handleSignup}
                disabled={loading}
            >
                {loading ? 'Creating Account...' : 'Complete Signup'}
            </Button>
        </YStack>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F2F2F7' }}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }}>
                    <YStack flex={1} justifyContent="center">
                        <YStack alignItems="center" marginBottom="$8">
                            <Card borderRadius={100} backgroundColor="$blue10" padding="$4" marginBottom="$4">
                                <Ionicons name="medical" size={40} color="white" />
                            </Card>
                            <Text fontSize="$9" fontWeight="900" color="white" letterSpacing={-1}>Rex.ai</Text>
                            <Text color="#8E8E93" fontSize="$4">Your Personal Health Intelligence</Text>
                        </YStack>

                        <YStack marginBottom="$6">
                            <Text color="#8E8E93" marginBottom="$2" textAlign="right">Step {step} of 2</Text>
                            <Progress value={step === 1 ? 50 : 100} backgroundColor="#1C1C1E">
                                <Progress.Indicator backgroundColor="$blue10" />
                            </Progress>
                        </YStack>

                        {step === 1 ? renderStep1() : renderStep2()}

                        <XStack justifyContent="center" marginTop="$8" gap="$2">
                            <Text color="#8E8E93">Already have an account?</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                                <Text color="$blue10" fontWeight="700">Login</Text>
                            </TouchableOpacity>
                        </XStack>
                    </YStack>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

import { TouchableOpacity } from 'react-native';
