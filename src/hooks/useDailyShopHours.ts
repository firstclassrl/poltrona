import { useState, useEffect } from 'react';
import type { ShopHoursConfig, DailyHours, TimeSlot } from '../types';

const EXTRA_OPENING_STORAGE_KEY = 'extraShopOpening';
const EXTRA_OPENING_EVENT = 'extra-opening-updated';

interface ExtraOpeningConfig {
  date: string;
  morningStart?: string | null;
  morningEnd?: string | null;
  afternoonStart?: string | null;
  afternoonEnd?: string | null;
}

const getMinutesFromTime = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const DAYS_OF_WEEK = [
  { key: 0, name: 'Domenica', shortName: 'Dom' },
  { key: 1, name: 'Lunedì', shortName: 'Lun' },
  { key: 2, name: 'Martedì', shortName: 'Mar' },
  { key: 3, name: 'Mercoledì', shortName: 'Mer' },
  { key: 4, name: 'Giovedì', shortName: 'Gio' },
  { key: 5, name: 'Venerdì', shortName: 'Ven' },
  { key: 6, name: 'Sabato', shortName: 'Sab' },
];

// Default shop hours configuration (24-hour format)
const getDefaultShopHours = (): ShopHoursConfig => ({
  0: { isOpen: false, timeSlots: [] }, // Domenica chiuso
  1: { isOpen: true, timeSlots: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '19:00' }] }, // Lunedì
  2: { isOpen: true, timeSlots: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '19:00' }] }, // Martedì
  3: { isOpen: true, timeSlots: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '19:00' }] }, // Mercoledì
  4: { isOpen: true, timeSlots: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '19:00' }] }, // Giovedì
  5: { isOpen: true, timeSlots: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '19:00' }] }, // Venerdì
  6: { isOpen: true, timeSlots: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '19:00' }] }, // Sabato
});

