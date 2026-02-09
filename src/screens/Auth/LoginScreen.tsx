import React, { useState } from 'react';
import { SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { YStack, XStack, Text, Input, Button, Card, Tabs, Separator } from 'tamagui';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { auth as firebaseAuth } from '@/services/firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { useAuthStore } from '@/store/useAuthStore';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = {
    navigation: NativeStackNavigationProp<any>;
};

export function LoginScreen({ navigation }: Props) {
    const [loading, setLoading] = useState(false);
    const { loading: authLoading } = useAuthStore();

    // Login State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [showOtpInput, setShowOtpInput] = useState(false);

    const handlePasswordLogin = async () => {
        if (!email || !password) return;
        setLoading(true);
        try {
            await signInWithEmailAndPassword(firebaseAuth, email, password);
            // useAuthStore will update automatically via onAuthStateChanged
        } catch (error: any) {
            Alert.alert('Login Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            Alert.alert('Error', 'Please enter your email first');
            return;
        }
        setLoading(true);
        try {
            await sendPasswordResetEmail(firebaseAuth, email);
            Alert.alert('Success', 'Password reset email sent!');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F2F2F7' }}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }}>
                    <YStack flex={1} justifyContent="center">
                        <YStack alignItems="center" marginBottom="$10">
                            <Card borderRadius={100} backgroundColor="$blue10" padding="$4" marginBottom="$4">
                                <Ionicons name="medical" size={48} color="white" />
                            </Card>
                            <Text fontSize="$10" fontWeight="900" color="white" letterSpacing={-1}>Rex.ai</Text>
                            <Text color="#8E8E93" fontSize="$5">Welcome back</Text>
                        </YStack>

                        <YStack gap="$4">
                            <Input
                                backgroundColor="#1C1C1E"
                                borderColor="#2C2C2E"
                                color="white"
                                placeholder="Email"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={email}
                                onChangeText={setEmail}
                            />
                            <Input
                                backgroundColor="#1C1C1E"
                                borderColor="#2C2C2E"
                                color="white"
                                secureTextEntry
                                placeholder="Password"
                                value={password}
                                onChangeText={setPassword}
                            />
                            <Button backgroundColor="$blue10" onPress={handlePasswordLogin} disabled={loading}>
                                {loading ? 'Logging in...' : 'Login'}
                            </Button>
                            <Button chromeless onPress={handleForgotPassword} disabled={loading}>
                                <Text color="$blue10">Forgot Password?</Text>
                            </Button>
                        </YStack>

                        <XStack justifyContent="center" marginTop="$10" gap="$2">
                            <Text color="#8E8E93">Don't have an account?</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                                <Text color="$blue10" fontWeight="700">Sign up</Text>
                            </TouchableOpacity>
                        </XStack>
                    </YStack>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
