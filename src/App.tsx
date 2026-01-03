import { useState, useEffect, useMemo } from 'react';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { Calendar } from './components/Calendar';
import { Clients } from './components/Clients';
import { Products } from './components/Products';
import { Services } from './components/Services';
import { BarberProfile } from './components/BarberProfile';
import { ShopManagement } from './components/Shop';
import { ClientShop } from './components/ClientShop';
import { Settings } from './components/Settings';
import { AppointmentForm } from './components/AppointmentForm';
import { Login } from './components/Login';
import { ShopSetup } from './components/ShopSetup';
import { ResetPassword } from './components/ResetPassword';
import { ClientProfile } from './components/ClientProfile';
import { ClientBookings } from './components/ClientBookings';
import { ClientBookingCalendar } from './components/ClientBookingCalendar';
import { ClientProducts } from './components/ClientProducts';
import { Chat } from './components/Chat';
import { Notifications } from './components/Notifications';
import { WaitlistDashboard } from './components/WaitlistDashboard';
import { Toast } from './components/ui/Toast';
import { useToast } from './hooks/useToast';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { PWAUpdateNotification } from './components/PWAUpdateNotification';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ShopProvider, useShop } from './contexts/ShopContext';
import { ChatProvider } from './contexts/ChatContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import type { ThemePaletteId } from './theme/palettes';
import { APP_VERSION, VERSION_ENDPOINT } from './config/version';
import { apiService } from './services/api';
import type { CreateAppointmentRequest, UpdateAppointmentRequest, Appointment } from './types';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isAppointmentFormOpen, setIsAppointmentFormOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const { toast, showToast, hideToast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { currentShop } = useShop();
  const { setTheme } = useTheme();
  const setupToken = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const type = params.get('type');
    // Se è un token di recovery, non è un setup token
    if (type === 'recovery') return null;
    return token && token.trim().length > 0 ? token : null;
  }, []);

  const resetPasswordToken = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const type = params.get('type');
    // Verifica che sia un token di recovery
    if (type === 'recovery' && token && token.trim().length > 0) {
      return token;
    }
    return null;
  }, []);

  // Set initial tab based on user role
  useEffect(() => {
    if (user?.role === 'client') {
      setActiveTab('client_booking');
    }
  }, [user]);

  // Vista cliente: forza il tema a quello impostato sul negozio
  useEffect(() => {
    if (user?.role === 'client' && currentShop?.theme_palette) {
      // Per la vista cliente usiamo SEMPRE il tema del negozio
      // e lo persistiamo così resta anche dopo refresh
      setTheme(currentShop.theme_palette as ThemePaletteId, { persist: true });
    }
  }, [user?.role, currentShop?.theme_palette, setTheme]);

  // Poll di controllo versione: verifica periodicamente se esiste una versione più recente
  useEffect(() => {
    let isMounted = true;

    const checkVersion = async () => {
      try {
        const response = await fetch(VERSION_ENDPOINT, {
          cache: 'no-cache',
        });

        if (!response.ok) return;

        const data = (await response.json()) as { version?: string };
        const remoteVersion = data.version;

        if (!remoteVersion) return;

        if (isMounted) {
          setLatestVersion(remoteVersion);
          if (remoteVersion !== APP_VERSION) {
            setIsUpdateAvailable(true);
          }
        }
      } catch {
        // In caso di errore (offline, ecc.) non facciamo nulla
      }
    };

    // Primo controllo immediato
    void checkVersion();

    // Controlli successivi ogni 5 minuti
    const intervalId = window.setInterval(checkVersion, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const handleEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setIsAppointmentFormOpen(true);
  };

  const handleSaveAppointment = async (data: CreateAppointmentRequest | UpdateAppointmentRequest) => {
    try {
      if ('id' in data) {
        await apiService.updateAppointment(data as UpdateAppointmentRequest);
        showToast('Appuntamento aggiornato ✅', 'success');
      } else {
        await apiService.createAppointment(data as CreateAppointmentRequest);
        showToast('Appuntamento salvato ✅', 'success');
      }
      setIsAppointmentFormOpen(false);
      setEditingAppointment(null);
    } catch (error) {
      showToast('Operazione non riuscita. Riprova.', 'error');
    }
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            onNavigateToCalendar={() => setActiveTab('calendar')}
            onEditAppointment={handleEditAppointment}
            onNavigateToClients={() => setActiveTab('clients')}
          />
        );
      case 'calendar':
        return <Calendar />;
      case 'notifications':
        return <Notifications />;
      case 'clients':
        return <Clients onNavigateToBooking={() => setActiveTab('client_booking')} />;
      case 'products':
        // Mostra ClientProducts per i clienti, Products per admin/barbieri
        return user?.role === 'client' ? (
          <ClientProducts onNavigateToBooking={() => setActiveTab('client_booking')} />
        ) : <Products />;
      case 'services':
        return <Services />;
      case 'waitlist':
        return <WaitlistDashboard shopId={currentShop?.id} />;
      case 'chat':
        return <Chat />;
      case 'profile':
        return <BarberProfile />;
      case 'shop':
        // Mostra ClientShop per i clienti, ShopManagement per admin/barbieri
        return user?.role === 'client' ? (
          <ClientShop />
        ) : <ShopManagement />;
      case 'settings':
        return <Settings />;
      case 'client_profile':
        return <ClientProfile />;
      case 'client_bookings':
        return <ClientBookings />;
      case 'client_booking':
        return (
          <ClientBookingCalendar 
            onNavigateToProfile={() => setActiveTab('client_profile')}
            initialParams={(() => {
              // Recupera parametri da localStorage se presenti (impostati dalla notifica)
              try {
                const params = localStorage.getItem('bookingParams');
                if (params) {
                  const parsed = JSON.parse(params);
                  localStorage.removeItem('bookingParams'); // Rimuovi dopo averli letti
                  return parsed;
                }
              } catch (e) {
                console.error('Error parsing booking params:', e);
              }
              return undefined;
            })()}
          />
        );
      default:
        return (
          <Dashboard
            onNavigateToCalendar={() => setActiveTab('calendar')}
            onEditAppointment={handleEditAppointment}
            onNavigateToClients={() => setActiveTab('clients')}
          />
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen app-theme-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-on-surface">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (setupToken) {
      return <ShopSetup />;
    }
    if (resetPasswordToken) {
      return <ResetPassword />;
    }
    return <Login />;
  }

  return (
    <div className="min-h-screen app-theme-bg text-[var(--theme-text)]">
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Banner aggiornamento versione */}
      {isUpdateAvailable && (
        <div className="md:pl-64">
          <div className="bg-yellow-500 text-black px-4 py-2 text-sm flex items-center justify-between shadow-md">
            <span>
              È disponibile una nuova versione di Poltrona
              {latestVersion ? ` (v${latestVersion})` : ''}. Clicca per aggiornare.
            </span>
            <button
              type="button"
              className="ml-4 px-3 py-1 rounded bg-black text-yellow-300 text-xs font-semibold hover:bg-gray-900"
              onClick={() => {
                // Forza un reload completo per caricare la nuova index.html e i nuovi bundle
                window.location.reload();
              }}
            >
              Aggiorna ora
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="md:pl-64 pb-20 md:pb-0">
        <main className="p-6 max-w-7xl mx-auto text-[var(--theme-text)] min-h-screen">
          {renderActiveTab()}
        </main>
      </div>

      {/* Appointment Form Modal */}
      <AppointmentForm
        isOpen={isAppointmentFormOpen}
        onClose={() => {
          setIsAppointmentFormOpen(false);
          setEditingAppointment(null);
        }}
        onSave={handleSaveAppointment}
        appointment={editingAppointment}
      />

      {/* Toast Notifications */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />

      {/* PWA Components */}
      <PWAInstallPrompt />
      <PWAUpdateNotification />
      <OfflineIndicator />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <ShopProvider>
        <ThemeProvider>
          <NotificationProvider>
            <ChatProvider>
              <AppContent />
            </ChatProvider>
          </NotificationProvider>
        </ThemeProvider>
      </ShopProvider>
    </AuthProvider>
  );
}

export default App;