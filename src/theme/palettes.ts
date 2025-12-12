export type ThemePaletteId =
  | 'heritage'
  | 'aurora'
  | 'sunset-neon'
  | 'terra-soft'
  | 'cyber-lilac';

export interface ThemePalette {
  id: ThemePaletteId;
  name: string;
  description: string;
  trend: string;
  previewGradient: string;
  colors: {
    background: string;
    surface: string;
    surfaceAlt: string;
    primary: string;
    primaryStrong: string;
    accent: string;
    accentSoft: string;
    accentContrast: string;
    text: string;
    textMuted: string;
    border: string;
    success: string;
    warning: string;
    danger: string;
  };
}

export const THEME_PALETTES: ThemePalette[] = [
  {
    id: 'heritage',
    name: 'Heritage Verde/Oro',
    description: 'Palette attuale ispirata al barbershop retrò.',
    trend: 'Palette attuale (base)',
    previewGradient: 'linear-gradient(135deg, #f4fff6 0%, #e0f4e7 100%)',
    colors: {
      background: '#ffffff',      // sfondo chiaro
      surface: '#ffffff',
      surfaceAlt: '#f5f8f3',
      primary: '#25401c',         // verde heritage per sidebar e CTA
      primaryStrong: '#1b3015',
      accent: '#eecf54',          // oro heritage
      accentSoft: '#f7e8a3',
      accentContrast: '#0f0f0f',
      text: '#0f172a',            // testo scuro per contrasto
      textMuted: '#4b5563',
      border: '#d9dfd3',
      success: '#22c55e',
      warning: '#f59e0b',
      danger: '#ef4444',
    },
  },
  {
    id: 'aurora',
    name: 'Aurora (Bianco/Azzurro/Violetto)',
    description: 'Look luminoso e pulito, con tocchi aurora boreale.',
    trend: 'Bianco + Azzurro + Violetto (2025 clean web)',
    previewGradient: 'linear-gradient(135deg, #f7fbff 0%, #c8e4ff 40%, #c7c5ff 100%)',
    colors: {
      background: '#f4f7ff',
      surface: '#ffffff',
      surfaceAlt: '#eef3ff',
      primary: '#5b7cff',
      primaryStrong: '#3c5fe6',
      accent: '#9b7bff',
      accentSoft: '#d8d0ff',
      accentContrast: '#0a0a0a',
      text: '#ffffff',
      textMuted: '#e5e7eb',
      border: '#d5def7',
      success: '#22c55e',
      warning: '#f59e0b',
      danger: '#ef4444',
    },
  },
  {
    id: 'sunset-neon',
    name: 'Sunset Neon',
    description: 'Corallo e teal neon, vibe Miami/Soho 2025.',
    trend: 'Gradienti saturi e accenti neon (2025 storefronts)',
    previewGradient: 'linear-gradient(135deg, #f64f3b 0%, #ffb347 45%, #6ec8ff 100%)',
    colors: {
      background: '#ffffff',
      surface: '#ffffff',
      surfaceAlt: '#f5f7fb',
      primary: '#f64f3b',        // rosso sidebar
      primaryStrong: '#c93b2d',  // rosso più scuro
      accent: '#ffb347',         // accento caldo
      accentSoft: '#ffe0b8',
      accentContrast: '#0f0f0f',
      text: '#0f172a',
      textMuted: '#4b5563',
      border: '#e5e7eb',
      success: '#22c55e',
      warning: '#f59e0b',
      danger: '#f43f5e',
    },
  },
  {
    id: 'terra-soft',
    name: 'Terra Soft',
    description: 'Toni sabbia/terracotta con accenti salvia.',
    trend: 'New neutrals caldi + verdi salvia (interior 2025)',
    previewGradient: 'linear-gradient(135deg, #f5efe7 0%, #f0d6c0 45%, #6d9c7b 100%)',
    colors: {
      background: '#f7f2eb',
      surface: '#ffffff',
      surfaceAlt: '#f1e5d9',
      primary: '#d28b6c',
      primaryStrong: '#b46a4b',
      accent: '#6d9c7b',
      accentSoft: '#a6c5b0',
      accentContrast: '#0e1612',
      text: '#1f2a2f',
      textMuted: '#4b5560',
      border: '#e6d3c3',
      success: '#28a745',
      warning: '#d97706',
      danger: '#c2410c',
    },
  },
  {
    id: 'cyber-lilac',
    name: 'Cyber Lilac',
    description: 'Lavanda digitale con accenti lime/fucsia.',
    trend: 'Cyber-lavender + neon lime (fashion/ux 2025)',
    previewGradient: 'linear-gradient(135deg, #c5b3ff 0%, #9a7bff 45%, #b6ff6d 100%)',
    colors: {
      background: '#0f0f1a',
      surface: '#131428',
      surfaceAlt: '#101024',
      primary: '#9a7bff',
      primaryStrong: '#7f5be8',
      accent: '#b6ff6d',
      accentSoft: '#d5ffad',
      accentContrast: '#0f1610',
      text: '#f5f3ff',
      textMuted: '#c7c4e8',
      border: '#9a7bff',
      success: '#34d399',
      warning: '#fbbf24',
      danger: '#fb7185',
    },
  },
];

export const DEFAULT_THEME_ID: ThemePaletteId = 'heritage';

export const getPaletteById = (id?: ThemePaletteId | null): ThemePalette => {
  const fallback = THEME_PALETTES.find((p) => p.id === DEFAULT_THEME_ID)!;
  if (!id) return fallback;
  return THEME_PALETTES.find((p) => p.id === id) ?? fallback;
};




