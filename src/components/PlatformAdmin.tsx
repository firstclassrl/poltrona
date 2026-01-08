import React, { useState } from 'react';
import { API_ENDPOINTS, API_CONFIG } from '../config/api';

export const PlatformAdmin = () => {
    const [secret, setSecret] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [inviteUrl, setInviteUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Semplice protezione per evitare accessi accidentali
    // In produzione dovrebbe essere gestito da auth reale, ma per dev tool va bene
    const DEV_SECRET = 'dev';

    const login = (e: React.FormEvent) => {
        e.preventDefault();
        if (secret === DEV_SECRET) {
            setIsAuthenticated(true);
            setError(null);
        } else {
            setError('Password errata');
        }
    };

    const generateInvite = async () => {
        setLoading(true);
        setError(null);
        try {
            // Genera token casuale (32 chars hex)
            const array = new Uint8Array(16);
            window.crypto.getRandomValues(array);
            const token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');

            // Scadenza: 7 giorni da ora
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);

            const response = await fetch(API_ENDPOINTS.SHOP_INVITES, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': API_CONFIG.SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${API_CONFIG.SUPABASE_ANON_KEY}`,
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({
                    token: token,
                    expires_at: expiresAt.toISOString()
                })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Errore API: ${response.status} ${text}`);
            }

            const data = await response.json();
            const baseUrl = window.location.origin;
            const newToken = data[0]?.token || token; // Fallback se la risposta è diversa

            setInviteUrl(`${baseUrl}/setup?token=${newToken}`);

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Errore sconosciuto');
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
                    <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">🛠️ Platform Admin</h1>
                    <form onSubmit={login} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Access Key</label>
                            <input
                                type="password"
                                value={secret}
                                onChange={e => setSecret(e.target.value)}
                                placeholder="Enter secret key..."
                                className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                autoFocus
                            />
                        </div>
                        {error && <div className="text-red-500 text-sm">{error}</div>}
                        <button
                            type="submit"
                            className="w-full bg-gray-900 text-white p-3 rounded-lg hover:bg-black transition-colors font-medium"
                        >
                            Accedi
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6 md:p-12">
            <div className="max-w-3xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">🛠️ Admin Tools</h1>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="text-gray-500 hover:text-gray-900"
                    >
                        Torna alla App
                    </button>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl text-2xl">🏪</div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Nuovo Negozio</h2>
                            <p className="text-gray-500 mt-1">
                                Genera un link di invito univoco per l'onboarding di un nuovo shop.
                                Il link scade tra 7 giorni.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={generateInvite}
                        disabled={loading}
                        className="w-full md:w-auto bg-[#1e40af] text-white px-6 py-3 rounded-xl hover:bg-blue-800 disabled:opacity-50 transition-all font-medium shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <span className="animate-spin">⏳</span> Generazione in corso...
                            </>
                        ) : (
                            <>✨ Genera Link Invito</>
                        )}
                    </button>

                    {error && (
                        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                            <strong>Errore:</strong> {error}
                        </div>
                    )}

                    {inviteUrl && (
                        <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-2xl animate-in fade-in slide-in-from-bottom-4">
                            <label className="block text-sm font-bold text-green-800 mb-2">✅ Link Generato con Successo</label>
                            <div className="flex flex-col md:flex-row gap-3">
                                <input
                                    readOnly
                                    value={inviteUrl}
                                    className="flex-1 p-3 border border-green-200 rounded-lg bg-white text-sm font-mono text-gray-600 focus:ring-2 focus:ring-green-500 outline-none"
                                    onClick={e => e.currentTarget.select()}
                                />
                                <a
                                    href={inviteUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-medium text-center shadow-lg shadow-green-900/20 transition-all"
                                >
                                    Apri Link ↗
                                </a>
                            </div>
                            <p className="text-xs text-green-700 mt-3 opacity-80">
                                Copia questo link e invialo al gestore del negozio, oppure aprilo per testare l'onboarding.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
