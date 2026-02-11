import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, Animated, TouchableOpacity, Modal, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GiftedChat, IMessage, InputToolbar, Bubble, Send, Composer, MessageText } from 'react-native-gifted-chat';
import Markdown from 'react-native-markdown-display';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import {
  YStack,
  XStack,
  Card,
  Text,
  Button,
  ScrollView as RNScrollView,
  Input,
} from 'tamagui';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore, ChatSession } from '../../store/useChatStore';
import { useRecordsStore } from '../../store/useRecordsStore';
import { CustomMessageBubble } from '../../components/chat/CustomMessageBubble';
import { ResponsiveContainer } from '@/components/ui/ResponsiveContainer';
import { sendChatMessage, createSession, fetchSessions, fetchSessionMessages, deleteSession, renameSession, confirmMedicationPlan } from '@/services/api/backendApi';
import { useAuthStore } from '../../store/useAuthStore';
import { ActivityIndicator, Dimensions, Alert, View } from 'react-native';
import { HealthScoreGraph } from '@/components/chat/HealthScoreGraph';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;



const AddMedicationBubble = ({ initialData }: { initialData: any }) => {
  const [formData, setFormData] = useState({
    drug_name: initialData.drug_name || '',
    dosage: initialData.dosage || '',
    frequency_text: initialData.frequency_text || 'Once daily',
    recommended_times: initialData.recommended_times || ['09:00'],
    duration_days: initialData.duration_days || 7,
    instructions: initialData.instructions || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Time picker state
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingTimeIndex, setEditingTimeIndex] = useState<number | null>(null);
  const [pickerHour, setPickerHour] = useState('09');
  const [pickerMinute, setPickerMinute] = useState('00');

  const handleSave = async () => {
    if (!formData.drug_name) {
      Alert.alert('Missing Name', 'Please enter the medication name.');
      return;
    }

    setSaving(true);
    try {
      const payload = [{
        drug_name: formData.drug_name,
        dosage: formData.dosage,
        frequency_text: formData.frequency_text,
        recommended_times: formData.recommended_times,
        duration_days: formData.duration_days,
        instructions: formData.instructions || undefined,
        form: 'tablet',
        normalized_name: formData.drug_name.toLowerCase().trim(),
      }];

      const result = await confirmMedicationPlan(payload);
      if (result.success) {
        setSaved(true);
      } else {
        Alert.alert('Error', result.error || 'Failed to save.');
      }
    } catch (e) {
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const openTimePicker = (index: number) => {
    const time = formData.recommended_times[index] || '09:00';
    const [h, m] = time.split(':');
    setPickerHour(h || '09');
    setPickerMinute(m || '00');
    setEditingTimeIndex(index);
    setShowTimePicker(true);
  };

  const confirmTimePicker = () => {
    const h = Math.min(23, Math.max(0, parseInt(pickerHour) || 0)).toString().padStart(2, '0');
    const m = Math.min(59, Math.max(0, parseInt(pickerMinute) || 0)).toString().padStart(2, '0');
    const timeString = `${h}:${m}`;

    const newTimes = [...formData.recommended_times];
    if (editingTimeIndex !== null && editingTimeIndex < newTimes.length) {
      newTimes[editingTimeIndex] = timeString;
    } else {
      newTimes.push(timeString);
    }
    newTimes.sort();
    setFormData({ ...formData, recommended_times: newTimes });
    setShowTimePicker(false);
    setEditingTimeIndex(null);
  };

  const addTimeSlot = () => {
    setPickerHour('09');
    setPickerMinute('00');
    setEditingTimeIndex(formData.recommended_times.length); // new slot
    setShowTimePicker(true);
  };

  const removeLastTime = () => {
    if (formData.recommended_times.length > 1) {
      setFormData({
        ...formData,
        recommended_times: formData.recommended_times.slice(0, -1),
      });
    }
  };

  const changeDuration = (delta: number) => {
    const newVal = Math.max(1, formData.duration_days + delta);
    setFormData({ ...formData, duration_days: newVal });
  };

  if (saved) {
    return (
      <Card backgroundColor="#ECFDF5" padding="$4" borderRadius="$4" borderColor="#10B981" borderWidth={1} width={SCREEN_WIDTH * 0.85} alignSelf="center" marginVertical="$2">
        <YStack alignItems="center" gap="$2">
          <Ionicons name="checkmark-circle" size={36} color="#10B981" />
          <Text fontWeight="700" color="#065F46" fontSize={17}>Medication Scheduled!</Text>
          <YStack gap="$1" width="100%" paddingTop="$2">
            <XStack justifyContent="space-between">
              <Text fontSize={13} color="#047857" fontWeight="600">Name</Text>
              <Text fontSize={13} color="#065F46">{formData.drug_name}</Text>
            </XStack>
            {formData.dosage ? (
              <XStack justifyContent="space-between">
                <Text fontSize={13} color="#047857" fontWeight="600">Dosage</Text>
                <Text fontSize={13} color="#065F46">{formData.dosage}</Text>
              </XStack>
            ) : null}
            <XStack justifyContent="space-between">
              <Text fontSize={13} color="#047857" fontWeight="600">Frequency</Text>
              <Text fontSize={13} color="#065F46">{formData.frequency_text}</Text>
            </XStack>
            <XStack justifyContent="space-between">
              <Text fontSize={13} color="#047857" fontWeight="600">Times</Text>
              <Text fontSize={13} color="#065F46">{formData.recommended_times.join(', ')}</Text>
            </XStack>
            <XStack justifyContent="space-between">
              <Text fontSize={13} color="#047857" fontWeight="600">Duration</Text>
              <Text fontSize={13} color="#065F46">{formData.duration_days} days</Text>
            </XStack>
            {formData.instructions ? (
              <XStack justifyContent="space-between">
                <Text fontSize={13} color="#047857" fontWeight="600">Instructions</Text>
                <Text fontSize={13} color="#065F46">{formData.instructions}</Text>
              </XStack>
            ) : null}
          </YStack>
        </YStack>
      </Card>
    );
  }

  return (
    <>
      <Card backgroundColor="white" padding="$4" borderRadius="$4" borderColor="#E5E7EB" borderWidth={1} width={SCREEN_WIDTH * 0.85} alignSelf="center" marginVertical="$2" elevation={2}>
        <XStack alignItems="center" gap="$2" marginBottom="$3">
          <View style={{ backgroundColor: '#E0F2FE', padding: 6, borderRadius: 8 }}>
            <Ionicons name="add-circle" size={20} color="#0284C7" />
          </View>
          <Text fontWeight="700" fontSize={16} color="#1F2937">Schedule Medication</Text>
        </XStack>

        <YStack gap="$3">
          {/* Name */}
          <YStack>
            <Text fontSize={12} fontWeight="600" color="#6B7280" marginBottom="$1">Medication Name *</Text>
            <TextInput
              style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14 }}
              value={formData.drug_name}
              onChangeText={t => setFormData({ ...formData, drug_name: t })}
              placeholder="e.g. Ibuprofen"
            />
          </YStack>

          {/* Dosage & Frequency */}
          <XStack gap="$3">
            <YStack flex={1}>
              <Text fontSize={12} fontWeight="600" color="#6B7280" marginBottom="$1">Dosage</Text>
              <TextInput
                style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14 }}
                value={formData.dosage}
                onChangeText={t => setFormData({ ...formData, dosage: t })}
                placeholder="e.g. 200mg"
              />
            </YStack>
            <YStack flex={1}>
              <Text fontSize={12} fontWeight="600" color="#6B7280" marginBottom="$1">Frequency</Text>
              <TextInput
                style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14 }}
                value={formData.frequency_text}
                onChangeText={t => setFormData({ ...formData, frequency_text: t })}
                placeholder="e.g. Twice daily"
              />
            </YStack>
          </XStack>

          {/* Scheduled Times */}
          <YStack>
            <Text fontSize={12} fontWeight="600" color="#6B7280" marginBottom="$1">Scheduled Times</Text>
            <XStack flexWrap="wrap" gap="$2" alignItems="center">
              {formData.recommended_times.map((time: string, idx: number) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => openTimePicker(idx)}
                  style={{
                    backgroundColor: '#EFF6FF',
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#3B82F6',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Ionicons name="time-outline" size={14} color="#3B82F6" />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#3B82F6' }}>{time}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={addTimeSlot}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#D1D5DB',
                  borderStyle: 'dashed',
                }}
              >
                <Ionicons name="add" size={16} color="#6B7280" />
              </TouchableOpacity>
              {formData.recommended_times.length > 1 && (
                <TouchableOpacity
                  onPress={removeLastTime}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#EF4444',
                    borderStyle: 'dashed',
                  }}
                >
                  <Ionicons name="remove" size={16} color="#EF4444" />
                </TouchableOpacity>
              )}
            </XStack>
          </YStack>

          {/* Duration */}
          <YStack>
            <Text fontSize={12} fontWeight="600" color="#6B7280" marginBottom="$1">Duration</Text>
            <XStack alignItems="center" justifyContent="space-between" backgroundColor="#F9FAFB" borderRadius={8} borderWidth={1} borderColor="#D1D5DB" paddingVertical={6}>
              <TouchableOpacity onPress={() => changeDuration(-1)} style={{ width: 44, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="remove" size={18} color="#6B7280" />
              </TouchableOpacity>
              <Text fontSize={16} fontWeight="600" color="#1F2937">{formData.duration_days} days</Text>
              <TouchableOpacity onPress={() => changeDuration(1)} style={{ width: 44, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="add" size={18} color="#6B7280" />
              </TouchableOpacity>
            </XStack>
          </YStack>

          {/* Instructions */}
          <YStack>
            <Text fontSize={12} fontWeight="600" color="#6B7280" marginBottom="$1">Instructions (optional)</Text>
            <TextInput
              style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14 }}
              value={formData.instructions}
              onChangeText={t => setFormData({ ...formData, instructions: t })}
              placeholder="e.g. After food, Before sleep"
            />
          </YStack>

          <Button
            backgroundColor={saving ? "#93C5FD" : "#3B82F6"}
            onPress={handleSave}
            disabled={saving}
            marginTop="$2"
            borderRadius={12}
          >
            {saving ? <ActivityIndicator color="white" /> : (
              <XStack alignItems="center" gap="$2">
                <Ionicons name="calendar" size={16} color="white" />
                <Text color="white" fontWeight="600">Schedule Medication</Text>
              </XStack>
            )}
          </Button>
        </YStack>
      </Card>

      {/* Time Picker Modal */}
      <Modal visible={showTimePicker} transparent animationType="fade" onRequestClose={() => setShowTimePicker(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 24, width: '85%', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 20, color: '#1F2937' }}>Select Time</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <View style={{ alignItems: 'center' }}>
                <TextInput
                  style={{ fontSize: 32, fontWeight: 'bold', color: '#3B82F6', textAlign: 'center', width: 60, borderBottomWidth: 1, borderColor: '#E5E7EB' }}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="09"
                  value={pickerHour}
                  onChangeText={setPickerHour}
                />
                <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Hour</Text>
              </View>
              <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#1F2937' }}>:</Text>
              <View style={{ alignItems: 'center' }}>
                <TextInput
                  style={{ fontSize: 32, fontWeight: 'bold', color: '#3B82F6', textAlign: 'center', width: 60, borderBottomWidth: 1, borderColor: '#E5E7EB' }}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="00"
                  value={pickerMinute}
                  onChangeText={setPickerMinute}
                />
                <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Minute</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' }}
                onPress={() => setShowTimePicker(false)}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#9CA3AF' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#3B82F6', alignItems: 'center' }}
                onPress={confirmTimePicker}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: 'white' }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

// Confirmation bubble for non-RAG queries
const ConfirmationBubble = ({ originalQuestion, sessionId, chatId, addMessage, sendChatMessage }: {
  originalQuestion: string;
  sessionId: string | undefined;
  chatId: string;
  addMessage: (chatId: string, msg: any) => void;
  sendChatMessage: (req: any) => Promise<any>;
}) => {
  const [answered, setAnswered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [choice, setChoice] = useState<'yes' | 'no' | null>(null);

  const handleYes = async () => {
    setChoice('yes');
    setLoading(true);
    try {
      const response = await sendChatMessage({
        question: originalQuestion,
        sessionId: sessionId,
        skipRag: true,
      });

      if (response.success && response.answer) {
        addMessage(chatId, {
          id: Date.now().toString(),
          text: response.answer,
          userId: 'coach',
          createdAt: new Date(),
        });
      } else {
        addMessage(chatId, {
          id: Date.now().toString(),
          text: 'Sorry, I encountered an error while processing your request.',
          userId: 'coach',
          createdAt: new Date(),
        });
      }
    } catch (e) {
      addMessage(chatId, {
        id: Date.now().toString(),
        text: 'Something went wrong. Please try again.',
        userId: 'coach',
        createdAt: new Date(),
      });
    } finally {
      setLoading(false);
      setAnswered(true);
    }
  };

  const handleNo = () => {
    setChoice('no');
    setAnswered(true);
    addMessage(chatId, {
      id: Date.now().toString(),
      text: "Understood! Feel free to ask me anything about your uploaded medical records. 📋",
      userId: 'coach',
      createdAt: new Date(),
    });
  };

  // if (answered && choice === 'yes') {
  //   return (
  //     <Card backgroundColor="#EFF6FF" padding="$3" borderRadius="$4" borderColor="#3B82F6" borderWidth={1} width={SCREEN_WIDTH * 0.85} alignSelf="center" marginVertical="$2">
  //       <XStack alignItems="center" gap="$2">
  //         <Ionicons name="checkmark-circle" size={20} color="#3B82F6" />
  //         <Text fontSize={13} color="#1E40AF" fontWeight="600">
  //           {loading ? 'Generating response...' : 'Answered from general knowledge'}
  //         </Text>
  //         {loading && <ActivityIndicator size="small" color="#3B82F6" />}
  //       </XStack>
  //     </Card>
  //   );
  // }

  // if (answered && choice === 'no') {
  //   return (
  //     <Card backgroundColor="#F3F4F6" padding="$3" borderRadius="$4" borderColor="#D1D5DB" borderWidth={1} width={SCREEN_WIDTH * 0.85} alignSelf="center" marginVertical="$2">
  //       <XStack alignItems="center" gap="$2">
  //         <Ionicons name="close-circle" size={20} color="#6B7280" />
  //         <Text fontSize={13} color="#6B7280" fontWeight="600">Request declined</Text>
  //       </XStack>
  //     </Card>
  //   );
  // }

  return (
    <Card backgroundColor="#FFFBEB" padding="$4" borderRadius="$4" borderColor="#F59E0B" borderWidth={1} width={SCREEN_WIDTH * 0.85} alignSelf="center" marginVertical="$2" elevation={2}>
      <YStack gap="$3">
        <XStack alignItems="center" gap="$2">
          <View style={{ backgroundColor: '#FEF3C7', padding: 6, borderRadius: 8 }}>
            <Ionicons name="alert-circle" size={20} color="#D97706" />
          </View>
          <Text fontWeight="700" fontSize={15} color="#92400E" flex={1}>
            Not from your documents
          </Text>
        </XStack>

        <Text fontSize={14} color="#78350F" lineHeight={20}>
          This query doesn't seem related to your uploaded medical records. Would you like me to answer from my general medical knowledge?
        </Text>

        <XStack gap="$3" justifyContent="flex-end">
          <TouchableOpacity
            onPress={handleNo}
            disabled={loading}
            style={{
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: '#F3F4F6',
              borderWidth: 1,
              borderColor: '#D1D5DB',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#6B7280' }}>No, thanks</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleYes}
            disabled={loading}
            style={{
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: '#10B981',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color="white" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: 'white' }}>Yes, proceed</Text>
              </>
            )}
          </TouchableOpacity>
        </XStack>
      </YStack>
    </Card>
  );
};

export function CoachChatScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'CoachChat'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { chats, currentChatId, addMessage, createNewChat, switchChat, deleteChat } = useChatStore();
  const { records, fetchRecords } = useRecordsStore();
  const [openHistory, setOpenHistory] = useState(false);
  const [inputText, setInputText] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [contextFile, setContextFile] = useState<{ id: string; title: string } | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const { user: profile } = useAuthStore();
  const { updateChat } = useChatStore();
  const USER_ID = profile?.id;

  // Left drawer animation
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  // Menu and rename state
  const [menuChatId, setMenuChatId] = useState<string | null>(null);
  const [renameDialogVisible, setRenameDialogVisible] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);

  // Animate drawer open/close
  useEffect(() => {
    Animated.timing(drawerAnim, {
      toValue: openHistory ? 0 : -DRAWER_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [openHistory]);

  // Fetch records for mention list
  React.useEffect(() => {
    fetchRecords();
  }, []);

  // Get current active chat
  const currentChat = useMemo(() => {
    return chats.find(c => c.id === currentChatId);
  }, [chats, currentChatId]);

  const { setChats, setMessages } = useChatStore();

  // Load sessions from backend on mount
  React.useEffect(() => {
    const loadSessions = async () => {
      try {
        const sessions = await fetchSessions();
        if (sessions && sessions.length > 0) {
          const formattedSessions: ChatSession[] = sessions.map((s: any) => ({
            id: s.id,
            title: s.title,
            messages: [],
            createdAt: new Date(s.created_at),
            backendSessionId: s.id
          }));
          setChats(formattedSessions);

          // Switch to most recent
          switchChat(formattedSessions[0].id);
        } else {
          // If no sessions, CLEAR existing chats and create one
          setChats([]);
          handleNewChat();
        }
      } catch (error) {
        console.error('Error loading sessions:', error);
      }
    };
    loadSessions();
  }, [USER_ID]);

  // Load messages when current chat changes
  React.useEffect(() => {
    const loadMessages = async () => {
      if (currentChatId && currentChat && currentChat.messages.length === 0) {
        try {
          const msgs = await fetchSessionMessages(currentChatId);
          if (msgs && msgs.length > 0) {
            const formattedMsgs = msgs.map((m: any) => ({
              id: m.id,
              text: m.content,
              userId: m.role === 'user' ? 'user' : 'coach',
              createdAt: new Date(m.created_at)
            }));
            setMessages(currentChatId, formattedMsgs);
          }
        } catch (error) {
          console.error('Error loading messages:', error);
        }
      }
    };
    loadMessages();
  }, [currentChatId]);

  const handleNewChat = () => {
    createNewChat();
    setOpenHistory(false);
  };

  const handleDeleteChat = async (chatId: string) => {
    setMenuChatId(null);
    Alert.alert(
      "Delete Chat",
      "Are you sure you want to delete this conversation?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            // Optimistic update
            deleteChat(chatId);

            // Call backend
            const result = await deleteSession(chatId);
            if (!result.success) {
              console.error('Failed to delete chat session on backend:', result.error);
              // Ideally we should rollback or show error toast, but store is already updated.
            }

            // If no chats left, create new one
            if (chats.length <= 1) { // checking length before delete takes effect fully in re-render context?
              // deleteChat handles currentChatId logic. If empty, we might need to trigger new chat manually if not handled.
              // deleteChat logic: s.chats.filter(c => c.id !== id).
              // If resulting chats is empty...
            }
          }
        }
      ]
    );
  };

  const handleOpenRenameDialog = (chatId: string, currentTitle: string) => {
    setMenuChatId(null);
    setRenamingChatId(chatId);
    setRenameText(currentTitle);
    setRenameDialogVisible(true);
  };

  const handleRenameChat = async () => {
    if (!renamingChatId || !renameText.trim()) return;

    const newTitle = renameText.trim();

    // Optimistic update
    updateChat(renamingChatId, { title: newTitle });

    // Call backend
    // Call backend
    // FIX: Use backendSessionId if available (for new chats where id is local timestamp)
    const chatToRename = chats.find(c => c.id === renamingChatId);
    const apiSessionId = chatToRename?.backendSessionId || renamingChatId;

    const result = await renameSession(apiSessionId, newTitle);
    if (!result.success) {
      console.error('Failed to rename chat session:', result.error);
    }

    setRenameDialogVisible(false);
    setRenamingChatId(null);
    setRenameText('');
  };


  // ... (keep onSend logic but update message creation)
  const onSend = useCallback(async (newMessages: IMessage[] = []) => {
    if (newMessages.length > 0 && currentChatId && currentChat) {
      const msg = newMessages[0];
      const sentContext = contextFile ? { id: contextFile.id, title: contextFile.title } : undefined;

      // Clear context immediately after sending
      setContextFile(null);

      // Add user message locally
      addMessage(currentChatId, {
        id: Date.now().toString(),
        text: msg.text,
        userId: 'user',
        createdAt: new Date(),
        context: sentContext // Store context in message
      });

      setIsTyping(true);

      try {
        let backendSessionId = currentChat.backendSessionId;
        // ... (session creation logic same as before)
        if (!backendSessionId) {
          const session = await createSession(msg.text.substring(0, 30));
          if (session) {
            backendSessionId = session.id;
            updateChat(currentChatId, { backendSessionId });
          }
        }

        // Send to backend RAG
        const chatResponse = await sendChatMessage({
          question: msg.text,
          sessionId: backendSessionId,
          documentId: sentContext?.id // Use captured context
        });

        if (chatResponse.success) {
          // Check if this is a noRagMatch response
          if (chatResponse.noRagMatch) {
            // Show confirmation bubble instead of AI answer
            addMessage(currentChatId, {
              id: Date.now().toString(),
              text: JSON.stringify({
                type: 'rag_confirmation',
                data: {
                  originalQuestion: msg.text,
                  sessionId: backendSessionId,
                }
              }),
              userId: 'coach',
              createdAt: new Date(),
            });
          } else {
            // Normal AI response
            addMessage(currentChatId, {
              id: Date.now().toString(),
              text: chatResponse.answer,
              userId: 'coach',
              createdAt: new Date(),
            });
          }
        } else {
          // ... (error logic same)
          addMessage(currentChatId, {
            id: Date.now().toString(),
            text: "Sorry, I encountered an error: " + (chatResponse.error || "Unknown error"),
            userId: 'coach',
            createdAt: new Date(),
          });
        }
      } catch (error: any) {
        // ... (catch logic same)
        addMessage(currentChatId, {
          id: Date.now().toString(),
          text: "I'm having trouble connecting to my brain. Please try again later.",
          userId: 'coach',
          createdAt: new Date(),
        });
      } finally {
        setIsTyping(false);
      }
    }
  }, [addMessage, currentChatId, currentChat, USER_ID, updateChat, contextFile]); // Added contextFile dependency

  const renderBubble = (props: any) => {
    const { currentMessage } = props;
    const isUser = currentMessage.user._id === 'user';

    // For AI messages: icon on top, full-width bubble below
    if (!isUser) {
      return (
        <YStack width={SCREEN_WIDTH * 0.92} marginBottom={4}>
          {/* AI Icon Row */}
          <XStack alignItems="center" gap="$2" marginBottom="$1" marginLeft={4}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: '#10B981',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#10B981',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.2,
                shadowRadius: 3,
                elevation: 2,
              }}
            >
              <Ionicons name="sparkles" size={14} color="white" />
            </View>
            <Text fontSize={13} fontWeight="600" color="#374151">Rex.AI</Text>
          </XStack>

          {/* Context badge if present */}
          {currentMessage.context && (
            <XStack
              backgroundColor="#2C2C2E"
              paddingHorizontal="$2"
              paddingVertical="$1"
              borderRadius="$2"
              alignSelf="flex-start"
              marginBottom="$1"
              marginLeft={8}
              maxWidth={200}
            >
              <Ionicons name="document-text" size={10} color="#8E8E93" style={{ marginRight: 4 }} />
              <Text color="#8E8E93" fontSize={10} numberOfLines={1}>
                {currentMessage.context.title}
              </Text>
            </XStack>
          )}

          {/* AI Bubble - full width */}
          <Bubble
            {...props}
            wrapperStyle={{
              left: {
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                borderTopLeftRadius: 4,
                paddingHorizontal: 4,
                paddingVertical: 4,
                marginBottom: 0,
                width: '100%',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
                elevation: 2,
              },
              right: {},
            }}
            textStyle={{
              left: {
                color: '#1A1A1A',
                fontSize: 15,
                lineHeight: 22,
              },
              right: {},
            }}
            timeTextStyle={{
              left: {
                color: '#9CA3AF',
                fontSize: 11,
              },
              right: {},
            }}
          />
        </YStack>
      );
    }

    // User messages: standard right-aligned bubble
    return (
      <YStack>
        {currentMessage.context && (
          <XStack
            backgroundColor="#2C2C2E"
            paddingHorizontal="$2"
            paddingVertical="$1"
            borderRadius="$2"
            alignSelf="flex-end"
            marginBottom="$1"
            marginRight={8}
            maxWidth={200}
          >
            <Ionicons name="document-text" size={10} color="#8E8E93" style={{ marginRight: 4 }} />
            <Text color="#8E8E93" fontSize={10} numberOfLines={1}>
              {currentMessage.context.title}
            </Text>
          </XStack>
        )}
        <Bubble
          {...props}
          wrapperStyle={{
            right: {
              backgroundColor: '#3B82F6',
              borderRadius: 20,
              borderTopRightRadius: 4,
              paddingHorizontal: 4,
              paddingVertical: 4,
              marginBottom: 4,
              shadowColor: '#3B82F6',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 3,
            },
            left: {},
          }}
          textStyle={{
            right: {
              color: 'white',
              fontSize: 15,
              lineHeight: 22,
            },
            left: {},
          }}
          timeTextStyle={{
            right: {
              color: 'rgba(255,255,255,0.7)',
              fontSize: 11,
            },
            left: {},
          }}
        />
      </YStack>
    );
  };

  const onInputTextChanged = (text: string) => {
    setInputText(text);
    const lastWord = text.split(' ').pop() || '';
    if (lastWord.startsWith('@')) {
      setShowMentions(true);
      setMentionQuery(lastWord.slice(1).toLowerCase());
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (record: { id: string; title: string }) => {
    const words = inputText.split(' ');
    words.pop(); // Remove the '@query'
    const newText = words.join(' ');
    setInputText(newText);
    setContextFile({ id: record.id, title: record.title });
    setShowMentions(false);
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => r.title.toLowerCase().includes(mentionQuery));
  }, [records, mentionQuery]);

  const renderInputToolbar = (props: any) => {
    // Truncate title logic
    const truncateTitle = (title: string) => {
      if (title.length > 6) {
        return title.substring(0, 3) + '...';
      }
      return title;
    };

    return (
      <YStack>
        {/* Context Chip */}
        {contextFile && (
          <XStack
            position="absolute"
            bottom={60}
            left={16}
            backgroundColor="white"
            paddingVertical={8}
            paddingHorizontal={12}
            borderRadius={20}
            borderColor="#10B981"
            borderWidth={1.5}
            alignItems="center"
            gap={8}
            zIndex={10}
            shadowColor="#000"
            shadowOffset={{ width: 0, height: 2 }}
            shadowOpacity={0.08}
            shadowRadius={4}
            elevation={3}
          >
            <View style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              backgroundColor: '#ECFDF5',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Ionicons name="document-text" size={14} color="#10B981" />
            </View>
            <Text color="#1A1A1A" fontSize={13} fontWeight="500">Context: {truncateTitle(contextFile.title)}</Text>
            <TouchableOpacity
              onPress={() => setContextFile(null)}
              style={{ padding: 2 }}
            >
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </XStack>
        )}

        {showMentions && filteredRecords.length > 0 && (
          <XStack
            backgroundColor="white"
            marginHorizontal="$4"
            borderRadius={16}
            padding="$3"
            gap="$2"
            maxHeight={200}
            borderWidth={1}
            borderColor="#E5E7EB"
            position="absolute"
            bottom={75}
            left={0}
            right={0}
            zIndex={100}
            shadowColor="#000"
            shadowOffset={{ width: 0, height: 4 }}
            shadowOpacity={0.1}
            shadowRadius={12}
            elevation={4}
          >
            <RNScrollView keyboardShouldPersistTaps="always">
              <YStack gap="$1">
                {filteredRecords.map((record) => (
                  <Button
                    key={record.id}
                    backgroundColor="transparent"
                    paddingVertical="$2"
                    paddingHorizontal="$3"
                    onPress={() => insertMention(record)}
                    justifyContent="flex-start"
                    pressStyle={{ backgroundColor: '#F3F4F6' }}
                    borderRadius={12}
                  >
                    <XStack gap="$3" alignItems="center">
                      <View style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: record.type === 'lab' ? '#EBF4FF' : record.type === 'prescription' ? '#FEF3C7' : '#F3F4F6',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Ionicons
                          name={record.type === 'lab' ? 'flask' : record.type === 'prescription' ? 'medical' : 'document-text'}
                          size={18}
                          color={record.type === 'lab' ? '#3B82F6' : record.type === 'prescription' ? '#F59E0B' : '#6B7280'}
                        />
                      </View>
                      <YStack flex={1}>
                        <Text color="#1A1A1A" fontWeight="600" fontSize={14}>{record.title}</Text>
                        <Text color="#9CA3AF" fontSize={12}>{record.date}</Text>
                      </YStack>
                    </XStack>
                  </Button>
                ))}
              </YStack>
            </RNScrollView>
          </XStack>
        )}
        <InputToolbar
          {...props}
          containerStyle={{
            backgroundColor: '#F5F7FA',
            borderTopWidth: 0,
            paddingHorizontal: 16,
            paddingBottom: Platform.OS === 'ios' ? 16 : 12,
            paddingTop: 8,
          }}
          renderComposer={(composerProps: any) => (
            <XStack
              flex={1}
              backgroundColor="white"
              borderRadius={26}
              paddingLeft={16}
              paddingRight={6}
              paddingVertical={6}
              alignItems="flex-end"
              minHeight={52}
              shadowColor="#000"
              shadowOffset={{ width: 0, height: 2 }}
              shadowOpacity={0.06}
              shadowRadius={8}
              elevation={3}
              borderWidth={1}
              borderColor="#E5E7EB"
            >
              <Composer
                {...composerProps}
                placeholder="Ask a question..."
                placeholderTextColor="#9CA3AF"
                multiline
                textInputStyle={{
                  color: '#1A1A1A',
                  fontSize: 16,
                  lineHeight: 22,
                  paddingTop: 8,
                  paddingBottom: 8,
                  flex: 1,
                  maxHeight: 100,
                }}
              />
              <TouchableOpacity
                onPress={() => navigation.navigate('VoiceChat')}
                style={{ padding: 8, marginBottom: 4 }}
              >
                <Ionicons name="mic-outline" size={22} color="#9CA3AF" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (inputText.trim()) {
                    const msg = [{ _id: Date.now().toString(), text: inputText, createdAt: new Date(), user: { _id: 'user' } }];
                    props.onSend?.(msg, true);
                  }
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#3B82F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 2,
                }}
              >
                <Ionicons name="arrow-up" size={20} color="white" />
              </TouchableOpacity>
            </XStack>
          )}
          renderSend={() => null}
        />
      </YStack>
    );
  };

  const renderSend = (props: any) => {
    return (
      <Send
        {...props}
        containerStyle={{
          justifyContent: 'center',
          alignItems: 'center',
          alignSelf: 'flex-end',
          marginRight: 8,
          marginBottom: Platform.OS === 'ios' ? 28 : 24,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: '#3B82F6',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#3B82F6',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 4,
          }}
        >
          <Ionicons name="arrow-up" size={22} color="white" />
        </View>
      </Send>
    );
  };

  const renderAvatar = (props: any) => {
    // Avatar is now rendered inside renderBubble for AI messages
    // Suppress default GiftedChat avatar
    return null;
  };

  const renderCustomView = (props: any) => {
    const { currentMessage } = props;
    if (!currentMessage?.text) return null;

    const text = currentMessage.text;

    // Debug log to check if JSON is reaching the frontend
    if (text.includes('health_score') || text.includes('json')) {
      console.log('[CoachChat] Checking message for graph JSON...');
    }

    // Parse Logic:
    // 1. Try to find a fenced code block first (Most reliable for nested JSON)
    let jsonStr = '';
    const fencedMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);

    if (fencedMatch && fencedMatch[1]) {
      jsonStr = fencedMatch[1];
    } else {
      // 2. Fallback: Look for the specific signature but capture cleanly
      // We can't trust simple regex for nested {}, so we might need to assume it's at the end
      // or try a balanced approach. For now, let's look for the start and the LAST }
      // or try a balanced approach. For now, let's look for the start and the LAST }
      const startIdx = text.indexOf('{"type":');
      const endIdx = text.lastIndexOf('}');
      if (startIdx !== -1 && endIdx > startIdx) {
        jsonStr = text.substring(startIdx, endIdx + 1);
      }
    }

    if (jsonStr) {
      try {
        console.log('[CoachChat] Attempting to parse extracted JSON:', jsonStr.substring(0, 50) + '...');
        const data = JSON.parse(jsonStr);

        if (data.type === 'health_score') {
          return (
            <YStack padding="$2" width={SCREEN_WIDTH * 0.75} alignSelf="center">
              <HealthScoreGraph data={data.data} />
            </YStack>
          );
        }

        if (data.type === 'medication_list') {
          return (
            <YStack padding="$2" width={SCREEN_WIDTH * 0.85} alignSelf="center">
              <Text fontSize={14} fontWeight="600" color="#374151" marginBottom="$2">Active Medications:</Text>
              <RNScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
                {data.data.map((med: any, index: number) => (
                  <Card key={index} backgroundColor="#ECFDF5" padding="$3" borderRadius="$4" marginRight="$3" width={140} borderColor="#10B981" borderWidth={1}>
                    <YStack gap="$1">
                      <Ionicons name="medkit" size={20} color="#10B981" />
                      <Text fontWeight="700" color="#065F46" fontSize={14} numberOfLines={1}>{med.name || med.drug_name}</Text>
                      <Text fontSize={12} color="#047857">{med.dosage} • {med.frequency}</Text>
                    </YStack>
                  </Card>
                ))}
              </RNScrollView>
              <Button
                marginTop="$3"
                backgroundColor="#3B82F6"
                size="$2"
                onPress={() => (navigation as any).navigate('HomeTab', { screen: 'MedicationList' })}
                icon={<Ionicons name="list" size={16} color="white" />}
              >
                Go to Medication Library
              </Button>
            </YStack>
          );
        }

        if (data.type === 'add_medication_form') {
          return <AddMedicationBubble initialData={data.data} />;
        }

        if (data.type === 'medication_scheduled') {
          const med = data.data;
          return (
            <Card backgroundColor="#ECFDF5" padding="$4" borderRadius="$4" borderColor="#10B981" borderWidth={1} width={SCREEN_WIDTH * 0.85} alignSelf="center" marginVertical="$2">
              <YStack alignItems="center" gap="$2">
                <Ionicons name="checkmark-circle" size={36} color="#10B981" />
                <Text fontWeight="700" color="#065F46" fontSize={17}>Medication Scheduled!</Text>
                <YStack gap="$1" width="100%" paddingTop="$2">
                  <XStack justifyContent="space-between">
                    <Text fontSize={13} color="#047857" fontWeight="600">Name</Text>
                    <Text fontSize={13} color="#065F46">{med.drug_name}</Text>
                  </XStack>
                  {med.dosage ? (
                    <XStack justifyContent="space-between">
                      <Text fontSize={13} color="#047857" fontWeight="600">Dosage</Text>
                      <Text fontSize={13} color="#065F46">{med.dosage}</Text>
                    </XStack>
                  ) : null}
                  <XStack justifyContent="space-between">
                    <Text fontSize={13} color="#047857" fontWeight="600">Frequency</Text>
                    <Text fontSize={13} color="#065F46">{med.frequency_text}</Text>
                  </XStack>
                  <XStack justifyContent="space-between">
                    <Text fontSize={13} color="#047857" fontWeight="600">Times</Text>
                    <Text fontSize={13} color="#065F46">{(med.recommended_times || []).join(', ')}</Text>
                  </XStack>
                  <XStack justifyContent="space-between">
                    <Text fontSize={13} color="#047857" fontWeight="600">Duration</Text>
                    <Text fontSize={13} color="#065F46">{med.duration_days} days</Text>
                  </XStack>
                  {med.instructions ? (
                    <XStack justifyContent="space-between">
                      <Text fontSize={13} color="#047857" fontWeight="600">Instructions</Text>
                      <Text fontSize={13} color="#065F46">{med.instructions}</Text>
                    </XStack>
                  ) : null}
                </YStack>
              </YStack>
            </Card>
          );
        }

        if (data.type === 'next_doses') {
          return (
            <YStack padding="$2" width={SCREEN_WIDTH * 0.8} alignSelf="center">
              <Text fontSize={14} fontWeight="600" color="#374151" marginBottom="$2">Upcoming Doses:</Text>
              <YStack gap="$2">
                {data.data.map((dose: any, index: number) => (
                  <Card key={index} backgroundColor="#EFF6FF" padding="$3" borderRadius="$4" borderColor="#3B82F6" borderWidth={1}>
                    <XStack justifyContent="space-between" alignItems="center">
                      <YStack>
                        <Text fontWeight="700" color="#1E40AF" fontSize={15}>{dose.name || dose.drug_name}</Text>
                        <Text fontSize={12} color="#1E3A8A">{dose.dosage}</Text>
                      </YStack>
                      <YStack alignItems="flex-end">
                        <Text fontWeight="700" color="#2563EB" fontSize={14}>{dose.time || "Scheduled"}</Text>
                        <Ionicons name="time-outline" size={14} color="#3B82F6" />
                      </YStack>
                    </XStack>
                  </Card>
                ))}
              </YStack>
              <Button
                marginTop="$3"
                backgroundColor="#3B82F6"
                size="$2"
                onPress={() => (navigation as any).navigate('HomeTab', { screen: 'MedicationList' })}
                icon={<Ionicons name="calendar" size={16} color="white" />}
              >
                View Full Schedule
              </Button>
            </YStack>
          );
        }

        if (data.type === 'rag_confirmation') {
          return (
            <ConfirmationBubble
              originalQuestion={data.data.originalQuestion}
              sessionId={data.data.sessionId}
              chatId={currentChatId!}
              addMessage={addMessage}
              sendChatMessage={sendChatMessage}
            />
          );
        }

      } catch (e) {
        console.warn('Failed to parse health score JSON (CustomView)', e);
      }
    }
    return null;
  };

  // Helper to clean text for display (removes the JSON block)
  const formatMessageText = (text: string) => {
    // 1. Remove fenced block (robust)
    let clean = text.replace(/```json\s*(\{[\s\S]*?\})\s*```/g, '');

    // 2. Remove raw JSON block if it exists and wasn't fenced
    // Use the same fallback logic as renderCustomView to ensure we cut it all out
    // 2. Remove raw JSON block if it exists and wasn't fenced
    // Use the same fallback logic as renderCustomView to ensure we cut it all out
    if (clean.includes('"type": "health_score"') || clean.includes('"type": "medication_list"') || clean.includes('"type": "next_doses"') || clean.includes('"type": "add_medication_form"') || clean.includes('"type": "medication_scheduled"') || clean.includes('"type":"medication_scheduled"') || clean.includes('"type":"rag_confirmation"') || clean.includes('"type": "rag_confirmation"')) {
      const startIdx = clean.indexOf('{"type":');
      const endIdx = clean.lastIndexOf('}');
      if (startIdx !== -1 && endIdx > startIdx) {
        clean = clean.substring(0, startIdx) + clean.substring(endIdx + 1);
      }
    }
    return clean.trim();
  };

  // Convert store messages to GiftedChat format with CLEANED text
  const giftedMessages: IMessage[] = useMemo(() => {
    if (!currentChat) return [];
    return [...currentChat.messages].reverse().map((msg) => {
      // Check if original text has JSON to preserve it for CustomView, 
      // but we want to hide it from the text bubble.
      // GiftedChat passes the *entire* message object to renderCustomView.
      return {
        _id: msg.id,
        text: msg.text, // Keep full text here so CustomView can find it? 
        // Text bubble displays this. We need to split or handle text formatting.
        createdAt: msg.createdAt,
        user: {
          _id: msg.userId,
          name: msg.userId === 'user' ? 'You' : 'Rex.ai',
          // avatar: msg.userId === 'user' ? undefined : '🦖', // Removed manual emoji avatar, using renderAvatar
        },
        context: msg.context // Pass context to GiftedChat message
      };
    });
  }, [currentChat?.messages]);

  // Markdown styles for rich text rendering
  const markdownStyles = StyleSheet.create({
    body: {
      color: '#1A1A1A',
      fontSize: 15,
      lineHeight: 22,
    },
    heading1: {
      color: '#1A1A1A',
      fontSize: 20,
      fontWeight: '700',
      marginTop: 12,
      marginBottom: 8,
      lineHeight: 26,
    },
    heading2: {
      color: '#1A1A1A',
      fontSize: 18,
      fontWeight: '700',
      marginTop: 10,
      marginBottom: 6,
      lineHeight: 24,
    },
    heading3: {
      color: '#374151',
      fontSize: 16,
      fontWeight: '600',
      marginTop: 8,
      marginBottom: 4,
      lineHeight: 22,
    },
    paragraph: {
      color: '#374151',
      fontSize: 15,
      lineHeight: 22,
      marginTop: 4,
      marginBottom: 8,
    },
    strong: {
      fontWeight: '700',
      color: '#1A1A1A',
    },
    em: {
      fontStyle: 'italic',
      color: '#4B5563',
    },
    bullet_list: {
      marginVertical: 6,
    },
    ordered_list: {
      marginVertical: 6,
    },
    list_item: {
      flexDirection: 'row',
      marginVertical: 3,
    },
    bullet_list_icon: {
      color: '#3B82F6',
      fontSize: 16,
      marginRight: 8,
    },
    ordered_list_icon: {
      color: '#3B82F6',
      fontSize: 14,
      fontWeight: '600',
      marginRight: 8,
    },
    bullet_list_content: {
      flex: 1,
      color: '#374151',
      fontSize: 15,
      lineHeight: 22,
    },
    ordered_list_content: {
      flex: 1,
      color: '#374151',
      fontSize: 15,
      lineHeight: 22,
    },
    code_inline: {
      backgroundColor: '#F3F4F6',
      color: '#3B82F6',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      fontSize: 13,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    code_block: {
      backgroundColor: '#F3F4F6',
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
    },
    fence: {
      backgroundColor: '#F3F4F6',
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
    },
    blockquote: {
      backgroundColor: '#F0F9FF',
      borderLeftWidth: 4,
      borderLeftColor: '#3B82F6',
      paddingLeft: 12,
      paddingVertical: 8,
      marginVertical: 8,
      borderRadius: 4,
    },
    hr: {
      backgroundColor: '#E5E7EB',
      height: 1,
      marginVertical: 12,
    },
    link: {
      color: '#3B82F6',
      textDecorationLine: 'underline',
    },
    table: {
      borderWidth: 1,
      borderColor: '#E5E7EB',
      borderRadius: 8,
      marginVertical: 8,
    },
    thead: {
      backgroundColor: '#F9FAFB',
    },
    th: {
      padding: 8,
      fontWeight: '600',
      borderBottomWidth: 1,
      borderColor: '#E5E7EB',
    },
    td: {
      padding: 8,
      borderBottomWidth: 1,
      borderColor: '#E5E7EB',
    },
  });

  // Custom MessageText component with Markdown rendering
  const renderMessageText = (props: any) => {
    const { currentMessage, position } = props;
    const cleanText = formatMessageText(currentMessage.text);
    if (!cleanText) return null; // If text was only JSON

    const isUser = position === 'right';

    // For user messages, use simple text
    if (isUser) {
      return (
        <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text style={{ color: 'white', fontSize: 15, lineHeight: 22 }}>
            {cleanText}
          </Text>
        </View>
      );
    }

    // For AI messages, use Markdown rendering
    return (
      <View style={{ flexDirection: 'column', paddingHorizontal: 12, paddingVertical: 8 }}>
        <Markdown style={markdownStyles}>
          {cleanText}
        </Markdown>
      </View>
    );
  };

  // Empty Chat Component
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning.';
    if (hour < 17) return 'Good afternoon.';
    return 'Good evening.';
  };

  const suggestedInquiries = [
    {
      icon: 'document-text-outline',
      iconBg: '#EBF4FF',
      iconColor: '#3B82F6',
      title: 'Summarize prescription',
      subtitle: 'Break down latest medications',
      prompt: 'Summarize my prescription and break down the medications',
    },
    {
      icon: 'pricetag-outline',
      iconBg: '#EBF4FF',
      iconColor: '#3B82F6',
      title: 'Check interactions',
      subtitle: 'Safety analysis for your regime',
      prompt: 'Check for any drug interactions in my medications',
    },
    {
      icon: 'calendar-outline',
      iconBg: '#E0F7F7',
      iconColor: '#14B8A6',
      title: 'Next dose schedule',
      subtitle: 'View personalized timing',
      prompt: 'When should I take my next medication dose?',
    },
  ];

  const hasMessages = currentChat && currentChat.messages && currentChat.messages.length > 0;

  const [inputHeight, setInputHeight] = useState(44);

  const renderEmptyScreen = () => (
    <YStack flex={1}>
      <RNScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: 40,
          paddingBottom: 140,
        }}
      >
        <Ionicons name="sparkles-outline" size={30} color="#1364e7" />
        {/* Greeting */}
        <Text
          fontSize={30}
          fontWeight="500"
          color="#1A1A1A"
          marginBottom={4}
        >
          {getGreeting()}
        </Text>
        <Text
          fontSize={28}
          color="#9CA3AF"
          marginBottom={16}
          fontStyle="italic"
        >
          How can I assist you?
        </Text>

        {/* Subtitle */}
        <Text
          fontSize={15}
          color="#6B7280"
          lineHeight={22}
          marginBottom={32}
        >
          Your medical history and prescriptions{'\n'}are summarized and ready for analysis.
        </Text>

        {/* Suggested Inquiries Header */}
        <Text
          fontSize={11}
          fontWeight="700"
          color="#9CA3AF"
          letterSpacing={1.2}
          marginBottom={16}
        >
          SUGGESTED INQUIRIES
        </Text>

        {/* Inquiry Cards */}
        <YStack gap="$3">
          {suggestedInquiries.map((inquiry, index) => (
            <TouchableOpacity
              key={index}
              activeOpacity={0.7}
              onPress={() => {
                setInputText(inquiry.prompt);
              }}
              style={{
                backgroundColor: 'white',
                borderRadius: 16,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
                elevation: 1,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: inquiry.iconBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 16,
                }}
              >
                <Ionicons name={inquiry.icon as any} size={22} color={inquiry.iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#1A1A1A', fontSize: 16, fontWeight: '600', marginBottom: 2 }}>
                  {inquiry.title}
                </Text>
                <Text style={{ color: '#9CA3AF', fontSize: 14 }}>
                  {inquiry.subtitle}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
            </TouchableOpacity>
          ))}
        </YStack>
      </RNScrollView>

      {/* Input Bar for Empty State */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#F5F7FA',
          paddingHorizontal: 16,
          paddingBottom: Platform.OS === 'ios' ? 16 : 20,
          paddingTop: 12,
        }}
      >
        {/* Disclaimer above input */}
        <Text style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginBottom: 10 }}>
          Rex.AI analysis is for informational purposes only. Always consult a healthcare professional.
        </Text>
        <XStack
          backgroundColor="white"
          borderRadius={26}
          paddingHorizontal={16}
          paddingVertical={8}
          alignItems="flex-end"
          minHeight={52}
          shadowColor="#000"
          shadowOffset={{ width: 0, height: 1 }}
          shadowOpacity={0.05}
          shadowRadius={4}
          elevation={2}
        >
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask a question..."
            placeholderTextColor="#9CA3AF"
            multiline
            style={{
              flex: 1,
              color: '#1A1A1A',
              fontSize: 16,
              paddingVertical: 8,
              maxHeight: 120,
              minHeight: 36,
            }}
            onContentSizeChange={(e) => {
              const height = e.nativeEvent.contentSize.height;
              setInputHeight(Math.min(Math.max(height, 36), 120));
            }}
          />
          <TouchableOpacity
            onPress={() => navigation.navigate('VoiceChat')}
            style={{ padding: 8, marginBottom: 2 }}
          >
            <Ionicons name="mic-outline" size={22} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (inputText.trim()) {
                onSend([{ _id: Date.now().toString(), text: inputText, createdAt: new Date(), user: { _id: 'user' } }]);
                setInputText('');
              }
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#3B82F6',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 4,
            }}
          >
            <Ionicons name="arrow-up" size={20} color="white" />
          </TouchableOpacity>
        </XStack>
      </View>
    </YStack>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <YStack flex={1} backgroundColor="#F5F7FA">
          {/* Header */}
          <XStack
            paddingHorizontal="$4"
            paddingVertical="$3"
            alignItems="center"
            justifyContent="space-between"
            height={56}
            backgroundColor="#F5F7FA"
          >
            <Button
              size="$3"
              circular
              chromeless
              onPress={() => setOpenHistory(true)}
              icon={<Ionicons name="menu" size={24} color="#1A1A1A" />}
            />
            <XStack alignItems="center" gap="$2">
              <Ionicons name="sparkles" size={12} color="#c1d5f5" />
              <Text fontSize={13} fontWeight="600" color="#1A1A1A">
                Rex.AI
              </Text>
            </XStack>
            <Button
              size="$3"
              circular
              chromeless
              onPress={() => createNewChat()}
              icon={<Ionicons name="create-outline" size={24} color="#1A1A1A" />}
            />
          </XStack>

          {/* Content Area - Show Empty Screen or Chat */}
          {!hasMessages ? (
            renderEmptyScreen()
          ) : (
            <YStack flex={1} position="relative">
              <ResponsiveContainer>
                <GiftedChat
                  messages={giftedMessages}
                  onSend={onSend}
                  text={inputText}
                  user={{
                    _id: 'user',
                    name: 'You',
                  }}

                  renderBubble={renderBubble}
                  renderInputToolbar={renderInputToolbar}
                  renderSend={renderSend}
                  renderCustomView={renderCustomView}
                  renderMessageText={renderMessageText}
                  renderAvatar={renderAvatar}

                  textInputProps={{
                    placeholder: "Ask a question...",
                    onChangeText: onInputTextChanged,
                  }}
                  isSendButtonAlwaysVisible={true}
                  minInputToolbarHeight={90}
                  isTyping={isTyping}
                  messagesContainerStyle={{
                    backgroundColor: '#F5F7FA',
                    paddingBottom: 8,
                    paddingHorizontal: 8,
                  }}
                />
              </ResponsiveContainer>
            </YStack>
          )}
        </YStack>

        {/* Left-sliding History Drawer */}
        {openHistory && (
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              zIndex: 200000,
            }}
            activeOpacity={1}
            onPress={() => {
              setOpenHistory(false);
              setMenuChatId(null);
            }}
          />
        )}
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: DRAWER_WIDTH,
            height: '100%',
            backgroundColor: '#FAFBFC',
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
            zIndex: 200001,
            transform: [{ translateX: drawerAnim }],
            shadowColor: '#000',
            shadowOffset: { width: 4, height: 0 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 20,
          }}
        >
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            <YStack paddingHorizontal="$5" paddingTop="$4" flex={1}>
              {/* Header */}
              <XStack alignItems="center" justifyContent="space-between" marginBottom="$5">
                <Text fontSize={28} fontWeight="700" color="#1A1A1A">History</Text>
                <TouchableOpacity
                  onPress={() => {
                    setOpenHistory(false);
                    setMenuChatId(null);
                  }}
                  style={{ padding: 8 }}
                >
                  <Ionicons name="chevron-back" size={24} color="#3B82F6" />
                </TouchableOpacity>
              </XStack>

              {/* New Chat Button */}
              <TouchableOpacity
                onPress={handleNewChat}
                style={{
                  backgroundColor: '#3B82F6',
                  borderRadius: 12,
                  paddingVertical: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginBottom: 24,
                }}
              >
                <Ionicons name="add" size={22} color="white" />
                <Text color="white" fontSize={16} fontWeight="600">New Chat</Text>
              </TouchableOpacity>

              <RNScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {/* TODAY Section */}
                <Text fontSize={12} fontWeight="600" color="#9CA3AF" letterSpacing={1} marginBottom={12}>TODAY</Text>
                <YStack gap={8} marginBottom={24}>
                  {chats.map((chat) => (
                    <View key={chat.id}>
                      <TouchableOpacity
                        onPress={() => {
                          switchChat(chat.id);
                          setOpenHistory(false);
                          setMenuChatId(null);
                        }}
                        style={{
                          backgroundColor: 'transparent',
                          borderRadius: 12,
                          paddingVertical: 14,
                          paddingHorizontal: 16,
                          borderWidth: currentChatId === chat.id ? 2 : 0,
                          borderColor: currentChatId === chat.id ? '#3B82F6' : 'transparent',
                        }}
                      >
                        <XStack alignItems="center" justifyContent="space-between">
                          <Text
                            color={currentChatId === chat.id ? '#1E40AF' : '#374151'}
                            fontWeight={currentChatId === chat.id ? '600' : '500'}
                            fontSize={15}
                            numberOfLines={1}
                            style={{ flex: 1 }}
                          >
                            {chat.title}
                          </Text>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              setMenuChatId(menuChatId === chat.id ? null : chat.id);
                            }}
                            style={{ padding: 4, marginLeft: 8 }}
                          >
                            <Ionicons name="ellipsis-vertical" size={18} color="#9CA3AF" />
                          </TouchableOpacity>
                        </XStack>
                      </TouchableOpacity>

                      {/* Dropdown Menu */}
                      {menuChatId === chat.id && (
                        <View
                          style={{
                            backgroundColor: 'white',
                            borderRadius: 8,
                            marginTop: 4,
                            marginLeft: 16,
                            marginRight: 8,
                            overflow: 'hidden',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 8,
                            elevation: 4,
                            borderWidth: 1,
                            borderColor: '#E5E7EB',
                          }}
                        >
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingVertical: 12,
                              paddingHorizontal: 16,
                              gap: 12,
                            }}
                            onPress={() => handleOpenRenameDialog(chat.id, chat.title)}
                          >
                            <Ionicons name="pencil-outline" size={18} color="#374151" />
                            <Text color="#374151" fontSize={14}>Rename</Text>
                          </TouchableOpacity>
                          <View style={{ height: 1, backgroundColor: '#E5E7EB' }} />
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingVertical: 12,
                              paddingHorizontal: 16,
                              gap: 12,
                            }}
                            onPress={() => handleDeleteChat(chat.id)}
                          >
                            <Ionicons name="trash-outline" size={18} color="#EF4444" />
                            <Text color="#EF4444" fontSize={14}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ))}
                </YStack>
              </RNScrollView>

              {/* Settings Button */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 16,
                  borderTopWidth: 1,
                  borderTopColor: '#E5E7EB',
                }}
              >
                <Ionicons name="settings-outline" size={22} color="#6B7280" />
                <Text color="#374151" fontSize={15} fontWeight="500">Settings</Text>
              </TouchableOpacity>
            </YStack>
          </SafeAreaView>
        </Animated.View>

        {/* Rename Dialog */}
        <Modal
          visible={renameDialogVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setRenameDialogVisible(false)}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.6)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            activeOpacity={1}
            onPress={() => setRenameDialogVisible(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={{
                backgroundColor: 'white',
                borderRadius: 16,
                padding: 20,
                width: SCREEN_WIDTH * 0.85,
                maxWidth: 400,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 20,
                elevation: 10,
              }}
            >
              <Text color="#1A1A1A" fontSize={18} fontWeight="700" marginBottom={16}>
                Rename Chat
              </Text>
              <TextInput
                value={renameText}
                onChangeText={setRenameText}
                placeholder="Enter new title"
                placeholderTextColor="#9CA3AF"
                style={{
                  backgroundColor: '#F5F7FA',
                  borderRadius: 10,
                  padding: 14,
                  color: '#1A1A1A',
                  fontSize: 16,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
                autoFocus={true}
              />
              <XStack gap="$3" justifyContent="flex-end">
                <Button
                  size="$3"
                  backgroundColor="transparent"
                  borderWidth={1}
                  borderColor="#D1D5DB"
                  onPress={() => setRenameDialogVisible(false)}
                >
                  <Text color="#374151">Cancel</Text>
                </Button>
                <Button
                  size="$3"
                  backgroundColor="$blue10"
                  onPress={handleRenameChat}
                >
                  <Text color="white" fontWeight="600">Save</Text>
                </Button>
              </XStack>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
