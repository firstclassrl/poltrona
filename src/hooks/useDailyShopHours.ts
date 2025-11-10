import { useState, useEffect } from 'react';
import type { ShopHoursConfig, DailyHours, TimeSlot, Shop } from '../types';
import { apiService } from '../services/api';

const EXTRA_OPENING_STORAGE_KEY = 'extraShopOpening';
const EXTRA_OPENING_EVENT = 'extra-opening-updated';
const SHOP_HOURS_STORAGE_KEY = 'dailyShopHours';
const LOCAL_SHOP_STORAGE_KEY = 'localShopData';
const SHOP_HOURS_VERSION = 1;

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

const isBrowser = typeof window !== 'undefined';

interface PersistedShopHoursPayload {
  version: number;
  shopHours: ShopHoursConfig;
}

const serializeShopHours = (hours: ShopHoursConfig): string =>
  JSON.stringify({ version: SHOP_HOURS_VERSION, shopHours: hours });

const isPlainShopHoursConfig = (value: unknown): value is ShopHoursConfig => {
  if (!value || typeof value !== 'object') return false;
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.length > 0 && keys.every(key => ['0', '1', '2', '3', '4', '5', '6'].includes(key));
};

const parsePersistedShopHours = (raw: string | null): ShopHoursConfig | null => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed === 'object') {
      if ('shopHours' in parsed && isPlainShopHoursConfig((parsed as PersistedShopHoursPayload).shopHours)) {
        return (parsed as PersistedShopHoursPayload).shopHours;
      }

      // Backward compatibility: stored plain object without wrapper
      if (isPlainShopHoursConfig(parsed)) {
        return parsed as ShopHoursConfig;
      }
    }
  } catch (error) {
    console.error('Error parsing persisted shop hours:', error);
  }

  return null;
};

const readLocalShopData = (): Shop | null => {
  if (!isBrowser) return null;
  const raw = window.localStorage.getItem(LOCAL_SHOP_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Shop;
  } catch (error) {
    console.error('Error parsing local shop data:', error);
    return null;
  }
};

const persistLocalShopData = (shop: Shop) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(LOCAL_SHOP_STORAGE_KEY, JSON.stringify(shop));
  } catch (error) {
    console.error('Error persisting local shop data:', error);
  }
};

const parseOpeningHoursFromShop = (openingHours?: string | null): ShopHoursConfig | null => {
  if (!openingHours) return null;

  try {
    return parsePersistedShopHours(openingHours);
  } catch (error) {
    console.error('Error parsing shop opening hours:', error);
    return null;
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
  const [isInitialized, setIsInitialized] = useState(!isBrowser);

  const persistHoursLocally = (hours: ShopHoursConfig) => {
    if (!isBrowser) return;
    try {
      window.localStorage.setItem(SHOP_HOURS_STORAGE_KEY, serializeShopHours(hours));
    } catch (error) {
      console.error('Error saving shop hours locally:', error);
    }
  };

  const syncHoursWithBackend = async (hours: ShopHoursConfig) => {
    if (!isBrowser) return;

    try {
      const serialized = serializeShopHours(hours);
      let currentShop = readLocalShopData();

      if (!currentShop) {
        try {
          currentShop = await apiService.getShop();
        } catch (error) {
          console.warn('Unable to load shop from backend while syncing hours:', error);
        }
      }

      if (!currentShop) return;

      const updatedShop: Shop = {
        ...currentShop,
        opening_hours: serialized,
        updated_at: new Date().toISOString(),
      };

      persistLocalShopData(updatedShop);

      if (updatedShop.id && updatedShop.id !== 'local-shop') {
        try {
          await apiService.updateShop(updatedShop);
        } catch (error) {
          console.warn('Error syncing shop hours with backend:', error);
        }
      }
    } catch (error) {
      console.error('Unexpected error while syncing shop hours:', error);
    }
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

  useEffect(() => {
    // Load shop hours from localStorage
    if (!isBrowser) return;

    setExtraOpening(readExtraOpeningFromStorage());

    let isMounted = true;

    const loadShopHours = async () => {
      let loadedHours: ShopHoursConfig | null = null;
      let source: 'localStorage' | 'localShop' | 'remote' | null = null;

      const savedHours = window.localStorage.getItem(SHOP_HOURS_STORAGE_KEY);
      const parsedLocal = parsePersistedShopHours(savedHours);
      if (parsedLocal) {
        loadedHours = parsedLocal;
        source = 'localStorage';
      }

      if (!loadedHours) {
        const localShop = readLocalShopData();
        const parsedShop = parseOpeningHoursFromShop(localShop?.opening_hours);
        if (parsedShop) {
          loadedHours = parsedShop;
          source = 'localShop';
        }
      }

      if (!loadedHours) {
        try {
          const remoteShop = await apiService.getShop();
          const parsedRemote = parseOpeningHoursFromShop(remoteShop?.opening_hours);
          if (parsedRemote) {
            loadedHours = parsedRemote;
            source = 'remote';
            persistLocalShopData({
              ...remoteShop,
              opening_hours: serializeShopHours(parsedRemote),
            });
          }
        } catch (error) {
          console.warn('Unable to fetch shop hours from backend, using defaults:', error);
        }
      }

      if (loadedHours) {
        persistHoursLocally(loadedHours);
        if (source === 'localStorage' || source === 'localShop') {
          await syncHoursWithBackend(loadedHours);
        }
      }

      if (isMounted) {
        if (loadedHours) {
          setShopHours(loadedHours);
        }
        setIsInitialized(true);
      }
    };

    void loadShopHours();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateShopHours = (newHours: ShopHoursConfig) => {
    setShopHours(newHours);
    if (isBrowser) {
      persistHoursLocally(newHours);
      void syncHoursWithBackend(newHours);
    }
  };

  const applyExtraOpening = (config: ExtraOpeningConfig | null) => {
    setExtraOpening(config);
    if (config) {
      if (isBrowser) {
        window.localStorage.setItem(EXTRA_OPENING_STORAGE_KEY, JSON.stringify(config));
      }
    } else {
      if (isBrowser) {
        window.localStorage.removeItem(EXTRA_OPENING_STORAGE_KEY);
      }
    }
  };

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
    shopHoursLoaded: isInitialized,
  };
};
