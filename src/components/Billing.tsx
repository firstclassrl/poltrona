import React from 'react';
import { CreditCard, Calendar, AlertCircle, CheckCircle, Clock, ExternalLink, Loader2 } from 'lucide-react';
import { useSubscription, STRIPE_PRICES } from '../contexts/SubscriptionContext';
import type { SubscriptionPlan } from '../types/subscription';

export const Billing: React.FC = () => {
    const {
        subscription,
        access,
        isLoading,
        error,
        createCheckoutSession,
        openCustomerPortal,
        refreshSubscription
    } = useSubscription();

    const [checkoutLoading, setCheckoutLoading] = React.useState<SubscriptionPlan | null>(null);
    const [portalLoading, setPortalLoading] = React.useState(false);

    const handleSubscribe = async (plan: SubscriptionPlan) => {
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

    const handleManageSubscription = async () => {
        setPortalLoading(true);
        try {
            const url = await openCustomerPortal();
            if (url) {
                window.location.href = url;
            }
        } finally {
            setPortalLoading(false);
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('it-IT', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    const getStatusBadge = () => {
        if (!access.status) return null;

        const statusConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
            active: { color: 'bg-green-100 text-green-800', label: 'Attivo', icon: <CheckCircle className="w-4 h-4" /> },
            trialing: { color: 'bg-blue-100 text-blue-800', label: 'Prova Gratuita', icon: <Clock className="w-4 h-4" /> },
            past_due: { color: 'bg-yellow-100 text-yellow-800', label: 'Pagamento in Ritardo', icon: <AlertCircle className="w-4 h-4" /> },
            canceled: { color: 'bg-gray-100 text-gray-800', label: 'Cancellato', icon: <AlertCircle className="w-4 h-4" /> },
            unpaid: { color: 'bg-red-100 text-red-800', label: 'Non Pagato', icon: <AlertCircle className="w-4 h-4" /> },
        };

        const config = statusConfig[access.status] || statusConfig.unpaid;

        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
                {config.icon}
                {config.label}
            </span>
        );
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Abbonamento</h1>
                <p className="text-gray-600 mt-1">Gestisci il tuo piano e la fatturazione</p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-red-800">{error}</p>
                </div>
            )}

            {/* Stato Abbonamento Corrente */}
            {subscription ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-8">
                    <div className="p-6 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900">Piano Corrente</h2>
                            {getStatusBadge()}
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <p className="text-sm text-gray-500">Piano</p>
                                    <p className="text-lg font-medium text-gray-900 capitalize">
                                        {subscription.plan === 'yearly' ? 'Annuale' : 'Mensile'}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-sm text-gray-500">Periodo Corrente</p>
                                    <p className="text-gray-900">
                                        {formatDate(subscription.current_period_start)} - {formatDate(subscription.current_period_end)}
                                    </p>
                                </div>

                                {access.daysRemaining !== null && (
                                    <div>
                                        <p className="text-sm text-gray-500">Giorni Rimanenti</p>
                                        <p className="text-lg font-medium text-gray-900">{access.daysRemaining}</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                {access.isTrialing && subscription.trial_end && (
                                    <div className="p-4 bg-blue-50 rounded-lg">
                                        <p className="text-sm text-blue-800">
                                            <strong>Prova gratuita</strong> fino al {formatDate(subscription.trial_end)}
                                        </p>
                                    </div>
                                )}

                                {access.cancelAtPeriodEnd && (
                                    <div className="p-4 bg-yellow-50 rounded-lg">
                                        <p className="text-sm text-yellow-800">
                                            <AlertCircle className="w-4 h-4 inline mr-1" />
                                            L'abbonamento terminerà il {formatDate(subscription.current_period_end)}
                                        </p>
                                    </div>
                                )}

                                <button
                                    onClick={handleManageSubscription}
                                    disabled={portalLoading}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                                >
                                    {portalLoading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            <ExternalLink className="w-5 h-5" />
                                            Gestisci Abbonamento
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Piani Disponibili */
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Scegli il tuo Piano</h2>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Piano Mensile */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:border-blue-300 transition-colors">
                            <div className="mb-4">
                                <h3 className="text-xl font-bold text-gray-900">Mensile</h3>
                                <p className="text-gray-600 text-sm">Flessibilità massima</p>
                            </div>

                            <div className="mb-6">
                                <span className="text-4xl font-bold text-gray-900">€29</span>
                                <span className="text-gray-600">/mese</span>
                            </div>

                            <ul className="space-y-3 mb-6">
                                <li className="flex items-center gap-2 text-gray-700">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                    Tutte le funzionalità
                                </li>
                                <li className="flex items-center gap-2 text-gray-700">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                    Supporto prioritario
                                </li>
                                <li className="flex items-center gap-2 text-gray-700">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                    Aggiornamenti inclusi
                                </li>
                            </ul>

                            <button
                                onClick={() => handleSubscribe('monthly')}
                                disabled={checkoutLoading !== null || !STRIPE_PRICES.monthly}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {checkoutLoading === 'monthly' ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <CreditCard className="w-5 h-5" />
                                        Abbonati Ora
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Piano Annuale */}
                        <div className="bg-white rounded-xl border-2 border-blue-500 shadow-sm p-6 relative">
                            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                                    RISPARMIA 17%
                                </span>
                            </div>

                            <div className="mb-4">
                                <h3 className="text-xl font-bold text-gray-900">Annuale</h3>
                                <p className="text-gray-600 text-sm">Miglior valore</p>
                            </div>

                            <div className="mb-6">
                                <span className="text-4xl font-bold text-gray-900">€290</span>
                                <span className="text-gray-600">/anno</span>
                                <p className="text-sm text-gray-500 mt-1">equivalente a €24/mese</p>
                            </div>

                            <ul className="space-y-3 mb-6">
                                <li className="flex items-center gap-2 text-gray-700">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                    Tutte le funzionalità
                                </li>
                                <li className="flex items-center gap-2 text-gray-700">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                    Supporto prioritario
                                </li>
                                <li className="flex items-center gap-2 text-gray-700">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                    Aggiornamenti inclusi
                                </li>
                                <li className="flex items-center gap-2 text-gray-700">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                    2 mesi gratis
                                </li>
                            </ul>

                            <button
                                onClick={() => handleSubscribe('yearly')}
                                disabled={checkoutLoading !== null || !STRIPE_PRICES.yearly}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {checkoutLoading === 'yearly' ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Calendar className="w-5 h-5" />
                                        Abbonati Annuale
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Info Pagamenti Sicuri */}
            <div className="text-center text-sm text-gray-500">
                <p className="flex items-center justify-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Pagamenti sicuri gestiti da Stripe
                </p>
            </div>
        </div>
    );
};
