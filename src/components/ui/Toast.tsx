import React, { useEffect, useState, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  isVisible: boolean;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, isVisible, onClose }) => {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Ensure we're mounted before trying to portal
  useLayoutEffect(() => {
    setMounted(true);
    return () => {
      setMounted(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    // Clear any existing timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);

    if (isVisible) {
      console.log('[Toast] Showing toast:', message, type);
      // Show immediately
      setShow(true);

      // Auto-hide after 4 seconds
      timerRef.current = setTimeout(() => {
        console.log('[Toast] Auto-hiding toast');
        setShow(false);
        closeTimerRef.current = setTimeout(onClose, 300);
      }, 4000);
    } else {
      setShow(false);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [isVisible, message, type]); // Removed onClose from deps to prevent re-triggering

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5" />;
      case 'error':
        return <XCircle className="w-5 h-5" />;
      case 'info':
        return <Info className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getTypeClasses = () => {
    switch (type) {
      case 'success':
        return 'bg-green-600 text-white border-green-500 shadow-green-500/30';
      case 'error':
        return 'bg-red-600 text-white border-red-500 shadow-red-500/30';
      case 'info':
        return 'bg-blue-600 text-white border-blue-500 shadow-blue-500/30';
      default:
        return 'bg-blue-600 text-white border-blue-500 shadow-blue-500/30';
    }
  };

  // Don't render if nothing to show
  if (!isVisible && !show) return null;

  // Don't render until mounted
  if (!mounted) return null;

  const toastContent = (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 pointer-events-none"
      style={{ zIndex: 999999 }}
    >
      <div
        className={cn(
          'flex items-center space-x-3 px-5 py-4 rounded-xl border-2 shadow-2xl transition-all duration-300 transform pointer-events-auto min-w-[280px]',
          getTypeClasses(),
          show
            ? 'translate-y-0 opacity-100 scale-100'
            : '-translate-y-4 opacity-0 scale-95'
        )}
        style={{
          boxShadow: '0 20px 50px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)'
        }}
      >
        {getIcon()}
        <span className="font-semibold text-base">{message}</span>
        <button
          onClick={() => {
            console.log('[Toast] Manual close');
            setShow(false);
            setTimeout(onClose, 300);
          }}
          className="ml-2 hover:bg-white/30 rounded-full p-1.5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return createPortal(toastContent, document.body);
};