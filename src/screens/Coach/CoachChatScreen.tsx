import React, { useState, useCallback, useMemo } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GiftedChat, IMessage, InputToolbar, Bubble, Send, Composer, MessageText } from 'react-native-gifted-chat';
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
  Sheet,
  Separator,
} from 'tamagui';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore, ChatSession } from '../../store/useChatStore';
import { useRecordsStore } from '../../store/useRecordsStore';
import { CustomMessageBubble } from '../../components/chat/CustomMessageBubble';
import { ResponsiveContainer } from '@/components/ui/ResponsiveContainer';
import { sendChatMessage, createSession, fetchSessions, fetchSessionMessages, deleteSession } from '@/services/api/backendApi';
import { useAuthStore } from '../../store/useAuthStore';
import { ActivityIndicator, Dimensions, Alert, View } from 'react-native';
import { HealthScoreGraph } from '@/components/chat/HealthScoreGraph';

const { width: SCREEN_WIDTH } = Dimensions.get('window');


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
          // ... (success logic same)
          addMessage(currentChatId, {
            id: Date.now().toString(),
            text: chatResponse.answer,
            userId: 'coach',
            createdAt: new Date(),
          });
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
    return (
      <YStack>
        {currentMessage.context && (
          <XStack
            backgroundColor="#2C2C2E"
            paddingHorizontal="$2"
            paddingVertical="$1"
            borderRadius="$2"
            alignSelf={currentMessage.user._id === 'user' ? 'flex-end' : 'flex-start'}
            marginBottom="$1"
            marginRight={currentMessage.user._id === 'user' ? 8 : 0}
            marginLeft={currentMessage.user._id === 'user' ? 0 : 8}
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
              backgroundColor: '#007AFF',
              borderRadius: 18,
              paddingHorizontal: 12,
              paddingVertical: 8,
            },
            left: {
              backgroundColor: 'white',
              borderWidth: 1,
              borderColor: '#E5E5EA',
              borderRadius: 18,
              paddingHorizontal: 12,
              paddingVertical: 8,
            },
          }}
          textStyle={{
            right: {
              color: 'white',
              fontSize: 15,
            },
            left: {
              color: '#000000',
              fontSize: 15,
            },
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
            bottom={55}
            left={12}
            backgroundColor="#2C2C2E"
            paddingVertical="$1"
            paddingHorizontal="$3"
            borderRadius="$4"
            borderColor="#1ef33aff"
            borderWidth={1}
            alignItems="center"
            gap="$2"
            zIndex={10}
          >
            <Ionicons name="document-text" size={14} color="#3B82F6" />
            <Text color="white" fontSize="$3">Context: {truncateTitle(contextFile.title)}</Text>
            <Button
              size="$1"
              circular
              chromeless
              onPress={() => setContextFile(null)}
              icon={<Ionicons name="close" size={14} color="#8E8E93" />}
            />
          </XStack>
        )}

        {showMentions && filteredRecords.length > 0 && (
          <XStack
            backgroundColor="#1C1C1E"
            marginHorizontal="$4"
            borderRadius="$4"
            padding="$2"
            gap="$2"
            maxHeight={200}
            borderWidth={1}
            borderColor="#2C2C2E"
            position="absolute"
            bottom={75}
            left={0}
            right={0}
            zIndex={100}
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
                  >
                    <XStack gap="$3" alignItems="center">
                      <Ionicons
                        name={record.type === 'lab' ? 'flask' : record.type === 'prescription' ? 'medical' : 'document-text'}
                        size={18}
                        color="#3B82F6"
                      />
                      <YStack>
                        <Text color="white" fontWeight="600">{record.title}</Text>
                        <Text color="#8E8E93" fontSize="$2">{record.date}</Text>
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
            backgroundColor: '#F2F2F7',
            borderTopWidth: 0,
            paddingHorizontal: 8,
            paddingBottom: 8,
          }}
          renderComposer={(composerProps: any) => (
            <XStack
              flex={1}
              backgroundColor="#1C1C1E"
              borderRadius={24}
              paddingHorizontal={12}
              alignItems="center"
              minHeight={48}
              marginRight={8}
            >
              <Button
                circular
                size="$3"
                chromeless
                padding={0}
                width={34}
                icon={<Ionicons name="add" size={24} color="#8E8E93" />}
              />
              <Button
                circular
                size="$3"
                chromeless
                padding={0}
                width={34}
                onPress={() => navigation.navigate('VoiceChat')}
                icon={<Ionicons name="mic" size={20} color="#8E8E93" />}
              />
              <Composer
                {...composerProps}
                placeholderTextColor="#8E8E93"
                textInputStyle={{
                  color: '#FFFFFF',
                  fontSize: 16,
                  paddingTop: 8,
                  marginLeft: 4,
                }}
              />
            </XStack>
          )}
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
          alignSelf: 'center',
          marginRight: 8,
        }}
      >
        <XStack
          width={36}
          height={36}
          borderRadius={18}
          backgroundColor="#007AFF" // Dynamic blue
          alignItems="center"
          justifyContent="center"
        >
          <Ionicons name="arrow-up" size={22} color="white" />
        </XStack>
      </Send>
    );
  };

  const renderAvatar = (props: any) => {
    const { currentMessage } = props;
    const isUser = currentMessage.user._id === 'user';

    return (
      <YStack
        width={36}
        height={36}
        borderRadius={18}
        backgroundColor={isUser ? '#007AFF' : '#34C759'} // User Blue, Bot Green
        alignItems="center"
        justifyContent="center"
        marginRight={8}
        marginLeft={8}
      >
        <Ionicons
          name={isUser ? "person" : "medical"}
          size={20}
          color="white"
        />
      </YStack>
    );
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
      const startIdx = text.indexOf('{"type": "health_score"');
      const endIdx = text.lastIndexOf('}');
      if (startIdx !== -1 && endIdx > startIdx) {
        jsonStr = text.substring(startIdx, endIdx + 1);
      }
    }

    if (jsonStr) {
      try {
        console.log('[CoachChat] Attempting to parse extracted JSON:', jsonStr.substring(0, 50) + '...');
        const data = JSON.parse(jsonStr);


        return (
          <YStack padding="$2" width={SCREEN_WIDTH * 0.75} alignSelf="center">
            <HealthScoreGraph data={data.data} />
          </YStack>
        );
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
    if (clean.includes('"type": "health_score"')) {
      const startIdx = clean.indexOf('{"type": "health_score"');
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

  // Custom MessageText component to hide JSON
  const renderMessageText = (props: any) => {
    const { currentMessage } = props;
    const cleanText = formatMessageText(currentMessage.text);
    if (!cleanText) return null; // If text was only JSON

    // Use default MessageText but with cleaned text
    return <MessageText {...props} currentMessage={{ ...currentMessage, text: cleanText }} />;
  };

  // Empty Chat Component
  const renderChatEmpty = () => {
    return (
      <View style={{ flex: 1, transform: [{ rotate: '180deg' }] }}>
        <YStack
          flex={1}
          alignItems="center"
          justifyContent="center"
          padding="$6"
        >
          <YStack
            width={100}
            height={100}
            borderRadius={50}
            backgroundColor="#2C2C2E"
            alignItems="center"
            justifyContent="center"
            marginBottom="$5"
            borderWidth={1}
            borderColor="#3A3A3C"
          >
            <Ionicons name="chatbubbles" size={48} color="#007AFF" />
          </YStack>

          <Text fontSize="$9" fontWeight="800" color="white" textAlign="center" marginBottom="$2">
            Rex.ai
          </Text>
          <Text fontSize="$4" color="#8E8E93" textAlign="center" marginBottom="$6" paddingHorizontal="$4">
            Your personal health assistant. Analyze records, get insights, or just chat.
          </Text>

          {/* Suggestions Grid */}
          <YStack gap="$3" width="100%">
            <XStack gap="$3" width="100%">
              <Button
                flex={1}
                backgroundColor="white"
                borderColor="#E5E5EA"
                borderWidth={1}
                borderRadius="$4"
                pressStyle={{ backgroundColor: '#F5F5F5' }}
                height={100}
                onPress={() => setInputText("Analyze my blood report")}
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                padding="$2"
              >
                <YStack
                  width={32} height={32} borderRadius={16}
                  backgroundColor="rgba(59, 130, 246, 0.2)"
                  alignItems="center" justifyContent="center" marginBottom="$2"
                >
                  <Ionicons name="flask" size={18} color="#3B82F6" />
                </YStack>
                <Text color="#000000" fontSize="$3" textAlign="center" numberOfLines={2}>Summarize Records</Text>
              </Button>

              <Button
                flex={1}
                backgroundColor="white"
                borderColor="#E5E5EA"
                borderWidth={1}
                borderRadius="$4"
                pressStyle={{ backgroundColor: '#F5F5F5' }}
                height={100}
                onPress={() => setInputText("Explain this prescription")}
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                padding="$2"
              >
                <YStack
                  width={32} height={32} borderRadius={16}
                  backgroundColor="rgba(52, 199, 89, 0.2)"
                  alignItems="center" justifyContent="center" marginBottom="$2"
                >
                  <Ionicons name="medical" size={18} color="#34C759" />
                </YStack>
                <Text color="#000000" fontSize="$3" textAlign="center" numberOfLines={2}>Explain Meds</Text>
              </Button>
            </XStack>

            <XStack gap="$3" width="100%">
              <Button
                flex={1}
                backgroundColor="white"
                borderColor="#E5E5EA"
                borderWidth={1}
                borderRadius="$4"
                pressStyle={{ backgroundColor: '#F5F5F5' }}
                height={100}
                onPress={() => setInputText("What do these results mean?")}
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                padding="$2"
              >
                <YStack
                  width={32} height={32} borderRadius={16}
                  backgroundColor="rgba(255, 149, 0, 0.2)"
                  alignItems="center" justifyContent="center" marginBottom="$2"
                >
                  <Ionicons name="pulse" size={18} color="#FF9500" />
                </YStack>
                <Text color="#000000" fontSize="$3" textAlign="center" numberOfLines={2}>Health Insights</Text>
              </Button>

              <Button
                flex={1}
                backgroundColor="white"
                borderColor="#E5E5EA"
                borderWidth={1}
                borderRadius="$4"
                pressStyle={{ backgroundColor: '#F5F5F5' }}
                height={100}
                onPress={() => setInputText("Suggest a diet plan")}
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                padding="$2"
              >
                <YStack
                  width={32} height={32} borderRadius={16}
                  backgroundColor="rgba(175, 82, 222, 0.2)"
                  alignItems="center" justifyContent="center" marginBottom="$2"
                >
                  <Ionicons name="nutrition" size={18} color="#AF52DE" />
                </YStack>
                <Text color="#000000" fontSize="$3" textAlign="center" numberOfLines={2}>Diet Plan</Text>
              </Button>
            </XStack>
          </YStack>
        </YStack>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F2F2F7' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <YStack flex={1} backgroundColor="#F2F2F7">
          {/* Header */}
          <XStack
            paddingHorizontal="$4"
            paddingVertical="$2"
            alignItems="center"
            justifyContent="space-between"
            height={60}
          >
            <Button
              size="$3"
              circular
              chromeless
              onPress={() => setOpenHistory(true)}
              icon={<Ionicons name="menu" size={24} color="#000000" />}
            />
            <Text fontSize="$5" fontWeight="600" color="#000000">
              {currentChat?.title === 'New Chat' ? 'Rex.ai' : currentChat?.title}
            </Text>
            <Button
              size="$3"
              circular
              chromeless
              onPress={() => createNewChat()}
              icon={<Ionicons name="create-outline" size={24} color="#000000" />}
            />
          </XStack>

          <Separator borderColor="#E5E5EA" />

          {/* Chat Area */}
          <YStack flex={1} position="relative">
            <ResponsiveContainer>
              {/* Removed absolute empty view, using renderChatEmpty instead */}

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
                renderChatEmpty={renderChatEmpty} // Add empty state


                textInputProps={{
                  placeholder: "Ask a question...",
                  onChangeText: onInputTextChanged,
                }}
                isSendButtonAlwaysVisible={true}
                minInputToolbarHeight={70}
                isTyping={isTyping}
                messagesContainerStyle={{
                  backgroundColor: '#F2F2F7',
                  paddingBottom: 20,
                }}
              />
            </ResponsiveContainer>
          </YStack>
        </YStack>

        {/* History Drawer */}
        <Sheet
          modal={true}
          open={openHistory}
          onOpenChange={setOpenHistory}
          snapPoints={[100]}
          dismissOnSnapToBottom={false}
          zIndex={200000}
        >
          <Sheet.Overlay
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
            backgroundColor="rgba(0,0,0,0.8)"
          />
          <Sheet.Frame
            backgroundColor="#1C1C1E"
            width={SCREEN_WIDTH * 0.75}
            height="100%"
            borderTopLeftRadius={0}
            borderBottomLeftRadius={0}
            borderTopRightRadius={20}
            borderBottomRightRadius={20}
          >
            <YStack padding="$5" gap="$5" flex={1}>
              <XStack alignItems="center" justifyContent="space-between" marginBottom="$2" marginTop="$4">
                <Text fontSize="$7" fontWeight="800" color="white">History</Text>
                <XStack gap="$2">
                  <Button
                    size="$3"
                    circular
                    backgroundColor="$blue10"
                    icon={<Ionicons name="add" size={20} color="white" />}
                    onPress={handleNewChat}
                  />
                  <Button
                    size="$3"
                    circular
                    backgroundColor="#2C2C2E"
                    icon={<Ionicons name="close" size={20} color="white" />}
                    onPress={() => setOpenHistory(false)}
                  />
                </XStack>
              </XStack>

              <RNScrollView showsVerticalScrollIndicator={false}>
                <YStack gap="$2">
                  {chats.map((chat) => (
                    <Card
                      key={chat.id}
                      padding="$3"
                      backgroundColor={currentChatId === chat.id ? '#2C2C2E' : 'transparent'}
                      pressStyle={{ backgroundColor: '#2C2C2E' }}
                      borderRadius="$4"
                      onPress={() => {
                        switchChat(chat.id);
                        setOpenHistory(false);
                      }}
                      borderWidth={currentChatId === chat.id ? 1 : 0}
                      borderColor="$blue10"
                    >
                      <XStack gap="$3" alignItems="center" flex={1}>
                        <Ionicons
                          name="chatbubble-ellipses-outline"
                          size={20}
                          color={currentChatId === chat.id ? '#3B82F6' : '#8E8E93'}
                        />
                        <YStack flex={1}>
                          <Text color="white" fontWeight={currentChatId === chat.id ? "700" : "500"} numberOfLines={1}>
                            {chat.title}
                          </Text>
                          <Text color="#8E8E93" fontSize="$2" marginTop="$1">
                            {new Date(chat.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </Text>
                        </YStack>
                        <Button
                          size="$2"
                          circular
                          chromeless
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDeleteChat(chat.id);
                          }}
                          icon={<Ionicons name="trash-outline" size={18} color="#FF453A" />}
                        />
                      </XStack>
                    </Card>
                  ))}
                </YStack>
              </RNScrollView>
            </YStack>
          </Sheet.Frame>
        </Sheet>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
