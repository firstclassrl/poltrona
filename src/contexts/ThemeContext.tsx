import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_THEME_ID, THEME_PALETTES, ThemePalette, ThemePaletteId, getPaletteById } from '../theme/palettes';
import { useShop } from './ShopContext';

type SetThemeOptions = {
  persist?: boolean;
};

interface ThemeContextValue {
  themeId: ThemePaletteId;
  palette: ThemePalette;
  setTheme: (id: ThemePaletteId, options?: SetThemeOptions) => void;
  palettes: ThemePalette[];
}

const STORAGE_KEY = 'poltrona-theme';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const applyPaletteToDocument = (palette: ThemePalette) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const { colors } = palette;

  const derivedOverlay = 'rgba(15, 15, 15, 0.35)';
  root.dataset.theme = palette.id;
  root.style.setProperty('--theme-background', colors.background);
  root.style.setProperty('--theme-surface', colors.surface);
  root.style.setProperty('--theme-surface-alt', colors.surfaceAlt);
  root.style.setProperty('--theme-primary', colors.primary);
  root.style.setProperty('--theme-primary-strong', colors.primaryStrong);
  root.style.setProperty('--theme-accent', colors.accent);
  root.style.setProperty('--theme-accent-soft', colors.accentSoft);
  root.style.setProperty('--theme-accent-contrast', colors.accentContrast);
  root.style.setProperty('--theme-text', colors.text);
  root.style.setProperty('--theme-text-muted', colors.textMuted);
  root.style.setProperty('--theme-border', colors.border);
  root.style.setProperty('--theme-success', colors.success);
  root.style.setProperty('--theme-warning', colors.warning);
  root.style.setProperty('--theme-danger', colors.danger);
  root.style.setProperty('--theme-overlay', derivedOverlay);
  root.style.setProperty('--theme-page-gradient', palette.previewGradient);

  // Derivatives for glass/nav
  if (palette.id === 'dark-mode') {
    // Dark mode: sidebar nera solida, testo arancione, senza bordo
    root.style.setProperty('--theme-sidebar-bg', colors.background);
    root.style.setProperty('--theme-sidebar-border', 'transparent');
    root.style.setProperty('--theme-sidebar-shadow', `0 8px 32px rgba(0, 0, 0, 0.8)`);
    root.style.setProperty('--theme-nav-active', `color-mix(in srgb, ${colors.accent} 20%, transparent)`);
    root.style.setProperty('--theme-nav-hover', `color-mix(in srgb, ${colors.accent} 10%, transparent)`);
    root.style.setProperty('--theme-sidebar-text', colors.accent);
  } else {
    root.style.setProperty('--theme-sidebar-bg', `color-mix(in srgb, ${colors.primaryStrong} 78%, transparent)`);
    root.style.setProperty('--theme-sidebar-border', `color-mix(in srgb, ${colors.accent} 60%, transparent)`);
    root.style.setProperty('--theme-sidebar-shadow', `0 8px 32px color-mix(in srgb, ${colors.primaryStrong} 55%, transparent)`);
    root.style.setProperty('--theme-nav-active', `color-mix(in srgb, ${colors.accent} 18%, transparent)`);
    root.style.setProperty('--theme-nav-hover', `color-mix(in srgb, ${colors.accent} 12%, transparent)`);
    root.style.setProperty('--theme-sidebar-text', '#f8fafc');
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentShop, currentShopId } = useShop();
  // Usa shop_id da ShopContext (che legge da user o localStorage) per calcolare shopKey
  // Questo assicura che shopKey sia sempre lo stesso, anche prima che shop sia caricato
  const shopIdForKey = useMemo(() => {
    // Priorità: 1) shop corrente, 2) shopId da ShopContext, 3) localStorage diretto
    if (currentShop?.id) return currentShop.id;
    if (currentShopId) return currentShopId;
    if (typeof window !== 'undefined') {
      const storedShopId = localStorage.getItem('current_shop_id');
      if (storedShopId && storedShopId !== 'default') return storedShopId;
    }
    return null;
  }, [currentShop?.id, currentShopId]);
  
  const shopKey = useMemo(() => (shopIdForKey ? `${STORAGE_KEY}:${shopIdForKey}` : STORAGE_KEY), [shopIdForKey]);
  const initialisedRef = useRef(false);
  const manualThemeChangeRef = useRef(false);

  const resolveInitialTheme = (): ThemePaletteId => {
    if (typeof window === 'undefined') return currentShop?.theme_palette as ThemePaletteId || DEFAULT_THEME_ID;
    
    // Priorità: 1) tema dal database (shop), 2) localStorage, 3) default
    const shopTheme = currentShop?.theme_palette as ThemePaletteId | null;
    const stored = localStorage.getItem(shopKey) as ThemePaletteId | null;
    const resolved = shopTheme || stored || DEFAULT_THEME_ID;
    
    
    return resolved;
  };

  // Inizializza con localStorage come fallback, poi aggiorna quando shop è caricato
  const [themeId, setThemeId] = useState<ThemePaletteId>(() => {
    if (typeof window === 'undefined') return DEFAULT_THEME_ID;
    // All'inizializzazione, prova a leggere da localStorage con il shopKey corrente
    // Se shopKey cambia dopo, verrà aggiornato dall'useEffect
    const stored = localStorage.getItem(shopKey) as ThemePaletteId | null;
    const initial = stored || DEFAULT_THEME_ID;
    return initial;
  });
  
  // Quando shopKey cambia (es. shop viene caricato), verifica se c'è un tema salvato per questo shop
  // Solo se non è stato ancora inizializzato
  useEffect(() => {
    if (typeof window === 'undefined' || initialisedRef.current) return;
    const stored = localStorage.getItem(shopKey) as ThemePaletteId | null;
    if (stored && stored !== themeId) {
      setThemeId(stored);
    }
  }, [shopKey]);

  const palette = useMemo(() => getPaletteById(themeId), [themeId]);

  useEffect(() => {
    // Apply as soon as possible
    applyPaletteToDocument(palette);
    // Salva sempre in localStorage per persistenza tra refresh
    if (typeof window !== 'undefined') {
      localStorage.setItem(shopKey, palette.id);
    }
  }, [palette, shopKey]);

  // Quando il shop viene caricato, aggiorna il tema se necessario
  useEffect(() => {
    // Se il shop non è ancora caricato, aspetta
    if (!currentShop) {
      return;
    }
    
    const shopTheme = currentShop?.theme_palette as ThemePaletteId | null;
    
    // Se è la prima volta che il shop viene caricato, applica sempre il tema dal database
    if (!initialisedRef.current) {
      initialisedRef.current = true;
      // Se c'è un tema nel database, usalo SEMPRE (ha priorità assoluta su localStorage)
      if (shopTheme) {
        setThemeId(shopTheme);
        if (typeof window !== 'undefined') {
          localStorage.setItem(shopKey, shopTheme);
        }
        // Applica immediatamente il tema
        const paletteToApply = getPaletteById(shopTheme);
        applyPaletteToDocument(paletteToApply);
      } else {
        // Se non c'è tema nel database, mantieni quello corrente (da localStorage o default)
      }
      return;
    }
    
    // Dopo l'inizializzazione, verifica se il tema nel database è diverso
    const next = resolveInitialTheme();
    
    // Se il tema è stato cambiato manualmente, non resettarlo finché non corrisponde al database
    if (manualThemeChangeRef.current) {
      // Se il tema nel database corrisponde al tema corrente, significa che è stato salvato
      if (next === themeId) {
        manualThemeChangeRef.current = false;
      }
      // In ogni caso, non resettare il tema se è stato cambiato manualmente
      return;
    }
    
    // Se il tema dal database è diverso da quello corrente, aggiornalo
    // Questo gestisce il caso in cui il tema è stato salvato nel database ma non ancora applicato
    if (next !== themeId) {
      setThemeId(next);
      // Salva anche in localStorage per persistenza
      if (typeof window !== 'undefined') {
        localStorage.setItem(shopKey, next);
      }
    }
  }, [currentShop, shopKey]);

  const setTheme = (id: ThemePaletteId, options?: SetThemeOptions) => {
    const paletteToApply = getPaletteById(id);
    // Segna che il tema è stato cambiato manualmente
    manualThemeChangeRef.current = true;
    setThemeId(paletteToApply.id);
    if (options?.persist !== false && typeof window !== 'undefined') {
      localStorage.setItem(shopKey, paletteToApply.id);
    }
    applyPaletteToDocument(paletteToApply);
    window.dispatchEvent(new CustomEvent('theme:changed', { detail: { id: paletteToApply.id } }));
  };

  const value: ThemeContextValue = {
    themeId,
    palette,
    setTheme,
    palettes: THEME_PALETTES,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
};




