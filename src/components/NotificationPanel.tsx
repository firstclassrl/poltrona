import React from 'react';
import { X, Check, CheckCheck, Trash2, Calendar, AlertCircle, Bell, Clock, MessageCircle, ArrowRight, Users, ArrowUpCircle } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import type { Notification, NotificationType } from '../types';
import { cn } from '../utils/cn';

interface NotificationPanelProps {
  onClose: () => void;
  onNavigateToBooking?: (params?: { date?: string; serviceId?: string; staffId?: string }) => void;
  onOpenEarlierSlotOffer?: (params: { waitlistId: string; appointmentId: string; earlierStartAt: string; earlierEndAt: string }) => void;
}

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'new_appointment':
      return <Calendar className="w-5 h-5 text-green-400" />;
    case 'appointment_cancelled':
      return <X className="w-5 h-5 text-red-400" />;
    case 'appointment_reminder':
      return <Bell className="w-5 h-5 text-blue-400" />;
    case 'waitlist_available':
      return <Clock className="w-5 h-5 text-amber-400" />;
    case 'waitlist_summary':
      return <Users className="w-5 h-5 text-purple-400" />;
    case 'appointment_earlier_available':
      return <ArrowUpCircle className="w-5 h-5 text-emerald-400" />;
    case 'chat_message':
      return <MessageCircle className="w-5 h-5 text-blue-400" />;
    case 'system':
    default:
      return <AlertCircle className="w-5 h-5 text-yellow-400" />;
  }
};

