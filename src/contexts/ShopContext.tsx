import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import type { Shop } from '../types';
import { apiService } from '../services/api';
import { buildShopPath, extractSlugFromLocation } from '../utils/slug';

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

const getSlugFromLocation = (): string | null => {
  return extractSlugFromLocation();
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

  const slugFromUrl = useMemo(() => getSlugFromLocation(), []);
  const setupMode = useMemo(() => isSetupMode(), []);

  const syncUrlWithSlug = useCallback(
    (slug: string | null | undefined) => {
      if (typeof window === 'undefined' || setupMode || !slug) return;
      const currentSlug = extractSlugFromLocation();
      if (currentSlug === slug) return;

      const params = new URLSearchParams(window.location.search);
      params.delete('shop'); // rimuovi vecchio formato query
      const newSearch = params.toString();
      const hash = window.location.hash || '';
      const newPath = buildShopPath(slug, false);
      const newUrl = `${newPath}${newSearch ? `?${newSearch}` : ''}${hash}`;
      window.history.replaceState({}, '', newUrl);
    },
    [setupMode]
  );

  const effectiveSlug = useMemo(() => {
    // Se siamo in setup mode (token nell'URL), non caricare negozi
    if (setupMode) return null;
    
    // Se c'è slug nel percorso, vince sempre lui
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
        syncUrlWithSlug(shop?.slug);
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
      syncUrlWithSlug(shop?.slug || effectiveSlug);
    } catch (err) {
      console.error('Error loading shop in ShopProvider:', err);
      setError(err instanceof Error ? err.message : 'Errore caricamento negozio');
      setCurrentShop(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, currentShopId, effectiveSlug, setupMode, syncUrlWithSlug]);

  useEffect(() => {
    void loadShop();
  }, [loadShop]);

  const value: ShopContextValue = {
    currentShop,
    currentShopId: currentShop?.id || currentShopId,
    currentSlug: currentShop?.slug || effectiveSlug,
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





