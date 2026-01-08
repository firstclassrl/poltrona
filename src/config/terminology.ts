// ==========================================
// MULTI-TIPOLOGIA: Dizionario Terminologico
// ==========================================

// ==========================================
// TIPI
// ==========================================

export type ShopType = 'barbershop' | 'hairdresser' | 'beauty_salon';
export type Gender = 'male' | 'female' | 'neutral';

export interface GenderedTerm {
    male: string;
    female: string;
    neutral: string;
    plural: string;
}

export interface ShopTerminology {
    // Identificazione
    type_name: string;
    type_description: string;

    // Professionista
    professional: GenderedTerm;
    professional_article: GenderedTerm;

    // Spazi
    workspace: string;
    workspace_plural: string;
    shop: string;
    shop_generic: string;

    // Clienti
    client: string;
    client_plural: string;
    welcome_client: GenderedTerm;

    // Azioni
    booking_cta: GenderedTerm;
    select_professional: GenderedTerm;
    no_professionals: string;

    // Appuntamenti
    appointment: string;
    appointment_plural: string;
    new_appointment: string;

    // Messaggi
    professional_not_available: GenderedTerm;
}

// ==========================================
// DIZIONARIO COMPLETO
// ==========================================

export const terminology: Record<ShopType, ShopTerminology> = {

    // ==========================================
    // BARBERSHOP
    // ==========================================
    barbershop: {
        type_name: "Barbershop",
        type_description: "Per barbieri e barber shop",

        professional: {
            male: "Barbiere",
            female: "Barbiera",
            neutral: "Barbiere",
            plural: "Barbieri"
        },
        professional_article: {
            male: "il barbiere",
            female: "la barbiera",
            neutral: "il barbiere",
            plural: "i barbieri"
        },

        workspace: "Poltrona",
        workspace_plural: "Poltrone",
        shop: "Barbershop",
        shop_generic: "Negozio",

        client: "Cliente",
        client_plural: "Clienti",
        welcome_client: {
            male: "Benvenuto",
            female: "Benvenuta",
            neutral: "Benvenuto",
            plural: "Benvenuti"
        },

        booking_cta: {
            male: "Prenota dal tuo barbiere",
            female: "Prenota dalla tua barbiera",
            neutral: "Prenota dal tuo barbiere",
            plural: "Prenota"
        },
        select_professional: {
            male: "Scegli il tuo barbiere",
            female: "Scegli la tua barbiera",
            neutral: "Scegli il tuo barbiere",
            plural: "Scegli il barbiere"
        },
        no_professionals: "Nessun barbiere disponibile",

        appointment: "Appuntamento",
        appointment_plural: "Appuntamenti",
        new_appointment: "Nuovo appuntamento",

        professional_not_available: {
            male: "Il barbiere non è disponibile",
            female: "La barbiera non è disponibile",
            neutral: "Il barbiere non è disponibile",
            plural: "I barbieri non sono disponibili"
        }
    },

    // ==========================================
    // HAIRDRESSER (Parrucchiere)
    // ==========================================
    hairdresser: {
        type_name: "Salone parrucchiere",
        type_description: "Per parrucchieri e saloni di bellezza",

        professional: {
            male: "Parrucchiere",
            female: "Parrucchiera",
            neutral: "Parrucchiere",
            plural: "Parrucchieri"
        },
        professional_article: {
            male: "il parrucchiere",
            female: "la parrucchiera",
            neutral: "il parrucchiere",
            plural: "i parrucchieri"
        },

        workspace: "Postazione",
        workspace_plural: "Postazioni",
        shop: "Salone",
        shop_generic: "Salone",

        client: "Cliente",
        client_plural: "Clienti",
        welcome_client: {
            male: "Benvenuto",
            female: "Benvenuta",
            neutral: "Benvenuta",
            plural: "Benvenuti"
        },

        booking_cta: {
            male: "Prenota dal tuo parrucchiere",
            female: "Prenota dalla tua parrucchiera",
            neutral: "Prenota dal tuo parrucchiere",
            plural: "Prenota"
        },
        select_professional: {
            male: "Scegli il tuo parrucchiere",
            female: "Scegli la tua parrucchiera",
            neutral: "Scegli il tuo parrucchiere",
            plural: "Scegli il parrucchiere"
        },
        no_professionals: "Nessun parrucchiere disponibile",

        appointment: "Appuntamento",
        appointment_plural: "Appuntamenti",
        new_appointment: "Nuovo appuntamento",

        professional_not_available: {
            male: "Il parrucchiere non è disponibile",
            female: "La parrucchiera non è disponibile",
            neutral: "Il parrucchiere non è disponibile",
            plural: "I parrucchieri non sono disponibili"
        }
    },

    // ==========================================
    // BEAUTY SALON (Centro estetico)
    // ==========================================
    beauty_salon: {
        type_name: "Centro estetico",
        type_description: "Per estetiste e centri estetici",

        professional: {
            male: "Estetista",
            female: "Estetista",
            neutral: "Estetista",
            plural: "Estetiste"
        },
        professional_article: {
            male: "l'estetista",
            female: "l'estetista",
            neutral: "l'estetista",
            plural: "le estetiste"
        },

        workspace: "Cabina",
        workspace_plural: "Cabine",
        shop: "Centro estetico",
        shop_generic: "Centro",

        client: "Cliente",
        client_plural: "Clienti",
        welcome_client: {
            male: "Benvenuto",
            female: "Benvenuta",
            neutral: "Benvenuta",
            plural: "Benvenuti"
        },

        booking_cta: {
            male: "Prenota il tuo trattamento",
            female: "Prenota il tuo trattamento",
            neutral: "Prenota il tuo trattamento",
            plural: "Prenota"
        },
        select_professional: {
            male: "Scegli il tuo estetista",
            female: "Scegli la tua estetista",
            neutral: "Scegli l'estetista",
            plural: "Scegli l'estetista"
        },
        no_professionals: "Nessuna estetista disponibile",

        appointment: "Appuntamento",
        appointment_plural: "Appuntamenti",
        new_appointment: "Nuovo appuntamento",

        professional_not_available: {
            male: "L'estetista non è disponibile",
            female: "L'estetista non è disponibile",
            neutral: "L'estetista non è disponibile",
            plural: "Le estetiste non sono disponibili"
        }
    }
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Ottiene il termine corretto in base al genere
 */
export function getGenderedTerm(
    term: GenderedTerm,
    gender: Gender = 'neutral'
): string {
    return term[gender] || term.neutral;
}

/**
 * Ottiene la terminologia completa per un tipo di shop
 */
export function getShopTerminology(shopType: ShopType): ShopTerminology {
    return terminology[shopType] || terminology.barbershop;
}

/**
 * Shorthand per ottenere un termine specifico
 */
export function t(
    shopType: ShopType,
    key: keyof ShopTerminology,
    gender?: Gender
): string {
    const terms = getShopTerminology(shopType);
    const value = terms[key];

    if (typeof value === 'string') {
        return value;
    }

    // È un GenderedTerm
    return getGenderedTerm(value as GenderedTerm, gender);
}

/**
 * Opzioni per la selezione del tipo di shop (uso in UI)
 */
export const shopTypeOptions = [
    {
        type: 'barbershop' as ShopType,
        name: 'Barbershop',
        description: 'Per barbieri e barber shop',
        icon: '💈'
    },
    {
        type: 'hairdresser' as ShopType,
        name: 'Salone parrucchiere',
        description: 'Per parrucchieri e saloni di bellezza',
        icon: '✂️'
    },
    {
        type: 'beauty_salon' as ShopType,
        name: 'Centro estetico',
        description: 'Per estetiste e centri estetici',
        icon: '💅'
    }
];

/**
 * Opzioni per la selezione del genere staff (uso in UI)
 */
export const genderOptions = [
    { value: 'male' as Gender, label: 'Uomo' },
    { value: 'female' as Gender, label: 'Donna' }
];
