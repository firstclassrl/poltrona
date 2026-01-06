import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import type { Appointment } from '../types';
import { doesAppointmentOverlapSlot } from '../utils/date';

export interface CreateAppointmentData {
  client_id: string | null;
  client_name?: string;
  staff_id: string;
  service_id: string;
  start_at: string;
  end_at: string;
  notes?: string;
  products?: Array<{
    productId: string;
    quantity: number;
  }>;
}

export const useAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastError, setLastError] = useState<Error | null>(null);
  const [isLoadingInProgress, setIsLoadingInProgress] = useState(false);

  // Carica gli appuntamenti dal database
  const loadAppointments = useCallback(async () => {
    // Prevenire caricamenti simultanei
    if (isLoadingInProgress) {
      console.log('⏭️ useAppointments: Skipping duplicate load request');
      return;
    }

    setIsLoadingInProgress(true);

    try {
      setIsLoading(true);
      // Carica appuntamenti per un range ampio (1 settimana fa fino a 2 anni nel futuro)
      // per includere appuntamenti prenotati anche molto in anticipo (es. 2026)
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 7); // 1 settimana fa
      startDate.setHours(0, 0, 0, 0); // Imposta a inizio giornata
      const endDate = new Date(today);
      endDate.setFullYear(today.getFullYear() + 2); // 2 anni nel futuro
      endDate.setHours(23, 59, 59, 999); // Imposta a fine giornata

      const startISO = startDate.toISOString();
      const endISO = endDate.toISOString();


      const dbAppointments = await apiService.getAppointments(
        startISO,
        endISO
      );

      if (dbAppointments && dbAppointments.length > 0) {
        setAppointments(dbAppointments);
        setLastError(null); // Reset error on success
        // Log delle date degli appuntamenti per debug
        dbAppointments.forEach((apt: Appointment) => {
        });
      } else {
        setAppointments([]);
        setLastError(null);
      }
    } catch (error) {
      console.error('Errore nel caricamento degli appuntamenti:', error);
      setLastError(error instanceof Error ? error : new Error(String(error)));

      // Se l'errore è ERR_INSUFFICIENT_RESOURCES, non fare fallback al localStorage
      // per evitare loop infiniti
      if (error instanceof Error && (
        error.message.includes('ERR_INSUFFICIENT_RESOURCES') ||
        error.message.includes('Failed to fetch')
      )) {
        console.warn('⚠️ Network error detected, keeping current appointments to avoid loop');
        // Mantieni gli appuntamenti esistenti invece di resettarli
        return;
      }

      // Fallback al localStorage solo per altri tipi di errori
      try {
        const savedAppointments = localStorage.getItem('appointments');
        if (savedAppointments) {
          setAppointments(JSON.parse(savedAppointments));
        } else {
          setAppointments([]);
        }
      } catch {
        setAppointments([]);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingInProgress(false);
    }
  }, [isLoadingInProgress]);

  // Crea un nuovo appuntamento
  const createAppointment = async (appointmentData: CreateAppointmentData): Promise<Appointment> => {
    setIsLoading(true);

    try {
      // Prova a salvare nel database
      const created = await apiService.createAppointmentDirect({
        client_id: appointmentData.client_id,
        client_name: appointmentData.client_name,
        staff_id: appointmentData.staff_id,
        service_id: appointmentData.service_id,
        start_at: appointmentData.start_at,
        end_at: appointmentData.end_at,
        notes: appointmentData.notes || '',
        status: 'confirmed',
        products: appointmentData.products,
      });

      // Aggiungi l'appuntamento creato alla lista locale immediatamente
      // per evitare di dover ricaricare tutto e causare loop
      setAppointments(prev => {
        // Evita duplicati
        const exists = prev.some(apt => apt.id === created.id);
        if (exists) return prev;
        return [...prev, created].sort((a, b) =>
          new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
        );
      });

      // Ricarica gli appuntamenti dal database in background con un delay
      // per evitare richieste simultanee che causano ERR_INSUFFICIENT_RESOURCES
      setTimeout(() => {
        if (!isLoadingInProgress) {
          loadAppointments().catch(err => {
            console.warn('⚠️ Background reload of appointments failed:', err);
          });
        }
      }, 1000);

      return created;

    } catch (error) {
      console.error('❌ Errore nella creazione dell\'appuntamento nel database:', error);
      throw error;

    } finally {
      setIsLoading(false);
    }
  };

  // Ottieni appuntamenti per una data specifica
  const getAppointmentsForDate = (date: Date): Appointment[] => {
    const dateString = date.toISOString().split('T')[0];
    return appointments.filter(appointment => {
      const appointmentDate = new Date(appointment.start_at).toISOString().split('T')[0];
      return appointmentDate === dateString;
    });
  };

  // Ottieni appuntamenti per un orario specifico
  const getAppointmentForDateTime = (date: Date, time: string): Appointment | null => {
    return (
      appointments.find((appointment) =>
        doesAppointmentOverlapSlot(appointment, date, time)
      ) || null
    );
  };

  // Controlla se un orario è occupato
  const isTimeSlotBooked = (date: Date, time: string): boolean => {
    return getAppointmentForDateTime(date, time) !== null;
  };

  // Elimina un appuntamento
  const deleteAppointment = async (appointmentId: string): Promise<void> => {
    setIsLoading(true);

    try {
      // Usa deleteAppointmentDirect per eliminare completamente l'appuntamento
      await apiService.deleteAppointmentDirect(appointmentId);
      await loadAppointments();
    } catch (error) {
      console.error('❌ Errore nell\'eliminazione dal database:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Aggiorna un appuntamento
  const updateAppointment = async (appointmentId: string, updates: Partial<Appointment>): Promise<void> => {
    setIsLoading(true);

    try {
      // Filtra i valori null e undefined per compatibilità con UpdateAppointmentRequest
      const cleanUpdates: Record<string, any> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== null && value !== undefined) {
          cleanUpdates[key] = value;
        }
      }

      // Prova ad aggiornare nel database
      await apiService.updateAppointment({ id: appointmentId, ...cleanUpdates });
      await loadAppointments();
    } catch (error) {
      console.error('❌ Errore nell\'aggiornamento nel database:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Carica gli appuntamenti all'inizializzazione
  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  return {
    appointments,
    isLoading,
    createAppointment,
    getAppointmentsForDate,
    getAppointmentForDateTime,
    isTimeSlotBooked,
    deleteAppointment,
    updateAppointment,
    loadAppointments,
  };
};
