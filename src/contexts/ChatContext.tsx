import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useAuth } from './AuthContext';
import type { Chat, ChatMessage } from '../types';
import { apiService } from '../services/api';

interface ChatContextType {
  chats: Chat[];
  activeChat: Chat | null;
  messages: ChatMessage[];
  isLoading: boolean;
  unreadCount: number;
  setActiveChat: (chat: Chat | null) => void;
  sendMessage: (content: string) => Promise<void>;
  sendBroadcast: (content: string) => Promise<void>;
  startChatWithClient: (clientId: string, content: string) => Promise<void>;
  markAsRead: (chatId: string) => Promise<void>;
  loadChats: () => Promise<Chat[]>;
  loadMessages: (chatId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Nessun mock: tutto da database via apiService

  const staffIdRef = useRef<string | null>(null);

  const loadChats = async (): Promise<Chat[]> => {
    setIsLoading(true);
    try {
      const chatsData = await apiService.getChats();
      setChats(chatsData);
      return chatsData;
    } catch (error) {
      console.error('Error loading chats:', error);
      setChats([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (chatId: string) => {
    setIsLoading(true);
    try {
      const messagesData = await apiService.getMessages(chatId);
      setMessages(messagesData);
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const resolveStaffId = async (): Promise<string | null> => {
    if (!user || (user.role !== 'barber' && user.role !== 'admin')) {
      return null;
    }
    if (staffIdRef.current) {
      return staffIdRef.current;
    }

    const staff = await apiService.getStaffByUserId(user.id);
    if (staff?.id) {
      staffIdRef.current = staff.id;
      return staff.id;
    }

    return null;
  };

  const getSenderType = (): 'client' | 'staff' => {
    return user?.role === 'client' ? 'client' : 'staff';
  };

  const sendMessage = async (content: string) => {
    if (!activeChat || !user || !content.trim()) return;
    try {
      await apiService.sendMessage({
        chat_id: activeChat.id,
        content: content.trim(),
        message_type: 'text',
        sender_id: user.id,
        sender_type: getSenderType()
      });
      // Ricarica i messaggi dopo l'invio
      await loadMessages(activeChat.id);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const sendBroadcast = async (_content: string) => {
    throw new Error('Broadcast non implementato lato API');
  };

  const startChatWithClient = async (clientId: string, content: string) => {
    if (!user || !content.trim()) return;
    try {
      const staffId = await resolveStaffId();
      if (!staffId) {
        throw new Error('Impossibile identificare il barbiere associato all\'utente corrente');
      }

      let targetChat = chats.find(
        (chat) => chat.client_id === clientId && chat.staff_id === staffId
      );
      let ensuredChat = targetChat;

      if (!ensuredChat) {
        ensuredChat = await apiService.findChatByParticipants(clientId, staffId) 
          ?? await apiService.createChat({ client_id: clientId, staff_id: staffId });
        const refreshedChats = await loadChats();
        targetChat = refreshedChats.find((chat) => chat.id === ensuredChat?.id) || ensuredChat || null;
      }

      if (!targetChat) {
        throw new Error('Impossibile determinare la chat in cui inviare il messaggio');
      }

      await apiService.sendMessage({
        chat_id: targetChat.id,
        content: content.trim(),
        message_type: 'text',
        sender_id: user.id,
        sender_type: getSenderType()
      });
      await loadMessages(targetChat.id);
      setActiveChat(targetChat);
    } catch (error) {
      console.error('Error starting chat with client:', error);
      throw error;
    }
  };

  const markAsRead = async (chatId: string) => {
    try {
      await apiService.markMessagesAsRead(chatId);
      setChats(prev => prev.map(chat => 
        chat.id === chatId 
          ? { ...chat, unread_count: 0 }
          : chat
      ));
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const unreadCount = chats.reduce((total, chat) => total + chat.unread_count, 0);

  useEffect(() => {
    staffIdRef.current = null;
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      loadChats();
    }
  }, [user]);

  useEffect(() => {
    if (activeChat) {
      loadMessages(activeChat.id);
      markAsRead(activeChat.id);
    }
  }, [activeChat]);

  const value: ChatContextType = {
    chats,
    activeChat,
    messages,
    isLoading,
    unreadCount,
    setActiveChat,
    sendMessage,
    sendBroadcast,
    startChatWithClient,
    markAsRead,
    loadChats,
    loadMessages,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};
