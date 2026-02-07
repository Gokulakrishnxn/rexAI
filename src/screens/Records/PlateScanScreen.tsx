import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { YStack, XStack, Card, Text, Button } from 'tamagui';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { analyzePlate } from '../../services/visionService';
import type { NutritionResult } from '../../services/visionService';
import { useRecordsStore } from '../../store/useRecordsStore';
import { useTimelineStore } from '../../store/useTimelineStore';
import type { RecordsStackParamList } from '../../navigation/stacks/RecordsStack';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProp = NativeStackNavigationProp<RecordsStackParamList, 'PlateScan'>;

export function PlateScanScreen() {
  const navigation = useNavigation<NavigationProp>();
  const addRecord = useRecordsStore((s) => s.addRecord);
  const addTimelineEvent = useTimelineStore((s) => s.addEvent);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NutritionResult | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return;
    }
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });
    if (pickerResult.canceled || !pickerResult.assets?.[0]) return;
    const asset = pickerResult.assets[0];
    setImageUri(asset.uri);
    if (asset.base64) {
      runAnalysis(asset.base64);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const cameraResult = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });
    if (cameraResult.canceled || !cameraResult.assets?.[0]) return;
    const asset = cameraResult.assets[0];
    setImageUri(asset.uri);
    if (asset.base64) {
      runAnalysis(asset.base64);
    }
  };

  const runAnalysis = async (base64: string) => {
    setLoading(true);
    setResult(null);
    try {
      const nutrition = await analyzePlate(base64);
      setResult(nutrition);
      const title = nutrition.foodItems.length
        ? `Plate scanned: ${nutrition.foodItems.join(' + ')} (${nutrition.calories} kcal)`
        : 'Plate scanned';
      addRecord({
        id: `plate_${Date.now()}`,
        type: 'other',
        title,
        date: new Date().toISOString(),
        summary: nutrition.recommendation,
        doctor: 'Rex Plate Scan',
      });
      const foodLabel = nutrition.foodItems.length ? nutrition.foodItems.join(' + ') : 'Plate';
      addTimelineEvent({
        id: `tl_plate_${Date.now()}`,
        type: 'plate_scan',
        title: `Plate scanned: ${foodLabel}`,
        summary: nutrition.recommendation,
        timestamp: new Date().toISOString(),
        source: 'system',
      });
    } catch {
      setResult({
        foodItems: [],
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        recommendation: 'Unable to analyze, please retry.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <YStack flex={1} backgroundColor="#000000" padding="$4">
        <XStack alignItems="center" marginBottom="$4">
          <Button
            size="$3"
            circular
            chromeless
            icon={<Ionicons name="arrow-back" size={24} color="white" />}
            onPress={() => navigation.goBack()}
          />
          <Text fontSize="$6" fontWeight="700" color="white" marginLeft="$2">
            Scan Plate
          </Text>
        </XStack>

        {!result && !loading && (
          <YStack flex={1} gap="$4" justifyContent="center">
            <Card
              backgroundColor="#1C1C1E"
              borderRadius="$6"
              padding="$6"
              borderWidth={1}
              borderColor="#2C2C2E"
              alignItems="center"
            >
              <Ionicons name="nutrition" size={64} color="#3B82F6" style={{ marginBottom: 16 }} />
              <Text fontSize="$5" fontWeight="600" color="white" marginBottom="$2">
                Add a photo of your plate
              </Text>
              <Text fontSize="$3" color="#8E8E93" textAlign="center" marginBottom="$4">
                Pick from gallery or take a photo. Rex will estimate calories and macros.
              </Text>
              <XStack gap="$3">
                <Button
                  backgroundColor="#3B82F6"
                  paddingHorizontal="$4"
                  paddingVertical="$3"
                  borderRadius="$6"
                  icon={<Ionicons name="images" size={22} color="white" />}
                  onPress={pickImage}
                >
                  <Text color="white" fontWeight="600">Gallery</Text>
                </Button>
                <Button
                  backgroundColor="#1C1C1E"
                  borderWidth={1}
                  borderColor="#3B82F6"
                  paddingHorizontal="$4"
                  paddingVertical="$3"
                  borderRadius="$6"
                  icon={<Ionicons name="camera" size={22} color="#3B82F6" />}
                  onPress={takePhoto}
                >
                  <Text color="#3B82F6" fontWeight="600">Camera</Text>
                </Button>
              </XStack>
            </Card>
          </YStack>
        )}

        {loading && (
          <YStack flex={1} justifyContent="center" alignItems="center" gap="$3">
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text fontSize="$4" color="#8E8E93">Analyzing plate…</Text>
          </YStack>
        )}

        {result && !loading && (
          <YStack flex={1} gap="$4">
            <Card
              backgroundColor="#1C1C1E"
              borderRadius="$6"
              padding="$5"
              borderWidth={1}
              borderColor="#2C2C2E"
            >
              <Text fontSize="$4" fontWeight="700" color="#3B82F6" marginBottom="$3">
                Food
              </Text>
              <Text fontSize="$5" fontWeight="600" color="white" marginBottom="$4">
                {result.foodItems.length ? result.foodItems.join(', ') : '—'}
              </Text>

              <Text fontSize="$4" fontWeight="700" color="#3B82F6" marginBottom="$2">
                Calories
              </Text>
              <Text fontSize="$7" fontWeight="800" color="white" marginBottom="$4">
                {result.calories} kcal
              </Text>

              <Text fontSize="$4" fontWeight="700" color="#3B82F6" marginBottom="$2">
                Macros
              </Text>
              <XStack gap="$4" marginBottom="$4">
                <YStack flex={1} backgroundColor="#2C2C2E" padding="$3" borderRadius="$4">
                  <Text fontSize="$2" color="#8E8E93">Protein</Text>
                  <Text fontSize="$5" fontWeight="700" color="white">{result.protein}g</Text>
                </YStack>
                <YStack flex={1} backgroundColor="#2C2C2E" padding="$3" borderRadius="$4">
                  <Text fontSize="$2" color="#8E8E93">Carbs</Text>
                  <Text fontSize="$5" fontWeight="700" color="white">{result.carbs}g</Text>
                </YStack>
                <YStack flex={1} backgroundColor="#2C2C2E" padding="$3" borderRadius="$4">
                  <Text fontSize="$2" color="#8E8E93">Fat</Text>
                  <Text fontSize="$5" fontWeight="700" color="white">{result.fat}g</Text>
                </YStack>
              </XStack>

              <Text fontSize="$4" fontWeight="700" color="#3B82F6" marginBottom="$2">
                Rex recommendation
              </Text>
              <Text fontSize="$4" color="#E0E0E0" lineHeight={22}>
                {result.recommendation}
              </Text>
            </Card>

            <Button
              backgroundColor="#3B82F6"
              paddingVertical="$4"
              borderRadius="$6"
              onPress={() => { setResult(null); setImageUri(null); }}
            >
              <Text color="white" fontWeight="600">Scan another</Text>
            </Button>
          </YStack>
        )}
      </YStack>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
});
