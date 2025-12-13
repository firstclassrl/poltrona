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
  const { currentShop } = useShop();
  const shopKey = useMemo(() => (currentShop?.id ? `${STORAGE_KEY}:${currentShop.id}` : STORAGE_KEY), [currentShop?.id]);
  const initialisedRef = useRef(false);
  const manualThemeChangeRef = useRef(false);

  const resolveInitialTheme = (): ThemePaletteId => {
    if (typeof window === 'undefined') return currentShop?.theme_palette as ThemePaletteId || DEFAULT_THEME_ID;
    const stored = localStorage.getItem(shopKey) as ThemePaletteId | null;
    const shopTheme = currentShop?.theme_palette as ThemePaletteId | null;
    const resolved = shopTheme || stored || DEFAULT_THEME_ID;
    
    console.log('🎨 ThemeContext: Risoluzione tema iniziale:', {
      shopTheme,
      stored,
      defaultTheme: DEFAULT_THEME_ID,
      resolved,
      shopId: currentShop?.id,
      shopKey
    });
    
    return resolved;
  };

  const [themeId, setThemeId] = useState<ThemePaletteId>(() => resolveInitialTheme());

  const palette = useMemo(() => getPaletteById(themeId), [themeId]);

  useEffect(() => {
    // Apply as soon as possible
    applyPaletteToDocument(palette);
    if (typeof window !== 'undefined') {
      localStorage.setItem(shopKey, palette.id);
    }
  }, [palette, shopKey]);

  useEffect(() => {
    if (!initialisedRef.current) {
      initialisedRef.current = true;
      return;
    }
    const next = resolveInitialTheme();
    console.log('🎨 ThemeContext: Aggiornamento tema da shop:', {
      currentTheme: themeId,
      newTheme: next,
      shopTheme: currentShop?.theme_palette,
      shopId: currentShop?.id,
      manualChange: manualThemeChangeRef.current
    });
    
    // Se il tema è stato cambiato manualmente, non resettarlo finché non corrisponde al database
    if (manualThemeChangeRef.current) {
      // Se il tema nel database corrisponde al tema corrente, significa che è stato salvato
      if (next === themeId) {
        manualThemeChangeRef.current = false;
      }
      // In ogni caso, non resettare il tema se è stato cambiato manualmente
      return;
    }
    
    // Non resettare il tema se è già quello corretto (evita reset quando si naviga su opzioni)
    if (next !== themeId) {
      setThemeId(next);
    }
  }, [shopKey, currentShop?.theme_palette, themeId]);

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




