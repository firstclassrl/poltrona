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
  deleteChat: (chatId: string) => Promise<void>;
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
  const { user, isAuthenticated } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Nessun mock: tutto da database via apiService

  const staffIdRef = useRef<string | null>(null);

  const initialLoadDone = useRef(false);

  const loadChats = async (options?: { silent?: boolean }): Promise<Chat[]> => {
    const silent = options?.silent;
    // Non caricare chat se l'utente non è autenticato
    if (!isAuthenticated || !user) {
      setChats([]);
      return [];
    }

    if (!silent && !initialLoadDone.current) {
      setIsLoading(true);
    }
    try {
      let chatsData = await apiService.getChats();
      
      // Filtra le chat per i clienti: mostrano solo le proprie chat
      if (user?.role === 'client') {
        // Ottieni il client_id dell'utente corrente
        const clientId = await getClientIdForUser();
        if (clientId) {
          chatsData = chatsData
            .filter(chat => chat.client_id === clientId)
            .map(chat => {
              const lastMsg = chat.last_message;
              const unreadFromStaff = lastMsg && lastMsg.sender_type === 'staff' && !lastMsg.read_at;
              const computedUnread = chat.unread_count ?? 0;
              return { ...chat, unread_count: Math.max(computedUnread, unreadFromStaff ? 1 : 0) };
            });
        } else {
          // Se non riesci a trovare il client_id, non mostrare nessuna chat
          chatsData = [];
        }
      }
      
      setChats(chatsData);
      return chatsData;
    } catch (error) {
      console.error('Error loading chats:', error);
      setChats([]);
      return [];
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
      initialLoadDone.current = true;
    }
  };

  const getClientIdForUser = async (): Promise<string | null> => {
    // Non tentare di ottenere il client_id se non autenticato
    if (!isAuthenticated || !user || user.role !== 'client') return null;
    
    try {
      // Usa la funzione esistente per ottenere o creare il cliente
      const client = await apiService.getOrCreateClientFromUser({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone
      });
      return client?.id || null;
    } catch (error) {
      console.error('Error getting client ID for user:', error);
      return null;
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

  const getSenderIdentity = async (chat: Chat | null): Promise<{ senderId: string; senderType: 'staff' | 'client' } | null> => {
    if (!chat || !user) return null;
    if (user.role === 'barber' || user.role === 'admin') {
      const staffId = chat.staff_id || await resolveStaffId();
      if (!staffId) return null;
      return { senderId: staffId, senderType: 'staff' };
    }

    if (chat.client_id) {
      return { senderId: chat.client_id, senderType: 'client' };
    }

    return null;
  };

  const sendMessage = async (content: string) => {
    if (!activeChat || !user || !content.trim()) return;
    try {
      const sender = await getSenderIdentity(activeChat);
      if (!sender) {
        throw new Error('Impossibile determinare il mittente per questa chat');
      }

      await apiService.sendMessage({
        chat_id: activeChat.id,
        content: content.trim(),
        message_type: 'text',
        sender_id: sender.senderId,
        sender_type: sender.senderType
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

      const sender = await getSenderIdentity(targetChat);
      if (!sender) {
        throw new Error('Impossibile determinare il mittente per questa chat');
      }

      await apiService.sendMessage({
        chat_id: targetChat.id,
        content: content.trim(),
        message_type: 'text',
        sender_id: sender.senderId,
        sender_type: sender.senderType
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

  const deleteChat = async (chatId: string) => {
    try {
      await apiService.deleteChat(chatId);
      setChats(prev => prev.filter(chat => chat.id !== chatId));
      if (activeChat?.id === chatId) {
        setActiveChat(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      throw error;
    }
  };

  const unreadCount = chats.reduce((total, chat) => total + chat.unread_count, 0);
  const prevUnreadCountRef = useRef<number>(0);

  // Funzione per suonare la campanella
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioContext.currentTime;
      
      // Crea un suono di campanella più realistico con più toni
      const frequencies = [523.25, 659.25, 783.99]; // Do, Mi, Sol
      
      frequencies.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, now);
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15 + index * 0.05);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start(now + index * 0.05);
        oscillator.stop(now + 0.2 + index * 0.05);
      });
    } catch (error) {
      console.warn('Impossibile riprodurre il suono di notifica:', error);
    }
  };

  useEffect(() => {
    staffIdRef.current = null;
  }, [user?.id]);

  useEffect(() => {
    // Ferma il polling se l'utente non è autenticato
    if (!isAuthenticated || !user) {
      setChats([]);
      return;
    }

    loadChats();

    // Polling leggero ogni 12s senza toccare lo stato di loading
    const interval = setInterval(() => {
      if (isAuthenticated && user) {
        loadChats({ silent: true });
      }
    }, 12000);

    // Aggiorna quando la finestra torna in focus (senza flicker)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadChats({ silent: true });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user, isAuthenticated]);

  useEffect(() => {
    if (activeChat) {
      loadMessages(activeChat.id);
      markAsRead(activeChat.id);
    }
  }, [activeChat]);

  // Rileva nuovi messaggi e suona la campanella
  useEffect(() => {
    if (unreadCount > prevUnreadCountRef.current && prevUnreadCountRef.current > 0) {
      // C'è un nuovo messaggio non letto
      playNotificationSound();
    }
    prevUnreadCountRef.current = unreadCount;
  }, [unreadCount]);

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
    deleteChat,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};
