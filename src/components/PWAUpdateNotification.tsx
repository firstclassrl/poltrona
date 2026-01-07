import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X, Loader2 } from 'lucide-react';

export const PWAUpdateNotification: React.FC = () => {
  const [isUpdating, setIsUpdating] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error: any) {
      console.log('SW registration error', error);
    },
  });

  const handleUpdate = () => {
    if (isUpdating) return; // Previene click multipli

    setIsUpdating(true);
    console.log('[PWA] Starting update - forcing hard reload...');

    // Esegui tutto in modo sincrono e aggressivo
    // Non aspettiamo updateServiceWorker perché sembra non funzionare

    // Funzione che forza il reload
    const forceReload = async () => {
      try {
        // 1. Cancella TUTTE le cache
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          console.log('[PWA] Deleting caches:', cacheNames);
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        }

        // 2. Unregister TUTTI i service workers
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          console.log('[PWA] Unregistering SWs:', registrations.length);
          await Promise.all(registrations.map(r => r.unregister()));
        }

        // 3. Forza hard reload
        console.log('[PWA] Forcing hard reload...');
        // Usa replace per non lasciare entry nella history
        window.location.replace(window.location.origin + window.location.pathname + '?v=' + Date.now());
      } catch (error) {
        console.error('[PWA] Error during update:', error);
        // Fallback: reload semplice
        window.location.reload();
      }
    };

    // Esegui immediatamente
    forceReload();
  };

  const handleDismiss = () => {
    if (isUpdating) return; // Non permettere dismiss durante update
    setNeedRefresh(false);
  };

  if (!needRefresh) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
      <div className="bg-gradient-to-br from-blue-600 to-purple-700 backdrop-blur-xl rounded-2xl p-4 shadow-2xl border border-blue-500/50">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-white animate-spin-slow" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-sm mb-1">
              Aggiornamento disponibile
            </h3>
            <p className="text-white/90 text-xs mb-3">
              Una nuova versione dell'app è disponibile. Aggiorna per ottenere le ultime funzionalità.
            </p>
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className={`w-full font-medium py-2 px-4 rounded-lg text-sm transition-all duration-200 shadow-lg flex items-center justify-center gap-2 ${isUpdating
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-white hover:bg-gray-100 text-blue-600'
                }`}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Aggiornamento in corso...
                </>
              ) : (
                'Aggiorna ora'
              )}
            </button>
          </div>
          <button
            onClick={handleDismiss}
            disabled={isUpdating}
            className={`flex-shrink-0 transition-colors ${isUpdating
              ? 'text-white/40 cursor-not-allowed'
              : 'text-white/80 hover:text-white'
              }`}
            aria-label="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
