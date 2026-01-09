import React, { useState, useEffect } from 'react';
import { Calendar, Users, Home, ShoppingBag, User, Building2, LogOut, UserCheck, MessageCircle, Scissors, Bell, ListChecks, Settings, Clock, MoreVertical, CreditCard } from 'lucide-react';
import { cn } from '../utils/cn';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useChat } from '../contexts/ChatContext';
import { useShop } from '../contexts/ShopContext';
import { useTerminologyOptional } from '../contexts/TerminologyContext';
import { apiService } from '../services/api';
import { APP_VERSION } from '../config/version';
import { API_CONFIG } from '../config/api';
import { MobileNavMenu } from './MobileNavMenu';



interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const { user, logout, hasPermission } = useAuth();
  const { notifications, unreadCount: notificationUnreadCount } = useNotifications();
  const { unreadCount: chatUnreadCount } = useChat();
  const { currentShop: shop } = useShop();
  const terminology = useTerminologyOptional();
  const [shopLogoUrl, setShopLogoUrl] = useState<string | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Label dinamica per la voce "Negozio" vista cliente
  const myShopLabel = terminology ? `Il Mio ${terminology.shop}` : 'Il Mio Negozio';

  // Load signed logo when shop changes
  useEffect(() => {
    const fetchLogo = async () => {
      // Priorità 1: Prova con logo_url salvato (se valido)
      if (shop?.logo_url) {
        const logoUrl = shop.logo_url.trim();
        if (logoUrl && logoUrl !== 'null' && logoUrl !== 'undefined' && logoUrl.length > 0) {
          setShopLogoUrl(logoUrl);
          return;
        }
      }

      // Priorità 2: Costruisci URL pubblico da logo_path (se bucket è pubblico)
      if (shop?.logo_path) {
        const publicUrl = `${API_CONFIG.SUPABASE_EDGE_URL} /storage/v1 / object / public / shop - logos / ${shop.logo_path} `;
        setShopLogoUrl(publicUrl);

        // Verifica se l'URL funziona, altrimenti prova signed URL
        try {
          const testRes = await fetch(publicUrl, { method: 'HEAD' });
          if (!testRes.ok) {
            // Se URL pubblico non funziona, prova signed URL
            try {
              const signed = await apiService.getSignedShopLogoUrl(shop.logo_path);
              setShopLogoUrl(signed);
              return;
            } catch (e) {
              console.error('Error loading shop logo (signed URL):', e);
            }
          }
        } catch (e) {
          // Silently fallback to signed URL
          try {
            const signed = await apiService.getSignedShopLogoUrl(shop.logo_path);
            setShopLogoUrl(signed);
            return;
          } catch (signedError) {
            console.error('Error loading shop logo:', signedError);
          }
        }
        return;
      }

      // Priorità 3: Fallback su logo di default
      setShopLogoUrl(null);
    };
    fetchLogo();
  }, [shop?.logo_path, shop?.logo_url]);

  // Calcola badge chat considerando sia chat non lette che notifiche di tipo chat_message
  const unreadChatNotifications = notifications
    ? notifications.filter((n) => n.type === 'chat_message' && !n.read_at).length
    : 0;
  const chatBadgeCount = chatUnreadCount + unreadChatNotifications;

  // Cliente: badge su "Le Mie Prenotazioni" quando arriva uno slot prima
  const unreadEarlierOffers = notifications
    ? notifications.filter((n) => n.type === 'appointment_earlier_available' && !n.read_at).length
    : 0;

  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, permission: 'dashboard' },
    { id: 'calendar', label: 'Calendario', icon: Calendar, permission: 'appointments' },
    { id: 'clients', label: 'Clienti', icon: Users, permission: 'clients' },
    { id: 'waitlist', label: 'Lista d\'Attesa', icon: Clock, permission: 'appointments' },
    { id: 'services', label: 'Servizi', icon: Scissors, permission: 'services' },
    { id: 'products', label: 'Prodotti', icon: ShoppingBag, permission: 'products' },
    { id: 'chat', label: 'Chat', icon: MessageCircle, permission: 'chat' },
    { id: 'profile', label: 'Poltrone', icon: User, permission: 'profile' },
    { id: 'shop', label: 'Negozio', icon: Building2, permission: 'shop' },
    { id: 'settings', label: 'Opzioni', icon: Settings, permission: 'shop' },
    // { id: 'analytics', label: 'Analisi', icon: BarChart3, permission: 'analytics' }, // Temporaneamente nascosto
    { id: 'client_profile', label: 'Il Mio Profilo', icon: UserCheck, permission: 'client_profile' },
    { id: 'client_bookings', label: 'Le Mie Prenotazioni', icon: ListChecks, permission: 'client_bookings' },
    { id: 'client_booking', label: 'Prenota', icon: Calendar, permission: 'client_booking' },
  ];

  // Check if products are enabled (treat unknown as disabled to avoid showing erroneously)
  const areProductsEnabled = shop ? shop.products_enabled !== false : false;

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


    // CRITICO: Nascondi voci specifiche del cliente se non sei un cliente
    // Questo previene che admin/staff vedano "Il Mio Profilo", "Le Mie Prenotazioni", "Prenota"
    if (['client_profile', 'client_bookings', 'client_booking'].includes(item.id)) {
      return user?.role === 'client';
    }

    return hasPermission(item.permission);
  });

  // Helper functions to separate primary and secondary nav items for mobile
  const getPrimaryNavItems = (role: string, items: typeof navItems, productsEnabled: boolean) => {
    if (role === 'client') {
      // Cliente: mostra sempre questi 3 + Prodotti (se abilitati) + "Altro"
      const baseItems = ['client_booking', 'client_bookings', 'chat'];
      if (productsEnabled) {
        baseItems.push('products');
      }
      return items.filter(item => baseItems.includes(item.id));
    } else {
      // Staff/Admin: mostra sempre questi 4 + "Altro"
      return items.filter(item =>
        ['dashboard', 'calendar', 'clients', 'chat'].includes(item.id)
      );
    }
  };

  const getSecondaryNavItems = (role: string, items: typeof navItems, productsEnabled: boolean) => {
    if (role === 'client') {
      // Cliente: menu "Altro" contiene shop, client_profile
      const primaryIds = ['client_booking', 'client_bookings', 'chat'];
      if (productsEnabled) {
        primaryIds.push('products');
      }
      return items.filter(item =>
        !primaryIds.includes(item.id) &&
        ['shop', 'client_profile'].includes(item.id)
      );
    } else {
      // Staff/Admin: menu "Altro" contiene tutto tranne i 4 principali e notifiche
      return items.filter(item =>
        !['dashboard', 'calendar', 'clients', 'chat', 'notifications'].includes(item.id)
      );
    }
  };

  // Reorder items for client users (for desktop sidebar)
  if (user?.role === 'client') {
    // Build client order dynamically based on products enabled status
    const clientOrder = areProductsEnabled
      ? ['client_booking', 'client_bookings', 'products', 'chat', 'shop', 'client_profile']
      : ['client_booking', 'client_bookings', 'chat', 'shop', 'client_profile'];

    navItems = clientOrder
      .map(id => navItems.find(item => item.id === id))
      .filter(Boolean) as typeof navItems;
  }

  // Get primary and secondary items for mobile navigation
  const primaryNavItems = getPrimaryNavItems(user?.role || '', navItems, areProductsEnabled);
  const secondaryNavItems = getSecondaryNavItems(user?.role || '', navItems, areProductsEnabled);

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 glass-sidebar-dark aurora-sidebar">
          <div className="flex-1 flex flex-col pt-1 pb-4 overflow-y-auto">
            {/* Logo Section */}
            {shopLogoUrl && (
              <div className="flex items-center justify-center flex-shrink-0 px-6 py-2 mb-1 aurora-logo-container">
                <img
                  src={shopLogoUrl}
                  alt="Logo negozio"
                  className="w-24 h-24 object-contain filter brightness-110 aurora-logo"
                />
              </div>
            )}

            {/* Separator Line Below Logo (tra logo e menu) - per tutti i temi */}
            <div className="mx-4 mb-2 theme-separator-top"></div>

            <nav className="mt-1 flex-1 px-4 space-y-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const showChatBadge = item.id === 'chat' && chatBadgeCount > 0;
                const showClientBookingsBadge = item.id === 'client_bookings' && user?.role === 'client' && unreadEarlierOffers > 0;
                // Mostra label dinamica per i clienti, altrimenti la label originale
                const displayLabel = item.id === 'shop' && user?.role === 'client'
                  ? myShopLabel
                  : item.label;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={cn(
                      'group flex items-center h-11 px-4 text-sm font-medium w-full text-left transition-all duration-200 relative aurora-nav-item',
                      activeTab === item.id
                        ? 'aurora-nav-item-active'
                        : 'aurora-nav-item-inactive'
                    )}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {displayLabel}
                    {showChatBadge && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center min-w-[20px] h-[20px] px-1.5 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse aurora-badge-nav">
                        {chatBadgeCount > 99 ? '99+' : chatBadgeCount}
                      </span>
                    )}
                    {showClientBookingsBadge && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center min-w-[20px] h-[20px] px-1.5 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse aurora-badge-nav">
                        {unreadEarlierOffers > 99 ? '99+' : unreadEarlierOffers}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Notification Button - Only for staff/admin */}
            {(user?.role === 'admin' || user?.role === 'barber') && (
              <div className="px-4 mt-4 mb-4">
                <button
                  onClick={() => onTabChange('notifications')}
                  className={cn(
                    'w-full flex items-center justify-between h-11 px-4 text-sm font-medium transition-all duration-200 dark-mode-notification-button aurora-notification-button',
                    activeTab === 'notifications'
                      ? 'aurora-nav-item-active'
                      : 'aurora-nav-item-inactive'
                  )}
                >
                  <div className="flex items-center">
                    <Bell className="w-5 h-5 mr-3" />
                    <span>Notifiche</span>
                  </div>
                  {notificationUnreadCount > 0 && (
                    <span className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse aurora-badge-nav">
                      {notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Separator Line Above User Info - per tutti i temi - RIMOSSA per Aurora */}

            {/* User Info and Logout */}
            <div className="mt-auto px-4 pb-4">
              <div className="pt-4">
                <div className="mb-4">
                  <div className="text-center">
                    <p className="text-sm font-bold theme-user-email">{user?.full_name}</p>
                    <p className="text-xs text-yellow-400/70 capitalize">{user?.role}</p>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="w-full flex items-center justify-center px-4 py-2.5 text-sm font-medium transition-all duration-200 aurora-nav-item-inactive"
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

      {/* Mobile Bottom Navigation - Redesigned */}
      <div
        className={cn(
          'md:hidden fixed bottom-0 left-0 right-0 z-50',
          'glass-sidebar-dark border-t',
          'backdrop-blur-xl shadow-2xl',
          'pb-safe-area-inset-bottom',
          'rounded-t-3xl'
        )}
        style={{
          borderTopColor: 'var(--theme-sidebar-border, rgba(238, 207, 84, 0.3))',
          paddingBottom: `max(0.75rem, env(safe - area - inset - bottom, 0.75rem))`,
        }}
      >
        <div className="flex items-center justify-around px-2 py-3">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const showChatBadge = item.id === 'chat' && chatBadgeCount > 0;
            const showClientBookingsBadge = item.id === 'client_bookings' && user?.role === 'client' && unreadEarlierOffers > 0;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  'flex flex-col items-center justify-center min-h-[56px] min-w-[56px] px-3 py-2 rounded-xl',
                  'transition-all duration-200 relative touch-target',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--theme-accent)]',
                  isActive
                    ? 'bg-[var(--theme-accent)]/15 text-[var(--theme-accent)]'
                    : 'text-[var(--theme-sidebar-text)]/70 hover:text-[var(--theme-sidebar-text)] hover:bg-[var(--theme-accent)]/10'
                )}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className="relative">
                  <Icon className={cn(
                    'w-6 h-6 mb-1 transition-transform duration-200',
                    isActive && 'scale-110'
                  )} />
                  {showChatBadge && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-[20px] px-1.5 text-[10px] font-bold text-white bg-red-500 rounded-full animate-pulse shadow-lg">
                      {chatBadgeCount > 99 ? '99+' : chatBadgeCount}
                    </span>
                  )}
                  {showClientBookingsBadge && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-[20px] px-1.5 text-[10px] font-bold text-white bg-red-500 rounded-full animate-pulse shadow-lg">
                      {unreadEarlierOffers > 99 ? '99+' : unreadEarlierOffers}
                    </span>
                  )}
                </div>
                <span className={cn(
                  'text-[10px] font-medium mt-0.5 text-center leading-tight',
                  isActive && 'font-semibold'
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* Menu "Altro" Button */}
          <button
            onClick={() => setShowMobileMenu(true)}
            className={cn(
              'flex flex-col items-center justify-center min-h-[56px] min-w-[56px] px-3 py-2 rounded-xl',
              'transition-all duration-200 touch-target',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--theme-accent)]',
              showMobileMenu
                ? 'bg-[var(--theme-accent)]/15 text-[var(--theme-accent)]'
                : 'text-[var(--theme-sidebar-text)]/70 hover:text-[var(--theme-sidebar-text)] hover:bg-[var(--theme-accent)]/10'
            )}
            aria-label="Altro"
            aria-expanded={showMobileMenu}
          >
            <MoreVertical className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium mt-0.5">Altro</span>
          </button>
        </div>
      </div>

      {/* Mobile Nav Menu (Bottom Sheet) */}
      <MobileNavMenu
        isOpen={showMobileMenu}
        onClose={() => setShowMobileMenu(false)}
        items={secondaryNavItems.map(item => ({
          id: item.id,
          label: item.id === 'shop' && user?.role === 'client' ? myShopLabel : item.label,
          icon: item.icon,
        }))}
        activeTab={activeTab}
        onTabChange={onTabChange}
        onLogout={logout}
        showVersion={true}
        version={APP_VERSION}
      />
    </>
  );
};