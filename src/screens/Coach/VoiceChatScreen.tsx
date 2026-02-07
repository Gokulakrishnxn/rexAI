import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StyleSheet, Animated, Dimensions, TextInput, ActivityIndicator } from 'react-native';
import { YStack, XStack, Text, Button } from 'tamagui';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Room } from 'livekit-client';
import { connectToRoom, startAudioStream, stopAudioStream } from '../../services/livekitVoiceService';
import { routeMessage, type SuggestedTool } from '../../agents/routerAgent';
import { bookAppointment } from '../../tools/calendarTool';

const { width } = Dimensions.get('window');

export function VoiceChatScreen() {
  const navigation = useNavigation();
  const animValue = useRef(new Animated.Value(0)).current;
  const roomRef = useRef<Room | null>(null);

  const [roomConnected, setRoomConnected] = useState(false);
  const [replyText, setReplyText] = useState<string | null>(null);
  const [suggestedTool, setSuggestedTool] = useState<SuggestedTool | null>(null);
  const [loading, setLoading] = useState(false);
  const [simulateText, setSimulateText] = useState('');

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

  // Connect to LiveKit room on mount; stub token may fail — fallback mode still works
  useEffect(() => {
    let mounted = true;
    connectToRoom()
      .then((room) => {
        if (!mounted) {
          room.disconnect();
          return;
        }
        roomRef.current = room;
        return startAudioStream(room);
      })
      .then(() => mounted && setRoomConnected(true))
      .catch(() => {
        if (mounted) setRoomConnected(false);
      });
    return () => {
      mounted = false;
      stopAudioStream(roomRef.current ?? undefined);
      roomRef.current = null;
    };
  }, []);

  const handleVoiceIntent = useCallback(async (transcript: string) => {
    const t = transcript.trim();
    if (!t) return;
    setLoading(true);
    setReplyText(null);
    setSuggestedTool(null);
    try {
      const { replyText: text, suggestedTool: tool } = await routeMessage(t, 'voice');
      setReplyText(text);
      setSuggestedTool(tool ?? null);
    } catch {
      setReplyText("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleConfirmBooking = useCallback(
    (title: string, datetime: string) => {
      setLoading(true);
      bookAppointment(title, datetime, 'voice').then((resultText) => {
        setReplyText(resultText);
        setSuggestedTool(null);
        setLoading(false);
      });
    },
    []
  );

  const handleClose = useCallback(() => {
    stopAudioStream(roomRef.current ?? undefined);
    roomRef.current = null;
    navigation.goBack();
  }, [navigation]);

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
                  transform: [
                    {
                      scale: animValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.9, 1.1],
                      }),
                    },
                  ],
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
              {roomConnected ? "Go ahead, I'm all ears" : 'Connecting… (or type below)'}
            </Text>
          </YStack>

          {/* Voice reply / demo */}
          {loading && (
            <YStack alignItems="center" gap="$2">
              <ActivityIndicator size="small" color="#3B82F6" />
              <Text fontSize="$3" color="#8E8E93">Thinking…</Text>
            </YStack>
          )}
          {replyText && !loading && (
            <YStack
              padding="$4"
              borderRadius="$4"
              backgroundColor="#1C1C1E"
              maxWidth={width - 48}
              alignSelf="center"
              gap="$3"
            >
              <YStack>
                <Text fontSize="$2" color="#8E8E93" marginBottom="$1">Rex says</Text>
                <Text fontSize="$4" color="white">{replyText}</Text>
              </YStack>
              {suggestedTool?.type === 'BOOK_APPOINTMENT' && suggestedTool.payload && (
                <Button
                  size="$4"
                  backgroundColor="#007AFF"
                  onPress={() =>
                    handleConfirmBooking(suggestedTool.payload.title, suggestedTool.payload.datetime)
                  }
                  icon={<Ionicons name="calendar" size={20} color="white" />}
                >
                  Book Appointment
                </Button>
              )}
            </YStack>
          )}

          <YStack flex={1} />

          {/* Demo: type to simulate voice (e.g. "Book dentist tomorrow 4 pm") */}
          <YStack width="100%" gap="$2" paddingBottom="$4">
            <Text fontSize="$2" color="#8E8E93" alignSelf="center">
              Or type to try: &quot;Book dentist tomorrow 4 pm&quot;
            </Text>
            <XStack width="100%" gap="$2" alignItems="center">
              <TextInput
                style={styles.input}
                placeholder="Say something…"
                placeholderTextColor="#8E8E93"
                value={simulateText}
                onChangeText={setSimulateText}
                onSubmitEditing={() => handleVoiceIntent(simulateText)}
                returnKeyType="send"
              />
              <Button
                size="$4"
                backgroundColor="#007AFF"
                onPress={() => handleVoiceIntent(simulateText)}
                icon={<Ionicons name="send" size={18} color="white" />}
              />
            </XStack>
          </YStack>

          {/* Controls */}
          <XStack width="100%" justifyContent="center" paddingBottom="$10">
            <Button
              size="$6"
              circular
              backgroundColor="#FF3B30"
              onPress={handleClose}
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
  input: {
    flex: 1,
    height: 44,
    backgroundColor: '#1C1C1E',
    borderRadius: 22,
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 16,
  },
});
