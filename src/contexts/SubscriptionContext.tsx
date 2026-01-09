import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useShop } from './ShopContext';
import { API_CONFIG, API_ENDPOINTS } from '../config/api';
import type { ShopSubscription, SubscriptionAccess, SubscriptionPlan } from '../types/subscription';

// Prezzi Stripe per tipologia negozio
// basic: Barbiere + Estetista (€49.99/mese, fatturato ogni 6 mesi = €299.94)
// pro: Parrucchiere (€99.99/mese, fatturato ogni 6 mesi = €599.94)
export const STRIPE_PRICES = {
    basic: import.meta.env.VITE_STRIPE_PRICE_BASIC || '',   // Barbiere, Estetista
    pro: import.meta.env.VITE_STRIPE_PRICE_PRO || '',       // Parrucchiere
};

// Mappatura shop_type → price tier
export type PriceTier = 'basic' | 'pro';
export const SHOP_TYPE_PRICE_MAP: Record<string, PriceTier> = {
    barbershop: 'basic',
    beauty_salon: 'basic',
    hairdresser: 'pro',
};

// Info prezzi per UI
export const PRICE_INFO: Record<PriceTier, { monthly: number; billing: number; period: number }> = {
    basic: { monthly: 49.99, billing: 299.94, period: 6 },
    pro: { monthly: 99.99, billing: 599.94, period: 6 },
};

interface SubscriptionContextValue {
    subscription: ShopSubscription | null;
    access: SubscriptionAccess;
    isLoading: boolean;
    error: string | null;
    createCheckoutSession: (plan: SubscriptionPlan) => Promise<string | null>;
    openCustomerPortal: () => Promise<string | null>;
    refreshSubscription: () => Promise<void>;
}

const defaultAccess: SubscriptionAccess = {
    hasAccess: true, // Default to true so app doesn't block during loading
    status: null,
    plan: null,
    isTrialing: false,
    daysRemaining: null,
    cancelAtPeriodEnd: false,
};

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

interface SubscriptionProviderProps {
    children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
    const { user, isAuthenticated } = useAuth();
    const { currentShopId, currentShop } = useShop();
    const [subscription, setSubscription] = useState<ShopSubscription | null>(null);
    const [access, setAccess] = useState<SubscriptionAccess>(defaultAccess);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const getAuthHeaders = useCallback(() => {
        // Fix: AuthContext usa 'auth_token', non 'access_token'
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        return {
            'Content-Type': 'application/json',
            'apikey': API_CONFIG.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${token}`,
        };
    }, []);

    // Calcola l'accesso basato sulla subscription
    const calculateAccess = useCallback((sub: ShopSubscription | null): SubscriptionAccess => {
        if (!sub) {
            return {
                hasAccess: false,
                status: null,
                plan: null,
                isTrialing: false,
                daysRemaining: null,
                cancelAtPeriodEnd: false,
            };
        }

        const now = new Date();
        let endDate: Date | null = null;
        let daysRemaining: number | null = null;

        if (sub.status === 'trialing' && sub.trial_end) {
            endDate = new Date(sub.trial_end);
        } else if (sub.current_period_end) {
            endDate = new Date(sub.current_period_end);
        }

        if (endDate) {
            daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }

        // Determina se ha accesso
        const hasAccess = ['active', 'trialing', 'past_due'].includes(sub.status) &&
            (daysRemaining === null || daysRemaining >= 0);

        return {
            hasAccess,
            status: sub.status,
            plan: sub.plan,
            isTrialing: sub.status === 'trialing',
            daysRemaining,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
        };
    }, []);

    // Carica subscription
    const loadSubscription = useCallback(async () => {
        if (!isAuthenticated || !currentShopId) {
            setSubscription(null);
            setAccess(defaultAccess);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `${API_ENDPOINTS.SUBSCRIPTIONS}?shop_id=eq.${currentShopId}&select=*`,
                { headers: getAuthHeaders() }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch subscription');
            }

            const data = await response.json();
            const sub = data.length > 0 ? data[0] : null;

            setSubscription(sub);
            setAccess(calculateAccess(sub));
        } catch (err) {
            console.error('Error loading subscription:', err);
            setError(err instanceof Error ? err.message : 'Error loading subscription');
            // In caso di errore, consenti accesso (fail-open per non bloccare)
            setAccess({ ...defaultAccess, hasAccess: true });
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated, currentShopId, getAuthHeaders, calculateAccess]);

    useEffect(() => {
        void loadSubscription();
    }, [loadSubscription]);

    // Crea sessione checkout per nuovo abbonamento
    const createCheckoutSession = useCallback(async (plan: SubscriptionPlan): Promise<string | null> => {
        if (!currentShopId) {
            setError('No shop selected');
            return null;
        }

        // Determina il prezzo basato sul tipo di negozio
        const shopType = currentShop?.shop_type || 'barbershop';
        const priceTier = SHOP_TYPE_PRICE_MAP[shopType] || 'basic';
        const priceId = STRIPE_PRICES[priceTier];

        console.log('Creating checkout session:', { shopType, priceTier, priceId });

        if (!priceId) {
            console.error(`Stripe price not configured for ${priceTier} tier`);
            setError('Stripe price not configured');
            return null;
        }

        try {
            console.log('Sending request to:', API_ENDPOINTS.CREATE_CHECKOUT_SESSION);
            const response = await fetch(API_ENDPOINTS.CREATE_CHECKOUT_SESSION, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    shop_id: currentShopId,
                    price_id: priceId,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Checkout session creation failed:', errorData);
                throw new Error(errorData.error || 'Failed to create checkout session');
            }

            const { url } = await response.json();
            console.log('Checkout session created:', url);
            return url;
        } catch (err) {
            console.error('Error creating checkout session:', err);
            setError(err instanceof Error ? err.message : 'Error creating checkout');
            return null;
        }
    }, [currentShopId, currentShop, getAuthHeaders]);

    // Apri Customer Portal per gestire abbonamento
    const openCustomerPortal = useCallback(async (): Promise<string | null> => {
        if (!currentShopId) {
            setError('No shop selected');
            return null;
        }

        try {
            const response = await fetch(API_ENDPOINTS.CREATE_PORTAL_SESSION, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    shop_id: currentShopId,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create portal session');
            }

            const { url } = await response.json();
            return url;
        } catch (err) {
            console.error('Error creating portal session:', err);
            setError(err instanceof Error ? err.message : 'Error opening portal');
            return null;
        }
    }, [currentShopId, getAuthHeaders]);

    const value: SubscriptionContextValue = {
        subscription,
        access,
        isLoading,
        error,
        createCheckoutSession,
        openCustomerPortal,
        refreshSubscription: loadSubscription,
    };

    return (
        <SubscriptionContext.Provider value={value}>
            {children}
        </SubscriptionContext.Provider>
    );
};

export const useSubscription = (): SubscriptionContextValue => {
    const ctx = useContext(SubscriptionContext);
    if (!ctx) {
        throw new Error('useSubscription must be used within a SubscriptionProvider');
    }
    return ctx;
};
