import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  text: string;
  userId: string;
  createdAt: Date;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
}

interface ChatState {
  chats: ChatSession[];
  currentChatId: string | null;
  setChats: (sessions: ChatSession[]) => void;
  addMessage: (chatId: string, m: ChatMessage) => void;
  createNewChat: () => string;
  switchChat: (id: string) => void;
  deleteChat: (id: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  currentChatId: null,
  setChats: (sessions) => set({ chats: sessions }),
  addMessage: (chatId, m) => set((s) => ({
    chats: s.chats.map(chat =>
      chat.id === chatId
        ? { ...chat, messages: [...chat.messages, m] }
        : chat
    )
  })),
  createNewChat: () => {
    const id = Date.now().toString();
    const newChat: ChatSession = {
      id,
      title: 'New Chat',
      messages: [],
      createdAt: new Date(),
    };
    set((s) => ({
      chats: [newChat, ...s.chats],
      currentChatId: id,
    }));
    return id;
  },
  switchChat: (id) => set({ currentChatId: id }),
  deleteChat: (id) => set((s) => ({
    chats: s.chats.filter(c => c.id !== id),
    currentChatId: s.currentChatId === id ? (s.chats.length > 1 ? s.chats[0].id : null) : s.currentChatId,
  })),
}));
