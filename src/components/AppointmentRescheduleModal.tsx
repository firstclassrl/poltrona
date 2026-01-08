import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpCircle, Calendar, Clock, Scissors, User } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { apiService } from '../services/api';
import { useTerminologyOptional } from '../contexts/TerminologyContext';
import type { Appointment } from '../types';

interface AppointmentRescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  offer: {
    waitlistId: string;
    appointmentId: string;
    earlierStartAt: string;
    earlierEndAt: string;
  } | null;
  onSuccess?: () => void;
}

export const AppointmentRescheduleModal: React.FC<AppointmentRescheduleModalProps> = ({
  isOpen,
  onClose,
  offer,
  onSuccess,
}) => {
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const terminology = useTerminologyOptional();
  const professionalLabel = terminology?.professional() || 'Professionista';

  const earlierStart = useMemo(() => (offer ? new Date(offer.earlierStartAt) : null), [offer]);
  const earlierEnd = useMemo(() => (offer ? new Date(offer.earlierEndAt) : null), [offer]);

  useEffect(() => {
    const load = async () => {
      if (!isOpen || !offer) return;
      setIsLoading(true);
      setError(null);
      try {
        const apt = await apiService.getAppointmentById(offer.appointmentId);
        setAppointment(apt);
      } catch (e) {
        console.error('Error loading appointment for reschedule modal:', e);
        setAppointment(null);
        setError('Impossibile caricare i dettagli della prenotazione.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [isOpen, offer]);

  const formatDateTime = (d: Date) => {
    const date = d.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Rome',
    });
    const time = d.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Europe/Rome',
    });
    return `${date} alle ${time}`;
  };

  const handleAccept = async () => {
    if (!offer || !appointment) return;
    if (!appointment.staff_id || !appointment.service_id) {
      setError('Dati prenotazione incompleti.');
      return;
    }
    if (!earlierStart || !earlierEnd) {
      setError('Dati dello slot anticipato incompleti.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await apiService.acceptEarlierSlotOffer({
        waitlistId: offer.waitlistId,
        appointmentId: offer.appointmentId,
        staffId: appointment.staff_id,
        serviceId: appointment.service_id,
        earlierStartAt: earlierStart.toISOString(),
        earlierEndAt: earlierEnd.toISOString(),
      });
      onClose();
      onSuccess?.();
    } catch (e) {
      console.error('Error accepting earlier slot offer:', e);
      setError(e instanceof Error ? e.message : 'Impossibile anticipare la prenotazione. Riprova.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!offer) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await apiService.declineEarlierSlotOffer(offer.waitlistId);
      onClose();
    } catch (e) {
      console.error('Error declining earlier slot offer:', e);
      setError('Impossibile aggiornare la richiesta. Riprova.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStart = appointment?.start_at ? new Date(appointment.start_at) : null;
  const currentEnd = appointment?.end_at ? new Date(appointment.end_at) : null;
  const durationMin =
    currentStart && currentEnd ? Math.round((currentEnd.getTime() - currentStart.getTime()) / 60000) : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Anticipa la prenotazione" size="medium">
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-8 h-8 border-2 border-yellow-400/60 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !offer || !appointment || !earlierStart || !earlierEnd ? (
        <div className="text-sm text-gray-600">
          {error || 'Dettagli non disponibili.'}
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 aurora-modal-bg-white">
            <div className="flex items-center gap-2 text-gray-800">
              <Scissors className="w-4 h-4" />
              <span className="font-medium">{appointment.services?.name ?? 'Servizio'}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700 text-sm">
              <User className="w-4 h-4" />
              <span>{appointment.staff?.full_name ?? professionalLabel}</span>
            </div>
            {durationMin !== null && (
              <div className="flex items-center gap-2 text-gray-700 text-sm">
                <Clock className="w-4 h-4" />
                <span>Durata: {durationMin} minuti</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm text-gray-800">
              <Calendar className="w-4 h-4 mt-0.5" />
              <div>
                <div className="font-medium">Orario attuale</div>
                <div className="text-gray-600">{currentStart ? formatDateTime(currentStart) : '-'}</div>
              </div>
            </div>

            <div className="flex items-start gap-2 text-sm text-emerald-800">
              <ArrowUpCircle className="w-4 h-4 mt-0.5" />
              <div>
                <div className="font-medium">Nuovo orario disponibile</div>
                <div className="text-emerald-700">{formatDateTime(earlierStart)}</div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={handleDecline} disabled={isSubmitting} className="flex-1">
              Mantieni orario
            </Button>
            <Button onClick={handleAccept} disabled={isSubmitting} className="flex-1">
              {isSubmitting ? 'Spostamento...' : 'Sposta appuntamento'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};


