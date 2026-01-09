import React, { useState, useEffect } from 'react';
import {
  Bell,
  Calendar,
  X,
  UserPlus,
  Check,
  CheckCheck,
  Trash2,
  AlertCircle,
  RefreshCw,
  Filter,
  Clock,
  MessageCircle,
  RotateCcw,
  ArrowUpCircle
} from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import type { Notification, NotificationType } from '../types';
import { cn } from '../utils/cn';
import { useToast } from '../hooks/useToast';
import { Toast } from './ui/Toast';

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'new_appointment':
      return <Calendar className="w-6 h-6 text-green-500" />;
    case 'appointment_cancelled':
      return <X className="w-6 h-6 text-red-500" />;
    case 'appointment_rescheduled':
      return <RotateCcw className="w-6 h-6 text-orange-500" />;
    case 'appointment_earlier_available':
      return <ArrowUpCircle className="w-6 h-6 text-emerald-500" />;
    case 'new_client':
      return <UserPlus className="w-6 h-6 text-purple-500" />;
    case 'chat_message':
      return <MessageCircle className="w-6 h-6 text-blue-500" />;
    case 'system':
    default:
      return <AlertCircle className="w-6 h-6 text-yellow-500" />;
  }
};

const getNotificationBadgeColor = (type: NotificationType) => {
  switch (type) {
    case 'new_appointment':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'appointment_cancelled':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'appointment_rescheduled':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'appointment_earlier_available':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'new_client':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'chat_message':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'system':
    default:
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  }
};

const getNotificationTypeLabel = (type: NotificationType) => {
  switch (type) {
    case 'new_appointment':
      return 'Nuovo Appuntamento';
    case 'appointment_cancelled':
      return 'Annullamento';
    case 'appointment_rescheduled':
      return 'Appuntamento Spostato';
    case 'appointment_earlier_available':
      return 'Posto Prima Disponibile';
    case 'new_client':
      return 'Nuovo Cliente';
    case 'chat_message':
      return 'Messaggio Chat';
    case 'system':
    default:
      return 'Sistema';
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

  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatFullDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

type FilterType = 'all' | 'unread' | NotificationType;

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
        'p-5 rounded-xl border transition-all duration-200 hover:shadow-md',
        isUnread
          ? 'bg-amber-50 border-amber-200 shadow-sm'
          : 'bg-white border-gray-200 hover:bg-gray-50'
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={cn(
          'flex-shrink-0 p-3 rounded-xl',
          isUnread ? 'bg-white shadow-sm' : 'bg-gray-100'
        )}>
          {getNotificationIcon(notification.type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className={cn(
              'text-xs font-medium px-2.5 py-1 rounded-full border',
              getNotificationBadgeColor(notification.type)
            )}>
              {getNotificationTypeLabel(notification.type)}
            </span>
            {isUnread && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                Non letta
              </span>
            )}
          </div>

          <h3 className={cn(
            'text-lg mb-1',
            isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
          )}>
            {notification.title}
          </h3>

          <p className="text-gray-600 mb-3 leading-relaxed">
            {notification.type === 'chat_message' && notification.data?.sender_name
              ? `${notification.data.sender_name}: ${notification.message}`
              : notification.message}
          </p>

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            <span title={formatFullDate(notification.created_at)}>
              {formatTimeAgo(notification.created_at)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex flex-col gap-2">
          {isUnread && (
            <button
              onClick={() => onMarkAsRead(notification.id)}
              className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Segna come letta"
            >
              <Check className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => onDelete(notification.id)}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Elimina"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const Notifications: React.FC = () => {
  const {
    notifications,
    unreadCount,
    isLoading,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications
  } = useNotifications();

  const { toast, showToast, hideToast } = useToast();
  const [filter, setFilter] = useState<FilterType>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  // Load notifications on mount
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadNotifications();
    setTimeout(() => setIsRefreshing(false), 500);
  };

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
  const handleDeleteAll = async () => {
    try {
      await deleteAllNotifications();
      // Ricarica le notifiche per sincronizzare con il backend
      await loadNotifications();
      setShowDeleteAllConfirm(false);
      showToast('Tutte le notifiche sono state eliminate', 'success');
    } catch (error) {
      console.error('Failed to delete all:', error);
      showToast('Errore durante l\'eliminazione delle notifiche. Riprova più tardi.', 'error');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.read_at;
    return n.type === filter;
  });

  const filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'Tutte' },
    { value: 'unread', label: 'Non lette' },
    { value: 'new_appointment', label: 'Nuovi Appuntamenti' },
    { value: 'appointment_rescheduled', label: 'Appuntamenti spostati' },
    { value: 'appointment_cancelled', label: 'Annullamenti' },
    { value: 'system', label: 'Sistema' },
  ];

  return (
    <div className="p-0 page-container-chat-style">
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 rounded-xl">
                <Bell className="w-8 h-8 text-amber-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Notifiche</h1>
                <p className="text-gray-500">
                  {unreadCount > 0
                    ? `${unreadCount} notifiche non lette`
                    : 'Tutte le notifiche sono state lette'
                  }
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={cn(
                  'p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all',
                  isRefreshing && 'animate-spin'
                )}
                title="Aggiorna"
              >
                <RefreshCw className="w-5 h-5" />
              </button>

              {notifications.length > 0 && (
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-xl transition-colors"
                    >
                      <CheckCheck className="w-4 h-4" />
                      Segna tutte come lette
                    </button>
                  )}
                  <button
                    onClick={() => setShowDeleteAllConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 bg-red-100 hover:bg-red-200 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Elimina tutte
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Delete all confirmation */}
          {showDeleteAllConfirm && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-red-700">
                <p className="font-semibold">Eliminare tutte le notifiche?</p>
                <p>Questa azione non può essere annullata.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteAllConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  onClick={handleDeleteAll}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700"
                >
                  Elimina tutto
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-600">Filtra per:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {filterOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-xl transition-all',
                  filter === option.value
                    ? 'bg-gray-900 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {option.label}
                {option.value === 'unread' && unreadCount > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-amber-500 text-white rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin mb-4" />
              <p className="text-gray-500">Caricamento notifiche...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
              <div className="p-4 bg-gray-100 rounded-full mb-4">
                <Bell className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-700 mb-1">
                {filter === 'all' ? 'Nessuna notifica' : 'Nessuna notifica trovata'}
              </h3>
              <p className="text-gray-500 text-center max-w-md">
                {filter === 'all'
                  ? 'Le notifiche su appuntamenti, nuovi clienti e promemoria appariranno qui.'
                  : 'Non ci sono notifiche che corrispondono al filtro selezionato.'
                }
              </p>
              {filter !== 'all' && (
                <button
                  onClick={() => setFilter('all')}
                  className="mt-4 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-xl transition-colors"
                >
                  Mostra tutte le notifiche
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Group by date */}
              {filteredNotifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                  onDelete={handleDelete}
                />
              ))}
            </>
          )}
        </div>

        {/* Stats Footer */}
        {notifications.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-center gap-8 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-700">{notifications.length}</span>
                totali
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-amber-600">{unreadCount}</span>
                non lette
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-green-600">{notifications.length - unreadCount}</span>
                lette
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={toast.isVisible}
          onClose={hideToast}
        />
      </div>
    </div>
  );
};

