import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, User, AlertTriangle, CheckCircle2, Ban, CalendarPlus, Pencil } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useAppointments } from '../hooks/useAppointments';
import { useClientRegistration } from '../hooks/useClientRegistration';
import { apiService } from '../services/api';
import { API_CONFIG } from '../config/api';
import { useDailyShopHours } from '../hooks/useDailyShopHours';
import { useVacationMode } from '../hooks/useVacationMode';
import type { Appointment, Shop, Notification } from '../types';
import { AppointmentRescheduleModal } from './AppointmentRescheduleModal';
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
  const { notifications, loadNotifications, markAsRead, deleteNotification } = useNotifications();
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
  const [earlierOffer, setEarlierOffer] = useState<{
    waitlistId: string;
    appointmentId: string;
    earlierStartAt: string;
    earlierEndAt: string;
    notificationId: string;
  } | null>(null);

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

  // Ensure notifications are loaded (used to show the red badge and the "slot prima" offers list)
  useEffect(() => {
    if (user?.id) {
      loadNotifications().catch(() => undefined);
    }
  }, [user?.id, loadNotifications]);

  const earlierOfferNotifications = useMemo(() => {
    return (notifications || []).filter((n) => n.type === 'appointment_earlier_available');
  }, [notifications]);

  const formatOfferDateTime = (iso: string) => {
    const d = new Date(iso);
    const date = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${date} alle ${time}`;
  };

  const openEarlierOffer = async (n: Notification) => {
    const data = (n.data || {}) as any;
    if (!data?.waitlist_id || !data?.appointment_id || !data?.earlier_start_at || !data?.earlier_end_at) return;

    try {
      if (!n.read_at) await markAsRead(n.id);
    } catch {
      // ignore
    }

    setEarlierOffer({
      waitlistId: String(data.waitlist_id),
      appointmentId: String(data.appointment_id),
      earlierStartAt: String(data.earlier_start_at),
      earlierEndAt: String(data.earlier_end_at),
      notificationId: n.id,
    });
  };

  const declineEarlierOffer = async (n: Notification) => {
    const data = (n.data || {}) as any;
    if (!data?.waitlist_id) return;
    try {
      await apiService.declineEarlierSlotOffer(String(data.waitlist_id));
      if (!n.read_at) await markAsRead(n.id);
      await deleteNotification(n.id);
    } catch (e) {
      console.warn('Decline earlier offer failed:', e);
      setMessage({ type: 'error', text: 'Impossibile aggiornare la richiesta. Riprova.' });
    }
  };

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

      // Trigger webhook Supabase -> n8n per email di modifica appuntamento (non bloccante)
      apiService
        .triggerAppointmentModifiedHook({
          id: appointmentToReschedule.id,
          staff_id: appointmentToReschedule.staff_id || '',
          service_id: appointmentToReschedule.service_id || '',
          start_at: startDateTime.toISOString(),
          end_at: endDateTime.toISOString(),
          status: 'rescheduled',
        })
        .catch((e) => console.warn('appointment_modified_hook failed:', e));

      // Notifica barbiere (recupera user_id certo dal profilo staff)
      let staffUserId: string | null = null;
      try {
        if (appointmentToReschedule.staff_id) {
          const staffDetails = await apiService.getStaffById(appointmentToReschedule.staff_id);
          staffUserId = staffDetails?.user_id || staffDetails?.id || appointmentToReschedule.staff_id;
        }
      } catch (e) {
        console.warn('Errore recupero staff per notifica riprogrammazione:', e);
      }

      if (staffUserId) {
        const clientName = user?.full_name || 'Cliente';
        const serviceName = appointmentToReschedule.services?.name || 'Servizio';
        const appointmentDate = startDateTime.toLocaleDateString('it-IT', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'Europe/Rome',
        });
        const appointmentTime = startDateTime.toLocaleTimeString('it-IT', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Europe/Rome',
        });

        try {
          await apiService.createNotification({
            user_id: staffUserId,
            user_type: 'staff',
            type: 'appointment_rescheduled',
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
          console.warn('Errore creazione notifica riprogrammazione (appointment_rescheduled):', notifErr);
        }
      }

      // Email disabilitate lato app: invio gestito da webhooks Supabase

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
            year: 'numeric',
            timeZone: 'Europe/Rome',
          });
          
          const appointmentTime = new Date(selectedAppointment.start_at).toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Europe/Rome',
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
          <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:space-x-2">
            <Button
              variant="ghost"
              onClick={() => handleAddToCalendar(appointment)}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white border-none focus:ring-green-600"
            >
              <CalendarPlus className="w-4 h-4 mr-2" />
              Aggiungi al calendario
            </Button>
            <Button
              variant="ghost"
              onClick={() => openRescheduleModal(appointment)}
              className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white border-none focus:ring-orange-500"
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
    <div
      className="space-y-8 rounded-3xl p-6 md:p-10"
      style={{
        background: 'var(--theme-page-gradient)',
      }}
    >
      <div className="text-center glass-panel pb-2">
        <h1 className="text-3xl font-bold text-gray-900">Le Mie Prenotazioni</h1>
        <p className="text-gray-700 mt-2">Gestisci e controlla i tuoi appuntamenti</p>
      </div>

      {message && (
        <div
          className={`border rounded-lg p-4 ${
            message.type === 'success'
              ? 'bg-green-50/80 border-green-200/80 text-green-800'
              : 'bg-red-50/80 border-red-200/80 text-red-800'
          } backdrop-blur shadow-lg`}
        >
          {message.text}
        </div>
      )}

      {/* Notifiche (solo cliente): proposte per anticipare la prenotazione */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
            <Clock className="w-5 h-5 text-emerald-700" />
            <span>Notifiche</span>
          </h2>
        </div>

        {earlierOfferNotifications.length === 0 ? (
          <Card className="p-5 text-gray-600">
            Nessuna notifica al momento.
          </Card>
        ) : (
          <div className="space-y-3">
            {earlierOfferNotifications
              .slice()
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((n) => {
                const data = (n.data || {}) as any;
                const isUnread = !n.read_at;
                const slotText = data?.earlier_start_at
                  ? formatOfferDateTime(String(data.earlier_start_at))
                  : 'Slot disponibile';
                return (
                  <Card key={n.id} className="p-4 border border-gray-200">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-semibold text-gray-900 truncate">{n.title}</p>
                          {isUnread && <span className="w-2 h-2 bg-red-500 rounded-full" />}
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{n.message}</p>
                        <p className="text-sm text-emerald-700 font-semibold mt-2">
                          Slot disponibile: {slotText}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          onClick={() => openEarlierOffer(n)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          Anticipa
                        </Button>
                        <Button variant="secondary" onClick={() => declineEarlierOffer(n)}>
                          Rifiuta
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
          </div>
        )}
      </section>

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

      {/* Modale "slot prima" */}
      <AppointmentRescheduleModal
        isOpen={earlierOffer !== null}
        offer={
          earlierOffer
            ? {
                waitlistId: earlierOffer.waitlistId,
                appointmentId: earlierOffer.appointmentId,
                earlierStartAt: earlierOffer.earlierStartAt,
                earlierEndAt: earlierOffer.earlierEndAt,
              }
            : null
        }
        onClose={() => setEarlierOffer(null)}
        onSuccess={async () => {
          try {
            if (earlierOffer?.notificationId) {
              await deleteNotification(earlierOffer.notificationId);
            }
          } catch {
            // ignore
          }
          setEarlierOffer(null);
          await loadAppointments();
          setMessage({ type: 'success', text: 'Prenotazione anticipata con successo.' });
        }}
      />
    </div>
  );
};

