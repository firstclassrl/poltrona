import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, User, AlertTriangle, CheckCircle2, Ban } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useAppointments } from '../hooks/useAppointments';
import { useClientRegistration } from '../hooks/useClientRegistration';
import { apiService } from '../services/api';
import type { Appointment } from '../types';

const normalizeEmail = (email?: string | null) => email?.trim().toLowerCase() || '';

const statusLabels: Record<string, string> = {
  confirmed: 'Confermato',
  scheduled: 'Programmato',
  completed: 'Completato',
  cancelled: 'Annullato',
  rescheduled: 'Ripianificato',
  in_progress: 'In corso',
  no_show: 'No-Show',
};

export const ClientBookings: React.FC = () => {
  const { user } = useAuth();
  const { appointments, loadAppointments } = useAppointments();
  const { getClientByEmail } = useClientRegistration();

  const [registeredClientId, setRegisteredClientId] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (user?.email) {
      const client = getClientByEmail(user.email);
      setRegisteredClientId(client?.id ?? null);
      setRegisteredEmail(normalizeEmail(client?.email));
    }
  }, [user, getClientByEmail]);

  const filteredAppointments = useMemo(() => {
    const authEmail = normalizeEmail(user?.email);

    return appointments.filter((apt) => {
      const appointmentClientId = apt.client_id || apt.clients?.id || null;
      const appointmentEmail = normalizeEmail(apt.clients?.email);

      const matchesClientId =
        (!!user?.id && appointmentClientId === user.id) ||
        (!!registeredClientId && appointmentClientId === registeredClientId);

      const matchesEmail =
        (!!authEmail && appointmentEmail === authEmail) ||
        (!!registeredEmail && appointmentEmail === registeredEmail);

      return matchesClientId || matchesEmail;
    });
  }, [appointments, user, registeredClientId, registeredEmail]);

  const activeAppointments = filteredAppointments.filter(
    (apt) => apt.status !== 'cancelled'
  );
  const cancelledAppointments = filteredAppointments.filter(
    (apt) => apt.status === 'cancelled'
  );

  const handleRequestCancel = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedAppointment) return;
    setIsCancelling(true);
    setMessage(null);

    try {
      await apiService.cancelAppointmentDirect(selectedAppointment.id);
      
      // Crea notifica in-app per il barbiere
      if (selectedAppointment.staff_id && selectedAppointment.staff) {
        try {
          const staffDetails = selectedAppointment.staff;
          const clientName = user?.full_name || 'Cliente';
          const serviceName = selectedAppointment.services?.name || 'Servizio';
          
          const appointmentDate = new Date(selectedAppointment.start_at).toLocaleDateString('it-IT', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          });
          
          const appointmentTime = new Date(selectedAppointment.start_at).toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
          
          // Usa user_id se disponibile (collegato a auth.users), altrimenti usa id
          const notificationUserId = staffDetails.user_id || staffDetails.id || selectedAppointment.staff_id;
          
          await apiService.createNotification({
            user_id: notificationUserId,
            user_type: 'staff',
            type: 'appointment_cancelled',
            title: '❌ Appuntamento Annullato',
            message: `${clientName} ha annullato l'appuntamento per ${serviceName} del ${appointmentDate} alle ${appointmentTime}`,
            data: {
              appointment_id: selectedAppointment.id,
              client_name: clientName,
              client_email: user?.email,
              service_name: serviceName,
              appointment_date: appointmentDate,
              appointment_time: appointmentTime,
              staff_id: selectedAppointment.staff_id,
            }
          });
          console.log('✅ Notifica annullamento creata. user_id:', notificationUserId);
        } catch (notifError) {
          console.warn('⚠️ Errore creazione notifica annullamento:', notifError);
          // Non bloccare l'annullamento se la notifica fallisce
        }
      }
      
      await loadAppointments();
      setMessage({ type: 'success', text: 'Prenotazione annullata con successo.' });
    } catch (error) {
      console.error('Errore annullamento prenotazione:', error);
      setMessage({ type: 'error', text: 'Impossibile annullare la prenotazione. Riprova.' });
    } finally {
      setIsCancelling(false);
      setIsCancelModalOpen(false);
      setSelectedAppointment(null);
    }
  };

  const renderAppointmentCard = (appointment: Appointment, canCancel: boolean) => {
    const serviceName = appointment.services?.name || 'Servizio';
    const barber = appointment.staff?.full_name || 'Barbiere';
    const date = new Date(appointment.start_at).toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const time = new Date(appointment.start_at).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    return (
      <Card key={appointment.id} className="p-4 space-y-3 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold text-gray-900">{serviceName}</p>
            <p className="text-sm text-gray-600 flex items-center space-x-1">
              <User className="w-4 h-4" />
              <span>{barber}</span>
            </p>
          </div>
          <Badge variant={appointment.status === 'cancelled' ? 'danger' : 'info'}>
            {statusLabels[appointment.status || 'confirmed'] || appointment.status}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="capitalize">{date}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span>{time}</span>
          </div>
        </div>

        {canCancel && (
          <div className="flex justify-end">
            <Button
              variant="danger"
              onClick={() => handleRequestCancel(appointment)}
              className="bg-red-600 hover:bg-red-700"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Annulla prenotazione
            </Button>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Le mie prenotazioni</h1>
        <p className="text-gray-600 mt-2">Gestisci e controlla i tuoi appuntamenti</p>
      </div>

      {message && (
        <div
          className={`border rounded-lg p-4 ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span>Prenotazioni attive</span>
          </h2>
          <span className="text-sm text-gray-500">
            {activeAppointments.length} appuntamento{activeAppointments.length !== 1 ? 'i' : ''}
          </span>
        </div>

        {activeAppointments.length === 0 ? (
          <Card className="p-6 text-center text-gray-500">
            Non hai prenotazioni attive al momento.
          </Card>
        ) : (
          <div className="space-y-4">
            {activeAppointments.map((apt) => renderAppointmentCard(apt, true))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
            <Ban className="w-5 h-5 text-gray-500" />
            <span>Prenotazioni annullate</span>
          </h2>
          <span className="text-sm text-gray-500">
            {cancelledAppointments.length} appuntamento{cancelledAppointments.length !== 1 ? 'i' : ''}
          </span>
        </div>

        {cancelledAppointments.length === 0 ? (
          <Card className="p-6 text-center text-gray-500">
            Nessuna prenotazione annullata di recente.
          </Card>
        ) : (
          <div className="space-y-4">
            {cancelledAppointments.map((apt) => renderAppointmentCard(apt, false))}
          </div>
        )}
      </section>

      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Conferma annullamento"
        size="small"
      >
        <div className="space-y-4 text-sm text-gray-700">
          <p>
            Sei sicuro di voler annullare la prenotazione per{' '}
            <strong>{selectedAppointment?.services?.name || 'il servizio selezionato'}</strong> del{' '}
            <strong>
              {selectedAppointment &&
                new Date(selectedAppointment.start_at).toLocaleDateString('it-IT')}
            </strong>{' '}
            alle{' '}
            <strong>
              {selectedAppointment &&
                new Date(selectedAppointment.start_at).toLocaleTimeString('it-IT', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })}
            </strong>
            ?
          </p>
          <p className="text-xs text-gray-500">
            Il barbiere verrà avvisato automaticamente dell&apos;annullamento.
          </p>
          <div className="flex space-x-3">
            <Button variant="secondary" className="flex-1" onClick={() => setIsCancelModalOpen(false)}>
              Torna indietro
            </Button>
            <Button
              variant="danger"
              className="flex-1 bg-red-600 hover:bg-red-700"
              onClick={handleConfirmCancel}
              disabled={isCancelling}
            >
              {isCancelling ? 'Annullamento...' : 'Conferma annullamento'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

