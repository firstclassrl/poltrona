import React, { useState, useEffect } from 'react';
import { Calendar, Users, Home, ShoppingBag, User, Building2, LogOut, UserCheck, MessageCircle, Scissors } from 'lucide-react';
import { cn } from '../utils/cn';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { APP_VERSION } from '../config/version';
import type { Shop } from '../types';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const { user, logout, hasPermission } = useAuth();
  const [shop, setShop] = useState<Shop | null>(null);

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

  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, permission: 'dashboard' },
    { id: 'calendar', label: 'Calendario', icon: Calendar, permission: 'appointments' },
    { id: 'clients', label: 'Clienti', icon: Users, permission: 'clients' },
    { id: 'services', label: 'Servizi', icon: Scissors, permission: 'services' },
    { id: 'products', label: 'Prodotti', icon: ShoppingBag, permission: 'products' },
    { id: 'chat', label: 'Chat', icon: MessageCircle, permission: 'chat' },
    { id: 'profile', label: 'Profilo', icon: User, permission: 'profile' },
    { id: 'shop', label: 'Negozio', icon: Building2, permission: 'shop' },
    // { id: 'analytics', label: 'Analisi', icon: BarChart3, permission: 'analytics' }, // Temporaneamente nascosto
    { id: 'client_profile', label: 'Il Mio Profilo', icon: UserCheck, permission: 'client_profile' },
    { id: 'client_booking', label: 'Prenota', icon: Calendar, permission: 'client_booking' },
  ];

  // Filter nav items based on user permissions and shop settings
  let navItems = allNavItems.filter(item => {
    // Check if products are enabled for the shop
    if (item.id === 'products') {
      console.log('🔧 [DEBUG] Checking products navigation item:', {
        shop: shop,
        products_enabled: shop?.products_enabled,
        products_enabled_type: typeof shop?.products_enabled,
        shouldHide: shop && shop.products_enabled === false
      });
      
      if (shop && shop.products_enabled === false) {
        console.log('🚫 [DEBUG] Hiding products navigation item - products disabled');
        return false;
      }
    }
    return hasPermission(item.permission);
  });

  // Reorder items for client users
  if (user?.role === 'client') {
    const clientOrder = ['client_booking', 'products', 'chat', 'client_profile'];
    navItems = clientOrder
      .map(id => navItems.find(item => item.id === id))
      .filter(Boolean) as typeof navItems;
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 glass-sidebar-dark">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            {/* Logo Section */}
            <div className="flex items-center justify-center flex-shrink-0 px-4 mb-8">
              <img 
                src="/Logo retro barbershop glass copy copy.png" 
                alt="Retro Barbershop Logo" 
                className="w-40 h-40 object-contain filter brightness-110"
              />
            </div>
            
            {/* Separator Line */}
            <div className="mx-4 mb-6 border-t border-white/20"></div>
            
            <nav className="mt-5 flex-1 px-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={cn(
                      'group flex items-center px-2 py-2 text-sm font-medium rounded-md w-full text-left transition-all duration-200',
                      activeTab === item.id
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-400/40 shadow-lg glass-nav-item'
                        : 'text-yellow-300 hover:bg-yellow-500/10 hover:text-yellow-400 hover:glass-nav-item'
                    )}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
            
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
                    © 2025 abruzzo.ai
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
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  'flex flex-col items-center py-2 px-1 transition-all duration-200',
                  activeTab === item.id ? 'text-yellow-400' : 'text-yellow-300'
                )}
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium">{item.label}</span>
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
            v{APP_VERSION} | © 2025 abruzzo.ai
          </p>
        </div>
      </div>
    </>
  );
};