export const useDailyShopHours = () => {
  const [shopHours, setShopHours] = useState<ShopHoursConfig>(getDefaultShopHours());
  const [extraOpening, setExtraOpening] = useState<ExtraOpeningConfig | null>(null);

  const readExtraOpeningFromStorage = (): ExtraOpeningConfig | null => {
    const stored = localStorage.getItem(EXTRA_OPENING_STORAGE_KEY);
    if (!stored) return null;
    try {
      const parsed = JSON.parse(stored) as ExtraOpeningConfig;
      if (!parsed?.date) return null;
      return parsed;
    } catch (error) {
      console.error('Error parsing extra opening data:', error);
      return null;
    }
  };

  useEffect(() => {
    // Load shop hours from localStorage
    const savedHours = localStorage.getItem('dailyShopHours');
    if (savedHours) {
      try {
        const parsed = JSON.parse(savedHours);
        setShopHours(parsed);
      } catch (error) {
        console.error('Error loading shop hours:', error);
        setShopHours(getDefaultShopHours());
      }
    }

    setExtraOpening(readExtraOpeningFromStorage());
  }, []);

  const updateShopHours = (newHours: ShopHoursConfig) => {
    setShopHours(newHours);
    localStorage.setItem('dailyShopHours', JSON.stringify(newHours));
  };

  const applyExtraOpening = (config: ExtraOpeningConfig | null) => {
    setExtraOpening(config);
    if (config) {
      localStorage.setItem(EXTRA_OPENING_STORAGE_KEY, JSON.stringify(config));
    } else {
      localStorage.removeItem(EXTRA_OPENING_STORAGE_KEY);
    }
  };

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === EXTRA_OPENING_STORAGE_KEY) {
        setExtraOpening(readExtraOpeningFromStorage());
      }
    };

    const handleExtraOpeningEvent = (event: Event) => {
      const customEvent = event as CustomEvent<ExtraOpeningConfig | null>;
      setExtraOpening(customEvent.detail ?? null);
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(EXTRA_OPENING_EVENT, handleExtraOpeningEvent as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(EXTRA_OPENING_EVENT, handleExtraOpeningEvent as EventListener);
    };
  }, []);

  const getIsoDate = (date: Date) => date.toISOString().split('T')[0];

  const isExtraOpeningActiveForDate = (date: Date): boolean => {
    if (!extraOpening?.date) return false;
    const matches = extraOpening.date === getIsoDate(date);
    if (!matches) return false;

    const hasMorning = extraOpening.morningStart && extraOpening.morningEnd;
    const hasAfternoon = extraOpening.afternoonStart && extraOpening.afternoonEnd;
    return Boolean(hasMorning || hasAfternoon);
  };

  const getExtraTimeSlots = (date: Date, slotDurationMinutes: number = 30): string[] => {
    if (!isExtraOpeningActiveForDate(date) || !extraOpening) return [];

    const slots: string[] = [];

    const pushRange = (start?: string | null, end?: string | null) => {
      if (!start || !end) return;
      const [startHours, startMinutes] = start.split(':').map(Number);
      const [endHours, endMinutes] = end.split(':').map(Number);
      let currentTime = startHours * 60 + startMinutes;
      const endTime = endHours * 60 + endMinutes;

      while (currentTime + slotDurationMinutes <= endTime) {
        const hours = Math.floor(currentTime / 60);
        const minutes = currentTime % 60;
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        slots.push(timeString);
        currentTime += slotDurationMinutes;
      }
    };

    pushRange(extraOpening.morningStart, extraOpening.morningEnd);
    pushRange(extraOpening.afternoonStart, extraOpening.afternoonEnd);

    return slots;
  };

  const updateDayHours = (dayOfWeek: number, dayHours: DailyHours) => {
    const newHours = { ...shopHours, [dayOfWeek]: dayHours };
    updateShopHours(newHours);
  };

  const addTimeSlot = (dayOfWeek: number, timeSlot: TimeSlot) => {
    const dayHours = shopHours[dayOfWeek];
    const newTimeSlots = [...dayHours.timeSlots, timeSlot];
    updateDayHours(dayOfWeek, { ...dayHours, timeSlots: newTimeSlots });
  };

  const removeTimeSlot = (dayOfWeek: number, slotIndex: number) => {
    const dayHours = shopHours[dayOfWeek];
    const newTimeSlots = dayHours.timeSlots.filter((_, index) => index !== slotIndex);
    updateDayHours(dayOfWeek, { ...dayHours, timeSlots: newTimeSlots });
  };

  const updateTimeSlot = (dayOfWeek: number, slotIndex: number, timeSlot: TimeSlot) => {
    const dayHours = shopHours[dayOfWeek];
    const newTimeSlots = dayHours.timeSlots.map((slot, index) => 
      index === slotIndex ? timeSlot : slot
    );
    updateDayHours(dayOfWeek, { ...dayHours, timeSlots: newTimeSlots });
  };

  const toggleDayOpen = (dayOfWeek: number) => {
    const dayHours = shopHours[dayOfWeek];
    updateDayHours(dayOfWeek, { ...dayHours, isOpen: !dayHours.isOpen });
  };

  // Check if a specific date is open
  const isDateOpen = (date: Date): boolean => {
    if (isExtraOpeningActiveForDate(date)) return true;
    const dayOfWeek = date.getDay();
    return shopHours[dayOfWeek]?.isOpen || false;
  };

  // Check if a specific time is within opening hours for a date
  const isTimeWithinHours = (date: Date, time: string): boolean => {
    if (isExtraOpeningActiveForDate(date)) {
      if (!extraOpening) return false;

      const checkRange = (start?: string | null, end?: string | null) => {
        if (!start || !end) return false;
        const [startHours, startMinutes] = start.split(':').map(Number);
        const [endHours, endMinutes] = end.split(':').map(Number);
        const timeInMinutes = getMinutesFromTime(time);
        const startTime = startHours * 60 + startMinutes;
        const endTime = endHours * 60 + endMinutes;
        return timeInMinutes >= startTime && timeInMinutes < endTime;
      };

      return (
        checkRange(extraOpening.morningStart, extraOpening.morningEnd) ||
        checkRange(extraOpening.afternoonStart, extraOpening.afternoonEnd)
      );
    }

    if (!isDateOpen(date)) return false;
    
    const dayOfWeek = date.getDay();
    const dayHours = shopHours[dayOfWeek];
    
    if (!dayHours.isOpen || dayHours.timeSlots.length === 0) return false;
    
    const [hours, minutes] = time.split(':').map(Number);
    const timeInMinutes = hours * 60 + minutes;
    
    return dayHours.timeSlots.some(slot => {
      const [startHours, startMinutes] = slot.start.split(':').map(Number);
      const [endHours, endMinutes] = slot.end.split(':').map(Number);
      const startTime = startHours * 60 + startMinutes;
      const endTime = endHours * 60 + endMinutes;
      
      return timeInMinutes >= startTime && timeInMinutes < endTime;
    });
  };

  // Get available time slots for a specific date
  const getAvailableTimeSlots = (date: Date, slotDurationMinutes: number = 30): string[] => {
    if (isExtraOpeningActiveForDate(date)) {
      return getExtraTimeSlots(date, slotDurationMinutes);
    }

    if (!isDateOpen(date)) return [];
    
    const dayOfWeek = date.getDay();
    const dayHours = shopHours[dayOfWeek];
    
    if (!dayHours.isOpen || dayHours.timeSlots.length === 0) return [];
    
    const slots: string[] = [];
    
    dayHours.timeSlots.forEach(slot => {
      const [startHours, startMinutes] = slot.start.split(':').map(Number);
      const [endHours, endMinutes] = slot.end.split(':').map(Number);
      const startTime = startHours * 60 + startMinutes;
      const endTime = endHours * 60 + endMinutes;
      
      let currentTime = startTime;
      
      while (currentTime + slotDurationMinutes <= endTime) {
        const hours = Math.floor(currentTime / 60);
        const minutes = currentTime % 60;
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        slots.push(timeString);
        currentTime += slotDurationMinutes;
      }
    });
    
    return slots;
  };

  // Get shop hours summary for display
  const getShopHoursSummary = (): string => {
    const summary: string[] = [];
    
    DAYS_OF_WEEK.forEach(day => {
      const dayHours = shopHours[day.key];
      if (dayHours.isOpen && dayHours.timeSlots.length > 0) {
        const timeSlotsStr = dayHours.timeSlots
          .map(slot => `${slot.start}-${slot.end}`)
          .join(', ');
        summary.push(`${day.shortName}: ${timeSlotsStr}`);
      } else {
        summary.push(`${day.shortName}: Chiuso`);
      }
    });
    
    return summary.join(' | ');
  };

  return {
    shopHours,
    DAYS_OF_WEEK,
    updateShopHours,
    updateDayHours,
    addTimeSlot,
    removeTimeSlot,
    updateTimeSlot,
    toggleDayOpen,
    isDateOpen,
    isTimeWithinHours,
    getAvailableTimeSlots,
    getShopHoursSummary,
    extraOpening,
    applyExtraOpening,
    refreshExtraOpening: () => setExtraOpening(readExtraOpeningFromStorage()),
  };
};
