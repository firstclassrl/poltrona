import { useState, useEffect } from 'react';
import type { ShopHoursConfig, DailyHours, TimeSlot } from '../types';
import { apiService } from '../services/api';
import { createDefaultShopHoursConfig } from '../utils/shopHours';

const EXTRA_OPENING_STORAGE_KEY = 'extraShopOpening';
const EXTRA_OPENING_EVENT = 'extra-opening-updated';
const SHOP_HOURS_STORAGE_KEY = 'dailyShopHours';
const SHOP_HOURS_CACHE_VERSION = 1;

interface ExtraOpeningConfig {
  date: string;
  morningStart?: string | null;
  morningEnd?: string | null;
  afternoonStart?: string | null;
  afternoonEnd?: string | null;
}

interface PersistedHoursPayload {
  version: number;
  data: ShopHoursConfig;
}

const isBrowser = typeof window !== 'undefined';

const getMinutesFromTime = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const readExtraOpeningFromStorage = (): ExtraOpeningConfig | null => {
  if (!isBrowser) return null;
  const stored = window.localStorage.getItem(EXTRA_OPENING_STORAGE_KEY);
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

const readCachedHours = (): ShopHoursConfig | null => {
  if (!isBrowser) return null;
  const raw = window.localStorage.getItem(SHOP_HOURS_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedHoursPayload | ShopHoursConfig;
    if ('data' in (parsed as PersistedHoursPayload)) {
      const payload = parsed as PersistedHoursPayload;
      if (payload.version === SHOP_HOURS_CACHE_VERSION) {
        return payload.data;
      }
      return null;
    }
    return parsed as ShopHoursConfig;
  } catch (error) {
    console.error('Error parsing cached shop hours:', error);
    return null;
  }
};

const persistHoursLocally = (hours: ShopHoursConfig) => {
  if (!isBrowser) return;
  try {
    const payload: PersistedHoursPayload = {
      version: SHOP_HOURS_CACHE_VERSION,
      data: hours,
    };
    window.localStorage.setItem(SHOP_HOURS_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error('Error saving shop hours locally:', error);
  }
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

export const useDailyShopHours = () => {
  const [shopHours, setShopHours] = useState<ShopHoursConfig>(createDefaultShopHoursConfig());
  const [extraOpening, setExtraOpening] = useState<ExtraOpeningConfig | null>(null);
  const [shopHoursLoaded, setShopHoursLoaded] = useState(!isBrowser);

  useEffect(() => {
    if (!isBrowser) return;

    const cached = readCachedHours();
    if (cached) {
      setShopHours(cached);
    }
    setExtraOpening(readExtraOpeningFromStorage());

    // Only fetch from backend if user is authenticated
    const authToken = localStorage.getItem('auth_token');
    if (!authToken) {
      // No auth token - use cached data or defaults, mark as loaded
      setShopHoursLoaded(true);
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        const remoteHours = await apiService.getDailyShopHours();
        if (!isMounted) return;
        setShopHours(remoteHours);
        persistHoursLocally(remoteHours);
      } catch (error) {
        console.error('Error loading shop hours from backend:', error);
      } finally {
        if (isMounted) {
          setShopHoursLoaded(true);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isBrowser) return;

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

  const updateShopHours = (newHours: ShopHoursConfig) => {
    setShopHours(newHours);
    persistHoursLocally(newHours);
    void apiService.saveDailyShopHours(newHours).catch((error) => {
      console.error('Error saving daily shop hours:', error);
    });
  };

  const applyExtraOpening = (config: ExtraOpeningConfig | null) => {
    setExtraOpening(config);
    if (!isBrowser) return;
    if (config) {
      window.localStorage.setItem(EXTRA_OPENING_STORAGE_KEY, JSON.stringify(config));
    } else {
      window.localStorage.removeItem(EXTRA_OPENING_STORAGE_KEY);
    }
  };

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
    shopHoursLoaded,
  };
};
