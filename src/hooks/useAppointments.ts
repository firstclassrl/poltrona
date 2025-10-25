import { useState, useEffect } from 'react';
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

  // Carica gli appuntamenti dal localStorage
  const loadAppointments = () => {
    try {
      const savedAppointments = localStorage.getItem('appointments');
      if (savedAppointments) {
        setAppointments(JSON.parse(savedAppointments));
      } else {
        // Se non ci sono appuntamenti salvati, inizializza con array vuoto
        setAppointments([]);
      }
    } catch (error) {
      console.error('Errore nel caricamento degli appuntamenti:', error);
      setAppointments([]);
    }
  };

  // Salva gli appuntamenti nel localStorage
  const saveAppointments = (newAppointments: Appointment[]) => {
    try {
      localStorage.setItem('appointments', JSON.stringify(newAppointments));
      setAppointments(newAppointments);
    } catch (error) {
      console.error('Errore nel salvataggio degli appuntamenti:', error);
    }
  };

  // Crea un nuovo appuntamento
  const createAppointment = async (appointmentData: CreateAppointmentData): Promise<Appointment> => {
    setIsLoading(true);
    
    try {
      // Simula chiamata API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
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

      // Aggiungi il nuovo appuntamento alla lista
      const updatedAppointments = [...appointments, newAppointment];
      saveAppointments(updatedAppointments);
      
      console.log('✅ Appuntamento creato e salvato:', newAppointment);
      return newAppointment;
      
    } catch (error) {
      console.error('❌ Errore nella creazione dell\'appuntamento:', error);
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
      const updatedAppointments = appointments.filter(app => app.id !== appointmentId);
      saveAppointments(updatedAppointments);
      console.log('✅ Appuntamento eliminato:', appointmentId);
    } catch (error) {
      console.error('❌ Errore nell\'eliminazione dell\'appuntamento:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Aggiorna un appuntamento
  const updateAppointment = async (appointmentId: string, updates: Partial<Appointment>): Promise<void> => {
    setIsLoading(true);
    
    try {
      const updatedAppointments = appointments.map(app => 
        app.id === appointmentId 
          ? { ...app, ...updates, updated_at: new Date().toISOString() }
          : app
      );
      saveAppointments(updatedAppointments);
      console.log('✅ Appuntamento aggiornato:', appointmentId);
    } catch (error) {
      console.error('❌ Errore nell\'aggiornamento dell\'appuntamento:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Carica gli appuntamenti all'inizializzazione
  useEffect(() => {
    loadAppointments();
  }, []);

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
