import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, YStack, XStack } from 'tamagui';
import { X, Check, AlertCircle } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { uploadToStorage } from '../../services/supabase';
import { triggerIngestion } from '../../services/api/backendApi';
import { useRecordsStore } from '../../store/useRecordsStore';
import { HealthRecord } from '../../../types/record';

type NavigationProp = NativeStackNavigationProp<any>;

interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  errorMessage?: string;
}

const PROCESSING_STEPS: ProcessingStep[] = [
  { id: 'upload', label: 'Processing the Document', status: 'pending' },
  { id: 'analyze', label: 'Analysing the Document', status: 'pending' },
  { id: 'verify', label: 'Verifying Medical Document', status: 'pending' },
  { id: 'save', label: 'Uploading to DB', status: 'pending' },
];

export function DocumentProcessingScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { fileUri, fileName, mimeType, userId, targetScreen } = route.params as {
    fileUri: string;
    fileName: string;
    mimeType: string;
    userId: string;
    targetScreen?: string;
  };

  const { addRecord, updateRecord, removeRecord } = useRecordsStore();
  const [steps, setSteps] = useState<ProcessingStep[]>(PROCESSING_STEPS);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [errorReason, setErrorReason] = useState<string>('');
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Rotate animation
  useEffect(() => {
    if (!hasError) {
      const rotation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      rotation.start();
      return () => rotation.stop();
    }
  }, [hasError]);

  // Progress animation
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: hasError ? (currentStep + 0.5) / PROCESSING_STEPS.length : (currentStep + 1) / PROCESSING_STEPS.length,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [currentStep, hasError]);

  // Run processing
  useEffect(() => {
    let cancelled = false;
    const recordId = Date.now().toString();

    const processDocument = async () => {
      // Create initial record
      const newRecord: HealthRecord = {
        id: recordId,
        type: mimeType?.includes('image') ? 'imaging' : mimeType?.includes('pdf') ? 'lab' : 'other',
        title: fileName,
        date: new Date().toISOString(),
        fileUri: fileUri,
        doctor: 'Pending Extraction',
        ingestionStatus: 'uploading'
      };
      addRecord(newRecord);

      try {
        // Step 1: Processing Document
        updateStepStatus(0, 'active');
        await delay(500);
        if (cancelled) return;

        // Upload to storage
        const { url, path } = await uploadToStorage(
          userId,
          fileUri,
          fileName,
          mimeType || 'application/octet-stream'
        );

        updateRecord(recordId, {
          supabaseUrl: url,
          storagePath: path,
          ingestionStatus: 'processing',
        });

        updateStepStatus(0, 'completed');
        if (cancelled) return;

        // Step 2: Analysing Document
        setCurrentStep(1);
        updateStepStatus(1, 'active');
        await delay(400);
        if (cancelled) return;

        // Step 3: Verifying Medical Document (actual ingestion)
        setCurrentStep(2);
        updateStepStatus(1, 'completed');
        updateStepStatus(2, 'active');

        const ingestResult = await triggerIngestion({
          fileUrl: url,
          fileName: fileName,
          fileType: mimeType || 'application/octet-stream',
        }, 'agentic');

        if (cancelled) return;

        if (!ingestResult.success) {
          // Handle verification/validation failure
          const failReason = ingestResult.reason || ingestResult.error || 'Document verification failed';
          updateStepStatus(2, 'failed');
          setSteps(prev => {
            const updated = [...prev];
            updated[2] = {
              ...updated[2],
              status: 'failed',
              errorMessage: failReason
            };
            return updated;
          });
          setHasError(true);
          setErrorReason(failReason);

          updateRecord(recordId, {
            ingestionStatus: 'error',
            ingestionError: ingestResult.error,
          });

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }

        updateStepStatus(2, 'completed');
        if (cancelled) return;

        // Step 4: Uploading to DB
        setCurrentStep(3);
        updateStepStatus(3, 'active');
        await delay(400);

        updateRecord(recordId, {
          documentId: ingestResult.documentId,
          summary: ingestResult.summary,
          ingestionStatus: 'complete',
          doctor: 'AI Extracted'
        });

        updateStepStatus(3, 'completed');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Navigate to Records screen or target screen on success
        await delay(500);
        if (!cancelled) {
          if (targetScreen === 'MedicalInsights' && ingestResult.documentId) {
            navigation.replace('MedicalInsights', {
              documentId: ingestResult.documentId,
              documentTitle: fileName,
            });
          } else {
            navigation.replace('RecordsDashboard');
          }
        }

      } catch (error: any) {
        if (!cancelled) {
          const errorMsg = error.message || 'An unexpected error occurred';

          // Determine which step failed
          if (currentStep === 0) {
            updateStepStatus(0, 'failed');
            setSteps(prev => {
              const updated = [...prev];
              updated[0] = { ...updated[0], status: 'failed', errorMessage: errorMsg };
              return updated;
            });
          } else if (currentStep === 1) {
            updateStepStatus(1, 'failed');
            setSteps(prev => {
              const updated = [...prev];
              updated[1] = { ...updated[1], status: 'failed', errorMessage: errorMsg };
              return updated;
            });
          } else {
            updateStepStatus(2, 'failed');
            setSteps(prev => {
              const updated = [...prev];
              updated[2] = { ...updated[2], status: 'failed', errorMessage: errorMsg };
              return updated;
            });
          }

          setHasError(true);
          setErrorReason(errorMsg);

          updateRecord(recordId, {
            ingestionStatus: 'error',
            ingestionError: errorMsg,
          });

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    };

    processDocument();

    return () => {
      cancelled = true;
    };
  }, []);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const updateStepStatus = (index: number, status: ProcessingStep['status']) => {
    setSteps((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], status };
      return updated;
    });
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.goBack();
  };

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.replace('RecordsDashboard');
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const circumference = 2 * Math.PI * 70;
  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, circumference * 0.25],
  });

  const circleColor = hasError ? '#FF3B30' : '#007AFF';

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={hasError ? handleDismiss : handleCancel} style={styles.closeButton}>
            <X size={24} color="#8E8E93" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <YStack flex={1} alignItems="center" justifyContent="center" paddingHorizontal={24}>
          {/* Animated Circle */}
          <View style={styles.circleContainer}>
            <Animated.View style={!hasError ? { transform: [{ rotate: spin }] } : undefined}>
              <Svg width={160} height={160}>
                {/* Background Circle */}
                <Circle
                  cx={80}
                  cy={80}
                  r={70}
                  stroke={hasError ? '#FFE5E5' : '#E5E5EA'}
                  strokeWidth={4}
                  fill="transparent"
                />
                {/* Progress Circle */}
                <AnimatedCircle
                  cx={80}
                  cy={80}
                  r={70}
                  stroke={circleColor}
                  strokeWidth={4}
                  fill="transparent"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  rotation={-90}
                  origin="80, 80"
                />
              </Svg>
            </Animated.View>
            {/* Center Icon */}
            <View style={[styles.centerIcon, hasError && styles.centerIconError]}>
              <AlertCircle size={32} color={hasError ? 'white' : '#007AFF'} strokeWidth={2} />
            </View>
          </View>

          {/* Title */}
          <Text fontSize={24} fontWeight="700" color="#1C1C1E" marginTop={32}>
            {hasError ? 'Analysis Interrupted' : 'Processing Document'}
          </Text>
          <Text fontSize={15} color="#8E8E93" marginTop={8} textAlign="center">
            {hasError
              ? 'There was an issue processing your medical document.'
              : 'Please wait while our AI processes your document.'
            }
          </Text>

          {/* Steps Card */}
          <View style={styles.stepsCard}>
            {steps.map((step, index) => (
              <View key={step.id}>
                <View style={[
                  styles.stepRow,
                  step.status === 'failed' && styles.stepRowFailed
                ]}>
                  <XStack alignItems="center" gap="$3" paddingVertical={14}>
                    <View style={[
                      styles.stepIndicator,
                      step.status === 'completed' && styles.stepIndicatorCompleted,
                      step.status === 'active' && styles.stepIndicatorActive,
                      step.status === 'failed' && styles.stepIndicatorFailed,
                    ]}>
                      {step.status === 'completed' ? (
                        <Check size={14} color="white" strokeWidth={3} />
                      ) : step.status === 'failed' ? (
                        <X size={14} color="white" strokeWidth={3} />
                      ) : step.status === 'active' ? (
                        <View style={styles.activeDot} />
                      ) : null}
                    </View>
                    <Text
                      fontSize={15}
                      fontWeight={step.status === 'active' || step.status === 'failed' ? '600' : '400'}
                      color={
                        step.status === 'completed'
                          ? '#1C1C1E'
                          : step.status === 'active'
                            ? '#007AFF'
                            : step.status === 'failed'
                              ? '#FF3B30'
                              : '#C7C7CC'
                      }
                    >
                      {step.label}
                    </Text>
                  </XStack>
                </View>
                {/* Error message for failed step */}
                {step.status === 'failed' && step.errorMessage && (
                  <View style={styles.errorMessageContainer}>
                    <Text fontSize={13} fontWeight="600" color="#FF3B30">
                      Not a medical document
                    </Text>
                    <Text fontSize={12} color="#666" marginTop={4}>
                      {step.errorMessage}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </YStack>

        {/* Bottom Button */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={hasError ? handleDismiss : handleCancel}
        >
          <Text fontSize={16} fontWeight="500" color={hasError ? '#FF3B30' : '#8E8E93'}>
            {hasError ? 'Cancel Processing' : 'Cancel Processing'}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

// Animated Circle component
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleContainer: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerIcon: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerIconError: {
    backgroundColor: '#FF3B30',
  },
  stepsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginTop: 40,
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
  },
  stepRow: {
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  stepRowFailed: {
    backgroundColor: '#FFF0F0',
  },
  stepIndicator: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndicatorCompleted: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  stepIndicatorActive: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  stepIndicatorFailed: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  errorMessageContainer: {
    backgroundColor: '#FFF5F5',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 20,
  },
});
