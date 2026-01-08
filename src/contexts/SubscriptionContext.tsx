import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useShop } from './ShopContext';
import { API_CONFIG, API_ENDPOINTS } from '../config/api';
import type { ShopSubscription, SubscriptionAccess, SubscriptionPlan } from '../types/subscription';

// Configurazione prezzi Stripe - DA AGGIORNARE con i tuoi price IDs
export const STRIPE_PRICES = {
    monthly: import.meta.env.VITE_STRIPE_PRICE_MONTHLY || '',
    yearly: import.meta.env.VITE_STRIPE_PRICE_YEARLY || '',
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
    const { currentShopId } = useShop();
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

        const priceId = plan === 'yearly' ? STRIPE_PRICES.yearly : STRIPE_PRICES.monthly;

        if (!priceId) {
            setError('Stripe price not configured');
            return null;
        }

        try {
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
                throw new Error(errorData.error || 'Failed to create checkout session');
            }

            const { url } = await response.json();
            return url;
        } catch (err) {
            console.error('Error creating checkout session:', err);
            setError(err instanceof Error ? err.message : 'Error creating checkout');
            return null;
        }
    }, [currentShopId, getAuthHeaders]);

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
