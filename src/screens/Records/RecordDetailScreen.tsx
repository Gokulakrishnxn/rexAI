import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, XStack } from 'tamagui';
import { 
  ChevronLeft, 
  Trash2, 
  Maximize2, 
  X,
  Sparkles,
  FileText,
  Stethoscope,
  Building2,
  Calendar
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRecordsStore } from '../../store/useRecordsStore';
import { deleteDocument } from '../../services/api/backendApi';
import { HealthRecord } from '../../../types/record';

type NavigationProp = NativeStackNavigationProp<any>;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export function RecordDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { id } = route.params as { id: string };
  
  const { records, removeRecord } = useRecordsStore();
  const [record, setRecord] = useState<HealthRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);

  useEffect(() => {
    const found = records.find(r => r.id === id);
    setRecord(found || null);
  }, [id, records]);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Document',
      'Are you sure you want to permanently delete this document? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              // Delete from backend if we have a documentId
              if (record?.documentId) {
                const result = await deleteDocument(record.documentId);
                if (!result.success) {
                  Alert.alert('Error', result.error || 'Failed to delete document');
                  setDeleting(false);
                  return;
                }
              }
              // Remove from local store
              removeRecord(id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete document');
              setDeleting(false);
            }
          }
        }
      ]
    );
  };

  const handleAnalyzeWithAI = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navigate to Medical Insights screen for deep analysis
    navigation.navigate('MedicalInsights', {
      documentId: record?.documentId || id,
      documentTitle: record?.title || 'Medical Document',
      extractedText: record?.rawText,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getCategoryLabel = (type: string) => {
    switch (type) {
      case 'lab': return 'Lab Results';
      case 'prescription': return 'Prescription';
      case 'imaging': return 'Imaging';
      default: return 'Medical Document';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complete':
        return { label: 'VERIFIED', color: '#34C759', bgColor: '#E8FAF0' };
      case 'processing':
        return { label: 'PROCESSING', color: '#FF9500', bgColor: '#FFF4E5' };
      case 'error':
        return { label: 'ERROR', color: '#FF3B30', bgColor: '#FFE5E5' };
      default:
        return { label: 'STORED', color: '#8E8E93', bgColor: '#F0F0F0' };
    }
  };

  // Parse summary into sections
  const parseSummary = (summary: string | undefined) => {
    if (!summary) return null;
    
    // Try to detect if summary has structured sections
    const sections: { title: string; content: string }[] = [];
    
    // Check for common patterns
    if (summary.includes('**') || summary.includes('##')) {
      // Markdown-style sections
      const lines = summary.split('\n');
      let currentSection = { title: 'Summary', content: '' };
      
      lines.forEach(line => {
        const headerMatch = line.match(/^(?:\*\*|##)\s*(.+?)(?:\*\*)?$/);
        if (headerMatch) {
          if (currentSection.content.trim()) {
            sections.push(currentSection);
          }
          currentSection = { title: headerMatch[1].replace(/\*\*/g, ''), content: '' };
        } else {
          currentSection.content += line + '\n';
        }
      });
      
      if (currentSection.content.trim()) {
        sections.push(currentSection);
      }
    }
    
    // If no sections detected, return as single block
    if (sections.length === 0) {
      sections.push({ title: 'AI Summary', content: summary });
    }
    
    return sections;
  };

  if (!record) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text marginTop={12} color="#8E8E93">Loading document...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const status = getStatusBadge(record.ingestionStatus);
  const sections = parseSummary(record.summary);
  const imageUrl = record.supabaseUrl || record.fileUri;

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ChevronLeft size={24} color="#007AFF" strokeWidth={2} />
            <Text fontSize={17} color="#007AFF">Back</Text>
          </TouchableOpacity>
          
          <Text fontSize={17} fontWeight="600" color="#1C1C1E">
            Document Detail
          </Text>
          
          <TouchableOpacity onPress={handleDelete} style={styles.deleteButton} disabled={deleting}>
            {deleting ? (
              <ActivityIndicator size="small" color="#FF3B30" />
            ) : (
              <Trash2 size={22} color="#FF3B30" strokeWidth={2} />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Document Image */}
          {imageUrl && (
            <TouchableOpacity 
              style={styles.imageContainer}
              onPress={() => setImageModalVisible(true)}
              activeOpacity={0.9}
            >
              <Image
                source={{ uri: imageUrl }}
                style={styles.documentImage}
                resizeMode="cover"
              />
              <TouchableOpacity 
                style={styles.fullscreenButton}
                onPress={() => setImageModalVisible(true)}
              >
                <Maximize2 size={18} color="white" strokeWidth={2} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}

          {/* Document Info Section */}
          <Text style={styles.sectionTitle}>DOCUMENT INFO</Text>
          <View style={styles.infoRow}>
            <View style={styles.infoCard}>
              <XStack alignItems="center" gap="$1" marginBottom={4}>
                <Calendar size={12} color="#8E8E93" strokeWidth={2} />
                <Text fontSize={11} color="#8E8E93" textTransform="uppercase">
                  Uploaded On
                </Text>
              </XStack>
              <Text fontSize={14} fontWeight="600" color="#1C1C1E">
                {formatDate(record.date)}
              </Text>
            </View>

            <View style={styles.infoCard}>
              <XStack alignItems="center" gap="$1" marginBottom={4}>
                <Stethoscope size={12} color="#8E8E93" strokeWidth={2} />
                <Text fontSize={11} color="#8E8E93" textTransform="uppercase">
                  Doctor
                </Text>
              </XStack>
              <Text fontSize={14} fontWeight="600" color="#1C1C1E" numberOfLines={1}>
                {record.doctor || 'Unknown'}
              </Text>
            </View>

            <View style={styles.infoCard}>
              <XStack alignItems="center" gap="$1" marginBottom={4}>
                <Building2 size={12} color="#8E8E93" strokeWidth={2} />
                <Text fontSize={11} color="#8E8E93" textTransform="uppercase">
                  Category
                </Text>
              </XStack>
              <Text fontSize={14} fontWeight="600" color="#1C1C1E" numberOfLines={1}>
                {getCategoryLabel(record.type)}
              </Text>
            </View>
          </View>

          {/* Summary Section */}
          <XStack alignItems="center" justifyContent="space-between" marginTop={24} marginBottom={12}>
            <Text style={styles.sectionTitle} marginTop={0} marginBottom={0}>
              SUMMARY & EXTRACTED TEXT
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
              <Text fontSize={10} fontWeight="700" color={status.color}>
                {status.label}
              </Text>
            </View>
          </XStack>

          <View style={styles.summaryCard}>
            {sections && sections.length > 0 ? (
              sections.map((section, index) => (
                <View key={index}>
                  {index > 0 && <View style={styles.sectionDivider} />}
                  <Text fontSize={12} fontWeight="700" color="#007AFF" textTransform="uppercase" marginBottom={8}>
                    {section.title}
                  </Text>
                  <Text fontSize={15} color="#1C1C1E" lineHeight={22}>
                    {section.content.trim()}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.noSummary}>
                <FileText size={32} color="#C7C7CC" strokeWidth={1.5} />
                <Text fontSize={14} color="#8E8E93" marginTop={12} textAlign="center">
                  No summary available yet.{'\n'}Click "Analyze with AI" to generate one.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Bottom Button */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity 
            style={styles.analyzeButton}
            onPress={handleAnalyzeWithAI}
            activeOpacity={0.9}
          >
            <Sparkles size={20} color="white" strokeWidth={2} />
            <Text fontSize={16} fontWeight="600" color="white" marginLeft={8}>
              Analyze with AI
            </Text>
          </TouchableOpacity>
        </View>

        {/* Fullscreen Image Modal */}
        <Modal
          visible={imageModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setImageModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setImageModalVisible(false)}
            >
              <X size={24} color="white" strokeWidth={2} />
            </TouchableOpacity>
            {imageUrl && (
              <Image
                source={{ uri: imageUrl }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            )}
          </View>
        </Modal>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: 'white',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 70,
  },
  deleteButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  imageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E5E5EA',
    marginBottom: 20,
  },
  documentImage: {
    width: '100%',
    height: '100%',
  },
  fullscreenButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  infoCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 16,
  },
  noSummary: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
});
