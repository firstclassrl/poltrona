import { useState, useEffect } from 'react';
import { API_CONFIG } from '@/config/api';
import { HairProfile } from '@/types/hairProfile';
import { useClientHairProfile } from './useClientHairProfile';
import { isColorService } from '@/utils/calculateDuration';

// Helper to get auth token
const getAuthToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
};

// Build headers for Supabase REST API
const buildHeaders = (): Record<string, string> => {
    const token = getAuthToken();
    const bearer = token || API_CONFIG.SUPABASE_ANON_KEY;

    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'apikey': API_CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${bearer}`,
    };
};

// ==========================================
// TIPI
// ==========================================

export type QuestionType = 'hair_type' | 'hair_length' | 'color_situation';

export interface QuestionnaireDecision {
    shouldShow: boolean;
    reason: 'disabled' | 'no_variable_services' | 'no_profile' | 'profile_outdated' | 'needs_color_info' | 'skip';
    existingProfile: HairProfile | null;
    questionsToAsk: QuestionType[];
}

interface Service {
    id: string;
    name: string;
    is_duration_variable?: boolean;
}

// ==========================================
// HOOK
// ==========================================

/**
 * Hook che decide se mostrare il questionario e quali domande fare
 */
export function useHairQuestionnaire(
    shopId: string | null,
    clientId: string | null,
    selectedServices: Service[]
): QuestionnaireDecision | null {
    const [decision, setDecision] = useState<QuestionnaireDecision | null>(null);
    const { profile, hasProfile, isProfileOutdated } = useClientHairProfile(clientId, shopId);

    useEffect(() => {
        async function checkQuestionnaire() {
            if (!shopId) {
                setDecision({ shouldShow: false, reason: 'disabled', existingProfile: null, questionsToAsk: [] });
                return;
            }

            if (!API_CONFIG.SUPABASE_EDGE_URL || !API_CONFIG.SUPABASE_ANON_KEY) {
                setDecision({ shouldShow: false, reason: 'disabled', existingProfile: null, questionsToAsk: [] });
                return;
            }

            try {
                // 1. Shop ha abilitato il questionario?
                const url = `${API_CONFIG.SUPABASE_EDGE_URL}/rest/v1/shops?select=hair_questionnaire_enabled,shop_type&id=eq.${shopId}&limit=1`;
                const response = await fetch(url, { headers: buildHeaders() });

                if (!response.ok) {
                    setDecision({ shouldShow: false, reason: 'disabled', existingProfile: null, questionsToAsk: [] });
                    return;
                }

                const shops = await response.json();
                const shop = shops && shops.length > 0 ? shops[0] : null;

                if (!shop?.hair_questionnaire_enabled || shop.shop_type !== 'hairdresser') {
                    setDecision({ shouldShow: false, reason: 'disabled', existingProfile: null, questionsToAsk: [] });
                    return;
                }

                // 2. Servizi selezionati richiedono durata variabile?
                const hasVariableServices = selectedServices.some(s => s.is_duration_variable);
                if (!hasVariableServices) {
                    setDecision({ shouldShow: false, reason: 'no_variable_services', existingProfile: profile, questionsToAsk: [] });
                    return;
                }

                // 3. Determina quali domande fare
                const questionsToAsk: QuestionType[] = [];

                // Nessun profilo → domande base
                if (!hasProfile) {
                    questionsToAsk.push('hair_type', 'hair_length');
                }
                // Profilo outdated → conferma
                else if (isProfileOutdated) {
                    questionsToAsk.push('hair_type', 'hair_length');
                }

                // 4. Servizi colore richiedono info aggiuntive
                const hasColorServiceSelected = selectedServices.some(s => isColorService(s.name));

                if (hasColorServiceSelected) {
                    questionsToAsk.push('color_situation');
                }

                // 5. Determina reason
                let reason: QuestionnaireDecision['reason'] = 'skip';
                if (!hasProfile) reason = 'no_profile';
                else if (isProfileOutdated) reason = 'profile_outdated';
                else if (questionsToAsk.length > 0) reason = 'needs_color_info';

                setDecision({
                    shouldShow: questionsToAsk.length > 0,
                    reason,
                    existingProfile: profile,
                    questionsToAsk
                });
            } catch (err) {
                console.error('Error checking questionnaire:', err);
                setDecision({ shouldShow: false, reason: 'disabled', existingProfile: null, questionsToAsk: [] });
            }
        }

        checkQuestionnaire();
    }, [shopId, clientId, selectedServices, profile, hasProfile, isProfileOutdated]);

    return decision;
}
