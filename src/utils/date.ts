import type { Appointment } from '../types';

export const formatDate = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const formatTime = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false, // Forza formato 24 ore
  });
};

export const formatDateTime = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false, // Forza formato 24 ore
  });
};

export const getWeekDates = (date: Date = new Date()): { start: string; end: string } => {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay() + 1); // Monday
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // Sunday
  end.setHours(23, 59, 59, 999);
  
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

export const getTodayRange = (): { start: string; end: string } => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

export const generateTimeSlots = (startHour: number = 9, endHour: number = 19, interval: number = 30): string[] => {
  const slots = [];
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += interval) {
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      slots.push(time);
    }
  }
  return slots;
};

export const addMinutes = (date: Date, minutes: number): Date => {
  return new Date(date.getTime() + minutes * 60000);
};

export const getSlotDateTime = (date: Date, time: string): Date => {
  const [hours, minutes] = time.split(':').map(Number);
  const slotDate = new Date(date);
  slotDate.setHours(hours, minutes, 0, 0);
  return slotDate;
};

export const doesAppointmentOverlapSlot = (
  appointment: Appointment,
  slotDate: Date,
  slotTime: string,
  slotDurationMinutes: number = 15
): boolean => {
  if (appointment.status === 'cancelled') {
    return false;
  }

  const slotDateString = slotDate.toISOString().split('T')[0];
  const appointmentDateString = new Date(appointment.start_at).toISOString().split('T')[0];

  if (slotDateString !== appointmentDateString) {
    return false;
  }

  const slotStart = getSlotDateTime(slotDate, slotTime);
  const slotEnd = addMinutes(slotStart, slotDurationMinutes);

  const appointmentStart = new Date(appointment.start_at);
  const appointmentEnd = appointment.end_at
    ? new Date(appointment.end_at)
    : addMinutes(
        appointmentStart,
        appointment.services?.duration_min || slotDurationMinutes
      );

  return slotStart < appointmentEnd && slotEnd > appointmentStart;
};

/**
 * Calcola quanti slot di 15 minuti occupa un appuntamento
 */
export const getAppointmentSlotCount = (appointment: Appointment): number => {
  const durationMinutes = appointment.services?.duration_min || 30;
  return Math.ceil(durationMinutes / 15);
};

/**
 * Verifica se due appuntamenti si sovrappongono
 */
export const doAppointmentsOverlap = (
  appointment1: Appointment,
  appointment2: Appointment
): boolean => {
  // Gli appuntamenti cancellati non si sovrappongono
  if (appointment1.status === 'cancelled' || appointment2.status === 'cancelled') {
    return false;
  }

  // Devono essere dello stesso staff per sovrapporsi
  if (appointment1.staff_id !== appointment2.staff_id) {
    return false;
  }

  const start1 = new Date(appointment1.start_at);
  const end1 = appointment1.end_at ? new Date(appointment1.end_at) : addMinutes(start1, appointment1.services?.duration_min || 30);
  
  const start2 = new Date(appointment2.start_at);
  const end2 = appointment2.end_at ? new Date(appointment2.end_at) : addMinutes(start2, appointment2.services?.duration_min || 30);

  // Due appuntamenti si sovrappongono se: start1 < end2 && end1 > start2
  return start1 < end2 && end1 > start2;
};

/**
 * Verifica se un nuovo appuntamento si sovrappone con quelli esistenti
 */
export const checkAppointmentOverlap = (
  newAppointment: {
    staff_id: string;
    start_at: string;
    end_at: string;
  },
  existingAppointments: Appointment[]
): boolean => {
  const newStart = new Date(newAppointment.start_at);
  const newEnd = new Date(newAppointment.end_at);
  const newStartTime = newStart.getTime();
  const newEndTime = newEnd.getTime();

  return existingAppointments.some(existing => {
    if (existing.status === 'cancelled') return false;
    if (existing.staff_id !== newAppointment.staff_id) return false;

    const existingStart = new Date(existing.start_at);
    const existingEnd = existing.end_at 
      ? new Date(existing.end_at)
      : addMinutes(existingStart, existing.services?.duration_min || 30);
    
    const existingStartTime = existingStart.getTime();
    const existingEndTime = existingEnd.getTime();

    // Check if appointments overlap: start1 < end2 && end1 > start2
    // Allow exact boundaries (one ends exactly when the other starts)
    const overlaps = newStartTime < existingEndTime && newEndTime > existingStartTime;
    
    return overlaps;
  });
};