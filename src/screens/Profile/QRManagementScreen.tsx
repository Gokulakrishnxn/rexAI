import React from 'react';
import { StyleSheet, TouchableOpacity, Share, Alert, Platform } from 'react-native';
import { View, Text, YStack, XStack, ScrollView, Button } from 'tamagui';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

export function QRManagementScreen() {
  const { user: profile } = useAuthStore();
  const navigation = useNavigation();
  const qrUid = profile?.qr_uid || 'No ID available';

  const handleShare = async () => {
    try {
      await Share.share({
        message: `My Rex.ai Medical ID: ${qrUid}`,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingVertical="$3">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Medical ID</Text>
        <View style={{ width: 40 }} />
      </XStack>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <YStack alignItems="center" gap="$6" paddingTop="$8">
          <View style={styles.qrContainer}>
            <QRCode
              value={qrUid}
              size={220}
              color="#1A1A1A"
              backgroundColor="white"
            />
          </View>

          <YStack alignItems="center" gap="$2">
            <Text style={styles.idLabel}>Your ID</Text>
            <Text style={styles.idValue}>{qrUid}</Text>
          </YStack>

          <Text style={styles.description}>
            This QR code contains your unique Medical ID. Healthcare providers can scan this to quickly access your emergency records.
          </Text>

          <YStack width="100%" gap="$4" marginTop="$4">
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleShare}
            >
              <Ionicons name="share-outline" size={20} color="white" />
              <Text style={styles.primaryButtonText}>Share My ID</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => Alert.alert('Coming Soon', 'PDF download will be available in the next update.')}
            >
              <Ionicons name="download-outline" size={20} color="#3B82F6" />
              <Text style={styles.secondaryButtonText}>Download as PDF</Text>
            </TouchableOpacity>
          </YStack>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFC',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  qrContainer: {
    padding: 24,
    backgroundColor: 'white',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  idLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  idValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  description: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginHorizontal: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
  },
  secondaryButtonText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600',
  },
});
