import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  text: string;
  userId: string;
  createdAt: Date;
  context?: {
    id: string;
    title: string;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  backendSessionId?: string;
}

interface ChatState {
  chats: ChatSession[];
  currentChatId: string | null;
  setChats: (sessions: ChatSession[]) => void;
  setMessages: (chatId: string, messages: ChatMessage[]) => void;
  addMessage: (chatId: string, m: ChatMessage) => void;
  createNewChat: (id?: string, title?: string, backendSessionId?: string) => string;
  updateChat: (id: string, updates: Partial<ChatSession>) => void;
  switchChat: (id: string) => void;
  deleteChat: (id: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  currentChatId: null,
  setChats: (sessions) => set({ chats: sessions }),
  setMessages: (chatId, messages) => set((s) => ({
    chats: s.chats.map(chat =>
      chat.id === chatId ? { ...chat, messages } : chat
    )
  })),
  addMessage: (chatId, m) => set((s) => ({
    chats: s.chats.map(chat =>
      chat.id === chatId
        ? { ...chat, messages: [...chat.messages, m] }
        : chat
    )
  })),
  updateChat: (id, updates) => set((s) => ({
    chats: s.chats.map(chat => chat.id === id ? { ...chat, ...updates } : chat)
  })),
  createNewChat: (id, title, backendSessionId) => {
    const newId = id || Date.now().toString();
    const newChat: ChatSession = {
      id: newId,
      title: title || 'New Chat',
      messages: [],
      createdAt: new Date(),
      backendSessionId,
    };
    set((s) => ({
      chats: [newChat, ...s.chats],
      currentChatId: newId,
    }));
    return newId;
  },
  switchChat: (id) => set({ currentChatId: id }),
  deleteChat: (id) => set((s) => ({
    chats: s.chats.filter(c => c.id !== id),
    currentChatId: s.currentChatId === id ? (s.chats.length > 1 ? s.chats[0].id : null) : s.currentChatId,
  })),
}));
