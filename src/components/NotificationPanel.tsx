import React from 'react';
import { X, Check, CheckCheck, Trash2, Calendar, AlertCircle, Bell } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import type { Notification, NotificationType } from '../types';
import { cn } from '../utils/cn';

interface NotificationPanelProps {
  onClose: () => void;
}

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'new_appointment':
      return <Calendar className="w-5 h-5 text-green-400" />;
    case 'appointment_cancelled':
      return <X className="w-5 h-5 text-red-400" />;
    case 'appointment_reminder':
      return <Bell className="w-5 h-5 text-blue-400" />;
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
}

const NotificationItem: React.FC<NotificationItemProps> = ({ 
  notification, 
  onMarkAsRead, 
  onDelete 
}) => {
  const isUnread = !notification.read_at;

  return (
    <div 
      className={cn(
        'p-3 border-b border-yellow-400/20 transition-colors duration-200',
        isUnread ? 'bg-yellow-500/10' : 'bg-transparent',
        'hover:bg-yellow-500/5'
      )}
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
            {notification.message}
          </p>
          <p className="text-xs text-yellow-300/50 mt-1">
            {formatTimeAgo(notification.created_at)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-1">
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

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ onClose }) => {
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
    <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 max-h-[70vh] bg-slate-900/95 backdrop-blur-xl border border-yellow-400/30 rounded-xl shadow-2xl overflow-hidden z-50">
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

