import React, { useState, useCallback, useMemo } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GiftedChat, IMessage, InputToolbar, Bubble, Send, Composer } from 'react-native-gifted-chat';
import { useNavigation } from '@react-navigation/native';
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
import { sendChatMessage, createSession, fetchSessions, fetchSessionMessages } from '@/services/api/backendApi';
import { useAuthStore } from '../../store/useAuthStore';
import { ActivityIndicator, Dimensions } from 'react-native';
import { HealthScoreGraph } from '@/components/chat/HealthScoreGraph';

const { width: SCREEN_WIDTH } = Dimensions.get('window');


export function CoachChatScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { chats, currentChatId, addMessage, createNewChat, switchChat, deleteChat } = useChatStore();
  const { records } = useRecordsStore();
  const [openHistory, setOpenHistory] = useState(false);
  const [inputText, setInputText] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const { user: profile } = useAuthStore();
  const { updateChat } = useChatStore();
  const USER_ID = profile?.id;

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
          // If no sessions, create one
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


  const onSend = useCallback(async (newMessages: IMessage[] = []) => {
    if (newMessages.length > 0 && currentChatId && currentChat) {
      const msg = newMessages[0];

      // Add user message locally
      addMessage(currentChatId, {
        id: Date.now().toString(),
        text: msg.text,
        userId: 'user',
        createdAt: new Date(),
      });

      setIsTyping(true);

      try {
        let backendSessionId = currentChat.backendSessionId;

        // Create backend session if it doesn't exist
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
          sessionId: backendSessionId
        });

        if (chatResponse.success) {
          addMessage(currentChatId, {
            id: Date.now().toString(),
            text: chatResponse.answer,
            userId: 'coach',
            createdAt: new Date(),
          });
        } else {
          addMessage(currentChatId, {
            id: Date.now().toString(),
            text: "Sorry, I encountered an error: " + (chatResponse.error || "Unknown error"),
            userId: 'coach',
            createdAt: new Date(),
          });
        }
      } catch (error: any) {
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
  }, [addMessage, currentChatId, currentChat, USER_ID, updateChat]);


  const renderBubble = (props: any) => {
    return (
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
            backgroundColor: '#1C1C1E',
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
            color: '#FFFFFF',
            fontSize: 15,
          },
        }}
      />
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

  const insertMention = (recordTitle: string) => {
    const words = inputText.split(' ');
    words.pop(); // Remove the '@query'
    const newText = [...words, `@${recordTitle} `].join(' ');
    setInputText(newText);
    setShowMentions(false);
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => r.title.toLowerCase().includes(mentionQuery));
  }, [records, mentionQuery]);

  const renderInputToolbar = (props: any) => {
    return (
      <YStack>
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
                    onPress={() => insertMention(record.title)}
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
            backgroundColor: '#000000',
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
          <YStack padding="$2" width={SCREEN_WIDTH * 0.9} alignSelf="center">
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
          avatar: msg.userId === 'user' ? undefined : '🦖',
        },
      };
    });
  }, [currentChat?.messages]);

  // Custom MessageText component to hide JSON
  const renderMessageText = (props: any) => {
    const { currentMessage } = props;
    const cleanText = formatMessageText(currentMessage.text);
    if (!cleanText) return null; // If text was only JSON

    // Use default MessageText but with cleaned text
    const { MessageText } = require('react-native-gifted-chat');
    return <MessageText {...props} currentMessage={{ ...currentMessage, text: cleanText }} />;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <YStack flex={1} backgroundColor="#000000">
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
              icon={<Ionicons name="menu" size={24} color="white" />}
            />
            <Text fontSize="$5" fontWeight="600" color="white">
              {currentChat?.title === 'New Chat' ? 'Rex.ai' : currentChat?.title}
            </Text>
            <Button
              size="$3"
              circular
              chromeless
              onPress={() => createNewChat()}
              icon={<Ionicons name="create-outline" size={24} color="white" />}
            />
          </XStack>

          <Separator borderColor="#1C1C1E" />

          {/* Chat Area */}
          <YStack flex={1} position="relative">
            <ResponsiveContainer>
              {(!currentChat || currentChat.messages.length === 0) && (
                <YStack
                  position="absolute"
                  top={0}
                  left={0}
                  right={0}
                  bottom={0}
                  alignItems="center"
                  justifyContent="center"
                  zIndex={0}
                  gap="$4"
                  padding="$6"
                >
                  <Text fontSize="$9" fontWeight="800" color="white" textAlign="center">
                    Start a conversation
                  </Text>
                  <Text fontSize="$4" color="#8E8E93" textAlign="center">
                    Ask me anything, and I'll do my best to help.
                  </Text>
                </YStack>
              )}

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
                textInputProps={{
                  placeholder: "Ask a question...",
                  onChangeText: onInputTextChanged,
                }}
                isSendButtonAlwaysVisible={true}
                minInputToolbarHeight={70}
                isTyping={isTyping}
                messagesContainerStyle={{
                  backgroundColor: '#000000',
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
                      <XStack gap="$3" alignItems="center">
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
