import React, { useState, useRef } from 'react';
import {
    View,
    StyleSheet,
    SafeAreaView,
    Dimensions,
    FlatList,
    TouchableOpacity,
    Image,
    Linking,
} from 'react-native';
import { Text, YStack, XStack } from 'tamagui';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

const SLIDES = [
    {
        id: '1',
        title: 'Your ABHA Health ID',
        description: 'Ayushman Bharat Health Account (ABHA) is your unique health identity. It allows you to share and access your health records digitally with ease.',
        linkText: 'Learn more about ABHA',
        linkUrl: 'https://abha.abdm.gov.in/abha/v3',
        icon: 'card-outline',
        color: '#3B82F6',
    },
    {
        id: '2',
        title: 'Smart Health Records',
        description: 'Upload your prescriptions and reports. Rex.ai automatically organizes them and provides instant insights into your health.',
        icon: 'document-text-outline',
        color: '#10B981',
    },
    {
        id: '3',
        title: 'AI Health Coach',
        description: 'Chat with your personal AI coach. Ask questions about your medications, symptoms, or general wellness anytime.',
        icon: 'chatbubbles-outline',
        color: '#8B5CF6',
    },
];

export function PostSignupWalkthroughScreen() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const { setOnboarded } = useAuthStore();

    const handleNext = async () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({
                index: currentIndex + 1,
                animated: true,
            });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
            // Finish onboarding
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await setOnboarded(true);
        }
    };

    const renderItem = ({ item }: { item: typeof SLIDES[0] }) => (
        <View style={styles.slide}>
            <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon as any} size={80} color={item.color} />
            </View>

            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>

            {item.linkText && (
                <TouchableOpacity
                    onPress={() => Linking.openURL(item.linkUrl!)}
                    style={styles.linkButton}
                >
                    <Text style={[styles.linkText, { color: item.color }]}>{item.linkText}</Text>
                    <Ionicons name="open-outline" size={16} color={item.color} />
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <FlatList
                ref={flatListRef}
                data={SLIDES}
                renderItem={renderItem}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                    const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
                    setCurrentIndex(newIndex);
                }}
                keyExtractor={(item) => item.id}
                bounces={false}
            />

            <View style={styles.footer}>
                {/* Pagination Dots */}
                <XStack gap="$2" justifyContent="center" marginBottom="$6">
                    {SLIDES.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                {
                                    backgroundColor: currentIndex === index ? '#3B82F6' : '#E5E7EB',
                                    width: currentIndex === index ? 24 : 8
                                }
                            ]}
                        />
                    ))}
                </XStack>

                {/* Action Button */}
                <TouchableOpacity
                    style={styles.button}
                    onPress={handleNext}
                    activeOpacity={0.8}
                >
                    <Text style={styles.buttonText}>
                        {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
                    </Text>
                    <Ionicons
                        name={currentIndex === SLIDES.length - 1 ? "checkmark-circle" : "arrow-forward"}
                        size={20}
                        color="white"
                    />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    slide: {
        width,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingBottom: 100, // Space for footer
    },
    iconContainer: {
        width: 160,
        height: 160,
        borderRadius: 80,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1A1A1A',
        marginBottom: 16,
        textAlign: 'center',
    },
    description: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    linkButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: 8,
    },
    linkText: {
        fontSize: 15,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 32,
        backgroundColor: 'white',
    },
    dot: {
        height: 8,
        borderRadius: 4,
    },
    button: {
        backgroundColor: '#3B82F6',
        borderRadius: 16,
        paddingVertical: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
    },
});
