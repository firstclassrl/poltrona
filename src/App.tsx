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
import { ClientProfile } from './components/ClientProfile';
import { ClientBookings } from './components/ClientBookings';
import { ClientBookingCalendar } from './components/ClientBookingCalendar';
import { ClientProducts } from './components/ClientProducts';
import { Chat } from './components/Chat';
import { Notifications } from './components/Notifications';
import { Toast } from './components/ui/Toast';
import { useToast } from './hooks/useToast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ShopProvider } from './contexts/ShopContext';
import { ChatProvider } from './contexts/ChatContext';
import { ThemeProvider } from './contexts/ThemeContext';
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
  const setupToken = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    return token && token.trim().length > 0 ? token : null;
  }, []);

  // Set initial tab based on user role
  useEffect(() => {
    if (user?.role === 'client') {
      setActiveTab('client_booking');
    }
  }, [user]);

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
        return <ClientBookingCalendar onNavigateToProfile={() => setActiveTab('client_profile')} />;
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
      <div className="min-h-screen app-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[var(--theme-accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-on-surface">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (setupToken) {
      return <ShopSetup />;
    }
    return <Login />;
  }

  return (
    <div className="min-h-screen app-gradient text-on-surface">
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Banner aggiornamento versione */}
      {isUpdateAvailable && (
        <div className="md:pl-64">
          <div className="px-4 py-2 text-sm flex items-center justify-between shadow-md surface-card border border-[color-mix(in_srgb,var(--theme-border)_40%,transparent)]">
            <span>
              È disponibile una nuova versione di Poltrona
              {latestVersion ? ` (v${latestVersion})` : ''}. Clicca per aggiornare.
            </span>
            <button
              type="button"
              className="ml-4 px-3 py-1 rounded bg-[var(--theme-primary-strong)] text-[var(--theme-text)] text-xs font-semibold hover:bg-[var(--theme-primary)] border border-[color-mix(in_srgb,var(--theme-border)_30%,transparent)]"
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
        <main className="p-6 max-w-7xl mx-auto min-h-screen bg-[var(--theme-surface)] text-on-surface">
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