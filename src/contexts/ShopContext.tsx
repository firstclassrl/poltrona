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

export const ShopProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [currentShop, setCurrentShop] = useState<Shop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const slugFromUrl = useMemo(() => getSlugFromUrl(), []);

  const effectiveSlug = useMemo(() => {
    // Se c'è query param, vince sempre lui
    if (slugFromUrl) return slugFromUrl;
    // Se utente non loggato, fallback allo shop di default (retro-compatibilità QR)
    if (!isAuthenticated) return DEFAULT_SLUG;
    // Se loggato, sarà determinato da shop_id (non slug)
    return null;
  }, [slugFromUrl, isAuthenticated]);

  const currentShopId = useMemo(() => {
    // User potrebbe essere esteso con shop_id (in auth context)
    return (user as any)?.shop_id ?? null;
  }, [user]);

  const loadShop = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Priorità: shop_id (utente loggato) -> slug esplicito -> slug di default
      if (isAuthenticated && currentShopId) {
        const shop = await apiService.getShopById(currentShopId);
        setCurrentShop(shop);
        return;
      }

      const slugToUse = effectiveSlug || DEFAULT_SLUG;
      const shop = await apiService.getShopBySlug(slugToUse);
      setCurrentShop(shop);
    } catch (err) {
      console.error('Error loading shop in ShopProvider:', err);
      setError(err instanceof Error ? err.message : 'Errore caricamento negozio');
      setCurrentShop(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, currentShopId, effectiveSlug]);

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



