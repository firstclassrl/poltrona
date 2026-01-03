import { useOffline } from '../hooks/useOffline';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOffline = useOffline();

  if (!isOffline) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80">
      <div className="bg-gradient-to-br from-orange-600 to-red-600 backdrop-blur-xl rounded-2xl p-3 shadow-2xl border border-orange-500/50">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <WifiOff className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm">
              Modalità offline
            </p>
            <p className="text-white/80 text-xs">
              Alcune funzionalità potrebbero non essere disponibili
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
