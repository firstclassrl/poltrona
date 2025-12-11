import React, { useEffect, useState } from 'react';
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
        setTimeout(onClose, 300); // Wait for animation to complete
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
        return 'bg-[color-mix(in_srgb,var(--theme-success)_85%,transparent)] text-white border-[color-mix(in_srgb,var(--theme-success)_60%,transparent)]';
      case 'error':
        return 'bg-[color-mix(in_srgb,var(--theme-danger)_85%,transparent)] text-white border-[color-mix(in_srgb,var(--theme-danger)_60%,transparent)]';
      case 'info':
        return 'bg-[color-mix(in_srgb,var(--theme-accent)_80%,transparent)] text-[var(--theme-accent-contrast)] border-[color-mix(in_srgb,var(--theme-accent)_60%,transparent)]';
      default:
        return 'bg-[color-mix(in_srgb,var(--theme-accent)_80%,transparent)] text-[var(--theme-accent-contrast)] border-[color-mix(in_srgb,var(--theme-accent)_60%,transparent)]';
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      <div
        className={cn(
          'flex items-center space-x-3 px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg transition-all duration-300 transform',
          getTypeClasses(),
          show ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        )}
      >
        {getIcon()}
        <span className="font-medium">{message}</span>
        <button
          onClick={onClose}
          className="ml-2 hover:bg-white/20 rounded-full p-1 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};