const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Adesso';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min fa`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ore fa`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} giorni fa`;
  
  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
};

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigateToBooking?: (params?: { date?: string; serviceId?: string; staffId?: string }) => void;
  onOpenEarlierSlotOffer?: (params: { waitlistId: string; appointmentId: string; earlierStartAt: string; earlierEndAt: string }) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ 
  notification, 
  onMarkAsRead, 
  onDelete,
  onNavigateToBooking,
  onOpenEarlierSlotOffer
}) => {
  const isUnread = !notification.read_at;
  const isWaitlistAvailable = notification.type === 'waitlist_available';
  const isEarlierOffer = notification.type === 'appointment_earlier_available';
  
  const handleClick = () => {
    if (isWaitlistAvailable && onNavigateToBooking) {
      const data = notification.data as any;
      // Salva parametri in localStorage per ClientBookingCalendar
      try {
        localStorage.setItem('bookingParams', JSON.stringify({
          date: data?.available_date,
          serviceId: data?.service_id,
          staffId: data?.staff_id,
        }));
      } catch (e) {
        console.error('Error saving booking params:', e);
      }
      onNavigateToBooking({
        date: data?.available_date,
        serviceId: data?.service_id,
        staffId: data?.staff_id,
      });
    }

    if (isEarlierOffer && onOpenEarlierSlotOffer) {
      const data = notification.data as any;
      if (data?.waitlist_id && data?.appointment_id && data?.earlier_start_at && data?.earlier_end_at) {
        onOpenEarlierSlotOffer({
          waitlistId: String(data.waitlist_id),
          appointmentId: String(data.appointment_id),
          earlierStartAt: String(data.earlier_start_at),
          earlierEndAt: String(data.earlier_end_at),
        });
      }
    }
  };

  const formatWaitlistDetails = () => {
    if (!isWaitlistAvailable) return null;
    const data = notification.data as any;
    const parts: string[] = [];
    
    if (data?.available_date) {
      const date = new Date(data.available_date);
      parts.push(date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }));
    }
    
    if (data?.available_time) {
      parts.push(`alle ${data.available_time}`);
    }
    
    if (data?.service_name) {
      parts.push(`per ${data.service_name}`);
    }
    
    if (data?.staff_name) {
      parts.push(`con ${data.staff_name}`);
    }
    
    return parts.length > 0 ? parts.join(' ') : null;
  };

  const formatEarlierOfferDetails = () => {
    if (!isEarlierOffer) return null;
    const data = notification.data as any;
    if (!data?.earlier_start_at) return null;
    const start = new Date(data.earlier_start_at);
    const date = start.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    const time = start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${date} alle ${time}`;
  };

  return (
    <div 
      className={cn(
        'p-3 border-b border-yellow-400/20 transition-colors duration-200',
        isUnread ? 'bg-yellow-500/10' : 'bg-transparent',
        (isWaitlistAvailable || isEarlierOffer) ? 'hover:bg-yellow-500/10 cursor-pointer' : 'hover:bg-yellow-500/5'
      )}
      onClick={(isWaitlistAvailable || isEarlierOffer) ? handleClick : undefined}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {getNotificationIcon(notification.type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={cn(
              'text-sm truncate',
              isUnread ? 'font-semibold text-yellow-300' : 'font-medium text-yellow-300/80'
            )}>
              {notification.title}
            </h4>
            {isUnread && (
              <span className="flex-shrink-0 w-2 h-2 bg-yellow-400 rounded-full" />
            )}
          </div>
          <p className="text-xs text-yellow-300/70 mt-0.5 line-clamp-2">
            {notification.type === 'chat_message' && notification.data?.sender_name 
              ? `${notification.data.sender_name}: ${notification.message}`
              : notification.message}
          </p>
          {isWaitlistAvailable && formatWaitlistDetails() && (
            <p className="text-xs text-amber-400/80 mt-1 font-medium">
              {formatWaitlistDetails()}
            </p>
          )}
          {isEarlierOffer && formatEarlierOfferDetails() && (
            <p className="text-xs text-emerald-400/80 mt-1 font-medium">
              Slot disponibile: {formatEarlierOfferDetails()}
            </p>
          )}
          {isWaitlistAvailable && (
            <div className="flex items-center gap-1 mt-2 text-xs text-amber-400/70">
              <span>Clicca per prenotare</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          )}
          {isEarlierOffer && (
            <div className="flex items-center gap-1 mt-2 text-xs text-emerald-400/70">
              <span>Clicca per anticipare</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          )}
          <p className="text-xs text-yellow-300/50 mt-1">
            {formatTimeAgo(notification.created_at)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {isUnread && (
            <button
              onClick={() => onMarkAsRead(notification.id)}
              className="p-1.5 text-yellow-300/60 hover:text-green-400 hover:bg-green-500/10 rounded transition-colors"
              title="Segna come letta"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onDelete(notification.id)}
            className="p-1.5 text-yellow-300/60 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
            title="Elimina"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ onClose, onNavigateToBooking, onOpenEarlierSlotOffer }) => {
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification 
  } = useNotifications();

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  return (
    <div className="w-80 sm:w-96 max-h-[70vh] bg-slate-900/95 backdrop-blur-xl border border-yellow-400/30 rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-yellow-400/30 bg-slate-800/50">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-yellow-400" />
          <h3 className="font-semibold text-yellow-300">Notifiche</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-yellow-500/20 text-yellow-400 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="p-1.5 text-yellow-300/60 hover:text-yellow-400 hover:bg-yellow-500/10 rounded transition-colors"
              title="Segna tutte come lette"
            >
              <CheckCheck className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-yellow-300/60 hover:text-yellow-400 hover:bg-yellow-500/10 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto max-h-[calc(70vh-60px)]">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Bell className="w-12 h-12 text-yellow-400/30 mb-3" />
            <p className="text-yellow-300/70 text-sm">Nessuna notifica</p>
            <p className="text-yellow-300/50 text-xs mt-1">
              Le notifiche appariranno qui
            </p>
          </div>
        ) : (
          <div>
            {notifications.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={handleMarkAsRead}
                onDelete={handleDelete}
                onNavigateToBooking={onNavigateToBooking}
                onOpenEarlierSlotOffer={(params) => {
                  onClose();
                  onOpenEarlierSlotOffer?.(params);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

