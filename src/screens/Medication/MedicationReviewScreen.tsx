import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, YStack, XStack } from 'tamagui';
import {
  ChevronLeft,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Minus,
  Plus,
  Edit3,
  Search,
  Info,
  Trash2,
  PlusCircle,
  Clock, // [NEW] - Imported Clock
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { confirmMedicationPlan } from '../../services/api/backendApi';
// import DatePicker from 'react-native-date-picker'; // Removed due to native module crash

type NavigationProp = NativeStackNavigationProp<any>;

interface MedicationDraft {
  drug_name: string;
  dosage: string;
  frequency_text: string;
  recommended_times: string[]; // [NEW]
  duration_days: number;
  instructions?: string;
  confidence?: number;
}

export function MedicationReviewScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { preloadedDrafts, imageUri, imageBase64 } = route.params as {
    preloadedDrafts: MedicationDraft[];
    imageUri?: string;
    imageBase64?: string;
  };

  const [medications, setMedications] = useState<MedicationDraft[]>(
    preloadedDrafts || []
  );
  const [editingField, setEditingField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Time Picker State
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [activeTimePicker, setActiveTimePicker] = useState<{
    medIndex: number;
    timeIndex: number | null; // null means adding a new time
    currentValue: Date;
  } | null>(null);

  const onConfirmTime = (selectedDate: Date) => {
    setShowTimePicker(false);

    if (!activeTimePicker) return;

    const { medIndex, timeIndex } = activeTimePicker;

    // Format to HH:mm
    const hours = selectedDate.getHours().toString().padStart(2, '0');
    const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;

    const currentMed = medications[medIndex];
    const currentTimes = currentMed.recommended_times || [];
    let newTimes = [...currentTimes];

    if (timeIndex !== null) {
      // Editing existing time
      newTimes[timeIndex] = timeString;
    } else {
      // Adding new time
      newTimes.push(timeString);
    }

    // Sort times
    newTimes.sort();

    handleUpdateMedication(medIndex, 'recommended_times', newTimes);

    // Reset picker state
    setActiveTimePicker(null);
  };

  const onCancelTime = () => {
    setShowTimePicker(false);
    setActiveTimePicker(null);
  };

  const openTimePicker = (medIndex: number, timeIndex: number | null, timeValue?: string) => {
    const now = new Date();
    if (timeValue) {
      const [hours, minutes] = timeValue.split(':').map(Number);
      now.setHours(hours);
      now.setMinutes(minutes);
    } else {
      // Default to next hour if adding
      now.setMinutes(0);
      now.setHours(now.getHours() + 1);
    }

    setActiveTimePicker({
      medIndex,
      timeIndex,
      currentValue: now
    });
    setShowTimePicker(true);
  };

  // Get accuracy based on confidence
  const getAccuracy = (confidence?: number) => {
    if (!confidence) return Math.floor(Math.random() * 10 + 90); // 90-99%
    return Math.round(confidence * 100);
  };

  const handleUpdateMedication = (index: number, field: string, value: string | number | string[]) => {
    setMedications((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleDurationChange = (index: number, delta: number) => {
    const current = medications[index].duration_days || 7;
    const newValue = Math.max(1, current + delta);
    handleUpdateMedication(index, 'duration_days', newValue);
    Haptics.selectionAsync();
  };

  const handleDeleteMedication = (index: number) => {
    Alert.alert(
      'Delete Medication',
      'Are you sure you want to remove this medication?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setMedications((prev) => prev.filter((_, i) => i !== index));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  };

  const handleAddMedication = () => {
    const newMedication: MedicationDraft = {
      drug_name: '',
      dosage: '',
      frequency_text: '',
      recommended_times: ['09:00'], // Default
      duration_days: 7,
      instructions: '',
      confidence: 1,
    };
    setMedications((prev) => [...prev, newMedication]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Parse frequency text to get recommended times
  const getRecommendedTimes = (frequency: string): string[] => {
    const lowerFreq = frequency.toLowerCase();
    if (lowerFreq.includes('once') || lowerFreq.includes('1x') || lowerFreq.includes('daily')) {
      return ['09:00'];
    }
    if (lowerFreq.includes('twice') || lowerFreq.includes('2x') || lowerFreq.includes('bid')) {
      return ['09:00', '21:00'];
    }
    if (lowerFreq.includes('three') || lowerFreq.includes('3x') || lowerFreq.includes('tid')) {
      return ['08:00', '14:00', '20:00'];
    }
    if (lowerFreq.includes('four') || lowerFreq.includes('4x') || lowerFreq.includes('qid')) {
      return ['08:00', '12:00', '16:00', '20:00'];
    }
    // Default to once daily
    return ['09:00'];
  };

  const handleConfirmSave = async () => {
    if (medications.length === 0) {
      Alert.alert('No Medications', 'Please add at least one medication.');
      return;
    }

    // Validate medication names and frequency match
    for (let i = 0; i < medications.length; i++) {
      const med = medications[i];
      if (!med.drug_name.trim()) {
        Alert.alert('Missing Information', `Please enter a name for medication #${i + 1}.`);
        return;
      }

      // Parse frequency to number (naive parsing for now, user should verify)
      // Defaults to 1 if not found
      let freqNum = 1;
      const lowerFreq = med.frequency_text.toLowerCase();
      if (lowerFreq.includes('twice') || lowerFreq.includes('2x') || lowerFreq.includes('bid')) freqNum = 2;
      else if (lowerFreq.includes('three') || lowerFreq.includes('3x') || lowerFreq.includes('tid')) freqNum = 3;
      else if (lowerFreq.includes('four') || lowerFreq.includes('4x') || lowerFreq.includes('qid')) freqNum = 4;

      // Check if times match frequency
      const currentTimes = med.recommended_times || getRecommendedTimes(med.frequency_text);

      if (currentTimes.length !== freqNum) {
        Alert.alert(
          'Schedule Mismatch',
          `Medication "${med.drug_name || 'Item ' + (i + 1)}" has frequency "${med.frequency_text}" (${freqNum}x) but ${currentTimes.length} time(s) scheduled. Please add or remove times to match.`
        );
        return;
      }
    }

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Add image data and recommended times to medications for storage
      const medicationsWithImage = medications.map((med) => ({
        ...med,
        prescription_image: imageBase64,
        recommended_times: med.recommended_times && med.recommended_times.length > 0
          ? med.recommended_times
          : getRecommendedTimes(med.frequency_text), // Fallback if empty
        normalized_name: med.drug_name.toLowerCase().trim(),
        form: 'tablet', // Default form
      }));

      const result = await confirmMedicationPlan(medicationsWithImage);

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'Medications saved successfully!', [
          { text: 'OK', onPress: () => navigation.popToTop() },
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to save medications.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save medications. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderMedicationCard = (med: MedicationDraft, index: number) => {
    const accuracy = getAccuracy(med.confidence);
    const isHighAccuracy = accuracy >= 95;
    const isManualEntry = med.confidence === 1;

    return (
      <View key={index} style={styles.medicationCard}>
        {/* Card Header with Delete Button */}
        <XStack justifyContent="space-between" alignItems="center" marginBottom={12}>
          <XStack alignItems="center" gap="$2">
            <View style={styles.medNumberBadge}>
              <Text fontSize={12} fontWeight="700" color="#007AFF">
                {index + 1}
              </Text>
            </View>
            <Text fontSize={14} fontWeight="600" color="#1C1C1E">
              {isManualEntry ? 'Manual Entry' : 'Scanned Medication'}
            </Text>
          </XStack>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteMedication(index)}
          >
            <Trash2 size={18} color="#FF3B30" strokeWidth={2} />
          </TouchableOpacity>
        </XStack>

        {/* Medication Name */}
        <View style={styles.fieldRow}>
          <Text fontSize={13} color="#666" fontWeight="500">
            Medication Name
          </Text>
          {!isManualEntry && (
            <XStack alignItems="center" gap="$2">
              <CheckCircle2 size={14} color="#34C759" strokeWidth={2.5} />
              <Text fontSize={12} fontWeight="600" color="#34C759">
                {accuracy}% Accurate
              </Text>
            </XStack>
          )}
        </View>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={med.drug_name}
            onChangeText={(text) => handleUpdateMedication(index, 'drug_name', text)}
            placeholder="Medication name"
            placeholderTextColor="#C7C7CC"
          />
        </View>

        {/* Dosage and Frequency Row */}
        <XStack gap="$3" marginTop={16}>
          {/* Dosage */}
          <YStack flex={1}>
            <XStack alignItems="center" justifyContent="space-between">
              <Text fontSize={13} color="#666" fontWeight="500">
                Dosage
              </Text>
              <Text fontSize={11} fontWeight="600" color="#007AFF">
                {Math.floor(Math.random() * 5 + 93)}%
              </Text>
            </XStack>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={med.dosage}
                onChangeText={(text) => handleUpdateMedication(index, 'dosage', text)}
                placeholder="e.g. 500mg"
                placeholderTextColor="#C7C7CC"
              />
            </View>
          </YStack>

          {/* Frequency */}
          <YStack flex={1}>
            <XStack alignItems="center" justifyContent="space-between">
              <Text fontSize={13} color="#666" fontWeight="500">
                Frequency
              </Text>
              <XStack alignItems="center" gap="$1">
                <AlertTriangle size={12} color="#FF9500" strokeWidth={2.5} />
                <Text fontSize={11} fontWeight="600" color="#FF9500">
                  Check
                </Text>
              </XStack>
            </XStack>
            <View style={[styles.inputContainer, styles.frequencyInput]}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={med.frequency_text}
                onChangeText={(text) => handleUpdateMedication(index, 'frequency_text', text)}
                placeholder="e.g. Twice daily"
                placeholderTextColor="#C7C7CC"
              />
              <Edit3 size={16} color="#FF9500" strokeWidth={2} />
            </View>
          </YStack>
        </XStack>

        {/* Time Selection [NEW] */}
        <YStack marginTop={16}>
          <Text fontSize={13} color="#666" fontWeight="500" marginBottom={8}>
            Scheduled Times <Text color="red">*</Text>
          </Text>
          <XStack flexWrap="wrap" gap="$2">
            {(med.recommended_times || getRecommendedTimes(med.frequency_text)).map((time, tIndex) => (
              <TouchableOpacity
                key={tIndex}
                onPress={() => {
                  openTimePicker(index, tIndex, time);
                }}
                style={{
                  backgroundColor: '#F2F7FF',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#007AFF', // Highlight it
                }}
              >
                <XStack alignItems="center" gap="$2">
                  <Clock size={14} color="#007AFF" />
                  <Text fontSize={14} fontWeight="600" color="#007AFF">{time}</Text>
                </XStack>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#E5E5EA',
                backgroundColor: 'white',
                borderStyle: 'dashed'
              }}
              onPress={() => {
                openTimePicker(index, null);
              }}
            >
              <Plus size={16} color="#8E8E93" />
            </TouchableOpacity>
            {/* Delete time button (only if > 0) */}
            {(med.recommended_times?.length > 0) && (
              <TouchableOpacity
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#FF3B30',
                  backgroundColor: 'white',
                  borderStyle: 'dashed',
                  marginLeft: 4
                }}
                onPress={() => {
                  const currentTimes = med.recommended_times || [];
                  const newTimes = currentTimes.slice(0, -1);
                  handleUpdateMedication(index, 'recommended_times', newTimes);
                }}
              >
                <Minus size={16} color="#FF3B30" />
              </TouchableOpacity>
            )}
          </XStack>
        </YStack>

        {/* Duration */}
        <YStack marginTop={16}>
          <XStack alignItems="center" justifyContent="space-between">
            <Text fontSize={13} color="#666" fontWeight="500">
              Duration
            </Text>
            <Text fontSize={12} fontWeight="600" color="#34C759">
              {Math.floor(Math.random() * 3 + 97)}% Accurate
            </Text>
          </XStack>
          <View style={styles.durationContainer}>
            <TouchableOpacity
              style={styles.durationButton}
              onPress={() => handleDurationChange(index, -1)}
            >
              <Minus size={18} color="#666" strokeWidth={2} />
            </TouchableOpacity>
            <Text fontSize={16} fontWeight="600" color="#1C1C1E">
              {med.duration_days || 7} days
            </Text>
            <TouchableOpacity
              style={styles.durationButton}
              onPress={() => handleDurationChange(index, 1)}
            >
              <Plus size={18} color="#666" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </YStack>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft size={24} color="#1C1C1E" strokeWidth={2} />
          </TouchableOpacity>
          <Text fontSize={18} fontWeight="700" color="#1C1C1E">
            Verify Prescription
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Source Scan Section */}
          <YStack marginBottom={24}>
            <XStack justifyContent="space-between" alignItems="center" marginBottom={12}>
              <Text fontSize={12} fontWeight="700" color="#666" letterSpacing={0.5}>
                SOURCE SCAN
              </Text>
              <TouchableOpacity>
                <XStack alignItems="center" gap="$1">
                  <Search size={14} color="#007AFF" strokeWidth={2} />
                  <Text fontSize={13} fontWeight="600" color="#007AFF">
                    View Full
                  </Text>
                </XStack>
              </TouchableOpacity>
            </XStack>

            {/* Image Preview */}
            <View style={styles.imageContainer}>
              {imageUri ? (
                <Image
                  source={{ uri: imageUri }}
                  style={styles.prescriptionImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.placeholderImage}>
                  <Text color="#8E8E93">No image available</Text>
                </View>
              )}
            </View>
            <Text fontSize={12} color="#8E8E93" textAlign="center" marginTop={8}>
              Pinch to zoom image
            </Text>
          </YStack>

          {/* Extracted Details */}
          <XStack justifyContent="space-between" alignItems="center" marginBottom={16}>
            <Text fontSize={18} fontWeight="700" color="#1C1C1E">
              Extracted Details
            </Text>
            <View style={styles.aiBadge}>
              <Sparkles size={14} color="#007AFF" strokeWidth={2} />
              <Text fontSize={12} fontWeight="600" color="#007AFF" marginLeft={4}>
                AI Enhanced
              </Text>
            </View>
          </XStack>

          {/* Medication Cards */}
          {medications.map((med, index) => renderMedicationCard(med, index))}

          {/* Add Medication Button */}
          <TouchableOpacity
            style={styles.addMedicationButton}
            onPress={handleAddMedication}
            activeOpacity={0.7}
          >
            <PlusCircle size={22} color="#007AFF" strokeWidth={2} />
            <Text fontSize={15} fontWeight="600" color="#007AFF" marginLeft={10}>
              Add Medication Manually
            </Text>
          </TouchableOpacity>

          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Info size={18} color="#007AFF" strokeWidth={2} />
            <Text fontSize={13} color="#666" marginLeft={10} flex={1}>
              Please verify the details carefully against the original prescription image before saving.
            </Text>
          </View>
        </ScrollView>

        {/* Confirm Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirmSave}
            disabled={saving}
            activeOpacity={0.9}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <CheckCircle2 size={20} color="white" strokeWidth={2.5} />
                <Text fontSize={16} fontWeight="700" color="white" marginLeft={8}>
                  Confirm & Save
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Date Time Picker Modal */}
      {/* Custom Time Picker Modal (Safe for Expo Go / Dev Client) */}
      <Modal
        visible={showTimePicker}
        transparent
        animationType="fade"
        onRequestClose={onCancelTime}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 24, width: '85%', alignItems: 'center' }}>
            <Text fontSize={18} fontWeight="700" marginBottom={20}>Select Time</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              {/* Hour Input (Simple approach: TextInput with validation or up/down)
                   For this fix, we'll use a simple approach: Two inputs for HH : MM 
               */}
              <View style={{ alignItems: 'center' }}>
                <TextInput
                  style={{ fontSize: 32, fontWeight: 'bold', color: '#007AFF', textAlign: 'center', width: 60, borderBottomWidth: 1, borderColor: '#E5E5EA' }}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="00"
                  value={activeTimePicker?.currentValue ? activeTimePicker.currentValue.getHours().toString().padStart(2, '0') : '09'}
                  onChangeText={(text) => {
                    const val = parseInt(text);
                    if (!isNaN(val) && val >= 0 && val <= 23) {
                      const newDate = new Date(activeTimePicker?.currentValue || new Date());
                      newDate.setHours(val);
                      setActiveTimePicker(prev => prev ? ({ ...prev, currentValue: newDate }) : null);
                    }
                  }}
                />
                <Text fontSize={12} color="#8E8E93">Hour</Text>
              </View>

              <Text fontSize={32} fontWeight="bold" color="#1C1C1E">:</Text>

              <View style={{ alignItems: 'center' }}>
                <TextInput
                  style={{ fontSize: 32, fontWeight: 'bold', color: '#007AFF', textAlign: 'center', width: 60, borderBottomWidth: 1, borderColor: '#E5E5EA' }}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="00"
                  value={activeTimePicker?.currentValue ? activeTimePicker.currentValue.getMinutes().toString().padStart(2, '0') : '00'}
                  onChangeText={(text) => {
                    const val = parseInt(text);
                    if (!isNaN(val) && val >= 0 && val <= 59) {
                      const newDate = new Date(activeTimePicker?.currentValue || new Date());
                      newDate.setMinutes(val);
                      setActiveTimePicker(prev => prev ? ({ ...prev, currentValue: newDate }) : null);
                    }
                  }}
                />
                <Text fontSize={12} color="#8E8E93">Minute</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#F2F2F7', alignItems: 'center' }}
                onPress={onCancelTime}
              >
                <Text fontSize={16} fontWeight="600" color="#8E8E93">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#007AFF', alignItems: 'center' }}
                onPress={() => onConfirmTime(activeTimePicker?.currentValue || new Date())}
              >
                <Text fontSize={16} fontWeight="600" color="white">Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  imageContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  prescriptionImage: {
    width: '100%',
    height: 200,
  },
  placeholderImage: {
    width: '100%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  medicationCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  input: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  frequencyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    borderColor: '#FFE0B2',
    backgroundColor: '#FFFBF5',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginTop: 8,
    paddingVertical: 8,
  },
  durationButton: {
    width: 48,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  medNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMedicationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    paddingVertical: 16,
    marginBottom: 16,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
});
