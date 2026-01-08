import { useState, useEffect } from 'react';
import { API_CONFIG } from '@/config/api';
import type { Gender } from '@/config/terminology';

// Helper to get auth token
const getAuthToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
};

// Build headers for Supabase REST API
const buildHeaders = (authRequired: boolean = false): Record<string, string> => {
    const token = getAuthToken();
    const bearer = authRequired && token ? token : API_CONFIG.SUPABASE_ANON_KEY;

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

export interface VisitHistoryItem {
    id: string;
    date: string;
    services: Array<{
        name: string;
        duration_minutes: number;
        price: number;
    }>;
    staff_name: string;
    staff_gender: Gender;
    total_duration_minutes: number;
    status: 'completed' | 'no_show' | 'cancelled';
    notes?: string | null;
}

interface UseClientVisitHistoryResult {
    history: VisitHistoryItem[];
    loading: boolean;
    error: string | null;
    isEmpty: boolean;
}

// ==========================================
// HOOK
// ==========================================

/**
 * Hook per ottenere lo storico visite di un cliente
 * 
 * @param clientId - ID del cliente
 * @param shopId - ID dello shop
 * @param limit - Numero massimo di visite (default: 3)
 */
export function useClientVisitHistory(
    clientId: string | null,
    shopId: string | null,
    limit: number = 3
): UseClientVisitHistoryResult {
    const [history, setHistory] = useState<VisitHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!clientId || !shopId) {
            setHistory([]);
            setLoading(false);
            return;
        }

        if (!API_CONFIG.SUPABASE_EDGE_URL || !API_CONFIG.SUPABASE_ANON_KEY) {
            setHistory([]);
            setLoading(false);
            return;
        }

        async function fetchHistory() {
            setLoading(true);
            setError(null);

            try {
                // Query appuntamenti completati o no-show con join su staff e services
                const url = `${API_CONFIG.SUPABASE_EDGE_URL}/rest/v1/appointments?select=id,start_at,end_at,status,notes,staff:shop_staff(full_name,gender),services(id,name,duration_min,price_cents)&client_id=eq.${clientId}&shop_id=eq.${shopId}&status=in.(completed,no_show)&order=start_at.desc&limit=${limit}`;

                const response = await fetch(url, { headers: buildHeaders(true) });

                if (!response.ok) {
                    const errorText = await response.text();
                    setError(`Errore: ${response.status}`);
                    setLoading(false);
                    return;
                }

                const data = await response.json();

                if (data && Array.isArray(data)) {
                    const formatted: VisitHistoryItem[] = data.map((apt: any) => {
                        // Calcola durata totale da start/end
                        const start = new Date(apt.start_at);
                        const end = new Date(apt.end_at);
                        const durationMs = end.getTime() - start.getTime();
                        const durationMinutes = Math.round(durationMs / 60000);

                        // Formatta servizi
                        const services = apt.services ? [{
                            name: apt.services.name || 'Servizio',
                            duration_minutes: apt.services.duration_min || 0,
                            price: apt.services.price_cents ? apt.services.price_cents / 100 : 0
                        }] : [];

                        return {
                            id: apt.id,
                            date: apt.start_at,
                            services,
                            staff_name: apt.staff?.full_name || 'N/A',
                            staff_gender: apt.staff?.gender || 'neutral',
                            total_duration_minutes: durationMinutes,
                            status: apt.status as 'completed' | 'no_show',
                            notes: apt.notes
                        };
                    });

                    setHistory(formatted);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Errore sconosciuto');
            } finally {
                setLoading(false);
            }
        }

        fetchHistory();
    }, [clientId, shopId, limit]);

    return {
        history,
        loading,
        error,
        isEmpty: history.length === 0
    };
}
