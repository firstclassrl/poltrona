import React from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'medium' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    small: 'max-w-sm',
    medium: 'max-w-xl',
    large: 'max-w-3xl'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-[color-mix(in_srgb,var(--theme-background)_70%,transparent)] backdrop-blur-sm">
      <div className={`w-full ${sizeClasses[size]} surface-card rounded-2xl shadow-2xl overflow-hidden`}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[color-mix(in_srgb,var(--theme-border)_30%,transparent)]">
          <h2 className="text-xl font-semibold text-on-surface">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
};