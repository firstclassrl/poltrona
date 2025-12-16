import type { Appointment } from '../types';
import { addMinutes, getSlotDateTime } from './date';

interface FindAvailableSlotsParams {
  startDate: Date;
  endDate: Date;
  durationMin: number;
  appointments: Appointment[];
  isDateOpen: (date: Date) => boolean;
  isDateInVacation?: (date: Date) => boolean;
  getAvailableTimeSlots: (date: Date, slotDurationMinutes?: number) => string[];
  staffId?: string;
}

export interface AvailableSlot {
  date: Date;
  time: string; // HH:mm
}

export const findAvailableSlotsForDuration = ({
  startDate,
  endDate,
  durationMin,
  appointments,
  isDateOpen,
  isDateInVacation,
  getAvailableTimeSlots,
  staffId,
}: FindAvailableSlotsParams): AvailableSlot[] => {
  const results: AvailableSlot[] = [];

  const dayStart = new Date(startDate);
  dayStart.setHours(0, 0, 0, 0);

  const lastDay = new Date(endDate);
  lastDay.setHours(0, 0, 0, 0);

  // Work with 15-minute base slots
  const baseSlotMinutes = 15;

  for (
    let current = new Date(dayStart);
    current <= lastDay;
    current.setDate(current.getDate() + 1)
  ) {
    const day = new Date(current);

    if (!isDateOpen(day)) continue;
    if (isDateInVacation && isDateInVacation(day)) continue;

    const slots = getAvailableTimeSlots(day, baseSlotMinutes);
    if (!slots.length) continue;

    for (const time of slots) {
      const slotStart = getSlotDateTime(day, time);
      const slotEnd = addMinutes(slotStart, durationMin);

      // Ensure full interval is within opening hours:
      // we require that all 15m sub-slots in [slotStart, slotEnd) exist
      let fitsInHours = true;
      let checkTime = new Date(slotStart);
      while (checkTime < slotEnd) {
        const hh = checkTime.getHours().toString().padStart(2, '0');
        const mm = checkTime.getMinutes().toString().padStart(2, '0');
        const checkLabel = `${hh}:${mm}`;
        if (!slots.includes(checkLabel)) {
          fitsInHours = false;
          break;
        }
        checkTime = addMinutes(checkTime, baseSlotMinutes);
      }
      if (!fitsInHours) continue;

      // Check overlap with existing appointments
      const overlaps = appointments.some((apt) => {
        if (apt.status === 'cancelled') return false;
        if (staffId && apt.staff_id !== staffId) return false;

        const aptStart = new Date(apt.start_at);
        const aptEnd = apt.end_at
          ? new Date(apt.end_at)
          : addMinutes(
              aptStart,
              apt.services?.duration_min ?? durationMin
            );

        // same day check
        if (
          aptStart.toDateString() !== day.toDateString() &&
          aptEnd.toDateString() !== day.toDateString()
        ) {
          return false;
        }

        // intervals overlap?
        return slotStart < aptEnd && slotEnd > aptStart;
      });

      if (!overlaps) {
        results.push({ date: day, time });
      }
    }
  }

  return results;
};















