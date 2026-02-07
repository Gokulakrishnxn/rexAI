import React, { useState } from 'react';
import { ScrollView as RNScrollView, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  YStack,
  XStack,
  Card,
  Text,
  Button,
  Checkbox,
  Tabs,
  Progress,
  Input,
  ScrollView,
} from 'tamagui';
import * as DocumentPicker from 'expo-document-picker';
import { HeaderWave } from '@/components/ui/HeaderWave';
import { ResponsiveContainer } from '@/components/ui/ResponsiveContainer';
import { Ionicons } from '@expo/vector-icons';
import { useRecordsStore } from '../../store/useRecordsStore';
import { useMedAgentStore } from '../../store/useMedAgentStore';
import { useUserStore } from '../../store/useUserStore';
import { RecordCard } from '../../components/ui/RecordCard';
import { MedicationCard } from '../../components/ui/MedicationCard';
import type { RecordsStackParamList } from '../../navigation/stacks/RecordsStack';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProp = NativeStackNavigationProp<RecordsStackParamList>;

interface SummaryCardProps {
  title: string;
  children: React.ReactNode;
}

function SummaryCard({ title, children }: SummaryCardProps) {
  return (
    <Card
      flex={1}
      padding="$4"
      borderRadius="$5"
      backgroundColor="$background"
      borderWidth={1}
      borderColor="$borderColor"
      minWidth={160}
    >
      <Text fontSize="$4" fontWeight="700" color="$color" marginBottom="$3">
        {title}
      </Text>
      {children}
    </Card>
  );
}

function PillBadge({ label, variant = 'default' }: { label: string; variant?: 'default' | 'destructive' | 'success' }) {
  const bgColor = variant === 'destructive' ? '$red4' : variant === 'success' ? '$green4' : '$blue4';
  const textColor = variant === 'destructive' ? '$red11' : variant === 'success' ? '$green11' : '$blue11';

  return (
    <XStack
      paddingHorizontal="$2"
      paddingVertical="$1"
      borderRadius="$4"
      backgroundColor={bgColor}
      marginRight="$1"
      marginBottom="$1"
    >
      <Text fontSize="$2" fontWeight="600" color={textColor}>
        {label}
      </Text>
    </XStack>
  );
}

