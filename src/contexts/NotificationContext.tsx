import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { Notification } from '../types';
import { apiService } from '../services/api';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  loadNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Polling interval in milliseconds (15 seconds for faster notifications)
const POLLING_INTERVAL = 15000;

const isOwnChatNotification = (notification: Notification, role?: string) => {
  if (notification.type !== 'chat_message') return false;
  const senderType = (notification.data as any)?.sender_type;
  if (!senderType) return false;
  if (role === 'client' && senderType === 'client') return true;
  if ((role === 'barber' || role === 'admin') && senderType === 'staff') return true;
  return false;
};

const filterNotificationsForUser = (notifications: Notification[], role?: string) => {
  return notifications.filter((n) => !isOwnChatNotification(n, role));
};

// Play notification sound using Web Audio API
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Play two beeps for notification
    oscillator.frequency.value = 880; // A5 note
    oscillator.type = 'sine';
    
    const now = audioContext.currentTime;
    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    gainNode.gain.setValueAtTime(0.3, now + 0.2);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    
    oscillator.start(now);
    oscillator.stop(now + 0.4);
  } catch {
    // Audio not available - silently fail
  }
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const previousUnreadCount = useRef(0);
  const isInitialLoad = useRef(true);

  // Load notifications from API
  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const data = await apiService.getNotifications(user.id);
      const filtered = filterNotificationsForUser(data, user.role);
      setNotifications(filtered);
      // Update unread count from loaded data
      const unread = filtered.filter(n => !n.read_at).length;
      
      // Play sound if new notifications arrived (not on initial load)
      // Clients: no in-app bell UX; prefer push/email + badge in "Le Mie Prenotazioni"
      if (!isInitialLoad.current && unread > previousUnreadCount.current && user?.role !== 'client') {
        playNotificationSound();
        console.log('🔔 Nuova notifica ricevuta!');
      }
      
      previousUnreadCount.current = unread;
      isInitialLoad.current = false;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Refresh only unread count (lightweight polling)
  const refreshUnreadCount = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      // Ricarica le notifiche per applicare il filtro lato client (evita falsi positivi quando il mittente è l'utente stesso)
      const data = await apiService.getNotifications(user.id);
      const filtered = filterNotificationsForUser(data, user.role);
      const count = filtered.filter(n => !n.read_at).length;
      
      // Play sound if new notifications arrived (no sound for clients)
      if (count > previousUnreadCount.current && user?.role !== 'client') {
        playNotificationSound();
        console.log('🔔 Nuova notifica ricevuta! Totale non lette:', count);
        setNotifications(filtered);
      } else {
        setNotifications(filtered);
      }
      
      previousUnreadCount.current = count;
      setUnreadCount(count);
    } catch (error) {
      console.error('Error refreshing unread count:', error);
    }
  }, [user?.id]);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await apiService.markNotificationAsRead(notificationId);
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, read_at: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      await apiService.markAllNotificationsAsRead(user.id);
      setNotifications(prev => 
        prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
      throw error;
    }
  }, [user?.id]);

  // Delete a notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user?.id) {
      console.error('❌ Utente non autenticato, impossibile eliminare notifica');
      throw new Error('Utente non autenticato');
    }
    
    try {
      const notification = notifications.find(n => n.id === notificationId);
      
      // Verifica che la notifica appartenga all'utente corrente
      if (notification && notification.user_id !== user.id) {
        console.error('❌ Notifica non appartiene all\'utente corrente:', {
          notificationUserId: notification.user_id,
          currentUserId: user.id
        });
        throw new Error('Non autorizzato a eliminare questa notifica');
      }
      
      await apiService.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      // Update unread count if the deleted notification was unread
      if (notification && !notification.read_at) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }, [notifications, user?.id]);

  // Initial load when user authenticates
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadNotifications();
    } else {
      // Clear notifications on logout
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [isAuthenticated, user?.id, loadNotifications]);

  // Polling for unread count
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const intervalId = setInterval(() => {
      refreshUnreadCount();
    }, POLLING_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, user?.id, refreshUnreadCount]);

  const deleteAllNotifications = useCallback(async () => {
    if (!user?.id) {
      console.error('❌ Utente non autenticato, impossibile eliminare tutte le notifiche');
      throw new Error('Utente non autenticato');
    }
    
    try {
      const currentCount = notifications.length;
      console.log('🗑️ Eliminazione di tutte le notifiche per user:', user.id);
      console.log('📊 Notifiche prima dell\'eliminazione:', currentCount);
      await apiService.deleteAllNotifications(user.id);
      setNotifications([]);
      setUnreadCount(0);
      console.log('✅ Tutte le notifiche eliminate per user:', user.id);
      console.log('📊 Notifiche dopo l\'eliminazione:', 0);
    } catch (error) {
      console.error('❌ Error deleting all notifications:', error);
      throw error;
    }
  }, [user?.id, notifications]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    isLoading,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshUnreadCount,
    deleteAllNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
