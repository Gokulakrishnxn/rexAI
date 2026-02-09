import React, { useState, useMemo, useCallback } from 'react';
import { 
  ScrollView, 
  TouchableOpacity, 
  View, 
  StyleSheet, 
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Text, XStack } from 'tamagui';
import * as DocumentPicker from 'expo-document-picker';
import { 
  Search, 
  X, 
  Settings, 
  Clock, 
  ChevronRight,
  Camera,
  FileText,
  Shield,
  FlaskConical,
  Image as ImageIcon,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRecordsStore } from '../../store/useRecordsStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { RecordsStackParamList } from '../../navigation/stacks/RecordsStack';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { deleteFromStorage } from '@/services/supabase';
import { fetchUserDocuments } from '@/services/api/backendApi';
import { HealthRecord } from '../../../types/record';

type NavigationProp = NativeStackNavigationProp<RecordsStackParamList>;

type FilterType = 'All' | 'Medical' | 'Results' | 'Admin';

interface DocumentCardData {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  status: 'analyzed' | 'processing' | 'stored' | 'error';
  category: string;
  imageUrl?: string;
  type: string;
}

export function RecordsDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { records, setRecords, removeRecord } = useRecordsStore();
  const { user: profile } = useAuthStore();
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(['Blood test results', 'Lisinopril Rx']);

  const USER_ID = profile?.id;

  useFocusEffect(
    useCallback(() => {
      const loadRecords = async () => {
        try {
          const docs = await fetchUserDocuments();
          if (docs && docs.length > 0) {
            const formattedRecords: HealthRecord[] = docs.map((doc: any) => ({
              id: doc.id,
              type: doc.doc_category || (doc.file_type?.includes('image') ? 'imaging' : doc.file_type?.includes('pdf') ? 'lab' : 'other'),
              title: doc.file_name,
              date: doc.created_at,
              summary: doc.summary,
              doctor: doc.doctor || 'AI Extracted',
              hospital: doc.hospital || 'My Health',
              ingestionStatus: doc.validation_status === 'verified' ? 'complete' : 'processing',
              documentId: doc.id,
              storagePath: doc.file_url,
              imageUrl: doc.file_url,
            }));
            setRecords(formattedRecords);
          }
        } catch (error) {
          console.error('Error fetching records:', error);
        } finally {
          setLoading(false);
        }
      };

      if (USER_ID) {
        loadRecords();
      } else {
        setLoading(false);
      }
    }, [USER_ID])
  );

  // Map records to display format
  const documentCards: DocumentCardData[] = useMemo(() => {
    return records.map((record) => ({
      id: record.id,
      title: record.title || 'Untitled Document',
      subtitle: `${record.doctor || 'Unknown'} • ${record.hospital || 'General'}`,
      date: new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(),
      status: record.ingestionStatus === 'complete' ? 'analyzed' : 
              record.ingestionStatus === 'processing' ? 'processing' : 
              record.ingestionStatus === 'error' ? 'error' : 'stored',
      category: getCategoryLabel(record.type),
      imageUrl: record.storagePath,
      type: record.type,
    }));
  }, [records]);

  // Filter documents
  const filteredDocuments = useMemo(() => {
    let docs = [...documentCards];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      docs = docs.filter(doc => 
        doc.title.toLowerCase().includes(query) ||
        doc.subtitle.toLowerCase().includes(query) ||
        doc.category.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (activeFilter === 'Medical') {
      docs = docs.filter(doc => ['Prescription', 'Medical'].includes(doc.category));
    } else if (activeFilter === 'Results') {
      docs = docs.filter(doc => ['Lab Report', 'Imaging'].includes(doc.category));
    } else if (activeFilter === 'Admin') {
      docs = docs.filter(doc => ['Insurance', 'Invoice', 'Other'].includes(doc.category));
    }

    return docs;
  }, [documentCards, searchQuery, activeFilter]);

  // Separate into recent and older
  const recentDocuments = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return filteredDocuments.filter(doc => {
      const docDate = new Date(records.find(r => r.id === doc.id)?.date || '');
      return docDate >= thirtyDaysAgo;
    });
  }, [filteredDocuments, records]);

  const olderDocuments = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return filteredDocuments.filter(doc => {
      const docDate = new Date(records.find(r => r.id === doc.id)?.date || '');
      return docDate < thirtyDaysAgo;
    });
  }, [filteredDocuments, records]);

  // Filter counts
  const filterCounts = useMemo(() => ({
    All: documentCards.length,
    Medical: documentCards.filter(d => ['Prescription', 'Medical'].includes(d.category)).length,
    Results: documentCards.filter(d => ['Lab Report', 'Imaging'].includes(d.category)).length,
    Admin: documentCards.filter(d => ['Insurance', 'Invoice', 'Other'].includes(d.category)).length,
  }), [documentCards]);

  function getCategoryLabel(type: string): string {
    switch (type) {
      case 'prescription': return 'Prescription';
      case 'lab_report': 
      case 'lab': return 'Lab Report';
      case 'imaging': return 'Imaging';
      case 'insurance': return 'Insurance';
      case 'invoice': return 'Invoice';
      default: return 'Other';
    }
  }

  function getStatusConfig(status: string) {
    switch (status) {
      case 'analyzed':
        return { label: 'ANALYZED', color: '#34C759', bgColor: '#E8F8ED' };
      case 'processing':
        return { label: 'PROCESSING', color: '#FF9500', bgColor: '#FFF4E5' };
      case 'stored':
        return { label: 'STORED', color: '#8E8E93', bgColor: '#F2F2F7' };
      case 'error':
        return { label: 'ERROR', color: '#FF3B30', bgColor: '#FFE5E5' };
      default:
        return { label: 'PENDING', color: '#8E8E93', bgColor: '#F2F2F7' };
    }
  }

  function getCategoryIcon(category: string) {
    switch (category) {
      case 'Prescription':
        return <FileText size={20} color="#FF9500" strokeWidth={2} />;
      case 'Lab Report':
        return <FlaskConical size={20} color="#007AFF" strokeWidth={2} />;
      case 'Imaging':
        return <ImageIcon size={20} color="#5856D6" strokeWidth={2} />;
      case 'Insurance':
        return <Shield size={20} color="#007AFF" strokeWidth={2} />;
      default:
        return <FileText size={20} color="#8E8E93" strokeWidth={2} />;
    }
  }

  const handleSearch = (text: string) => {
    setSearchQuery(text);
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim() && !recentSearches.includes(searchQuery.trim())) {
      setRecentSearches(prev => [searchQuery.trim(), ...prev.slice(0, 4)]);
    }
    Keyboard.dismiss();
  };

  const handleRecentSearchTap = (search: string) => {
    setSearchQuery(search);
    Haptics.selectionAsync();
  };

  const cancelSearch = () => {
    setSearchQuery('');
    setIsSearchFocused(false);
    Keyboard.dismiss();
  };

  const handleUpload = async () => {
    if (!USER_ID) {
      Alert.alert('Error', 'Please log in to upload documents');
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const { assets } = result;
      if (assets && assets[0]) {
        const file = assets[0];
        
        // Navigate to processing screen
        navigation.navigate('DocumentProcessing', {
          fileUri: file.uri,
          fileName: file.name,
          mimeType: file.mimeType || 'application/octet-stream',
          userId: USER_ID,
        });
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to select document. Please try again.');
    }
  };

  const handleDelete = async (docId: string) => {
    const record = records.find(r => r.id === docId);
    if (!record) return;

    Alert.alert(
      "Delete Document",
      "Are you sure you want to delete this document?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            if (record.storagePath) {
              try {
                await deleteFromStorage(record.storagePath);
              } catch (e) {
                console.warn('Failed to delete from storage:', e);
              }
            }
            try {
              const { deleteDocument } = await import('@/services/api/backendApi');
              await deleteDocument(record.id);
            } catch (e) {
              console.error('Failed to delete from backend:', e);
            }
            removeRecord(record.id);
          }
        }
      ]
    );
  };

  const renderDocumentCard = (doc: DocumentCardData, dimmed: boolean = false) => {
    const statusConfig = getStatusConfig(doc.status);
    
    return (
      <TouchableOpacity
        key={doc.id}
        style={[styles.documentCard, dimmed && styles.documentCardDimmed]}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('RecordDetail', { id: doc.id })}
        onLongPress={() => handleDelete(doc.id)}
      >
        {/* Thumbnail */}
        <View style={styles.thumbnail}>
          {doc.imageUrl ? (
            <Image 
              source={{ uri: doc.imageUrl }} 
              style={styles.thumbnailImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              {getCategoryIcon(doc.category)}
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <XStack justifyContent="space-between" alignItems="flex-start">
            <Text fontSize={16} fontWeight="700" color="#1C1C1E" flex={1} numberOfLines={1}>
              {doc.title}
            </Text>
            <Text fontSize={12} color="#8E8E93" marginLeft={8}>
              {doc.date}
            </Text>
          </XStack>

          <Text fontSize={13} color="#8E8E93" marginTop={2} numberOfLines={1}>
            {doc.subtitle}
          </Text>

          <XStack alignItems="center" gap="$2" marginTop={8}>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
              <Text fontSize={10} fontWeight="700" color={statusConfig.color}>
                {statusConfig.label}
              </Text>
            </View>
            <Text fontSize={12} color="#8E8E93">•</Text>
            <Text fontSize={12} color="#8E8E93">{doc.category}</Text>
          </XStack>
        </View>

        {/* Chevron */}
        <ChevronRight size={18} color="#C7C7CC" strokeWidth={2} />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        {!isSearchFocused ? (
          <View style={styles.header}>
            <Text fontSize={28} fontWeight="800" color="#1C1C1E">
              My Documents
            </Text>
            <XStack gap="$4">
              <TouchableOpacity onPress={() => setIsSearchFocused(true)}>
                <Search size={24} color="#1C1C1E" strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity>
                <Settings size={24} color="#1C1C1E" strokeWidth={2} />
              </TouchableOpacity>
            </XStack>
          </View>
        ) : (
          <View style={styles.searchHeader}>
            <View style={styles.searchBarActive}>
              <Search size={18} color="#8E8E93" strokeWidth={2} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search documents..."
                placeholderTextColor="#8E8E93"
                value={searchQuery}
                onChangeText={handleSearch}
                onSubmitEditing={handleSearchSubmit}
                autoFocus
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <View style={styles.clearButton}>
                    <X size={14} color="#8E8E93" strokeWidth={2.5} />
                  </View>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={cancelSearch} style={styles.cancelButton}>
              <Text fontSize={16} fontWeight="500" color="#007AFF">
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Recent Searches - Only show when search is focused */}
          {isSearchFocused && searchQuery.length === 0 && recentSearches.length > 0 && (
            <View style={styles.recentSearches}>
              <Text fontSize={12} fontWeight="600" color="#8E8E93" letterSpacing={0.5}>
                RECENT SEARCHES
              </Text>
              {recentSearches.map((search, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.recentSearchItem}
                  onPress={() => handleRecentSearchTap(search)}
                >
                  <Clock size={16} color="#8E8E93" strokeWidth={2} />
                  <Text fontSize={15} color="#1C1C1E" marginLeft={12}>
                    {search}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Total Storage Header */}
          {!isSearchFocused && (
            <View style={styles.storageHeader}>
              <Text fontSize={12} fontWeight="600" color="#8E8E93" letterSpacing={0.5}>
                TOTAL STORAGE
              </Text>
              <Text fontSize={16} fontWeight="700" color="#007AFF">
                {documentCards.length} Files
              </Text>
            </View>
          )}

          {/* Filter Tabs - Segmented Control Style */}
          {!isSearchFocused && (
            <View style={styles.filterWrapper}>
              <View style={styles.filterContainer}>
                {(['All', 'Medical', 'Results', 'Admin'] as FilterType[]).map((filter, index) => (
                  <TouchableOpacity
                    key={filter}
                    style={[
                      styles.filterTab,
                      activeFilter === filter && styles.filterTabActive,
                      index === 0 && styles.filterTabFirst,
                      index === 3 && styles.filterTabLast,
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setActiveFilter(filter);
                    }}
                  >
                    <Text
                      fontSize={13}
                      fontWeight="600"
                      color={activeFilter === filter ? '#007AFF' : '#8E8E93'}
                    >
                      {filter} ({filterCounts[filter]})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Recent Uploads Section */}
          {recentDocuments.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>RECENT UPLOADS</Text>
              {recentDocuments.map(doc => renderDocumentCard(doc, isSearchFocused && searchQuery.length > 0))}
            </View>
          )}

          {/* Older Documents Section */}
          {olderDocuments.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>OLDER DOCUMENTS</Text>
              {olderDocuments.map(doc => renderDocumentCard(doc, isSearchFocused && searchQuery.length > 0))}
            </View>
          )}

          {/* Empty State */}
          {filteredDocuments.length === 0 && (
            <View style={styles.emptyState}>
              <FileText size={48} color="#C7C7CC" strokeWidth={1.5} />
              <Text fontSize={17} fontWeight="600" color="#1C1C1E" marginTop={16}>
                No documents found
              </Text>
              <Text fontSize={14} color="#8E8E93" textAlign="center" marginTop={8}>
                {searchQuery ? 'Try a different search term' : 'Upload your first document to get started'}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Floating Action Button */}
        <TouchableOpacity
          style={styles.fab}
          onPress={handleUpload}
          activeOpacity={0.9}
        >
          <Camera size={24} color="white" strokeWidth={2} />
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: '#F8F9FA',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  searchBarActive: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
    marginLeft: 8,
    paddingVertical: 8,
  },
  clearButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    paddingHorizontal: 4,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  recentSearches: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  storageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  filterWrapper: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    padding: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterTabFirst: {
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  filterTabLast: {
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  documentCardDimmed: {
    opacity: 0.5,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FD',
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
