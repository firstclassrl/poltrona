import React, { useState, useEffect } from 'react';
import { Calendar, Users, Home, ShoppingBag, User, Building2, LogOut, UserCheck, MessageCircle, Scissors, Bell, ListChecks, Settings } from 'lucide-react';
import { cn } from '../utils/cn';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useChat } from '../contexts/ChatContext';
import { apiService } from '../services/api';
import { APP_VERSION } from '../config/version';
import type { Shop } from '../types';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const { user, logout, hasPermission } = useAuth();
  const { unreadCount: notificationUnreadCount } = useNotifications();
  const { unreadCount: chatUnreadCount } = useChat();
  const [shop, setShop] = useState<Shop | null>(null);
  const [shopLogoUrl, setShopLogoUrl] = useState<string | null>(null);

  // Load shop data to check products_enabled (only when authenticated)
  useEffect(() => {
    if (!user) return; // Skip if not authenticated
    
    const loadShopData = async () => {
      try {
        const shopData = await apiService.getShop();
        setShop(shopData);
      } catch (error) {
        console.error('Error loading shop data:', error);
      }
    };
    loadShopData();
  }, [user]);

  // Load signed logo when shop changes
  useEffect(() => {
    const fetchLogo = async () => {
      if (shop?.logo_path) {
        try {
          const signed = await apiService.getSignedShopLogoUrl(shop.logo_path);
          setShopLogoUrl(signed);
          return;
        } catch (e) {
          console.error('Error loading shop logo:', e);
          // fallback
        }
      }
      if (shop?.logo_url) {
        setShopLogoUrl(shop.logo_url);
      } else {
        setShopLogoUrl(null);
      }
    };
    fetchLogo();
  }, [shop?.logo_path, shop?.logo_url]);

  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, permission: 'dashboard' },
    { id: 'calendar', label: 'Calendario', icon: Calendar, permission: 'appointments' },
    { id: 'clients', label: 'Clienti', icon: Users, permission: 'clients' },
    { id: 'services', label: 'Servizi', icon: Scissors, permission: 'services' },
    { id: 'products', label: 'Prodotti', icon: ShoppingBag, permission: 'products' },
    { id: 'chat', label: 'Chat', icon: MessageCircle, permission: 'chat' },
    { id: 'profile', label: 'Profilo', icon: User, permission: 'profile' },
    { id: 'shop', label: 'Negozio', icon: Building2, permission: 'shop' },
    { id: 'settings', label: 'Opzioni', icon: Settings, permission: 'shop' },
    // { id: 'analytics', label: 'Analisi', icon: BarChart3, permission: 'analytics' }, // Temporaneamente nascosto
    { id: 'client_profile', label: 'Il Mio Profilo', icon: UserCheck, permission: 'client_profile' },
    { id: 'client_bookings', label: 'Le Mie Prenotazioni', icon: ListChecks, permission: 'client_bookings' },
    { id: 'client_booking', label: 'Prenota', icon: Calendar, permission: 'client_booking' },
  ];

  // Check if products are enabled (false = disabled, true/undefined/null = enabled)
  const areProductsEnabled = shop?.products_enabled !== false;

  // Filter nav items based on user permissions and shop settings
  let navItems = allNavItems.filter(item => {
    // Check if products are enabled for the shop
    if (item.id === 'products') {
      // Hide products for all users if the product system is disabled
      if (!areProductsEnabled) {
        return false;
      }
    }
    // Settings (Opzioni) only visible to admin
    if (item.id === 'settings') {
      return user?.role === 'admin';
    }
    return hasPermission(item.permission);
  });

  // Reorder items for client users
  if (user?.role === 'client') {
    // Build client order dynamically based on products enabled status
    const clientOrder = areProductsEnabled 
      ? ['client_booking', 'client_bookings', 'products', 'chat', 'shop', 'client_profile']
      : ['client_booking', 'client_bookings', 'chat', 'shop', 'client_profile'];
    
    navItems = clientOrder
      .map(id => navItems.find(item => item.id === id))
      .filter(Boolean) as typeof navItems;
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 glass-sidebar-dark">
          <div className="flex-1 flex flex-col pt-3 pb-4 overflow-y-auto">
            {/* Logo Section */}
            <div className="flex items-center justify-center flex-shrink-0 px-4 mb-6">
              <img 
                src={shopLogoUrl || '/poltrona-placeholder-logo.png'} 
                alt="Logo negozio" 
                className="w-32 h-32 object-contain filter brightness-110"
              />
            </div>
            
            {/* Separator Line */}
            <div className="mx-4 mb-2 border-t border-white/20"></div>
            
            <nav className="mt-1 flex-1 px-3 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const showChatBadge = item.id === 'chat' && chatUnreadCount > 0;
                // Mostra "Il Mio Barbiere" per i clienti, altrimenti la label originale
                const displayLabel = item.id === 'shop' && user?.role === 'client' 
                  ? 'Il Mio Barbiere' 
                  : item.label;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={cn(
                      'group flex items-center h-11 px-3 text-sm font-medium rounded-lg w-full text-left transition-all duration-150 relative',
                      activeTab === item.id
                        ? item.id === 'settings'
                          ? 'text-yellow-400 border-l-2 border-yellow-400/60 bg-yellow-500/5'
                          : 'bg-yellow-500/15 text-yellow-400 border-l-4 border-yellow-400/50 shadow-md glass-nav-item'
                        : 'text-yellow-300 hover:bg-yellow-500/10 hover:text-yellow-400 hover:border-l-2 hover:border-yellow-400/30 hover:glass-nav-item border-l-2 border-transparent'
                    )}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {displayLabel}
                    {showChatBadge && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center min-w-[20px] h-[20px] px-1.5 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
                        {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            
            {/* Notification Button - Only for staff/admin */}
            {(user?.role === 'admin' || user?.role === 'barber') && (
              <div className="px-3 mt-3 mb-4">
                <button
                  onClick={() => onTabChange('notifications')}
                  className={cn(
                    'w-full flex items-center justify-between h-11 px-3 text-sm font-medium rounded-lg transition-all duration-150 border border-yellow-400/40',
                    activeTab === 'notifications'
                      ? 'bg-yellow-500/15 text-yellow-400 border-l-4 border-yellow-400/50 shadow-md'
                      : 'text-yellow-300 hover:bg-yellow-500/10 hover:text-yellow-400 border-l-2 border-transparent hover:border-yellow-400/30'
                  )}
                >
                  <div className="flex items-center">
                    <Bell className="w-5 h-5 mr-3" />
                    <span>Notifiche</span>
                  </div>
                  {notificationUnreadCount > 0 && (
                    <span className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
                      {notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}
                    </span>
                  )}
                </button>
              </div>
            )}
            
            {/* User Info and Logout */}
            <div className="mt-auto px-4 pb-4">
              <div className="border-t border-yellow-400/30 pt-4">
                <div className="mb-4">
                  <div className="text-center">
                    <p className="text-sm text-yellow-300 font-medium">{user?.full_name}</p>
                    <p className="text-xs text-yellow-400/70 capitalize">{user?.role}</p>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-yellow-300 hover:text-yellow-400 hover:bg-yellow-500/10 rounded-md transition-all duration-200"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </button>
                <div className="text-center mt-3">
                  <p className="text-xs text-yellow-300 font-medium">
                    Poltrona v{APP_VERSION}
                  </p>
                  <p className="text-xs text-yellow-300/70">
                    © 2025{' '}
                    <a
                      href="https://www.abruzzo.ai"
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-yellow-200 underline"
                    >
                      abruzzo.ai
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 glass-sidebar-dark border-t border-yellow-400/30 z-50 shadow-2xl">
        <div className="grid grid-cols-6 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const showChatBadge = item.id === 'chat' && chatUnreadCount > 0;
            // Mostra "Il Mio Barbiere" per i clienti, altrimenti la label originale
            const displayLabel = item.id === 'shop' && user?.role === 'client' 
              ? 'Il Mio Barbiere' 
              : item.label;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  'flex flex-col items-center py-2 px-1 transition-all duration-200 relative',
                  activeTab === item.id 
                    ? item.id === 'settings'
                      ? 'text-yellow-400 border-b-2 border-yellow-400/50'
                      : 'text-yellow-400 border-b-2 border-yellow-400/70'
                    : 'text-yellow-300 hover:text-yellow-400'
                )}
              >
                <div className="relative">
                  <Icon className="h-5 w-5 mb-1" />
                  {showChatBadge && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full animate-pulse">
                      {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium">{displayLabel}</span>
              </button>
            );
          })}
          {/* Mobile Logout Button */}
          <button
            onClick={logout}
            className="flex flex-col items-center py-2 px-1 transition-all duration-200 text-yellow-300 hover:text-red-400"
          >
            <LogOut className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Logout</span>
          </button>
        </div>
        {/* Mobile Version Info */}
        <div className="text-center py-1 border-t border-yellow-400/20">
          <p className="text-xs text-yellow-300/70">
            v{APP_VERSION} | © 2025{' '}
            <a
              href="https://www.abruzzo.ai"
              target="_blank"
              rel="noreferrer"
              className="hover:text-yellow-200 underline"
            >
              abruzzo.ai
            </a>
          </p>
        </div>
      </div>
    </>
  );
};