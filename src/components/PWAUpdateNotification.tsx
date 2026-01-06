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

    // Helper force reload with nuclear cache clearing
    const forceReload = async () => {
      console.log('☢️ Performing nuclear cache clear...');

      // 1. Clear all Cache API caches
      if ('caches' in window) {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map(key => caches.delete(key)));
          console.log('✅ Caches cleared');
        } catch (e) {
          console.error('Failed to clear caches:', e);
        }
      }

      // 2. Unregister all Service Workers
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(reg => reg.unregister()));
          console.log('✅ Service Workers unregistered');
        } catch (e) {
          console.error('Failed to unregister SW:', e);
        }
      }

      // 3. Force reload ignoring cache
      window.location.reload();
    };

    if (registration?.waiting) {
      // Send skip waiting message
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });

      // Wait briefly for the SW to activate, then nuke everything
      // We wait 100ms just to let the message send, but we don't trust the controllerchange
      setTimeout(forceReload, 100);
    } else {
      // Immediate nuke if no waiting worker
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
