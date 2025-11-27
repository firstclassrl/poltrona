import { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { Calendar } from './components/Calendar';
import { Clients } from './components/Clients';
import { Products } from './components/Products';
import { Services } from './components/Services';
// import { Analytics } from './components/Analytics'; // Temporaneamente nascosto
import { BarberProfile } from './components/BarberProfile';
import { ShopManagement } from './components/Shop';
import { AppointmentForm } from './components/AppointmentForm';
import { Login } from './components/Login';
import { ClientProfile } from './components/ClientProfile';
import { ClientBookingCalendar } from './components/ClientBookingCalendar';
import { ClientProducts } from './components/ClientProducts';
import { NotificationBell } from './components/NotificationBell';
import { Chat } from './components/Chat';
import { Toast } from './components/ui/Toast';
import { useToast } from './hooks/useToast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ChatProvider } from './contexts/ChatContext';
import { apiService } from './services/api';
import type { CreateAppointmentRequest, UpdateAppointmentRequest } from './types';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAppointmentFormOpen, setIsAppointmentFormOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const { toast, showToast, hideToast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();

  // Set initial tab based on user role
  useEffect(() => {
    if (user?.role === 'client') {
      setActiveTab('client_booking');
    }
  }, [user]);

  const handleNewAppointment = () => {
    setEditingAppointment(null);
    setIsAppointmentFormOpen(true);
  };

  const handleEditAppointment = (appointment: any) => {
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
            onNewAppointment={handleNewAppointment}
            onNavigateToCalendar={() => setActiveTab('calendar')}
            onEditAppointment={handleEditAppointment}
            onNavigateToClients={() => setActiveTab('clients')}
          />
        );
      case 'calendar':
        return <Calendar />;
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
        return <ShopManagement />;
      // case 'analytics':
      //   return <Analytics />; // Temporaneamente nascosto
      case 'client_profile':
        return <ClientProfile />;
      case 'client_booking':
        return <ClientBookingCalendar onNavigateToProfile={() => setActiveTab('client_profile')} />;
      default:
        return (
          <Dashboard
            onNewAppointment={handleNewAppointment}
            onNavigateToCalendar={() => setActiveTab('calendar')}
            onEditAppointment={handleEditAppointment}
            onNavigateToClients={() => setActiveTab('clients')}
          />
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950/20 to-pink-950/20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-yellow-300">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950/20 to-pink-950/20">
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      
      {/* Notification Bell for Barbers and Admins */}
      {user?.role !== 'client' && (
        <div className="fixed top-4 right-4 z-50">
          <NotificationBell />
        </div>
      )}
      
      {/* Main Content */}
      <div className="md:pl-64 pb-20 md:pb-0 bg-white">
        <main className="p-6 max-w-7xl mx-auto bg-white min-h-screen">
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

      {/* no debug UI */}
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ChatProvider>
          <AppContent />
        </ChatProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;