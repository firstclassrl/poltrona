import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../utils/cn';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MobileNavMenuProps {
  isOpen: boolean;
  onClose: () => void;
  items: NavItem[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout?: () => void;
  showVersion?: boolean;
  version?: string;
}

export const MobileNavMenu: React.FC<MobileNavMenuProps> = ({
  isOpen,
  onClose,
  items,
  activeTab,
  onTabChange,
  onLogout,
  showVersion = true,
  version,
}) => {
  if (!isOpen) return null;

  const handleItemClick = (itemId: string) => {
    onTabChange(itemId);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Bottom Sheet */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50',
          'bg-white/95 backdrop-blur-xl border-t border-gray-200/50',
          'rounded-t-3xl shadow-2xl',
          'animate-in slide-in-from-bottom duration-300',
          'pb-safe-area-inset-bottom'
        )}
        style={{
          paddingBottom: `max(1rem, env(safe-area-inset-bottom, 1rem))`,
        }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4 border-b border-gray-200/50">
          <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors touch-target"
            aria-label="Chiudi menu"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Menu Items */}
        <div className="max-h-[60vh] overflow-y-auto px-4 py-4">
          <div className="space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className={cn(
                    'w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 touch-target',
                    'text-left',
                    isActive
                      ? 'bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={cn(
                    'w-6 h-6 mr-3 flex-shrink-0',
                    isActive ? 'text-[var(--theme-primary)]' : 'text-gray-500'
                  )} />
                  <span className="text-base">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer with Logout and Version */}
        <div className="px-4 py-4 border-t border-gray-200/50 space-y-2">
          {onLogout && (
            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full flex items-center justify-center px-4 py-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-medium transition-colors touch-target"
              aria-label="Logout"
            >
              <span>Logout</span>
            </button>
          )}
          {showVersion && version && (
            <p className="text-center text-xs text-gray-500">
              v{version} | © 2025{' '}
              <a
                href="https://www.abruzzo.ai"
                target="_blank"
                rel="noreferrer"
                className="hover:text-gray-700 underline"
              >
                abruzzo.ai
              </a>
            </p>
          )}
        </div>
      </div>
    </>
  );
};
