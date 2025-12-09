import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, User, AlertTriangle, CheckCircle2, Ban, CalendarPlus, Pencil } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useAppointments } from '../hooks/useAppointments';
import { useClientRegistration } from '../hooks/useClientRegistration';
import { apiService } from '../services/api';
import { emailNotificationService } from '../services/emailNotificationService';
import { useDailyShopHours } from '../hooks/useDailyShopHours';
import { useVacationMode } from '../hooks/useVacationMode';
import type { Appointment, Shop } from '../types';
import { generateICSFile, downloadICSFile } from '../utils/calendar';
import { findAvailableSlotsForDuration } from '../utils/availability';
import { addMinutes, getSlotDateTime } from '../utils/date';

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
  const { isDateOpen, getAvailableTimeSlots, shopHoursLoaded } = useDailyShopHours();
  const { isDateInVacation } = useVacationMode();

  const [registeredClientId, setRegisteredClientId] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [shop, setShop] = useState<Shop | null>(null);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [rescheduleSlots, setRescheduleSlots] = useState<{ date: Date; time: string }[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [appointmentToReschedule, setAppointmentToReschedule] = useState<Appointment | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (user?.email) {
      const client = getClientByEmail(user.email);
      setRegisteredClientId(client?.id ?? null);
      setRegisteredEmail(normalizeEmail(client?.email));
    }
  }, [user, getClientByEmail]);

  // Load shop data for calendar events
  useEffect(() => {
    const loadShop = async () => {
      try {
        const shopData = await apiService.getShop();
        setShop(shopData);
      } catch (error) {
        console.error('Error loading shop data:', error);
      }
    };
    loadShop();
  }, []);

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

  const handleAddToCalendar = (appointment: Appointment) => {
    if (!appointment.services || !appointment.staff) {
      console.error('Dati appuntamento incompleti per il calendario');
      return;
    }

    const service = appointment.services;
    const barber = appointment.staff;
    const startDateTime = new Date(appointment.start_at);
    const endDateTime = appointment.end_at ? new Date(appointment.end_at) : new Date(startDateTime.getTime() + (service.duration_min || 60) * 60000);
    
    // Build location string
    const locationParts: string[] = [];
    if (shop?.name) {
      locationParts.push(shop.name);
    }
    if (shop?.address) {
      locationParts.push(shop.address);
    }
    if (shop?.city) {
      locationParts.push(shop.city);
    }
    const location = locationParts.join(', ');

    // Build description
    const descriptionParts: string[] = [];
    descriptionParts.push(`Barbiere: ${barber.full_name}`);
    if (shop?.name) {
      descriptionParts.push(`Negozio: ${shop.name}`);
    }
    if (shop?.phone) {
      descriptionParts.push(`Telefono: ${shop.phone}`);
    }
    const description = descriptionParts.join('\n');

    // Generate calendar event
    const icsContent = generateICSFile({
      title: service.name,
      startDate: startDateTime,
      endDate: endDateTime,
      description,
      location: location || undefined,
      uid: `appointment-${appointment.id}@poltrona`,
    });

    // Download the file
    const filename = `appuntamento-${service.name.toLowerCase().replace(/\s+/g, '-')}-${startDateTime.toISOString().split('T')[0]}.ics`;
    downloadICSFile(icsContent, filename);
  };

  const openRescheduleModal = async (appointment: Appointment) => {
    setMessage(null);
    setAppointmentToReschedule(appointment);
    setIsRescheduleModalOpen(true);

    // Calcola slot disponibili partendo da ora (o dallo start attuale se futuro)
    if (!appointment.staff_id || !appointment.services?.duration_min || !shopHoursLoaded) {
      setRescheduleSlots([]);
      return;
    }

    const duration = appointment.services.duration_min;
    const staffId = appointment.staff_id;
    const startDate = new Date();
    const appointmentStart = new Date(appointment.start_at);
    // Non proporre slot nel passato
    if (appointmentStart > startDate) startDate.setTime(appointmentStart.getTime());
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 3);
    endDate.setHours(23, 59, 59, 999);

    setIsLoadingSlots(true);
    try {
      const slots = findAvailableSlotsForDuration({
        startDate,
        endDate,
        durationMin: duration,
        appointments,
        isDateOpen,
        isDateInVacation,
        getAvailableTimeSlots,
        staffId,
      })
        .filter((slot) => {
          // escludi lo slot attuale
          const slotStart = getSlotDateTime(slot.date, slot.time);
          const slotEnd = addMinutes(slotStart, duration);
          const currentStart = new Date(appointment.start_at);
          const currentEnd = new Date(appointment.end_at || appointment.start_at);
          return !(slotStart.getTime() === currentStart.getTime() && slotEnd.getTime() === currentEnd.getTime());
        })
        .slice(0, 50); // limita elenco

      setRescheduleSlots(slots);
    } catch (err) {
      console.error('Errore calcolo slot disponibili per riprogrammazione:', err);
      setRescheduleSlots([]);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  const handleConfirmReschedule = async (slot: { date: Date; time: string }) => {
    if (!appointmentToReschedule || !appointmentToReschedule.staff_id || !appointmentToReschedule.service_id || !appointmentToReschedule.services?.duration_min) {
      return;
    }
    setIsUpdating(true);
    setMessage(null);
    try {
      const [hours, minutes] = slot.time.split(':').map(Number);
      const startDateTime = new Date(slot.date);
      startDateTime.setHours(hours, minutes, 0, 0);
      const endDateTime = addMinutes(startDateTime, appointmentToReschedule.services.duration_min);

      await apiService.updateAppointmentDirect({
        id: appointmentToReschedule.id,
        staff_id: appointmentToReschedule.staff_id,
        service_id: appointmentToReschedule.service_id,
        start_at: startDateTime.toISOString(),
        end_at: endDateTime.toISOString(),
        status: 'rescheduled',
      });

      // Notifica barbiere
      if (appointmentToReschedule.staff) {
        const staffUserId = appointmentToReschedule.staff.user_id || appointmentToReschedule.staff.id || appointmentToReschedule.staff_id;
        const clientName = user?.full_name || 'Cliente';
        const serviceName = appointmentToReschedule.services?.name || 'Servizio';
        const appointmentDate = startDateTime.toLocaleDateString('it-IT', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
        const appointmentTime = startDateTime.toLocaleTimeString('it-IT', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });

        try {
          await apiService.createNotification({
            user_id: staffUserId,
            user_type: 'staff',
            type: 'new_appointment',
            title: '🔄 Prenotazione aggiornata',
            message: `${clientName} ha spostato ${serviceName} a ${appointmentDate} alle ${appointmentTime}`,
            data: {
              appointment_id: appointmentToReschedule.id,
              client_name: clientName,
              service_name: serviceName,
              appointment_date: appointmentDate,
              appointment_time: appointmentTime,
              staff_id: appointmentToReschedule.staff_id,
            },
          });
        } catch (notifErr) {
          console.warn('Errore creazione notifica riprogrammazione:', notifErr);
        }
      }

      // Email negozio (non bloccante)
      try {
        const serviceName = appointmentToReschedule.services?.name || 'Servizio';
        const barberName = appointmentToReschedule.staff?.full_name || 'Barbiere';
        const appointmentDateStr = startDateTime.toLocaleDateString('it-IT');
        const appointmentTimeStr = startDateTime.toLocaleTimeString('it-IT', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        if (shop?.notification_email) {
          emailNotificationService
            .sendRescheduleNotification(
              {
                clientName: user?.full_name || 'Cliente',
                clientEmail: user?.email || '',
                clientPhone: user?.phone || '',
                serviceName,
                appointmentDate: appointmentDateStr,
                appointmentTime: appointmentTimeStr,
                barberName,
                shopName: shop.name || 'Barbershop',
              },
              shop.notification_email
            )
            .catch((err) => console.warn('Errore invio email riprogrammazione:', err));
        }
      } catch (emailErr) {
        console.warn('Errore gestione email riprogrammazione:', emailErr);
      }

      await loadAppointments();
      setMessage({ type: 'success', text: 'Prenotazione aggiornata con successo.' });
      setIsRescheduleModalOpen(false);
      setAppointmentToReschedule(null);
    } catch (err) {
      console.error('Errore riprogrammazione:', err);
      setMessage({ type: 'error', text: 'Impossibile modificare la prenotazione. Riprova.' });
    } finally {
      setIsUpdating(false);
    }
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
          <div className="flex justify-end space-x-2">
            <Button
              variant="secondary"
              onClick={() => handleAddToCalendar(appointment)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CalendarPlus className="w-4 h-4 mr-2" />
              Aggiungi al calendario
            </Button>
            <Button
              variant="secondary"
              onClick={() => openRescheduleModal(appointment)}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Pencil className="w-4 h-4 mr-2" />
              Modifica
            </Button>
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

      <Modal
        isOpen={isRescheduleModalOpen}
        onClose={() => {
          setIsRescheduleModalOpen(false);
          setAppointmentToReschedule(null);
          setRescheduleSlots([]);
        }}
        title="Modifica prenotazione"
        size="medium"
      >
        <div className="space-y-4 text-sm text-gray-700">
          {isLoadingSlots ? (
            <p>Caricamento disponibilità...</p>
          ) : rescheduleSlots.length === 0 ? (
            <p>Nessuno slot disponibile per il servizio selezionato nei prossimi 3 mesi.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
              {rescheduleSlots.map((slot) => {
                const dateLabel = slot.date.toLocaleDateString('it-IT', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                });
                return (
                  <button
                    key={`${slot.date.toISOString()}-${slot.time}`}
                    onClick={() => handleConfirmReschedule(slot)}
                    disabled={isUpdating}
                    className="border rounded-lg p-3 text-left hover:border-orange-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-300 transition"
                  >
                    <div className="text-sm font-semibold capitalize">{dateLabel}</div>
                    <div className="text-base text-gray-900">{slot.time}</div>
                  </button>
                );
              })}
            </div>
          )}
          {isUpdating && <p>Salvataggio modifica...</p>}
        </div>
      </Modal>
    </div>
  );
};

