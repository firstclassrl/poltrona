import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import type { Appointment } from '../types';
import { doesAppointmentOverlapSlot } from '../utils/date';

export interface CreateAppointmentData {
  client_id: string;
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
  const [isLoading, setIsLoading] = useState(false);

  // Carica gli appuntamenti dal database
  const loadAppointments = useCallback(async () => {
    try {
      setIsLoading(true);
      // Carica appuntamenti per un range ampio (1 settimana fa fino a 2 anni nel futuro)
      // per includere appuntamenti prenotati anche molto in anticipo (es. 2026)
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 7); // 1 settimana fa
      const endDate = new Date(today);
      endDate.setFullYear(today.getFullYear() + 2); // 2 anni nel futuro
      
      const dbAppointments = await apiService.getAppointments(
        startDate.toISOString(),
        endDate.toISOString()
      );
      
      if (dbAppointments && dbAppointments.length > 0) {
        setAppointments(dbAppointments);
        console.log('✅ Appuntamenti caricati dal database:', dbAppointments.length);
      } else {
        // Fallback al localStorage se il database è vuoto o non disponibile
        setAppointments([]);
      }
    } catch (error) {
      console.error('Errore nel caricamento degli appuntamenti:', error);
      // Fallback al localStorage in caso di errore
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
    }
  }, []);

  // Crea un nuovo appuntamento
  const createAppointment = async (appointmentData: CreateAppointmentData): Promise<Appointment> => {
    setIsLoading(true);
    
    try {
      // Prova a salvare nel database
      const created = await apiService.createAppointmentDirect({
        client_id: appointmentData.client_id,
        staff_id: appointmentData.staff_id,
        service_id: appointmentData.service_id,
        start_at: appointmentData.start_at,
        end_at: appointmentData.end_at,
        notes: appointmentData.notes || '',
        status: 'confirmed',
      });
      
      // Ricarica gli appuntamenti dal database per avere i dati completi
      await loadAppointments();
      
      console.log('✅ Appuntamento creato nel database:', created);
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
      console.log('✅ Appuntamento eliminato dal database:', appointmentId);
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
      console.log('✅ Appuntamento aggiornato nel database:', appointmentId);
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
