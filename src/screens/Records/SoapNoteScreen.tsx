import React, { useEffect, useState } from 'react';
import { Alert, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { YStack, XStack, Card, Text, Button } from 'tamagui';
import { Ionicons } from '@expo/vector-icons';
import type { SoapNote } from '../../types/soap';
import { useSoapStore } from '../../store/useSoapStore';

type SoapNoteParams = { noteId?: string };

function formatSoapForCopy(note: SoapNote): string {
  return [
    `Subjective: ${note.subjective}`,
    `Objective: ${note.objective}`,
    `Assessment: ${note.assessment}`,
    `Plan: ${note.plan}`,
  ].join('\n\n');
}

export function SoapNoteScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params ?? {}) as SoapNoteParams;
  const { notes, loadNotes, getLatestNote } = useSoapStore();
  const [note, setNote] = useState<SoapNote | null>(null);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    const noteId = params.noteId;
    if (noteId) {
      const found = notes.find((n) => n.id === noteId);
      setNote(found ?? null);
    } else {
      setNote(getLatestNote());
    }
  }, [notes, params.noteId, getLatestNote]);

  const handleCopyForDoctor = () => {
    if (!note) return;
    const text = formatSoapForCopy(note);
    if (Platform.OS === 'web') {
      try {
        navigator.clipboard.writeText(text);
        Alert.alert('Copied', 'SOAP note copied to clipboard.');
      } catch {
        Alert.alert('Copy failed', 'Could not copy to clipboard.');
      }
      return;
    }
    Share.share({
      message: text,
      title: 'SOAP Note for Doctor',
    }).catch(() => {});
  };

  if (!note) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
        <YStack flex={1} padding="$4" justifyContent="center" alignItems="center">
          <Text color="#8E8E93">No SOAP note found.</Text>
          <Button marginTop="$4" onPress={() => navigation.goBack()}>
            Go back
          </Button>
        </YStack>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
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
            SOAP Note
          </Text>
        </XStack>

        <YStack gap="$4" paddingBottom="$6">
          <Card
            backgroundColor="#1C1C1E"
            borderRadius="$6"
            padding="$4"
            borderWidth={1}
            borderColor="#2C2C2E"
          >
            <Text fontSize="$3" color="#3B82F6" fontWeight="600" marginBottom="$2">
              Subjective
            </Text>
            <Text fontSize="$4" color="#E0E0E0" lineHeight={22}>
              {note.subjective}
            </Text>
          </Card>

          <Card
            backgroundColor="#1C1C1E"
            borderRadius="$6"
            padding="$4"
            borderWidth={1}
            borderColor="#2C2C2E"
          >
            <Text fontSize="$3" color="#3B82F6" fontWeight="600" marginBottom="$2">
              Objective
            </Text>
            <Text fontSize="$4" color="#E0E0E0" lineHeight={22}>
              {note.objective}
            </Text>
          </Card>

          <Card
            backgroundColor="#1C1C1E"
            borderRadius="$6"
            padding="$4"
            borderWidth={1}
            borderColor="#2C2C2E"
          >
            <Text fontSize="$3" color="#3B82F6" fontWeight="600" marginBottom="$2">
              Assessment
            </Text>
            <Text fontSize="$4" color="#E0E0E0" lineHeight={22}>
              {note.assessment}
            </Text>
          </Card>

          <Card
            backgroundColor="#1C1C1E"
            borderRadius="$6"
            padding="$4"
            borderWidth={1}
            borderColor="#2C2C2E"
          >
            <Text fontSize="$3" color="#3B82F6" fontWeight="600" marginBottom="$2">
              Plan
            </Text>
            <Text fontSize="$4" color="#E0E0E0" lineHeight={22}>
              {note.plan}
            </Text>
          </Card>

          <Button
            backgroundColor="#3B82F6"
            paddingVertical="$4"
            borderRadius="$6"
            icon={<Ionicons name="share-outline" size={20} color="white" />}
            onPress={handleCopyForDoctor}
          >
            <Text color="white" fontWeight="600">
              Copy for Doctor
            </Text>
          </Button>
        </YStack>
      </YStack>
    </SafeAreaView>
  );
}
