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
                        <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4">

                            {/* STEP 1: Link */}
                            <div className="p-6 bg-green-50 border border-green-200 rounded-2xl">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="bg-green-100 text-green-700 w-8 h-8 rounded-full flex items-center justify-center font-bold">1</div>
                                    <h3 className="font-bold text-green-900">Link di Registrazione</h3>
                                </div>
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
                                        className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-medium text-center shadow-lg shadow-green-900/20 transition-all flex items-center justify-center gap-2"
                                    >
                                        Apri & Registrati ↗
                                    </a>
                                </div>
                                <p className="text-xs text-green-700 mt-3 opacity-80 pl-11">
                                    Apri il link, completa la prima schermata e **registrati con una email**. Poi torna qui.
                                </p>
                            </div>

                            {/* STEP 2: SQL Upgrade */}
                            <AdminPromotionStep />

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const AdminPromotionStep = () => {
    const [email, setEmail] = useState('');
    const [copied, setCopied] = useState(false);

    const sqlScript = `-- STEP 3: Esegui questo script nel SQL Editor di Supabase
UPDATE public.profiles
SET role = 'owner'
WHERE email = '${email || 'LA_TUA_EMAIL'}';

-- Verifica
SELECT email, role FROM public.profiles WHERE email = '${email || 'LA_TUA_EMAIL'}';`;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(sqlScript);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="p-6 bg-blue-50 border border-blue-200 rounded-2xl">
            <div className="flex items-center gap-3 mb-4">
                <div className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center font-bold">2</div>
                <h3 className="font-bold text-blue-900">Sblocco Admin (SQL)</h3>
            </div>

            <p className="text-sm text-blue-800 mb-4 pl-11">
                Dopo esserti registrato, inserisci qui la tua email per generare il codice SQL necessario a sbloccare i permessi di Owner.
            </p>

            <div className="pl-11 space-y-4">
                <input
                    type="email"
                    placeholder="Inserisci la mail usata per registrarti..."
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full p-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />

                <div className="relative group">
                    <pre className="bg-slate-800 text-blue-50 p-4 rounded-lg text-xs overflow-x-auto font-mono">
                        {sqlScript}
                    </pre>
                    <button
                        onClick={copyToClipboard}
                        className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded text-xs transition-colors backdrop-blur-sm"
                    >
                        {copied ? 'Copiato! ✨' : 'Copia SQL'}
                    </button>
                </div>

                <p className="text-xs text-blue-700 opacity-80">
                    Incolla ed esegui questo codice nella Dashboard di Supabase SQL Editor.
                    Poi torna nel Wizard e ricarica la pagina.
                </p>
            </div>
        </div>
    );
};
