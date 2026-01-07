import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

export const PWAUpdateNotification: React.FC = () => {
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
    updateServiceWorker(true);
  };

  const handleDismiss = () => {
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
              className="w-full bg-white hover:bg-gray-100 text-blue-600 font-medium py-2 px-4 rounded-lg text-sm transition-all duration-200 shadow-lg"
            >
              Aggiorna ora
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
