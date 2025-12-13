import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import type { Shop } from '../types';
import { apiService } from '../services/api';

interface ShopContextValue {
  currentShop: Shop | null;
  currentShopId: string | null;
  currentSlug: string | null;
  isLoading: boolean;
  error: string | null;
  refreshShop: () => Promise<void>;
}

const ShopContext = createContext<ShopContextValue | undefined>(undefined);

const DEFAULT_SLUG = 'retro-barbershop';

const getSlugFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('shop');
  return slug && slug.trim().length > 0 ? slug.trim() : null;
};

const isSetupMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  return !!(token && token.trim().length > 0);
};

export const ShopProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [currentShop, setCurrentShop] = useState<Shop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const slugFromUrl = useMemo(() => getSlugFromUrl(), []);
  const setupMode = useMemo(() => isSetupMode(), []);

  const effectiveSlug = useMemo(() => {
    // Se siamo in setup mode (token nell'URL), non caricare negozi
    if (setupMode) return null;
    
    // Se c'è query param, vince sempre lui
    if (slugFromUrl) return slugFromUrl;
    // Se utente non loggato, fallback allo shop di default (retro-compatibilità QR)
    if (!isAuthenticated) return DEFAULT_SLUG;
    // Se loggato, sarà determinato da shop_id (non slug)
    return null;
  }, [slugFromUrl, isAuthenticated, setupMode]);

  const currentShopId = useMemo(() => {
    // Prova prima da user (se disponibile)
    if ((user as any)?.shop_id) {
      return (user as any).shop_id;
    }
    // Fallback a localStorage
    if (typeof window !== 'undefined') {
      const storedShopId = localStorage.getItem('current_shop_id');
      if (storedShopId && storedShopId !== 'default') {
        return storedShopId;
      }
    }
    return null;
  }, [user]);

  const loadShop = useCallback(async () => {
    // Se siamo in setup mode (token nell'URL), non caricare negozi
    if (setupMode) {
      console.log('🔍 ShopProvider: Setup mode attivo, salto caricamento negozio');
      setIsLoading(false);
      setCurrentShop(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Priorità: shop_id (utente loggato) -> slug esplicito -> slug di default
      if (isAuthenticated && currentShopId) {
        const shop = await apiService.getShopById(currentShopId);
        setCurrentShop(shop);
        return;
      }

      // Se non c'è slug da usare, non caricare nulla
      if (!effectiveSlug) {
        setIsLoading(false);
        setCurrentShop(null);
        return;
      }

      const shop = await apiService.getShopBySlug(effectiveSlug);
      setCurrentShop(shop);
    } catch (err) {
      console.error('Error loading shop in ShopProvider:', err);
      setError(err instanceof Error ? err.message : 'Errore caricamento negozio');
      setCurrentShop(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, currentShopId, effectiveSlug, setupMode]);

  useEffect(() => {
    void loadShop();
  }, [loadShop]);

  const value: ShopContextValue = {
    currentShop,
    currentShopId: currentShop?.id || currentShopId,
    currentSlug: effectiveSlug,
    isLoading,
    error,
    refreshShop: loadShop,
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
};

export const useShop = (): ShopContextValue => {
  const ctx = useContext(ShopContext);
  if (!ctx) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return ctx;
};





