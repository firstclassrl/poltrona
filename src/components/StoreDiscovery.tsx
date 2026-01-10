import React, { useState, useEffect, useMemo } from 'react';
import { Search, MapPin, Phone, ChevronRight, Navigation, Scissors } from 'lucide-react';
import { Card } from './ui/Card';
import { apiService } from '../services/api';
import type { Shop } from '../types';
import { APP_VERSION } from '../config/version';

interface StoreDiscoveryProps {
    onSelectStore: (slug: string) => void;
}

export const StoreDiscovery: React.FC<StoreDiscoveryProps> = ({ onSelectStore }) => {
    const [shops, setShops] = useState<Shop[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProvince, setSelectedProvince] = useState<string>('');
    const [isLocating, setIsLocating] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Carica tutti i negozi disponibili
    useEffect(() => {
        const loadShops = async () => {
            try {
                const allShops = await apiService.getPublicShops();
                setShops(allShops);
            } catch (error) {
                console.error('Errore caricamento negozi:', error);
            }
        };

        void loadShops();
    }, []);

    // Estrai province uniche per il filtro
    const provinces = useMemo(() => {
        const uniqueProvinces = new Set<string>();
        shops.forEach(shop => {
            if (shop.province) {
                uniqueProvinces.add(shop.province);
            }
        });
        return Array.from(uniqueProvinces).sort();
    }, [shops]);

    // Filtra negozi in base alla ricerca - solo se l'utente ha cercato
    const filteredShops = useMemo(() => {
        if (!hasSearched) return [];

        return shops.filter(shop => {
            const matchesSearch = !searchQuery ||
                shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                shop.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                shop.address?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesProvince = !selectedProvince || shop.province === selectedProvince;

            return matchesSearch && matchesProvince;
        });
    }, [shops, searchQuery, selectedProvince, hasSearched]);

    // Gestione ricerca
    const handleSearch = () => {
        if (searchQuery.trim() || selectedProvince) {
            setHasSearched(true);
            setIsLoading(true);
            // Simula un piccolo delay per mostrare il loading
            setTimeout(() => setIsLoading(false), 300);
        }
    };

    // Gestione pressione Enter
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    // Geolocalizzazione
    const handleGeolocation = () => {
        if (!navigator.geolocation) {
            alert('La geolocalizzazione non è supportata dal tuo browser');
            return;
        }

        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    // Usa reverse geocoding per ottenere la città
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}&zoom=10&addressdetails=1`
                    );
                    const data = await response.json();
                    const city = data.address?.city || data.address?.town || data.address?.village || '';
                    const province = data.address?.county || data.address?.state || '';

                    if (city) {
                        setSearchQuery(city);
                    }
                    if (province) {
                        // Cerca se la provincia esiste nei nostri shop
                        const matchingProvince = provinces.find(p =>
                            province.toLowerCase().includes(p.toLowerCase()) ||
                            p.toLowerCase().includes(province.toLowerCase())
                        );
                        if (matchingProvince) {
                            setSelectedProvince(matchingProvince);
                        }
                    }
                    // Avvia la ricerca automaticamente dopo la geolocalizzazione
                    setHasSearched(true);
                } catch (error) {
                    console.error('Errore geocoding:', error);
                } finally {
                    setIsLocating(false);
                }
            },
            (error) => {
                console.error('Errore geolocalizzazione:', error);
                setIsLocating(false);
                alert('Impossibile ottenere la tua posizione. Assicurati di aver concesso i permessi.');
            }
        );
    };

    const handleSelectStore = (shop: Shop) => {
        if (shop.slug) {
            window.location.href = `/${shop.slug}`;
        }
    };

    // Pattern ID per lo sfondo (stile Aurora)
    const patternId = 'aurora-discovery-pattern';

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden animate-fadeIn"
            style={{
                background: 'linear-gradient(135deg, #f7fbff 0%, #c8e4ff 40%, #c7c5ff 100%)',
                animation: 'fadeIn 0.8s ease-out forwards'
            }}
        >
            {/* Grain texture */}
            <div className="login-grain"></div>

            {/* Pattern di sfondo Aurora */}
            <div className="absolute inset-0 opacity-10">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id={patternId} x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
                            <line x1="0" y1="0" x2="60" y2="60" stroke="#ffffff" strokeWidth="2" />
                            <line x1="60" y1="0" x2="0" y2="60" stroke="#ffffff" strokeWidth="2" />
                            <circle cx="30" cy="30" r="3" fill="#ffffff" />
                            <circle cx="0" cy="0" r="2" fill="#ffffff" />
                            <circle cx="60" cy="60" r="2" fill="#ffffff" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill={`url(#${patternId})`} />
                </svg>
            </div>

            {/* Overlay sfumato */}
            <div
                className="absolute inset-0"
                style={{
                    background: 'linear-gradient(to top, rgba(91, 124, 255, 0.15), transparent, rgba(155, 123, 255, 0.15))'
                }}
            ></div>

            {/* Titolo grande fuori dalla card */}
            <h1
                className="text-center mb-4 relative z-10 font-semibold tracking-tight"
                style={{
                    fontSize: 'clamp(1.75rem, 5vw, 3rem)',
                    color: '#1e3a5f',
                    textShadow: '0 2px 20px rgba(30, 58, 95, 0.15)',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    letterSpacing: '-0.02em',
                    animation: 'fadeInUp 0.6s ease-out 0.2s both'
                }}
            >
                Benvenuti in Poltrona
            </h1>

            {/* Divisore decorativo */}
            <div
                className="relative z-10 mb-8 flex items-center justify-center gap-3"
                style={{ animation: 'fadeIn 0.6s ease-out 0.4s both' }}
            >
                <div className="h-px w-12 bg-gradient-to-r from-transparent to-blue-400/60"></div>
                <div className="w-2 h-2 rounded-full bg-blue-500/50"></div>
                <div className="h-px w-12 bg-gradient-to-l from-transparent to-blue-400/60"></div>
            </div>

            {/* Card principale - Glassmorphism potenziato */}
            <Card
                className="w-full max-w-md p-8 relative z-10 login-card-glass"
                style={{
                    background: 'rgba(255, 255, 255, 0.35)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.5)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.3) inset',
                    borderRadius: '24px',
                    animation: 'fadeInUp 0.6s ease-out 0.3s both'
                }}
            >
                {/* Header con logo */}
                <div className="text-center mb-8">
                    <div
                        className="w-28 h-28 mx-auto mb-4 rounded-full overflow-hidden"
                        style={{
                            boxShadow: '0 10px 40px rgba(0, 100, 200, 0.2)'
                        }}
                    >
                        <img
                            src="/marchio abruzzo.ai vetro.png"
                            alt="Abruzzo.AI"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.parentElement!.innerHTML = '<div class="w-full h-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center"><svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg></div>';
                            }}
                        />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">Trova il tuo Shop!</h2>
                </div>

                {/* Campo di ricerca */}
                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Nome o città..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="w-full pl-12 pr-4 py-3 bg-white/70 border border-white/50 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all"
                        />
                    </div>

                    {/* Select provincia */}
                    {provinces.length > 0 && (
                        <select
                            value={selectedProvince}
                            onChange={(e) => setSelectedProvince(e.target.value)}
                            className="w-full px-4 py-3 bg-white/70 border border-white/50 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400/50 appearance-none cursor-pointer"
                        >
                            <option value="">Tutte le province</option>
                            {provinces.map(province => (
                                <option key={province} value={province}>
                                    {province}
                                </option>
                            ))}
                        </select>
                    )}

                    {/* Pulsanti azione */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleSearch}
                            disabled={!searchQuery.trim() && !selectedProvince}
                            className="flex-1 flex items-center justify-center space-x-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all duration-300 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Search className="w-5 h-5" />
                            <span>Cerca</span>
                        </button>

                        <button
                            onClick={handleGeolocation}
                            disabled={isLocating}
                            className="flex items-center justify-center px-4 py-3 bg-white/60 hover:bg-white/80 border border-white/40 text-slate-700 font-medium rounded-xl transition-all duration-300"
                            title="Usa la tua posizione"
                        >
                            {isLocating ? (
                                <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Navigation className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Risultati ricerca */}
                {hasSearched && (
                    <div className="mt-6 space-y-3 max-h-64 overflow-y-auto">
                        {isLoading ? (
                            <div className="text-center py-4">
                                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                <p className="text-slate-500 text-sm">Ricerca in corso...</p>
                            </div>
                        ) : filteredShops.length === 0 ? (
                            <div className="text-center py-4">
                                <p className="text-slate-500">Nessun negozio trovato</p>
                                <p className="text-slate-400 text-sm mt-1">Prova con altri criteri di ricerca</p>
                            </div>
                        ) : (
                            filteredShops.map((shop) => (
                                <ShopResultItem
                                    key={shop.id}
                                    shop={shop}
                                    onSelect={() => handleSelectStore(shop)}
                                />
                            ))
                        )}
                    </div>
                )}
            </Card>

            {/* Footer */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-center text-slate-500/70 text-sm z-10">
                <img
                    src="/logo Poltrona 2025.png"
                    alt="Poltrona"
                    className="w-8 h-8 mx-auto mb-1 object-contain"
                />
                <p>Poltrona v{APP_VERSION}</p>
                <p>Copyright 2025 www.abruzzo.ai</p>
            </div>
        </div>
    );
};

// Componente per ogni risultato di ricerca
interface ShopResultItemProps {
    shop: Shop;
    onSelect: () => void;
}

const ShopResultItem: React.FC<ShopResultItemProps> = ({ shop, onSelect }) => {
    return (
        <button
            onClick={onSelect}
            className="w-full flex items-center p-3 bg-white/50 hover:bg-white/70 border border-white/40 rounded-xl transition-all duration-200 group text-left"
        >
            {/* Logo/Avatar */}
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-400/30 to-indigo-400/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {shop.logo_url ? (
                    <img
                        src={shop.logo_url}
                        alt={shop.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <Scissors className="w-5 h-5 text-purple-600/60" />
                )}
            </div>

            {/* Info */}
            <div className="flex-1 ml-3 min-w-0">
                <h3 className="font-semibold text-slate-800 truncate">{shop.name}</h3>
                {(shop.city || shop.address) && (
                    <div className="flex items-center text-slate-500 text-sm truncate">
                        <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                        <span className="truncate">{[shop.city, shop.province].filter(Boolean).join(', ')}</span>
                    </div>
                )}
            </div>

            {/* Freccia */}
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-purple-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
        </button>
    );
};

export default StoreDiscovery;
