import React from 'react';
import { Lock, CreditCard, Calendar, CheckCircle, Loader2 } from 'lucide-react';
import { useSubscription, STRIPE_PRICES } from '../contexts/SubscriptionContext';
import type { SubscriptionPlan } from '../types/subscription';

interface PaywallProps {
    children: React.ReactNode;
}

export const Paywall: React.FC<PaywallProps> = ({ children }) => {
    const { access, isLoading, createCheckoutSession } = useSubscription();
    const [checkoutLoading, setCheckoutLoading] = React.useState<SubscriptionPlan | null>(null);

    React.useEffect(() => {
        console.log('Paywall Render Debug:', {
            checkoutLoading,
            stripePrices: STRIPE_PRICES,
            monthlyPrice: STRIPE_PRICES.monthly,
            isDisabled: checkoutLoading !== null || !STRIPE_PRICES.monthly
        });
    }, [checkoutLoading]);

    const handleSubscribe = async (plan: SubscriptionPlan) => {
        console.log('Button clicked for plan:', plan);
        console.log('Checkout Loading:', checkoutLoading);
        console.log('Stripe Prices:', STRIPE_PRICES);

        setCheckoutLoading(plan);
        try {
            const url = await createCheckoutSession(plan);
            if (url) {
                window.location.href = url;
            }
        } finally {
            setCheckoutLoading(null);
        }
    };

    // Durante il caricamento, mostra i children (fail-open)
    if (isLoading) {
        return <>{children}</>;
    }

    // Se ha accesso, mostra i children
    if (access.hasAccess) {
        return <>{children}</>;
    }

    // Altrimenti mostra il paywall
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }} />
            </div>

            <div className="relative max-w-lg w-full mx-4">
                {/* Card Glass */}
                <div className="backdrop-blur-xl bg-white/10 rounded-3xl border border-white/20 shadow-2xl p-8 md:p-12">
                    {/* Lock Icon */}
                    <div className="flex justify-center mb-6">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                            <Lock className="w-10 h-10 text-white" />
                        </div>
                    </div>

                    {/* Title */}
                    <h1 className="text-3xl font-bold text-white text-center mb-3">
                        Abbonamento Richiesto
                    </h1>

                    <p className="text-blue-200 text-center mb-8">
                        Per continuare ad utilizzare l'app, attiva il tuo abbonamento
                    </p>

                    {/* Features */}
                    <div className="space-y-3 mb-8">
                        {[
                            'Gestione appuntamenti illimitata',
                            'Calendario e prenotazioni online',
                            'Notifiche WhatsApp automatiche',
                            'Statistiche e report avanzati',
                            'Supporto prioritario'
                        ].map((feature, index) => (
                            <div key={index} className="flex items-center gap-3 text-white/90">
                                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                                <span>{feature}</span>
                            </div>
                        ))}
                    </div>

                    {/* Pricing Buttons */}
                    <button
                        onClick={() => handleSubscribe('monthly')}
                        disabled={checkoutLoading !== null || !STRIPE_PRICES.monthly}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-500 hover:to-purple-500 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:transform-none shadow-lg"
                    >
                        {checkoutLoading === 'monthly' ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <CreditCard className="w-5 h-5" />
                                <span>Mensile - €99/mese</span>
                            </>
                        )}
                    </button>


                    {/* Secure Payment Notice */}
                    <p className="text-center text-white/50 text-sm mt-6 flex items-center justify-center gap-2">
                        <Lock className="w-4 h-4" />
                        Pagamento sicuro con Stripe
                    </p>
                </div>
            </div>
        </div >
    );
};
