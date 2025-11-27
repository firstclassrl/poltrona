import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import type { Appointment } from '../types';

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
      // Carica appuntamenti per le prossime 4 settimane
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 7); // 1 settimana fa
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 28); // 4 settimane avanti
      
      const dbAppointments = await apiService.getAppointments(
        startDate.toISOString(),
        endDate.toISOString()
      );
      
      if (dbAppointments && dbAppointments.length > 0) {
        setAppointments(dbAppointments);
        console.log('✅ Appuntamenti caricati dal database:', dbAppointments.length);
      } else {
        // Fallback al localStorage se il database è vuoto o non disponibile
        const savedAppointments = localStorage.getItem('appointments');
        if (savedAppointments) {
          setAppointments(JSON.parse(savedAppointments));
          console.log('ℹ️ Appuntamenti caricati dal localStorage (fallback)');
        } else {
          setAppointments([]);
        }
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
      console.error('❌ Errore nella creazione dell\'appuntamento nel database, uso localStorage:', error);
      
      // Fallback al localStorage se il database non funziona
      const newAppointment: Appointment = {
        id: `appt_${Date.now()}`,
        shop_id: '1',
        client_id: appointmentData.client_id,
        staff_id: appointmentData.staff_id,
        service_id: appointmentData.service_id,
        start_at: appointmentData.start_at,
        end_at: appointmentData.end_at,
        status: 'confirmed',
        notes: appointmentData.notes || '',
        gcal_event_id: null,
        products: appointmentData.products || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        clients: {
          id: appointmentData.client_id,
          shop_id: '1',
          first_name: 'Cliente',
          last_name: 'Demo',
          phone_e164: '+39 123 456 7890',
          email: 'cliente@example.com',
          photo_url: null,
          notes: null,
          created_at: new Date().toISOString(),
        },
        staff: {
          id: appointmentData.staff_id,
          shop_id: '1',
          full_name: 'Barbiere Demo',
          role: 'Barbiere',
          calendar_id: null,
          active: true,
          chair_id: 'chair_1',
          profile_photo_url: null,
          email: 'barbiere@example.com',
          created_at: new Date().toISOString(),
        },
        services: {
          id: appointmentData.service_id,
          shop_id: '1',
          name: 'Servizio Demo',
          duration_min: 60,
          price_cents: 2500,
          active: true,
          image_url: null,
        },
      };

      // Salva nel localStorage come fallback
      const updatedAppointments = [...appointments, newAppointment];
      localStorage.setItem('appointments', JSON.stringify(updatedAppointments));
      setAppointments(updatedAppointments);
      
      console.log('⚠️ Appuntamento salvato in localStorage (fallback):', newAppointment);
      return newAppointment;
      
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
    const dateString = date.toISOString().split('T')[0];
    return appointments.find(appointment => {
      const appointmentDate = new Date(appointment.start_at).toISOString().split('T')[0];
      const appointmentTime = new Date(appointment.start_at).toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      return appointmentDate === dateString && appointmentTime === time;
    }) || null;
  };

  // Controlla se un orario è occupato
  const isTimeSlotBooked = (date: Date, time: string): boolean => {
    return getAppointmentForDateTime(date, time) !== null;
  };

  // Elimina un appuntamento
  const deleteAppointment = async (appointmentId: string): Promise<void> => {
    setIsLoading(true);
    
    try {
      // Prova a eliminare dal database
      await apiService.cancelAppointment(appointmentId);
      await loadAppointments();
      console.log('✅ Appuntamento eliminato dal database:', appointmentId);
    } catch (error) {
      console.error('❌ Errore nell\'eliminazione dal database, uso localStorage:', error);
      // Fallback al localStorage
      const updatedAppointments = appointments.filter(app => app.id !== appointmentId);
      localStorage.setItem('appointments', JSON.stringify(updatedAppointments));
      setAppointments(updatedAppointments);
    } finally {
      setIsLoading(false);
    }
  };

  // Aggiorna un appuntamento
  const updateAppointment = async (appointmentId: string, updates: Partial<Appointment>): Promise<void> => {
    setIsLoading(true);
    
    try {
      // Prova ad aggiornare nel database
      await apiService.updateAppointment({ id: appointmentId, ...updates });
      await loadAppointments();
      console.log('✅ Appuntamento aggiornato nel database:', appointmentId);
    } catch (error) {
      console.error('❌ Errore nell\'aggiornamento nel database, uso localStorage:', error);
      // Fallback al localStorage
      const updatedAppointments = appointments.map(app => 
        app.id === appointmentId 
          ? { ...app, ...updates, updated_at: new Date().toISOString() }
          : app
      );
      localStorage.setItem('appointments', JSON.stringify(updatedAppointments));
      setAppointments(updatedAppointments);
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
