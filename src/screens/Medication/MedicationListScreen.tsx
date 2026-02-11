import React, { useCallback, useState, useMemo } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  YStack,
  XStack,
  Text,
} from 'tamagui';
import { 
  ActivityIndicator, 
  TouchableOpacity, 
  Alert, 
  FlatList, 
  View, 
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Search,
  Mic,
  Settings,
  List,
  Calendar,
  Pill,
  Sparkles,
  CalendarDays,
  RefreshCw,
  FileText,
  Plus,
  Syringe,
  TestTube,
  Tablets,
  Trash2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useAuthStore } from '../../store/useAuthStore';
import { useMedAgentStore } from '../../store/useMedAgentStore';
import type { Medication } from '../../../types/medication';

type NavigationProp = NativeStackNavigationProp<any>;

type FilterType = 'All' | 'Active' | 'Completed' | 'Upcoming';
type ViewType = 'list' | 'calendar';

// Icon component for different medication types
const getMedicationIcon = (index: number) => {
  const icons = [
    { Icon: Pill, color: '#2196F3' },
    { Icon: Tablets, color: '#4CAF50' },
    { Icon: Syringe, color: '#9C27B0' },
    { Icon: TestTube, color: '#FF9800' },
  ];
  return icons[index % icons.length];
};

export function MedicationListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user: profile } = useAuthStore();
  const { activeMeds, compliance, fetchMedications, deleteMedication } = useMedAgentStore();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [viewType, setViewType] = useState<ViewType>('list');

  useFocusEffect(
    useCallback(() => {
      if (profile?.id) {
        setLoading(true);
        fetchMedications(profile.id).finally(() => setLoading(false));
      }
    }, [profile?.id, fetchMedications])
  );

  const handleAddNew = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      let base64 = asset.base64;
      if (!base64) {
        base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
      }

      // Navigate to analyzing screen
      navigation.navigate('AnalyzingPrescription' as any, {
        imageBase64: base64,
        imageUri: asset.uri,
      });
    } catch (error) {
      console.error('Scan Error:', error);
      Alert.alert('Error', 'Error selecting image. Please try again.');
    }
  };

  const handleDeleteMedication = (med: Medication) => {
    Alert.alert(
      'Delete Medication',
      `Are you sure you want to delete "${med.drug_name || med.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            const success = await deleteMedication(med.id);
            if (success) {
              // Refresh the list
              if (profile?.id) {
                fetchMedications(profile.id);
              }
            } else {
              Alert.alert('Error', 'Failed to delete medication. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Filter medications
  const filteredMeds = useMemo(() => {
    let meds = [...activeMeds];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      meds = meds.filter(med => 
        (med.drug_name || med.name || '').toLowerCase().includes(query) ||
        (med.dosage || '').toLowerCase().includes(query)
      );
    }
    
    // Apply status filter
    if (activeFilter === 'Active') {
      meds = meds.filter(med => med.status === 'active' || !med.status);
    } else if (activeFilter === 'Completed') {
      meds = meds.filter(med => med.status === 'completed');
    } else if (activeFilter === 'Upcoming') {
      // Upcoming medications - filter by future start date or no status
      meds = meds.filter(med => !med.status || med.status === 'active');
    }
    
    return meds;
  }, [activeMeds, searchQuery, activeFilter]);

  // Separate active and completed medications
  const activePrescriptions = useMemo(() => 
    filteredMeds.filter(med => med.status !== 'completed'), 
    [filteredMeds]
  );
  
  const completedPrescriptions = useMemo(() => 
    filteredMeds.filter(med => med.status === 'completed'), 
    [filteredMeds]
  );

  const formatDateRange = (med: Medication) => {
    if (med.created_at && med.duration_days) {
      const start = new Date(med.created_at);
      const end = new Date(start);
      end.setDate(end.getDate() + med.duration_days);
      const now = new Date();
      const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      
      if (daysLeft > 0) {
        return `${formatDate(start)} - ${formatDate(end)} (${daysLeft} days left)`;
      } else {
        return 'Ongoing treatment';
      }
    }
    return 'Ongoing treatment';
  };

  const renderMedicationCard = ({ item, index }: { item: Medication; index: number }) => {
    const iconConfig = getMedicationIcon(index);
    const IconComponent = iconConfig.Icon;
    const isCompleted = item.status === 'completed';
    
    return (
      <View style={styles.card}>
        <XStack alignItems="flex-start" gap="$3">
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: `${iconConfig.color}15` }]}>
            <IconComponent size={22} color={iconConfig.color} strokeWidth={2} />
          </View>
          
          {/* Content */}
          <YStack flex={1}>
            <XStack alignItems="center" justifyContent="space-between">
              <Text fontSize={16} fontWeight="700" color="#1C1C1E">
                {item.drug_name || item.name || 'Medication'}
              </Text>
              <View style={[styles.statusBadge, isCompleted && styles.statusBadgeCompleted]}>
                <Text fontSize={11} fontWeight="600" color={isCompleted ? '#666' : '#007AFF'}>
                  {isCompleted ? 'Completed' : 'Active'}
                </Text>
              </View>
            </XStack>
            
            <Text fontSize={13} color="#666" marginTop={2}>
              {item.dosage || '500mg'} • {item.frequency_text || item.frequency || 'Daily'}
            </Text>
            
            {/* Date info */}
            <XStack alignItems="center" gap="$2" marginTop={12}>
              <CalendarDays size={14} color="#8E8E93" strokeWidth={2} />
              <Text fontSize={12} color="#8E8E93">
                {isCompleted ? `Completed ${item.created_at ? new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}` : formatDateRange(item)}
              </Text>
            </XStack>
            
            {/* Action buttons */}
            {isCompleted ? (
              <XStack gap="$3" marginTop={14}>
                <TouchableOpacity style={styles.outlineButton} activeOpacity={0.7}>
                  <RefreshCw size={14} color="#007AFF" strokeWidth={2} />
                  <Text fontSize={13} fontWeight="500" color="#007AFF" marginLeft={6}>Refill</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.outlineButton} activeOpacity={0.7}>
                  <FileText size={14} color="#007AFF" strokeWidth={2} />
                  <Text fontSize={13} fontWeight="500" color="#007AFF" marginLeft={6}>Details</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.deleteButton} 
                  activeOpacity={0.7}
                  onPress={() => handleDeleteMedication(item)}
                >
                  <Trash2 size={14} color="#FF3B30" strokeWidth={2} />
                </TouchableOpacity>
              </XStack>
            ) : (
              <XStack gap="$3" marginTop={14} alignItems="center">
                <TouchableOpacity style={styles.analysisButton} activeOpacity={0.7}>
                  <Sparkles size={14} color="#007AFF" strokeWidth={2} />
                  <Text fontSize={13} fontWeight="600" color="#007AFF" marginLeft={6}>View AI Analysis</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.deleteButton} 
                  activeOpacity={0.7}
                  onPress={() => handleDeleteMedication(item)}
                >
                  <Trash2 size={14} color="#FF3B30" strokeWidth={2} />
                </TouchableOpacity>
              </XStack>
            )}
          </YStack>
        </XStack>
      </View>
    );
  };

  const renderFilterTab = (filter: FilterType) => (
    <TouchableOpacity
      key={filter}
      style={[styles.filterTab, activeFilter === filter && styles.filterTabActive]}
      onPress={() => {
        Haptics.selectionAsync();
        setActiveFilter(filter);
      }}
      activeOpacity={0.7}
    >
      <Text 
        fontSize={13} 
        fontWeight="500" 
        color={activeFilter === filter ? 'white' : '#666'}
      >
        {filter}
      </Text>
    </TouchableOpacity>
  );

  const ListHeader = () => (
    <>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={18} color="#8E8E93" strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search prescriptions, doctors..."
          placeholderTextColor="#8E8E93"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity activeOpacity={0.7}>
          <Mic size={18} color="#8E8E93" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <XStack gap="$2" marginBottom={16}>
        {(['All', 'Active', 'Completed', 'Upcoming'] as FilterType[]).map(renderFilterTab)}
      </XStack>

      {/* View Toggle */}
      <View style={styles.viewToggle}>
        <TouchableOpacity 
          style={[styles.viewOption, viewType === 'list' && styles.viewOptionActive]}
          onPress={() => setViewType('list')}
          activeOpacity={0.7}
        >
          <List size={16} color={viewType === 'list' ? '#1C1C1E' : '#8E8E93'} strokeWidth={2} />
          <Text fontSize={13} fontWeight="500" color={viewType === 'list' ? '#1C1C1E' : '#8E8E93'} marginLeft={6}>
            List View
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.viewOption, viewType === 'calendar' && styles.viewOptionActive]}
          onPress={() => setViewType('calendar')}
          activeOpacity={0.7}
        >
          <Calendar size={16} color={viewType === 'calendar' ? '#1C1C1E' : '#8E8E93'} strokeWidth={2} />
          <Text fontSize={13} fontWeight="500" color={viewType === 'calendar' ? '#1C1C1E' : '#8E8E93'} marginLeft={6}>
            Calendar
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active Prescriptions Section */}
      {activePrescriptions.length > 0 && (
        <XStack justifyContent="space-between" alignItems="center" marginTop={20} marginBottom={12}>
          <Text fontSize={12} fontWeight="700" color="#666" letterSpacing={0.5}>
            ACTIVE PRESCRIPTIONS
          </Text>
          <Text fontSize={12} fontWeight="600" color="#007AFF">
            {activePrescriptions.length} Active
          </Text>
        </XStack>
      )}
    </>
  );

  const renderSectionHeader = () => {
    if (completedPrescriptions.length === 0) return null;
    return (
      <Text fontSize={12} fontWeight="700" color="#666" letterSpacing={0.5} marginTop={24} marginBottom={12}>
        RECENTLY COMPLETED
      </Text>
    );
  };

  // Combine data for FlatList
  const listData = useMemo(() => {
    const data: Array<{ type: 'medication' | 'header'; item?: Medication; index?: number }> = [];
    
    activePrescriptions.forEach((med, index) => {
      data.push({ type: 'medication', item: med, index });
    });
    
    if (completedPrescriptions.length > 0) {
      data.push({ type: 'header' });
      completedPrescriptions.forEach((med, index) => {
        data.push({ type: 'medication', item: med, index: activePrescriptions.length + index });
      });
    }
    
    return data;
  }, [activePrescriptions, completedPrescriptions]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <Text fontSize={24} fontWeight="700" color="#1C1C1E">
            Medication Library
          </Text>
          <TouchableOpacity style={styles.settingsButton} activeOpacity={0.7}>
            <Settings size={22} color="#1C1C1E" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text fontSize={14} color="#8E8E93" marginTop={12}>Loading medications...</Text>
          </View>
        ) : filteredMeds.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Pill size={40} color="#007AFF" strokeWidth={1.5} />
            </View>
            <Text fontSize={18} fontWeight="700" color="#1C1C1E" textAlign="center">
              No Medications Yet
            </Text>
            <Text fontSize={14} color="#8E8E93" textAlign="center" marginTop={8}>
              Add your first medication by scanning a prescription
            </Text>
          </View>
        ) : (
          <FlatList
            data={listData}
            renderItem={({ item: data }) => {
              if (data.type === 'header') {
                return renderSectionHeader();
              }
              return renderMedicationCard({ item: data.item!, index: data.index! });
            }}
            keyExtractor={(item, index) => item.type === 'header' ? 'header' : item.item!.id}
            ListHeaderComponent={ListHeader}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        )}

        {/* FAB */}
        <TouchableOpacity style={styles.fab} onPress={handleAddNew} activeOpacity={0.9}>
          <Plus size={28} color="white" strokeWidth={2.5} />
        </TouchableOpacity>
      </SafeAreaView>
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1C1C1E',
    marginLeft: 10,
    marginRight: 10,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  filterTabActive: {
    backgroundColor: '#1C1C1E',
    borderColor: '#1C1C1E',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  viewOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  viewOptionActive: {
    backgroundColor: '#F5F5F5',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E3F2FD',
  },
  statusBadgeCompleted: {
    backgroundColor: '#F5F5F5',
  },
  analysisButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F7FF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    flex: 1,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
