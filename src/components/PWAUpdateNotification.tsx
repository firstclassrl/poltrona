import { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';

export const PWAUpdateNotification: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);

        // Controlla se c'è un service worker in attesa
        if (reg.waiting) {
          setUpdateAvailable(true);
        }

        // Ascolta per nuovi service worker
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && reg.waiting) {
                setUpdateAvailable(true);
              }
            });
          }
        });
      });

      // Ascolta messaggi dal service worker
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);

    // Helper force reload
    const forceReload = () => {
      // Clear any caches if possible (optional but safe)
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => {
            // Optional: Strategically delete only if needed, but for now just reload
          });
        });
      }
      window.location.reload();
    };

    if (registration?.waiting) {
      // Invia messaggio al service worker per saltare l'attesa
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });

      // Timeout di sicurezza: se il reload non avviene entro 300ms, forza il reload
      const reloadTimeout = setTimeout(forceReload, 300);

      // Pulisci il timeout se il controllerchange viene attivato prima
      const controllerChangeHandler = () => {
        clearTimeout(reloadTimeout);
        forceReload();
      };

      navigator.serviceWorker.addEventListener('controllerchange', controllerChangeHandler, { once: true });
    } else {
      // Se non c'è un service worker in attesa, prova a deregistrare e ricaricare
      // Questo risolve casi in cui il browser è "bloccato"
      if (registration) {
        await registration.unregister();
      }
      forceReload();
    }
  };

  const handleDismiss = () => {
    setUpdateAvailable(false);
  };

  if (!updateAvailable) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
      <div className="bg-gradient-to-br from-blue-600 to-purple-700 backdrop-blur-xl rounded-2xl p-4 shadow-2xl border border-blue-500/50">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <RefreshCw className={`w-6 h-6 text-white ${isUpdating ? 'animate-spin' : ''}`} />
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
              className="w-full bg-white hover:bg-gray-100 text-blue-600 font-medium py-2 px-4 rounded-lg text-sm transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating ? 'Aggiornamento...' : 'Aggiorna ora'}
            </button>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
            aria-label="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
