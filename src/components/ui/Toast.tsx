import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (isVisible) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
        const closeTimer = setTimeout(onClose, 300); // Wait for animation to complete
        return () => clearTimeout(closeTimer);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setShow(false);
    }
  }, [isVisible, onClose]);

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
        return 'bg-green-500/90 text-white border-green-400/50';
      case 'error':
        return 'bg-red-500/90 text-white border-red-400/50';
      case 'info':
        return 'bg-blue-500/90 text-white border-blue-400/50';
      default:
        return 'bg-blue-500/90 text-white border-blue-400/50';
    }
  };

  if (!isVisible && !show) return null;

  return createPortal(
    <div className="fixed top-4 right-4 z-[99999] pointer-events-none">
      <div
        className={cn(
          'flex items-center space-x-3 px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg transition-all duration-300 transform pointer-events-auto',
          getTypeClasses(),
          show ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        )}
      >
        {getIcon()}
        <span className="font-medium">{message}</span>
        <button
          onClick={() => {
            setShow(false);
            setTimeout(onClose, 300);
          }}
          className="ml-2 hover:bg-white/20 rounded-full p-1 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>,
    document.body
  );
};