import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, YStack, XStack } from 'tamagui';
import { ChevronLeft, Sparkles, Check } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { analyzeMedication } from '../../services/api/backendApi';

type NavigationProp = NativeStackNavigationProp<any>;

interface AnalysisStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed';
}

const ANALYSIS_STEPS: AnalysisStep[] = [
  { id: 'scan', label: 'Scanning document quality', status: 'pending' },
  { id: 'extract', label: 'Extracting medication names', status: 'pending' },
  { id: 'dosage', label: 'Identifying dosage', status: 'pending' },
  { id: 'interactions', label: 'Checking interactions', status: 'pending' },
];

export function AnalyzingPrescriptionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { imageBase64, imageUri } = route.params as { imageBase64: string; imageUri: string };

  const [steps, setSteps] = useState<AnalysisStep[]>(ANALYSIS_STEPS);
  const [currentStep, setCurrentStep] = useState(0);
  const [isCancelled, setIsCancelled] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Rotate animation for the progress circle
  useEffect(() => {
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
  }, []);

  // Progress animation
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (currentStep + 1) / ANALYSIS_STEPS.length,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [currentStep]);

  // Simulate step progression and actual API call
  useEffect(() => {
    let cancelled = false;

    const runAnalysis = async () => {
      // Step 1: Scanning document quality (simulate)
      await simulateStep(0, 800);
      if (cancelled) return;

      // Step 2: Extracting medication names (actual API call starts)
      setCurrentStep(1);
      updateStepStatus(0, 'completed');
      updateStepStatus(1, 'active');

      try {
        // Make the actual API call
        const response = await analyzeMedication({ imageBase64 });

        if (cancelled) return;

        // Complete remaining steps quickly
        await simulateStep(2, 400);
        if (cancelled) return;
        updateStepStatus(1, 'completed');
        updateStepStatus(2, 'active');
        setCurrentStep(2);

        await simulateStep(3, 400);
        if (cancelled) return;
        updateStepStatus(2, 'completed');
        updateStepStatus(3, 'active');
        setCurrentStep(3);

        await simulateStep(4, 300);
        if (cancelled) return;
        updateStepStatus(3, 'completed');

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Navigate to verification screen
        if (response.success && response.drafts) {
          navigation.replace('MedicationReview', {
            preloadedDrafts: response.drafts,
            imageUri,
            imageBase64,
          });
        } else {
          navigation.goBack();
          setTimeout(() => {
            alert(response.error || 'Failed to analyze prescription');
          }, 300);
        }
      } catch (error) {
        if (!cancelled) {
          navigation.goBack();
          setTimeout(() => {
            alert('Error analyzing prescription. Please try again.');
          }, 300);
        }
      }
    };

    const simulateStep = (step: number, delay: number): Promise<void> => {
      return new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
    };

    // Start with first step active
    updateStepStatus(0, 'active');
    runAnalysis();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateStepStatus = (index: number, status: 'pending' | 'active' | 'completed') => {
    setSteps((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], status };
      return updated;
    });
  };

  const handleCancel = () => {
    setIsCancelled(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.goBack();
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

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
            <ChevronLeft size={24} color="#1C1C1E" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <YStack flex={1} alignItems="center" justifyContent="center" paddingHorizontal={24}>
          {/* Animated Circle with Sparkles */}
          <View style={styles.circleContainer}>
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <Svg width={160} height={160}>
                {/* Background Circle */}
                <Circle
                  cx={80}
                  cy={80}
                  r={70}
                  stroke="#E5E5EA"
                  strokeWidth={4}
                  fill="transparent"
                />
                {/* Progress Circle */}
                <AnimatedCircle
                  cx={80}
                  cy={80}
                  r={70}
                  stroke="#007AFF"
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
            <View style={styles.centerIcon}>
              <Sparkles size={40} color="#007AFF" strokeWidth={1.5} />
            </View>
          </View>

          {/* Title */}
          <Text fontSize={24} fontWeight="700" color="#1C1C1E" marginTop={32}>
            Analyzing Prescription
          </Text>
          <Text fontSize={15} color="#8E8E93" marginTop={8} textAlign="center">
            Please wait while our AI processes your document.
          </Text>

          {/* Steps Card */}
          <View style={styles.stepsCard}>
            {steps.map((step, index) => (
              <XStack key={step.id} alignItems="center" gap="$3" paddingVertical={12}>
                <View style={[
                  styles.stepIndicator,
                  step.status === 'completed' && styles.stepIndicatorCompleted,
                  step.status === 'active' && styles.stepIndicatorActive,
                ]}>
                  {step.status === 'completed' ? (
                    <Check size={14} color="white" strokeWidth={3} />
                  ) : step.status === 'active' ? (
                    <View style={styles.activeDot} />
                  ) : null}
                </View>
                <Text
                  fontSize={15}
                  fontWeight={step.status === 'active' ? '600' : '400'}
                  color={
                    step.status === 'completed'
                      ? '#1C1C1E'
                      : step.status === 'active'
                      ? '#007AFF'
                      : '#C7C7CC'
                  }
                >
                  {step.label}
                </Text>
              </XStack>
            ))}
          </View>
        </YStack>

        {/* Cancel Button */}
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text fontSize={16} fontWeight="500" color="#8E8E93">
            Cancel Processing
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
  backButton: {
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginTop: 40,
    width: '100%',
    maxWidth: 340,
  },
  stepIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 20,
  },
});

export default AnalyzingPrescriptionScreen;
