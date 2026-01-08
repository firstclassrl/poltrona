import {
    HairProfile,
    HairType,
    HairLength,
    ColorSituation,
    DurationConfig,
    DurationResult
} from '@/types/hairProfile';

// ==========================================
// CONFIG DEFAULT
// ==========================================

export const DEFAULT_DURATION_CONFIG: DurationConfig = {
    base_minutes: 30,
    hair_type_multipliers: {
        straight_fine: 1.0,
        wavy_medium: 1.15,
        curly_thick: 1.25,
        very_curly_afro: 1.4
    },
    hair_length_multipliers: {
        short: 1.0,
        medium: 1.2,
        long: 1.35,
        very_long: 1.5
    },
    color_situation_extra_minutes: {
        virgin: 0,
        roots_touch_up: 0,
        full_color_change: 30,
        color_correction: 60
    },
    buffer_percentage: 10
};

// ==========================================
// HELPER FORMATTAZIONE
// ==========================================

export function formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
}

// ==========================================
// CALCOLO PRINCIPALE
// ==========================================

interface ServiceWithConfig {
    id: string;
    name: string;
    duration_minutes: number;
    is_duration_variable: boolean;
    duration_config?: DurationConfig;
}

/**
 * Calcola la durata stimata per un insieme di servizi
 * basandosi sul profilo capelli del cliente
 */
export function calculateServiceDuration(
    services: ServiceWithConfig[],
    hairProfile: Partial<HairProfile>
): DurationResult {
    let totalMinutes = 0;
    let baseTotal = 0;
    let afterHairType = 0;
    let afterLength = 0;
    let colorExtra = 0;

    for (const service of services) {
        // Servizio a durata fissa
        if (!service.is_duration_variable) {
            totalMinutes += service.duration_minutes;
            baseTotal += service.duration_minutes;
            afterHairType += service.duration_minutes;
            afterLength += service.duration_minutes;
            continue;
        }

        // Servizio a durata variabile
        const config = service.duration_config || DEFAULT_DURATION_CONFIG;
        let minutes = config.base_minutes;
        baseTotal += config.base_minutes;

        // Moltiplicatore tipo capello
        if (hairProfile.hair_type) {
            const multiplier = config.hair_type_multipliers[hairProfile.hair_type] || 1;
            minutes *= multiplier;
        }
        afterHairType += minutes;

        // Moltiplicatore lunghezza
        if (hairProfile.hair_length) {
            const multiplier = config.hair_length_multipliers[hairProfile.hair_length] || 1;
            minutes *= multiplier;
        }
        afterLength += minutes;

        // Extra colore
        if (hairProfile.color_situation && config.color_situation_extra_minutes) {
            const extra = config.color_situation_extra_minutes[hairProfile.color_situation] || 0;
            minutes += extra;
            colorExtra += extra;
        }

        totalMinutes += minutes;
    }

    // Buffer sicurezza (10%)
    const buffer = totalMinutes * 0.1;
    totalMinutes += buffer;

    // Arrotonda a slot di 15 minuti (per eccesso)
    const roundedMinutes = Math.ceil(totalMinutes / 15) * 15;

    return {
        estimated_minutes: Math.round(totalMinutes),
        rounded_minutes: roundedMinutes,
        breakdown: {
            base: Math.round(baseTotal),
            after_hair_type: Math.round(afterHairType),
            after_length: Math.round(afterLength),
            color_extra: Math.round(colorExtra),
            buffer: Math.round(buffer),
            final: roundedMinutes
        },
        display: formatDuration(roundedMinutes)
    };
}

/**
 * Verifica se un servizio è un servizio colore basandosi sul nome
 */
export function isColorService(serviceName: string): boolean {
    const name = serviceName.toLowerCase();
    return name.includes('colore') ||
        name.includes('tinta') ||
        name.includes('meches') ||
        name.includes('balayage') ||
        name.includes('shatush') ||
        name.includes('schiariture') ||
        name.includes('decolorazione');
}

/**
 * Controlla se almeno un servizio è a durata variabile
 */
export function hasVariableDurationServices(services: Array<{ is_duration_variable?: boolean }>): boolean {
    return services.some(s => s.is_duration_variable === true);
}
