// ==========================================
// TIPI ENUM
// ==========================================

export type HairType = 'straight_fine' | 'wavy_medium' | 'curly_thick' | 'very_curly_afro';
export type HairLength = 'short' | 'medium' | 'long' | 'very_long';
export type ColorSituation = 'virgin' | 'roots_touch_up' | 'full_color_change' | 'color_correction';

// ==========================================
// INTERFACCE
// ==========================================

export interface HairProfile {
    id: string;
    client_id: string;
    shop_id: string;
    hair_type: HairType | null;
    hair_length: HairLength | null;
    has_color_history: boolean;
    color_situation: ColorSituation | null;
    created_at: string;
    updated_at: string;
    updated_by: string | null;
}

export interface DurationConfig {
    base_minutes: number;
    hair_type_multipliers: Record<HairType, number>;
    hair_length_multipliers: Record<HairLength, number>;
    color_situation_extra_minutes: Record<ColorSituation, number>;
    buffer_percentage: number;
}

export interface DurationResult {
    estimated_minutes: number;
    rounded_minutes: number;
    breakdown: {
        base: number;
        after_hair_type: number;
        after_length: number;
        color_extra: number;
        buffer: number;
        final: number;
    };
    display: string;
}

// ==========================================
// LABELS PER UI
// ==========================================

export const HAIR_TYPE_OPTIONS: Array<{
    value: HairType;
    label: string;
    icon: string;
    description: string;
}> = [
        {
            value: 'straight_fine',
            label: 'Liscio / Fine',
            icon: '〰️',
            description: 'Capelli dritti, sottili'
        },
        {
            value: 'wavy_medium',
            label: 'Mosso / Medio',
            icon: '🌊',
            description: 'Leggermente ondulati'
        },
        {
            value: 'curly_thick',
            label: 'Riccio / Spesso',
            icon: '🔄',
            description: 'Ricci definiti, corposi'
        },
        {
            value: 'very_curly_afro',
            label: 'Molto riccio / Afro',
            icon: '⭕',
            description: 'Ricci stretti, voluminosi'
        }
    ];

export const HAIR_LENGTH_OPTIONS: Array<{
    value: HairLength;
    label: string;
    description: string;
    visual: string;
}> = [
        {
            value: 'short',
            label: 'Corti',
            description: 'Sopra le orecchie',
            visual: '●○○○'
        },
        {
            value: 'medium',
            label: 'Medi',
            description: 'Fino alle spalle',
            visual: '●●○○'
        },
        {
            value: 'long',
            label: 'Lunghi',
            description: 'Sotto le spalle',
            visual: '●●●○'
        },
        {
            value: 'very_long',
            label: 'Molto lunghi',
            description: 'Metà schiena o più',
            visual: '●●●●'
        }
    ];

export const COLOR_SITUATION_OPTIONS: Array<{
    value: ColorSituation;
    label: string;
    description: string;
}> = [
        {
            value: 'virgin',
            label: 'Mai colorati',
            description: 'Colore naturale'
        },
        {
            value: 'roots_touch_up',
            label: 'Ritocco ricrescita',
            description: 'Stesso colore, solo radici'
        },
        {
            value: 'full_color_change',
            label: 'Cambio colore',
            description: 'Voglio un colore diverso'
        },
        {
            value: 'color_correction',
            label: 'Correzione colore',
            description: 'Sistemare un colore precedente'
        }
    ];

// ==========================================
// HELPER PER OTTENERE LABEL DA VALORE
// ==========================================

export function getHairTypeLabel(value: HairType | null): string {
    if (!value) return 'Non specificato';
    return HAIR_TYPE_OPTIONS.find(o => o.value === value)?.label || value;
}

export function getHairLengthLabel(value: HairLength | null): string {
    if (!value) return 'Non specificato';
    return HAIR_LENGTH_OPTIONS.find(o => o.value === value)?.label || value;
}

export function getColorSituationLabel(value: ColorSituation | null): string {
    if (!value) return 'Non specificato';
    return COLOR_SITUATION_OPTIONS.find(o => o.value === value)?.label || value;
}

export function getHairTypeIcon(value: HairType | null): string {
    if (!value) return '❓';
    return HAIR_TYPE_OPTIONS.find(o => o.value === value)?.icon || '❓';
}

export function getHairLengthVisual(value: HairLength | null): string {
    if (!value) return '○○○○';
    return HAIR_LENGTH_OPTIONS.find(o => o.value === value)?.visual || '○○○○';
}
