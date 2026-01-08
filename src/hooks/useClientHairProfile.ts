import { useState, useEffect, useCallback } from 'react';
import { API_CONFIG } from '@/config/api';
import { HairProfile } from '@/types/hairProfile';

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

interface UseClientHairProfileResult {
    profile: HairProfile | null;
    loading: boolean;
    error: string | null;
    hasProfile: boolean;
    isProfileOutdated: boolean;
    saveProfile: (data: Partial<HairProfile>) => Promise<{ data?: HairProfile; error?: string }>;
    refetch: () => void;
}

/**
 * Hook per gestire il profilo capelli di un cliente
 * 
 * @param clientId - ID del cliente
 * @param shopId - ID dello shop
 */
export function useClientHairProfile(
    clientId: string | null,
    shopId: string | null
): UseClientHairProfileResult {
    const [profile, setProfile] = useState<HairProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch profilo
    const fetchProfile = useCallback(async () => {
        if (!clientId || !shopId) {
            setProfile(null);
            setLoading(false);
            return;
        }

        if (!API_CONFIG.SUPABASE_EDGE_URL || !API_CONFIG.SUPABASE_ANON_KEY) {
            setProfile(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const url = `${API_CONFIG.SUPABASE_EDGE_URL}/rest/v1/client_hair_profiles?client_id=eq.${clientId}&shop_id=eq.${shopId}&limit=1`;
            const response = await fetch(url, { headers: buildHeaders(true) });

            if (response.ok) {
                const data = await response.json();
                setProfile(data && data.length > 0 ? data[0] : null);
            } else if (response.status === 404 || response.status === 406) {
                // Table might not exist yet or no row found
                setProfile(null);
            } else {
                const errorText = await response.text();
                if (!errorText.includes('PGRST116')) {
                    setError(`Errore: ${response.status}`);
                }
                setProfile(null);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore sconosciuto');
        } finally {
            setLoading(false);
        }
    }, [clientId, shopId]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    // Controlla se profilo è outdated (>6 mesi)
    const isProfileOutdated = (() => {
        if (!profile?.updated_at) return false;
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        return new Date(profile.updated_at) < sixMonthsAgo;
    })();

    // Salva/Aggiorna profilo
    const saveProfile = async (profileData: Partial<HairProfile>) => {
        if (!clientId || !shopId) {
            return { error: 'Missing client or shop ID' };
        }

        if (!API_CONFIG.SUPABASE_EDGE_URL || !API_CONFIG.SUPABASE_ANON_KEY) {
            return { error: 'Supabase not configured' };
        }

        try {
            const payload = {
                client_id: clientId,
                shop_id: shopId,
                ...profileData,
                updated_at: new Date().toISOString()
            };

            // Use upsert via POST with resolution on conflict
            const url = `${API_CONFIG.SUPABASE_EDGE_URL}/rest/v1/client_hair_profiles`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    ...buildHeaders(true),
                    'Prefer': 'return=representation,resolution=merge-duplicates'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                return { error: `Errore salvataggio: ${errorText}` };
            }

            const data = await response.json();
            const savedProfile = data && data.length > 0 ? data[0] : null;
            setProfile(savedProfile);
            return { data: savedProfile };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Errore durante il salvataggio' };
        }
    };

    return {
        profile,
        loading,
        error,
        hasProfile: !!(profile?.hair_type && profile?.hair_length),
        isProfileOutdated,
        saveProfile,
        refetch: fetchProfile
    };
}
