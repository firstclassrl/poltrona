import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { NotificationPanel } from './NotificationPanel';
import { cn } from '../utils/cn';

export const NotificationBell: React.FC = () => {
  const { unreadCount, loadNotifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Calculate panel position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPanelPosition({
        top: rect.bottom + 8, // 8px below the button
        left: rect.left, // Align with button left
      });
    }
  }, [isOpen]);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current && 
        !buttonRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) {
      // Refresh notifications when opening
      loadNotifications();
    }
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={cn(
          'relative p-2 rounded-lg transition-all duration-200',
          'text-yellow-300 hover:text-yellow-400 hover:bg-yellow-500/10',
          isOpen && 'bg-yellow-500/20 text-yellow-400'
        )}
        aria-label={`Notifiche${unreadCount > 0 ? ` (${unreadCount} non lette)` : ''}`}
      >
        <Bell className="w-5 h-5" />
        
        {/* Badge with unread count */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel - rendered via Portal to avoid sidebar overflow clipping */}
      {isOpen && createPortal(
        <div 
          ref={panelRef}
          style={{ 
            position: 'fixed', 
            top: panelPosition.top, 
            left: panelPosition.left,
            zIndex: 9999 
          }}
        >
          <NotificationPanel onClose={() => setIsOpen(false)} />
        </div>,
        document.body
      )}
    </>
  );
};
