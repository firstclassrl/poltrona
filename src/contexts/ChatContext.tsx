import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  markAsRead: (chatId: string) => Promise<void>;
  loadChats: () => Promise<void>;
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

  const loadChats = async () => {
    setIsLoading(true);
    try {
      const chatsData = await apiService.getChats();
      setChats(chatsData);
    } catch (error) {
      console.error('Error loading chats:', error);
      setChats([]);
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

  const sendMessage = async (content: string) => {
    if (!activeChat || !user || !content.trim()) return;
    try {
      await apiService.sendMessage({
        chat_id: activeChat.id,
        content: content.trim(),
        message_type: 'text'
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
