// Subscription types for Stripe integration

export type SubscriptionStatus =
    | 'trialing'
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'unpaid'
    | 'incomplete'
    | 'incomplete_expired';

export type SubscriptionPlan = 'monthly' | 'yearly';

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

export interface ShopSubscription {
    id: string;
    shop_id: string;
    stripe_customer_id: string;
    stripe_subscription_id: string | null;
    status: SubscriptionStatus;
    plan: SubscriptionPlan | null;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    trial_end: string | null;
    created_at: string;
    updated_at: string;
}

export interface SubscriptionInvoice {
    id: string;
    shop_id: string;
    subscription_id: string | null;
    stripe_invoice_id: string;
    amount_cents: number;
    currency: string;
    status: InvoiceStatus;
    invoice_pdf: string | null;
    hosted_invoice_url: string | null;
    period_start: string | null;
    period_end: string | null;
    created_at: string;
}

// Helper type for subscription access check
export interface SubscriptionAccess {
    hasAccess: boolean;
    status: SubscriptionStatus | null;
    plan: SubscriptionPlan | null;
    isTrialing: boolean;
    daysRemaining: number | null;
    cancelAtPeriodEnd: boolean;
}

// Stripe price IDs - to be configured
export interface StripePriceConfig {
    monthly: string;
    yearly: string;
}
