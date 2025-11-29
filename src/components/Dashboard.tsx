import React, { useState, useEffect } from 'react';
import { Calendar, Users, Clock, AlertTriangle, ShoppingBag, Package, ChevronRight } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { formatTime, formatDate } from '../utils/date';
import { useAppointments } from '../hooks/useAppointments';
import { useAuth } from '../contexts/AuthContext';
import type { Appointment } from '../types';

interface DashboardProps {
  onNavigateToCalendar: () => void;
  onEditAppointment: (appointment: Appointment) => void;
  onNavigateToClients?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  onNavigateToCalendar,
  onEditAppointment,
  onNavigateToClients
}) => {
  const { user } = useAuth();
  const [greeting, setGreeting] = useState('Buongiorno');
  const [isMobile, setIsMobile] = useState(false);
  
  const { appointments } = useAppointments();
  const upcomingAppointments = appointments.slice(0, 6);
  const kpi = {
    total_appointments: appointments.length,
    no_shows: appointments.filter(a => a.status === 'no_show').length,
    estimated_revenue: appointments.reduce((sum, a) => sum + (a.services?.price_cents || 0), 0) / 100,
    completed_appointments: appointments.filter(a => a.status === 'completed').length,
  };
  const [showNoShowModal, setShowNoShowModal] = React.useState(false);
  const [selectedAppointment, setSelectedAppointment] = React.useState<Appointment | null>(null);
  const [showAppointmentModal, setShowAppointmentModal] = React.useState(false);
  const [showNoShowConfirmModal, setShowNoShowConfirmModal] = React.useState(false);

  useEffect(() => {
    // Imposta il saluto basato sull'ora
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting('Buongiorno');
    } else if (hour < 18) {
      setGreeting('Buon pomeriggio');
    } else {
      setGreeting('Buonasera');
    }
  }, []);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Record no-show reali (derivati dagli appuntamenti con status no_show)
  const noShowRecords = appointments
    .filter(a => a.status === 'no_show')
    .map(a => ({
      id: a.id,
      client: { first_name: a.clients?.first_name || '', last_name: a.clients?.last_name || '', phone_e164: a.clients?.phone_e164 || '' },
      date: a.start_at,
      service: a.services?.name || '',
      staff: a.staff?.full_name || '',
      noShowCount: 1,
    }));

  const getStatusBadge = (status: string) => {
    const variants = {
      scheduled: 'warning',
      confirmed: 'info',
      in_progress: 'success',
      completed: 'success',
      cancelled: 'danger',
      no_show: 'danger',
    } as const;
    
    const labels = {
      scheduled: 'Programmato',
      confirmed: 'Confermato',
      in_progress: 'In corso',
      completed: 'Completato',
      cancelled: 'Annullato',
      no_show: 'Non presentato',
    } as const;

    return <Badge variant={variants[status as keyof typeof variants]}>{labels[status as keyof typeof labels]}</Badge>;
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowAppointmentModal(true);
  };

  const handleNoShowClick = () => {
    setShowNoShowConfirmModal(true);
  };

  const handleConfirmNoShow = () => {
    if (selectedAppointment) {
      // In una app reale, qui faresti una chiamata API per aggiornare lo stato
      console.log('No-show segnalato per appuntamento:', selectedAppointment.id);
      
      // Simula l'aggiornamento dello stato
      selectedAppointment.status = 'no_show';
      
      // Chiudi i modal
      setShowNoShowConfirmModal(false);
      setShowAppointmentModal(false);
      
      // Mostra messaggio di successo
      // In una app reale, useresti un toast notification
      alert('No-show segnalato con successo!');
    }
  };

  const getNoShowBadgeColor = (count: number) => {
    if (count >= 3) return 'bg-red-600 text-white';
    if (count >= 2) return 'bg-orange-500 text-white';
    return 'bg-yellow-500 text-black';
  };
  return (
    <div className="space-y-8">
      {/* Header - Responsive */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {greeting}{user?.full_name ? `, ${user.full_name}` : ''}
          </h1>
          <p className="text-gray-600 mt-1 text-sm md:text-base">
            Benvenuto nella tua dashboard - {user?.role === 'admin' ? 'Amministratore' :
                                           user?.role === 'barber' ? 'Barbiere' :
                                           user?.role === 'client' ? 'Cliente' : 'Utente'}
          </p>
        </div>
      </div>

      {/* Mobile Optimized View */}
      {isMobile && (
        <div className="md:hidden space-y-4">
          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="secondary" 
              onClick={onNavigateToCalendar}
              className="flex items-center justify-center py-4"
            >
              <Calendar className="w-5 h-5 mr-2" />
              <span>Calendario</span>
            </Button>
            <Button 
              variant="secondary" 
              onClick={onNavigateToClients || (() => {})}
              className="flex items-center justify-center py-4"
            >
              <Users className="w-5 h-5 mr-2" />
              <span>Clienti</span>
            </Button>
          </div>

          {/* Today's Summary */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Oggi</h3>
              <Clock className="w-5 h-5 text-gray-500" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Appuntamenti:</span>
                <span className="font-semibold">{appointments.filter(a => {
                  const today = new Date().toDateString();
                  return new Date(a.start_at).toDateString() === today;
                }).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Completati:</span>
                <span className="font-semibold text-green-600">{appointments.filter(a => {
                  const today = new Date().toDateString();
                  return new Date(a.start_at).toDateString() === today && a.status === 'completed';
                }).length}</span>
              </div>
            </div>
          </Card>

          {/* Upcoming Appointments - Mobile */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Prossimi Appuntamenti</h3>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onNavigateToCalendar}
                className="flex items-center"
              >
                <span className="text-sm">Vedi tutto</span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            <div className="space-y-3">
              {upcomingAppointments.slice(0, 3).map((appointment) => (
                <Card 
                  key={appointment.id} 
                  className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => handleAppointmentClick(appointment)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-xs">
                            {appointment.clients?.first_name?.[0]}{appointment.clients?.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {appointment.clients?.first_name} {appointment.clients?.last_name}
                          </p>
                          <p className="text-xs text-gray-600">
                            {formatTime(appointment.start_at)} - {appointment.services?.name}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(appointment.status || 'scheduled')}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Desktop View */}
      <div className="hidden md:block space-y-8">
        {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card 
          className="cursor-pointer hover:scale-105 transition-transform"
          onClick={onNavigateToCalendar}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Data Odierna</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Date().toLocaleDateString('it-IT', { 
                  weekday: 'long', 
                  day: 'numeric', 
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-purple-600" />
          </div>
        </Card>

        <Card 
          className="cursor-pointer hover:scale-105 transition-transform"
          onClick={onNavigateToCalendar}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Appuntamenti Oggi</p>
              <p className="text-3xl font-bold text-gray-900">{kpi.total_appointments}</p>
            </div>
            <Calendar className="w-8 h-8 text-blue-600" />
          </div>
        </Card>

        <Card 
          className="cursor-pointer hover:scale-105 transition-transform"
          onClick={() => setShowNoShowModal(true)}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">No-Show</p>
              <p className="text-3xl font-bold text-gray-900">{kpi.no_shows}</p>
            </div>
            <Users className="w-8 h-8 text-yellow-600" />
          </div>
        </Card>
      </div>

      {/* Upcoming Appointments */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Prossimi Appuntamenti</h2>
          <Clock className="w-6 h-6 text-green-600" />
        </div>

        <div className="space-y-4">
          {upcomingAppointments.map((appointment) => (
            <div
              key={appointment.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleAppointmentClick(appointment)}
            >
              <div className="flex items-center space-x-4">
                {/* Orario in grande e colorato */}
                <div className="flex flex-col items-center justify-center min-w-[80px]">
                  <div className="text-2xl font-bold text-blue-600 mb-1">
                    {formatTime(appointment.start_at)}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">
                    {new Date(appointment.start_at).toLocaleDateString('it-IT', { 
                      weekday: 'short', 
                      day: 'numeric', 
                      month: 'short' 
                    })}
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-green-800 rounded-full flex items-center justify-center">
                    <span className="text-yellow-300 font-semibold text-sm">
                      {appointment.clients?.first_name?.[0]}{appointment.clients?.last_name?.[0]}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-gray-900 font-medium">
                      {appointment.clients?.first_name} {appointment.clients?.last_name}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {appointment.staff?.full_name} • {appointment.services?.name}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-gray-700 font-medium">€{(appointment.services?.price_cents || 0) / 100}</span>
                {getStatusBadge(appointment.status || 'scheduled')}
              </div>
              
              {/* Avviso Prodotti da Preparare */}
              {appointment.products && appointment.products.length > 0 && (
                <div className="flex items-center space-x-2 mt-2">
                  <div className="flex items-center space-x-1 bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                    <ShoppingBag className="w-3 h-3" />
                    <span className="text-xs font-medium">
                      {appointment.products.length} prodotto{appointment.products.length > 1 ? 'i' : ''} da preparare
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* No-Show Records Modal */}
      <Modal
        isOpen={showNoShowModal}
        onClose={() => setShowNoShowModal(false)}
        title="Record No-Show"
      >
        <div className="space-y-6">
          <div className="flex items-center space-x-2 text-orange-600 bg-orange-50 p-3 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-medium">
              Clienti con 3+ no-show vengono automaticamente segnalati
            </span>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {noShowRecords.map((record) => (
              <div
                key={record.id}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {record.client.first_name[0]}{record.client.last_name[0]}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-gray-900 font-medium">
                        {record.client.first_name} {record.client.last_name}
                      </h3>
                      <p className="text-gray-600 text-sm">{record.client.phone_e164}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getNoShowBadgeColor(record.noShowCount)}`}>
                      {record.noShowCount} No-Show{record.noShowCount > 1 ? 's' : ''}
                    </span>
                    {record.noShowCount >= 3 && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                        ⚠️ Blacklist
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 space-y-1">
                  <div><strong>Ultimo No-Show:</strong> {formatDate(record.date)} alle {formatTime(record.date)}</div>
                  <div><strong>Servizio:</strong> {record.service}</div>
                  <div><strong>Barbiere:</strong> {record.staff}</div>
                </div>

                {record.noShowCount >= 3 && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    <strong>⚠️ Cliente in Blacklist:</strong> Richiede conferma telefonica per nuovi appuntamenti
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setShowNoShowModal(false)}>
              Chiudi
            </Button>
          </div>
        </div>
      </Modal>
      </div>

      {/* Appointment Detail Modal */}
      <Modal
        isOpen={showAppointmentModal}
        onClose={() => setShowAppointmentModal(false)}
        title="Dettagli Appuntamento"
      >
        {selectedAppointment && (
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {selectedAppointment.clients?.first_name?.[0]}{selectedAppointment.clients?.last_name?.[0]}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedAppointment.clients?.first_name} {selectedAppointment.clients?.last_name || ''}
                </h2>
                <p className="text-gray-600">{formatTime(selectedAppointment.start_at)} - {selectedAppointment.staff?.full_name}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>Prezzo:</strong> €{(selectedAppointment.services?.price_cents || 0) / 100}</div>
              <div><strong>Stato:</strong> {getStatusBadge(selectedAppointment.status || 'scheduled')}</div>
            </div>

            {/* Prodotti da Preparare */}
            {selectedAppointment.products && selectedAppointment.products.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-800 mb-3 flex items-center">
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Prodotti da Preparare
                </h4>
                <div className="space-y-2">
                  {selectedAppointment.products.map((product, index) => (
                    <div key={index} className="flex items-center justify-between bg-white rounded-lg p-2 border border-green-100">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <Package className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">
                            {product.productName}
                          </div>
                          <div className="text-xs text-gray-600">
                            Quantità: {product.quantity}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-green-600 text-sm">
                          €{((product.productPrice || 0) * product.quantity / 100).toFixed(2)}
                        </div>
                        {product.quantity > 1 && (
                          <div className="text-xs text-gray-500">
                            €{(product.productPrice || 0) / 100}/pz
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-green-200 pt-2 mt-2">
                    <div className="flex items-center justify-between font-semibold text-green-800">
                      <span>Totale Prodotti</span>
                      <span>
                        €{selectedAppointment.products.reduce((total, product) => 
                          total + ((product.productPrice || 0) * product.quantity), 0
                        ) / 100}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {(!selectedAppointment.products || selectedAppointment.products.length === 0) && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 text-gray-600">
                  <Package className="w-4 h-4" />
                  <span className="text-sm">Nessun prodotto prenotato per questo appuntamento</span>
                </div>
              </div>
            )}

            <div className="flex space-x-3">
              <Button variant="primary" className="flex-1" onClick={() => onEditAppointment(selectedAppointment)}>
                Modifica Appuntamento
              </Button>
              {selectedAppointment.status !== 'no_show' && selectedAppointment.status !== 'completed' && (
                <Button 
                  variant="danger" 
                  onClick={handleNoShowClick}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Segnala No-Show
                </Button>
              )}
              <Button variant="secondary" onClick={() => setShowAppointmentModal(false)}>
                Chiudi
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Appointment Details Modal */}
      <Modal
        isOpen={showAppointmentModal}
        onClose={() => setShowAppointmentModal(false)}
        title="Dettagli Appuntamento"
      >
        {selectedAppointment && (
          <div className="space-y-6">
            {/* Client Info */}
            <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
              <div className="w-16 h-16 bg-gradient-to-br from-green-600 to-green-800 rounded-full flex items-center justify-center">
                <span className="text-yellow-300 font-bold text-xl">
                  {selectedAppointment.clients?.first_name?.[0]}{selectedAppointment.clients?.last_name?.[0]}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {selectedAppointment.clients?.first_name} {selectedAppointment.clients?.last_name}
                </h3>
                <p className="text-gray-600">{selectedAppointment.clients?.phone_e164}</p>
              </div>
            </div>

            {/* Appointment Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-600 font-medium">Data</p>
                <p className="text-lg font-semibold text-gray-900">
                  {new Date(selectedAppointment.start_at).toLocaleDateString('it-IT', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-600 font-medium">Orario</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatTime(selectedAppointment.start_at)}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 border-b">
                <span className="text-gray-600">Servizio</span>
                <span className="font-medium text-gray-900">{selectedAppointment.services?.name || 'Non specificato'}</span>
              </div>
              <div className="flex justify-between items-center p-3 border-b">
                <span className="text-gray-600">Barbiere</span>
                <span className="font-medium text-gray-900">{selectedAppointment.staff?.full_name}</span>
              </div>
              <div className="flex justify-between items-center p-3 border-b">
                <span className="text-gray-600">Durata</span>
                <span className="font-medium text-gray-900">{selectedAppointment.services?.duration_min || 0} minuti</span>
              </div>
              <div className="flex justify-between items-center p-3">
                <span className="text-gray-600">Stato</span>
                {getStatusBadge(selectedAppointment.status || 'scheduled')}
              </div>
            </div>

            {/* Notes */}
            {selectedAppointment.notes && (
              <div className="p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-700 font-medium mb-1">Note</p>
                <p className="text-gray-700">{selectedAppointment.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-3 pt-4">
              <Button 
                variant="secondary" 
                onClick={() => setShowAppointmentModal(false)}
                className="flex-1"
              >
                Chiudi
              </Button>
              {selectedAppointment.status !== 'no_show' && selectedAppointment.status !== 'completed' && (
                <Button 
                  variant="danger" 
                  onClick={() => {
                    setShowAppointmentModal(false);
                    handleNoShowClick();
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  Segna No-Show
                </Button>
              )}
              {onEditAppointment && (
                <Button 
                  onClick={() => {
                    setShowAppointmentModal(false);
                    onEditAppointment(selectedAppointment);
                  }}
                  className="flex-1"
                >
                  Modifica
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* No-Show Confirmation Modal */}
      <Modal
        isOpen={showNoShowConfirmModal}
        onClose={() => setShowNoShowConfirmModal(false)}
        title="Conferma No-Show"
      >
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Segnala No-Show</h3>
              <p className="text-gray-600">Sei sicuro di voler segnalare questo appuntamento come no-show?</p>
            </div>
          </div>

          {selectedAppointment && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Dettagli Appuntamento:</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p><strong>Cliente:</strong> {selectedAppointment.clients?.first_name} {selectedAppointment.clients?.last_name}</p>
                <p><strong>Data:</strong> {new Date(selectedAppointment.start_at).toLocaleDateString('it-IT')}</p>
                <p><strong>Orario:</strong> {formatTime(selectedAppointment.start_at)}</p>
                <p><strong>Servizio:</strong> {selectedAppointment.services?.name}</p>
                <p><strong>Barbiere:</strong> {selectedAppointment.staff?.full_name}</p>
              </div>
            </div>
          )}

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-800 mb-1">Attenzione</h4>
                <p className="text-sm text-yellow-700">
                  Questa azione non può essere annullata. Il cliente verrà segnalato come no-show 
                  e questo influenzerà le sue future prenotazioni.
                </p>
              </div>
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <Button 
              variant="secondary" 
              onClick={() => setShowNoShowConfirmModal(false)}
              className="flex-1"
            >
              Annulla
            </Button>
            <Button 
              variant="danger" 
              onClick={handleConfirmNoShow}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Conferma No-Show
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};