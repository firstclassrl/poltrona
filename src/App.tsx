import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { Navigation } from './components/Navigation';
import { Toast } from './components/ui/Toast';
import { useToast } from './hooks/useToast';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { usePWAUpdate } from './hooks/usePWAUpdate';
import { PageSkeleton } from './components/ui/PageSkeleton';

// Lazy load page components for code splitting
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const Calendar = lazy(() => import('./components/Calendar').then(m => ({ default: m.Calendar })));
const Clients = lazy(() => import('./components/Clients').then(m => ({ default: m.Clients })));
const Products = lazy(() => import('./components/Products').then(m => ({ default: m.Products })));
const Services = lazy(() => import('./components/Services').then(m => ({ default: m.Services })));
const BarberProfile = lazy(() => import('./components/BarberProfile').then(m => ({ default: m.BarberProfile })));
const ShopManagement = lazy(() => import('./components/Shop').then(m => ({ default: m.ShopManagement })));
const ClientShop = lazy(() => import('./components/ClientShop').then(m => ({ default: m.ClientShop })));
const Settings = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));
const AppointmentForm = lazy(() => import('./components/AppointmentForm').then(m => ({ default: m.AppointmentForm })));
const Login = lazy(() => import('./components/Login').then(m => ({ default: m.Login })));
const ShopSetup = lazy(() => import('./components/ShopSetup').then(m => ({ default: m.ShopSetup })));
const ResetPassword = lazy(() => import('./components/ResetPassword').then(m => ({ default: m.ResetPassword })));
const ClientProfile = lazy(() => import('./components/ClientProfile').then(m => ({ default: m.ClientProfile })));
const ClientBookings = lazy(() => import('./components/ClientBookings').then(m => ({ default: m.ClientBookings })));
const ClientBookingCalendar = lazy(() => import('./components/ClientBookingCalendar').then(m => ({ default: m.ClientBookingCalendar })));
const ClientProducts = lazy(() => import('./components/ClientProducts').then(m => ({ default: m.ClientProducts })));
const Chat = lazy(() => import('./components/Chat').then(m => ({ default: m.Chat })));
const Notifications = lazy(() => import('./components/Notifications').then(m => ({ default: m.Notifications })));
const WaitlistDashboard = lazy(() => import('./components/WaitlistDashboard').then(m => ({ default: m.WaitlistDashboard })));
const Billing = lazy(() => import('./components/Billing').then(m => ({ default: m.Billing })));
const PlatformAdmin = lazy(() => import('./components/PlatformAdmin').then(m => ({ default: m.PlatformAdmin })));
import { Paywall } from './components/Paywall';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ShopProvider, useShop } from './contexts/ShopContext';
import { ChatProvider } from './contexts/ChatContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { TerminologyProvider } from './contexts/TerminologyContext';
import { SubscriptionProvider, useSubscription } from './contexts/SubscriptionContext';
import type { ThemePaletteId } from './theme/palettes';
import { APP_VERSION, VERSION_ENDPOINT } from './config/version';
import { apiService } from './services/api';
import type { CreateAppointmentRequest, UpdateAppointmentRequest, Appointment } from './types';

const AppContent: React.FC = () => {
  const { forceUpdate, needRefresh } = usePWAUpdate();

  // Platform Admin Mode (Hidden Tool)
  // DISPONIBILE SOLO IN MODALITÀ SVILUPPO (LOCALE)
  const isPlatformAdmin = useMemo(() => {
    // Sicurezza: Abilita solo in dev mode (npm run dev)
    if (!import.meta.env.DEV) return false;

    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('admin_mode') === 'true';
  }, []);

  if (isPlatformAdmin) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <PlatformAdmin />
      </Suspense>
    );
  }

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
      case 'billing':
        return <Billing />;
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

  // IMPORTANTE: Non mostrare lo spinner generico quando l'utente non è autenticato
  // perché questo smonterebbe il componente Login e perderebbe lo stato degli errori.
  // Login gestisce internamente il proprio stato di loading tramite isLoading di useAuth.
  if (isLoading && isAuthenticated) {
    // Mostra lo spinner solo se l'utente è già autenticato (es. durante il refresh del token)
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
      return (
        <Suspense fallback={<PageSkeleton />}>
          <ShopSetup />
        </Suspense>
      );
    }
    if (resetPasswordToken) {
      return (
        <Suspense fallback={<PageSkeleton />}>
          <ResetPassword />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={<PageSkeleton />}>
        <Login />
      </Suspense>
    );
  }

  // Determina se mostrare il paywall (solo per staff, owner, admin - non per clienti)
  const shouldShowPaywall = user?.role && !['client'].includes(user.role);

  return (
    <div className="app-theme-bg text-[var(--theme-text)]">
      {/* Paywall per utenti non abbonati (esclusi i clienti) */}
      {shouldShowPaywall && <Paywall><></></Paywall>}

      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Banner aggiornamento versione */}
      {(isUpdateAvailable || needRefresh) && (
        <div className="md:ml-64">
          <div className="bg-yellow-500 text-black px-4 py-2 text-sm flex items-center justify-between shadow-md">
            <span>
              È disponibile una nuova versione di Poltrona
              {latestVersion ? ` (v${latestVersion})` : ''}. Clicca per aggiornare.
            </span>
            <button
              type="button"
              className="ml-4 px-3 py-1 rounded bg-black text-yellow-300 text-xs font-semibold hover:bg-gray-900"
              onClick={() => {
                forceUpdate();
              }}
            >
              Aggiorna ora
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="md:ml-64 pb-20 md:pb-4" style={{ marginTop: 0, paddingTop: 0, minHeight: 'calc(100vh - 0px)' }}>
        <main className="text-[var(--theme-text)]" style={{ marginTop: 0, paddingTop: 0, paddingBottom: '2rem' }}>
          <Suspense fallback={<PageSkeleton />}>
            {renderActiveTab()}
          </Suspense>
        </main>
      </div>

      {/* Appointment Form Modal */}
      <Suspense fallback={null}>
        <AppointmentForm
          isOpen={isAppointmentFormOpen}
          onClose={() => {
            setIsAppointmentFormOpen(false);
            setEditingAppointment(null);
          }}
          onSave={handleSaveAppointment}
          appointment={editingAppointment}
        />
      </Suspense>

      {/* Toast Notifications */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />

      {/* PWA Components */}
      <PWAInstallPrompt />
      <OfflineIndicator />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <ShopProvider>
        <ThemeProvider>
          <TerminologyProvider>
            <SubscriptionProvider>
              <NotificationProvider>
                <ChatProvider>
                  <AppContent />
                </ChatProvider>
              </NotificationProvider>
            </SubscriptionProvider>
          </TerminologyProvider>
        </ThemeProvider>
      </ShopProvider>
    </AuthProvider>
  );
}

export default App;