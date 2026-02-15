import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Voice, { SpeechResultsEvent, SpeechErrorEvent } from '@react-native-voice/voice';

interface VoiceInputProps {
    onSpeechResult: (text: string) => void;
    isProcessing: boolean;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({ onSpeechResult, isProcessing }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [partialResult, setPartialResult] = useState('');

    useEffect(() => {
        Voice.onSpeechStart = onSpeechStart;
        Voice.onSpeechEnd = onSpeechEnd;
        Voice.onSpeechResults = onSpeechResults;
        Voice.onSpeechError = onSpeechError;
        Voice.onSpeechPartialResults = onSpeechPartialResults;

        return () => {
            Voice.destroy().then(Voice.removeAllListeners);
        };
    }, []);

    const onSpeechStart = (e: any) => {
        console.log('[VoiceInput] Speech started');
        setIsRecording(true);
        setPartialResult('');
    };

    const onSpeechEnd = (e: any) => {
        console.log('[VoiceInput] Speech ended');
        setIsRecording(false);
    };

    const onSpeechError = (e: SpeechErrorEvent) => {
        console.error('[VoiceInput] Speech Error: ', e.error);
        setIsRecording(false);
    };

    const onSpeechResults = (e: SpeechResultsEvent) => {
        console.log('[VoiceInput] Speech Results: ', e.value);
        if (e.value && e.value.length > 0) {
            const text = e.value[0];
            onSpeechResult(text);
        }
    };

    const onSpeechPartialResults = (e: SpeechResultsEvent) => {
        if (e.value && e.value.length > 0) {
            setPartialResult(e.value[0]);
        }
    };

    const startRecording = async () => {
        try {
            setPartialResult('');
            await Voice.start('en-US');
        } catch (e) {
            console.error('[VoiceInput] Start Error:', e);
        }
    };

    const stopRecording = async () => {
        try {
            await Voice.stop();
        } catch (e) {
            console.error('[VoiceInput] Stop Error:', e);
        }
    };

    return (
        <View style={styles.container}>
            {isRecording && !!partialResult && (
                <View style={styles.previewContainer}>
                    <Text style={styles.previewText} numberOfLines={1}>{partialResult}...</Text>
                </View>
            )}

            <TouchableOpacity
                style={[
                    styles.button,
                    isRecording && styles.recordingButton,
                    isProcessing && styles.processingButton
                ]}
                onPress={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
            >
                {isProcessing ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Ionicons
                        name={isRecording ? "stop" : "mic"}
                        size={24}
                        color="#fff"
                    />
                )}
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
        position: 'relative',
    },
    button: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    recordingButton: {
        backgroundColor: '#FF3B30',
        borderWidth: 2,
        borderColor: '#ffdddd'
    },
    processingButton: {
        backgroundColor: '#8E8E93',
    },
    previewContainer: {
        position: 'absolute',
        bottom: 50,
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 8,
        borderRadius: 8,
        minWidth: 100,
        maxWidth: 200,
    },
    previewText: {
        color: 'white',
        fontSize: 12,
    }
});