export function RecordsDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { records } = useRecordsStore();
  const { activeMeds, compliance } = useMedAgentStore();
  const { profile } = useUserStore();
  const { addRecord } = useRecordsStore();
  const [activeTab, setActiveTab] = useState('timeline');

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // Allow all file types
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const { assets } = result;
      if (assets && assets[0]) {
        const file = assets[0];

        // Create a new record from the uploaded file
        const newRecord = {
          id: Date.now().toString(),
          type: 'other', // Default type for uploads
          title: file.name,
          date: new Date().toISOString(),
          fileUri: file.uri,
          doctor: 'Uploaded',
        };

        // Add to store (simulating storage)
        // Note: In a real app, you'd upload this to a server/storage bucket first
        addRecord(newRecord as any); // Type assertion needed until full compatibility

        // Optional: Navigate to detail or show success feedback
        // For now, we'll just let the list update
      }
    } catch (error) {
      console.error('Error picking document:', error);
    }
  };

  // Mock data for demo
  const conditions = ['Diabetes Type 2', 'Hypertension'];
  const allergies = profile?.allergies || ['Penicillin', 'Peanuts'];
  const vaccinations = ['COVID-19 (2023)', 'Flu (2024)'];

  const timelineRecords = records.length > 0 ? records : [
    { id: '1', type: 'lab', title: 'Complete Blood Count', date: '2024-01-15', doctor: 'Dr. Smith', hospital: 'City Hospital' },
    { id: '2', type: 'prescription', title: 'Metformin 500mg', date: '2024-01-10', doctor: 'Dr. Johnson' },
    { id: '3', type: 'imaging', title: 'Chest X-Ray', date: '2024-01-05', hospital: 'Medical Center' },
  ];

  const prescriptions = activeMeds.length > 0 ? activeMeds : [
    { id: '1', name: 'Metformin', dosage: '500mg', frequency: 'Twice daily' },
    { id: '2', name: 'Aspirin', dosage: '81mg', frequency: 'Once daily' },
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'lab': return 'flask';
      case 'prescription': return 'medical';
      case 'imaging': return 'scan';
      default: return 'document-text';
    }
  };

  const complianceRate = prescriptions.length > 0
    ? Object.values(compliance).filter(Boolean).length / prescriptions.length
    : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      <YStack flex={1} backgroundColor="#000000">
        <ResponsiveContainer>
          {/* Header Title */}
          <XStack paddingHorizontal="$4" paddingTop="$2" paddingBottom="$4" alignItems="center" justifyContent="space-between">
            <Text fontSize="$8" fontWeight="800" color="white" letterSpacing={-0.5}>
              Medical Records
            </Text>
            <Button size="$3" circular chromeless icon={<Ionicons name="filter" size={24} color="white" />} />
          </XStack>

          <RNScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Scan Plate entry */}
            <YStack paddingHorizontal="$4" marginBottom="$4">
              <Button
                backgroundColor="#1C1C1E"
                borderRadius="$6"
                padding="$4"
                borderWidth={1}
                borderColor="#2C2C2E"
                onPress={() => navigation.navigate('PlateScan')}
                icon={<Ionicons name="nutrition" size={22} color="#3B82F6" />}
              >
                <XStack flex={1} justifyContent="space-between" alignItems="center" width="100%">
                  <Text color="white" fontWeight="600" fontSize="$4">Scan Plate</Text>
                  <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                </XStack>
              </Button>
            </YStack>

            {/* SOAP Notes entry */}
            <YStack paddingHorizontal="$4" marginBottom="$4">
              <Button
                backgroundColor="#1C1C1E"
                borderRadius="$6"
                padding="$4"
                borderWidth={1}
                borderColor="#2C2C2E"
                onPress={() => navigation.navigate('SoapNote', {})}
                icon={<Ionicons name="document-text" size={22} color="#3B82F6" />}
              >
                <XStack flex={1} justifyContent="space-between" alignItems="center" width="100%">
                  <Text color="white" fontWeight="600" fontSize="$4">SOAP Notes</Text>
                  <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                </XStack>
              </Button>
            </YStack>

            {/* Search Bar */}
            <YStack paddingHorizontal="$4" marginBottom="$4">
              <XStack
                backgroundColor="#1C1C1E"
                borderRadius="$10"
                paddingHorizontal="$4"
                alignItems="center"
                height={50}
                borderWidth={1}
                borderColor="#2C2C2E"
              >
                <Ionicons name="search" size={20} color="#8E8E93" />
                <Input
                  flex={1}
                  backgroundColor="transparent"
                  borderWidth={0}
                  placeholder="Search records..."
                  placeholderTextColor="$gray10"
                  color="white"
                  fontSize="$4"
                  marginLeft="$2"
                />
              </XStack>
            </YStack>

            {/* Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} paddingHorizontal="$4" marginBottom="$6">
              <XStack gap="$3">
                {['All', 'Lab Result', 'Prescription', 'Imaging'].map((filter) => {
                  const isActive = (filter === 'All' && activeTab === 'timeline') ||
                    (filter === 'Prescription' && activeTab === 'prescriptions') ||
                    (filter === 'Lab Result' && activeTab === 'labs');
                  return (
                    <Button
                      key={filter}
                      backgroundColor={isActive ? '$blue10' : '#1C1C1E'}
                      borderRadius="$10"
                      paddingHorizontal="$4"
                      height={40}
                      pressStyle={{ opacity: 0.8 }}
                      onPress={() => {
                        if (filter === 'All') setActiveTab('timeline');
                        if (filter === 'Prescription') setActiveTab('prescriptions');
                        if (filter === 'Lab Result') setActiveTab('labs');
                      }}
                      borderWidth={isActive ? 0 : 1}
                      borderColor={isActive ? 'transparent' : '#2C2C2E'}
                    >
                      <Text color={isActive ? 'white' : '#8E8E93'} fontWeight="600">
                        {filter}
                      </Text>
                    </Button>
                  );
                })}
              </XStack>
            </ScrollView>

            {/* Stats Summary Card */}
            <YStack paddingHorizontal="$4" marginBottom="$6">
              <Card
                backgroundColor="#1C1C1E"
                borderRadius="$4"
                padding="$5"
                borderWidth={1}
                borderColor="#2C2C2E"
              >
                <XStack justifyContent="space-between" paddingHorizontal="$4">
                  <YStack alignItems="center" gap="$2">
                    <XStack alignItems="center" gap="$2">
                      <Ionicons name="folder-open" size={18} color="#E0E0E0" />
                      <Text color="#E0E0E0" fontSize="$6" fontWeight="700">30</Text>
                    </XStack>
                    <Text color="#8E8E93" fontSize="$2" fontWeight="600">Total</Text>
                  </YStack>

                  <YStack alignItems="center" gap="$2">
                    <XStack alignItems="center" gap="$2">
                      <Ionicons name="checkmark-circle" size={18} color="#4ADE80" />
                      <Text color="#4ADE80" fontSize="$6" fontWeight="700">24</Text>
                    </XStack>
                    <Text color="#4ADE80" fontSize="$2" fontWeight="600">Unique</Text>
                  </YStack>

                  <YStack alignItems="center" gap="$2">
                    <XStack alignItems="center" gap="$2">
                      <Ionicons name="copy" size={18} color="#F59E0B" />
                      <Text color="#F59E0B" fontSize="$6" fontWeight="700">6</Text>
                    </XStack>
                    <Text color="#F59E0B" fontSize="$2" fontWeight="600">Duplicates</Text>
                  </YStack>
                </XStack>
              </Card>
            </YStack>

            {/* Content Tabs Area */}
            <YStack paddingHorizontal="$4">

              {/* Timeline Tab */}
              {activeTab === 'timeline' && (
                <YStack gap="$4" paddingBottom="$8">
                  {timelineRecords.map((record) => (
                    <Card
                      key={record.id}
                      padding="$4"
                      borderRadius="$6"
                      backgroundColor="#1C1C1E"
                      borderWidth={1}
                      borderColor="#2C2C2E"
                      pressStyle={{ opacity: 0.9, backgroundColor: '#2C2C2E' }}
                      onPress={() => navigation.navigate('RecordDetail', { id: record.id })}
                    >
                      <YStack gap="$3">
                        {/* Header: Icon + Title */}
                        <XStack gap="$3" alignItems="flex-start">
                          <XStack
                            width={44}
                            height={44}
                            borderRadius="$4"
                            backgroundColor="#111827" // Dark blue-ish gray
                            alignItems="center"
                            justifyContent="center"
                          >
                            <Ionicons name={getTypeIcon(record.type)} size={22} color="#3B82F6" />
                          </XStack>
                          <YStack flex={1} gap="$1">
                            <Text fontSize="$5" fontWeight="700" color="white" lineHeight={22}>
                              {record.title}
                            </Text>
                            <Text fontSize="$3" color="#3B82F6" fontWeight="500">
                              {record.type === 'lab' ? 'labResult' : record.type}
                            </Text>
                          </YStack>
                          {record.id === '2' && ( // Mock tag for demo
                            <XStack backgroundColor="#451a03" paddingHorizontal="$2" paddingVertical="$1" borderRadius="$4" borderWidth={1} borderColor="#f59e0b">
                              <Text fontSize="$2" color="#f59e0b" fontWeight="600">Duplicate</Text>
                            </XStack>
                          )}
                        </XStack>

                        {/* Description / Summary */}
                        <Text fontSize="$3" color="#9CA3AF" lineHeight={20} numberOfLines={2}>
                          {record.type === 'lab'
                            ? "Hemoglobin: 14.5 g/dL (Normal), WBC: 7.2 x 10³/µL (Normal), Platelets: 250 x 10³/µL (Normal)"
                            : "Prescription for daily use. Take with food. Monitor blood pressure weekly."}
                        </Text>

                        {/* Metadata: Doctor + Date */}
                        <XStack justifyContent="space-between" alignItems="center" marginTop="$1">
                          <XStack alignItems="center" gap="$2">
                            <Ionicons name="person" size={14} color="#6B7280" />
                            <Text fontSize="$3" color="#9CA3AF">
                              {record.doctor || 'Dr. Sarah Johnson'}
                            </Text>
                          </XStack>
                          <XStack alignItems="center" gap="$2">
                            <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                            <Text fontSize="$3" color="#9CA3AF">
                              {new Date(record.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </Text>
                          </XStack>
                        </XStack>

                        {/* Tags */}
                        <XStack gap="$2" flexWrap="wrap" marginTop="$1">
                          {['Blood Test', 'CBC', 'Hematology'].map((tag) => (
                            <XStack key={tag} backgroundColor="#374151" paddingHorizontal="$3" paddingVertical="$1.5" borderRadius="$4">
                              <Text fontSize="$2" color="#D1D5DB" fontWeight="500">{tag}</Text>
                            </XStack>
                          ))}
                        </XStack>
                      </YStack>
                    </Card>
                  ))}
                </YStack>
              )}

              {/* Prescriptions Tab */}
              {activeTab === 'prescriptions' && (
                <YStack gap="$3">
                  {prescriptions.map((med) => {
                    const isTaken = compliance[med.id] || false;
                    return (
                      <Card
                        key={med.id}
                        padding="$4"
                        borderRadius="$9"
                        backgroundColor="$muted"
                        borderWidth={0}
                      >
                        <XStack alignItems="center" gap="$3">
                          <Checkbox
                            checked={isTaken}
                            size="$5"
                            borderColor="$blue10"
                          >
                            <Checkbox.Indicator>
                              <Ionicons name="checkmark" size={16} color="#007AFF" />
                            </Checkbox.Indicator>
                          </Checkbox>
                          <YStack flex={1} gap="$1">
                            <Text fontSize="$5" fontWeight="700" color="$color">
                              {med.name}
                            </Text>
                            <Text fontSize="$3" color="$color10">
                              {med.dosage} • {med.frequency}
                            </Text>
                            <Progress
                              value={isTaken ? 100 : 0}
                              max={100}
                              backgroundColor="$gray4"
                              marginTop="$2"
                            >
                              <Progress.Indicator backgroundColor="$green10" />
                            </Progress>
                          </YStack>
                          {isTaken && (
                            <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
                          )}
                        </XStack>
                      </Card>
                    );
                  })}
                </YStack>
              )}

              {/* Labs Tab */}
              {activeTab === 'labs' && (
                <YStack gap="$3">
                  {timelineRecords
                    .filter((r) => r.type === 'lab')
                    .map((record) => (
                      <Card
                        key={record.id}
                        padding="$4"
                        borderRadius="$9"
                        backgroundColor="$muted"
                        borderWidth={0}
                        pressStyle={{ opacity: 0.8, backgroundColor: '$background' }}
                        onPress={() => navigation.navigate('RecordDetail', { id: record.id })}
                      >
                        <YStack gap="$3">
                          <XStack alignItems="center" justifyContent="space-between">
                            <Text fontSize="$5" fontWeight="700" color="$color">
                              {record.title}
                            </Text>
                            <Text fontSize="$3" color="$color10">
                              {new Date(record.date).toLocaleDateString()}
                            </Text>
                          </XStack>
                          <XStack gap="$4">
                            <YStack flex={1}>
                              <Text fontSize="$2" color="$color10">Glucose</Text>
                              <Text fontSize="$4" fontWeight="700" color="$color">
                                95 mg/dL
                              </Text>
                            </YStack>
                            <YStack flex={1}>
                              <Text fontSize="$2" color="$color10">HbA1c</Text>
                              <Text fontSize="$4" fontWeight="700" color="$green10">
                                6.2%
                              </Text>
                            </YStack>
                          </XStack>
                        </YStack>
                      </Card>
                    ))}
                </YStack>
              )}
            </YStack>
          </RNScrollView>

          {/* Floating Action Button - Add Record */}
          <XStack
            position="absolute"
            bottom="$6"
            right="$6"
            zIndex={100}
          >
            <Button
              size="$5"
              borderRadius="$10"
              backgroundColor="#3B82F6" // Apple blue
              shadowColor="rgba(0,0,0,0.5)"
              shadowOffset={{ width: 0, height: 4 }}
              shadowOpacity={0.3}
              shadowRadius={8}
              elevation={8}
              pressStyle={{ scale: 0.95, backgroundColor: '#2563EB' }}
              onPress={handleUpload}
              icon={<Ionicons name="add" size={24} color="white" />}
              paddingHorizontal="$5"
            >
              <Text fontSize="$4" fontWeight="600" color="white">
                Add Record
              </Text>
            </Button>
          </XStack>
        </ResponsiveContainer>
      </YStack>
    </SafeAreaView>
  );
}
