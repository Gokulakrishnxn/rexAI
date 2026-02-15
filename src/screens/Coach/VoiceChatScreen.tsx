import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Animated, Dimensions, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { YStack, XStack, Text, Button } from 'tamagui';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    useAudioRecorder,
    AudioModule,
    RecordingPresets,
    setAudioModeAsync,
    useAudioRecorderState,
} from 'expo-audio';
import * as Audio from 'expo-audio';
import { useChatStore } from '../../store/useChatStore';
import { useAuthStore } from '../../store/useAuthStore';
import { sendVoiceMessage } from '../../services/api/backendApi';

const { width } = Dimensions.get('window');

export function VoiceChatScreen() {
    const navigation = useNavigation();
    const [status, setStatus] = useState<'listening' | 'processing' | 'speaking' | 'idle'>('idle');
    const [aiResponseText, setAiResponseText] = useState('');
    const playerRef = useRef<Audio.AudioPlayer | null>(null);

    // expo-audio recorder hook
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const recorderState = useAudioRecorderState(audioRecorder);

    // Animation refs
    const animValue = useRef(new Animated.Value(0)).current;

    const { currentChatId, addMessage, createNewChat } = useChatStore();
    const { user: profile } = useAuthStore();
    const USER_ID = profile?.id || 'guest';

    // 1. Permissions & Setup
    useEffect(() => {
        (async () => {
            const permStatus = await AudioModule.requestRecordingPermissionsAsync();
            if (!permStatus.granted) {
                Alert.alert('Permission needed', 'Please grant microphone permission to use voice chat.');
                return;
            }
            setAudioModeAsync({
                playsInSilentMode: true,
                allowsRecording: true,
            });

            // Auto-start recording on mount
            startRecording();
        })();

        return () => {
            stopAudio();
        };
    }, []);

    // 2. Animation Loop
    useEffect(() => {
        if (status === 'listening' || status === 'speaking') {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(animValue, { toValue: 1, duration: 1500, useNativeDriver: true }),
                    Animated.timing(animValue, { toValue: 0, duration: 1500, useNativeDriver: true }),
                ])
            ).start();
        } else {
            animValue.setValue(0);
        }
    }, [status]);

    const startRecording = async () => {
        try {
            stopAudio();
            setAiResponseText('');
            setStatus('listening');
            await audioRecorder.prepareToRecordAsync();
            audioRecorder.record();
        } catch (err) {
            console.error('[VoiceChat] Failed to start recording', err);
            setStatus('idle');
        }
    };

    const stopRecording = async () => {
        try {
            setStatus('processing');
            await audioRecorder.stop();
            const uri = audioRecorder.uri;
            console.log('[VoiceChat] Recording stopped, URI:', uri);

            if (uri) {
                handleSendVoice(uri);
            } else {
                setStatus('idle');
            }
        } catch (error) {
            console.error('[VoiceChat] Failed to stop recording', error);
            setStatus('idle');
        }
    };

    const handleSendVoice = async (uri: string) => {
        let chatId = currentChatId;
        if (!chatId) {
            chatId = createNewChat();
        }

        try {
            // Send audio file to backend (isText = false, so FormData)
            const response = await sendVoiceMessage(USER_ID, uri, undefined, false);

            if (response.success) {
                const aiMsgId = (Date.now() + 1).toString();
                const content = response.voice_summary || response.transcript || 'Response received.';
                setAiResponseText(content);

                addMessage(chatId, {
                    id: aiMsgId,
                    text: content,
                    userId: 'coach',
                    createdAt: new Date(),
                });

                // Add user transcript if available
                if (response.transcript) {
                    const userMsgId = Date.now().toString();
                    addMessage(chatId, {
                        id: userMsgId,
                        text: response.transcript,
                        userId: 'user',
                        createdAt: new Date(),
                    });
                }

                // Play Audio Response
                if (response.audio_base64) {
                    playResponseAudio(response.audio_base64);
                } else {
                    setStatus('idle');
                }
            } else {
                Alert.alert('Error', response.error || 'Failed to process voice.');
                setStatus('idle');
            }
        } catch (error) {
            console.error('[VoiceChat] Send Error:', error);
            setStatus('idle');
            Alert.alert('Error', 'Failed to send voice message.');
        }
    };

    const playResponseAudio = async (base64Audio: string) => {
        try {
            setStatus('speaking');

            // For playback, use Audio.createAudioPlayer with data URI
            const dataUri = `data:audio/mp3;base64,${base64Audio}`;
            const player = Audio.createAudioPlayer(dataUri);
            playerRef.current = player;
            player.play();

            // No built-in onFinish in expo-audio, so we poll or just set idle after a delay
            // We can check playing status periodically
            const checkInterval = setInterval(() => {
                if (!player.playing) {
                    clearInterval(checkInterval);
                    setStatus('idle');
                }
            }, 500);

        } catch (error) {
            console.error('[VoiceChat] Playback Error:', error);
            setStatus('idle');
        }
    };

    const stopAudio = () => {
        if (playerRef.current) {
            playerRef.current.remove();
            playerRef.current = null;
        }
    };

    // Animation Styles
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
                <YStack flex={1} alignItems="center" justifyContent="center" padding="$6" gap="$6">

                    {/* Transcript Area */}
                    <YStack flex={1} justifyContent="center" width="100%">
                        {status === 'processing' && (
                            <ActivityIndicator size="large" color="#3B82F6" style={{ marginBottom: 20 }} />
                        )}

                        <Text
                            fontSize="$7"
                            fontWeight="600"
                            color={status === 'listening' ? 'white' : '#9CA3AF'}
                            textAlign="center"
                            opacity={status === 'listening' ? 1 : 0.6}
                        >
                            {status === 'listening' ? 'Listening...' :
                                status === 'processing' ? 'Processing...' :
                                    status === 'speaking' ? 'Speaking...' :
                                        'REX AI  is ready...'}
                        </Text>

                        {aiResponseText ? (
                            <Text fontSize="$6" color="#34D399" textAlign="center" marginTop="$4" fontWeight="500">
                                {aiResponseText}
                            </Text>
                        ) : null}
                    </YStack>

                    {/* Visualizer */}
                    <YStack alignItems="center" justifyContent="center" height={200}>
                        <Animated.View
                            style={[
                                styles.waveCircle,
                                {
                                    transform: [{ scale: waveScale }],
                                    opacity: waveOpacity,
                                    backgroundColor: recorderState.isRecording ? '#EF4444' : '#3B82F6',
                                },
                            ]}
                        />
                        <TouchableOpacity
                            onPress={recorderState.isRecording ? stopRecording : startRecording}
                            activeOpacity={0.8}
                            disabled={status === 'processing' || status === 'speaking'}
                        >
                            <Animated.View
                                style={[
                                    styles.waveCircleInner,
                                    {
                                        transform: [{ scale: animValue.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.1] }) }],
                                        backgroundColor: recorderState.isRecording ? '#B91C1C' : '#1E40AF',
                                    },
                                ]}
                            >
                                <YStack flex={1} alignItems="center" justifyContent="center">
                                    <Ionicons
                                        name={recorderState.isRecording ? 'stop' : 'mic'}
                                        size={48}
                                        color="white"
                                    />
                                </YStack>
                            </Animated.View>
                        </TouchableOpacity>
                    </YStack>

                    <Text fontSize="$4" color="#8E8E93" marginBottom="$4">
                        {recorderState.isRecording ? 'Tap to Stop' : 'Tap to Speak'}
                    </Text>

                    {/* Bottom Controls */}
                    <XStack width="100%" justifyContent="center" paddingBottom="$4">
                        <Button
                            size="$5"
                            circular
                            backgroundColor="rgba(255,255,255,0.2)"
                            onPress={() => {
                                stopAudio();
                                navigation.goBack();
                            }}
                            icon={<Ionicons name="close" size={24} color="white" />}
                        />
                    </XStack>
                </YStack>
            </SafeAreaView>
        </YStack>
    );
}

const styles = StyleSheet.create({
    waveCircle: {
        width: 180,
        height: 180,
        borderRadius: 90,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 50,
        position: 'absolute',
    },
    waveCircleInner: {
        width: 140,
        height: 140,
        borderRadius: 70,
        zIndex: 10,
    },
});

export default VoiceChatScreen;
