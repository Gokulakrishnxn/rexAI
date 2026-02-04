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


export function CoachChatScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { chats, currentChatId, addMessage, createNewChat, switchChat, deleteChat } = useChatStore();
  const { records } = useRecordsStore();
  const [openHistory, setOpenHistory] = useState(false);
  const [inputText, setInputText] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);

  // Get current active chat
  const currentChat = useMemo(() => {
    return chats.find(c => c.id === currentChatId);
  }, [chats, currentChatId]);

  // Create first chat if none exists
  React.useEffect(() => {
    if (chats.length === 0) {
      createNewChat();
    } else if (!currentChatId) {
      switchChat(chats[0].id);
    }
  }, [chats.length, currentChatId]);

  // Convert store messages to GiftedChat format
  const giftedMessages: IMessage[] = useMemo(() => {
    if (!currentChat) return [];
    return [...currentChat.messages].reverse().map((msg) => ({
      _id: msg.id,
      text: msg.text,
      createdAt: msg.createdAt,
      user: {
        _id: msg.userId,
        name: msg.userId === 'user' ? 'You' : 'Rex.ai',
        avatar: msg.userId === 'user' ? undefined : '🦖',
      },
    }));
  }, [currentChat?.messages]);

  const onSend = useCallback((newMessages: IMessage[] = []) => {
    if (newMessages.length > 0 && currentChatId) {
      const msg = newMessages[0];

      // Add user message
      addMessage(currentChatId, {
        id: Date.now().toString(),
        text: msg.text,
        userId: 'user',
        createdAt: new Date(),
      });

      // Simulate AI response
      setTimeout(() => {
        addMessage(currentChatId, {
          id: (Date.now() + 1).toString(),
          text: "I'm Rex, your medical AI. How can I assist you with your records today?",
          userId: 'coach',
          createdAt: new Date(),
        });
      }, 1000);
    }
  }, [addMessage, currentChatId]);


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
                  color: 'white',
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
                textInputProps={{
                  placeholder: "Ask a question...",
                  onChangeText: onInputTextChanged,
                }}
                isSendButtonAlwaysVisible={true}
                minInputToolbarHeight={70}
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
          snapPoints={[85]}
          dismissOnSnapToBottom
          zIndex={200000}
        >
          <Sheet.Overlay
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
            backgroundColor="rgba(0,0,0,0.8)"
          />
          <Sheet.Frame backgroundColor="#1C1C1E" borderTopLeftRadius={20} borderTopRightRadius={20}>
            <Sheet.Handle />
            <YStack padding="$4" gap="$4">
              <Text fontSize="$6" fontWeight="700" color="white" marginBottom="$2">
                Chat History
              </Text>
              <RNScrollView>
                <YStack gap="$2">
                  {chats.map((chat) => (
                    <XStack
                      key={chat.id}
                      padding="$3"
                      borderRadius="$4"
                      backgroundColor={currentChatId === chat.id ? "#2C2C2E" : "transparent"}
                      onPress={() => {
                        switchChat(chat.id);
                        setOpenHistory(false);
                      }}
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <XStack gap="$3" alignItems="center">
                        <Ionicons name="chatbubble-outline" size={20} color="white" />
                        <YStack>
                          <Text color="white" fontWeight="600">
                            {chat.messages[0]?.text?.substring(0, 30) || chat.title}
                          </Text>
                          <Text fontSize="$2" color="#8E8E93">
                            {new Date(chat.createdAt).toLocaleDateString()}
                          </Text>
                        </YStack>
                      </XStack>
                      {currentChatId === chat.id && (
                        <Ionicons name="checkmark" size={20} color="#007AFF" />
                      )}
                    </XStack>
                  ))}
                </YStack>
              </RNScrollView>

              <Button
                marginTop="$4"
                backgroundColor="$blue10"
                onPress={() => {
                  createNewChat();
                  setOpenHistory(false);
                }}
              >
                New Chat
              </Button>
            </YStack>
          </Sheet.Frame>
        </Sheet>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
