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
    previewGradient: 'linear-gradient(135deg, #25401c 0%, #1a2f15 45%, #eecf54 100%)',
    colors: {
      background: '#0c100a',
      surface: '#10180f',
      surfaceAlt: '#0f120f',
      primary: '#25401c',
      primaryStrong: '#1b3015',
      accent: '#eecf54',
      accentSoft: '#f5e59a',
      accentContrast: '#0f0f0c',
      text: '#f8f7f2',
      textMuted: '#d8d4c3',
      border: '#eecf54',
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
      accentContrast: '#0f1024',
      text: '#0f172a',
      textMuted: '#4b5563',
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
    previewGradient: 'linear-gradient(135deg, #ff7a70 0%, #ffb36b 40%, #2fd7c4 100%)',
    colors: {
      background: '#0f1115',
      surface: '#131720',
      surfaceAlt: '#0f131c',
      primary: '#ff7a70',
      primaryStrong: '#e45b52',
      accent: '#2fd7c4',
      accentSoft: '#7ee8dd',
      accentContrast: '#0b0f12',
      text: '#f7f7fb',
      textMuted: '#cdd3e1',
      border: '#ffb36b',
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



