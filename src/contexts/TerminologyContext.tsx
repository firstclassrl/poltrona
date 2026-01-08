import React, { createContext, useContext, useMemo } from 'react';
import {
    ShopType,
    Gender,
    ShopTerminology,
    GenderedTerm,
    getShopTerminology,
    getGenderedTerm
} from '@/config/terminology';
import { useShop } from '@/contexts/ShopContext';

// ==========================================
// TIPI CONTEXT
// ==========================================

interface TerminologyContextValue {
    shopType: ShopType;
    terms: ShopTerminology;

    // Helper per termini con genere
    professional: (gender?: Gender) => string;
    professionalPlural: () => string;
    professionalArticle: (gender?: Gender) => string;
    selectProfessional: (gender?: Gender) => string;
    bookingCta: (gender?: Gender) => string;
    welcomeClient: (gender?: Gender) => string;
    professionalNotAvailable: (gender?: Gender) => string;
    professionalActive: (gender?: Gender) => string;

    // Termini semplici (senza genere)
    workspace: string;
    workspacePlural: string;
    shop: string;
    shopGeneric: string;
    client: string;
    clientPlural: string;
    appointment: string;
    appointmentPlural: string;
    newAppointment: string;
    noProfessionals: string;

    // Info tipo shop
    typeName: string;
    typeDescription: string;
}

// ==========================================
// CONTEXT
// ==========================================

const TerminologyContext = createContext<TerminologyContextValue | null>(null);

// ==========================================
// PROVIDER
// ==========================================

interface TerminologyProviderProps {
    children: React.ReactNode;
}

export function TerminologyProvider({ children }: TerminologyProviderProps) {
    const { currentShop } = useShop();
    const shopType: ShopType = currentShop?.shop_type || 'barbershop';
    const terms = getShopTerminology(shopType);

    const value = useMemo<TerminologyContextValue>(() => ({
        shopType,
        terms,

        // Helper con genere
        professional: (gender?: Gender) => getGenderedTerm(terms.professional, gender),
        professionalPlural: () => terms.professional.plural,
        professionalArticle: (gender?: Gender) => getGenderedTerm(terms.professional_article, gender),
        selectProfessional: (gender?: Gender) => getGenderedTerm(terms.select_professional, gender),
        bookingCta: (gender?: Gender) => getGenderedTerm(terms.booking_cta, gender),
        welcomeClient: (gender?: Gender) => getGenderedTerm(terms.welcome_client, gender),
        professionalNotAvailable: (gender?: Gender) => getGenderedTerm(terms.professional_not_available, gender),
        professionalActive: (gender?: Gender) => `${getGenderedTerm(terms.professional, gender)} Attivo`,

        // Termini semplici
        workspace: terms.workspace,
        workspacePlural: terms.workspace_plural,
        shop: terms.shop,
        shopGeneric: terms.shop_generic,
        client: terms.client,
        clientPlural: terms.client_plural,
        appointment: terms.appointment,
        appointmentPlural: terms.appointment_plural,
        newAppointment: terms.new_appointment,
        noProfessionals: terms.no_professionals,

        // Info tipo shop
        typeName: terms.type_name,
        typeDescription: terms.type_description,
    }), [shopType, terms]);

    return (
        <TerminologyContext.Provider value={value}>
            {children}
        </TerminologyContext.Provider>
    );
}

// ==========================================
// HOOK
// ==========================================

export function useTerminology(): TerminologyContextValue {
    const context = useContext(TerminologyContext);
    if (!context) {
        throw new Error('useTerminology must be used within TerminologyProvider');
    }
    return context;
}

/**
 * Hook alternativo che non lancia errore se usato fuori dal provider
 * Utile per componenti che potrebbero essere usati sia dentro che fuori dal context
 */
export function useTerminologyOptional(): TerminologyContextValue | null {
    return useContext(TerminologyContext);
}
