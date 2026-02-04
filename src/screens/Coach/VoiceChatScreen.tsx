import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, Dimensions } from 'react-native';
import { YStack, XStack, Text, Button } from 'tamagui';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export function VoiceChatScreen() {
    const navigation = useNavigation();
    const animValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(animValue, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(animValue, {
                    toValue: 0,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const waveScale = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.2],
    });

    const waveOpacity = animValue.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.3, 0.6, 0.3],
    });

    return (
        <YStack flex={1} backgroundColor="#000000">
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
            <SafeAreaView style={{ flex: 1 }}>
                <YStack flex={1} alignItems="center" justifyContent="center" padding="$6" gap="$10">
                    {/* Waveform Area */}
                    <YStack alignItems="center" justifyContent="center">
                        <Animated.View
                            style={[
                                styles.waveCircle,
                                {
                                    transform: [{ scale: waveScale }],
                                    opacity: waveOpacity,
                                },
                            ]}
                        />
                        <Animated.View
                            style={[
                                styles.waveCircleInner,
                                {
                                    transform: [{ scale: animValue.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.1] }) }],
                                },
                            ]}
                        />
                        <YStack position="absolute" alignItems="center">
                            <Ionicons name="mic" size={48} color="white" />
                        </YStack>
                    </YStack>

                    <YStack alignItems="center" gap="$2">
                        <Text fontSize="$8" fontWeight="700" color="white">
                            Rex.ai is listening
                        </Text>
                        <Text fontSize="$4" color="#8E8E93">
                            Go ahead, I'm all ears
                        </Text>
                    </YStack>

                    <YStack flex={1} />

                    {/* Controls */}
                    <XStack width="100%" justifyContent="center" paddingBottom="$10">
                        <Button
                            size="$6"
                            circular
                            backgroundColor="#FF3B30"
                            onPress={() => navigation.goBack()}
                            icon={<Ionicons name="close" size={32} color="white" />}
                        />
                    </XStack>
                </YStack>
            </SafeAreaView>
        </YStack>
    );
}

const styles = StyleSheet.create({
    waveCircle: {
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: '#3B82F6',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 50,
    },
    waveCircleInner: {
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: '#1E40AF',
        position: 'absolute',
    },
});
