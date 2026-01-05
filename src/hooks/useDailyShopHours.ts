import { useState, useEffect, useRef, useCallback } from 'react';
import type { ShopHoursConfig, DailyHours, TimeSlot } from '../types';
import { apiService } from '../services/api';
import { createDefaultShopHoursConfig } from '../utils/shopHours';
import { isItalianHoliday } from '../utils/italianHolidays';

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
  const [autoCloseHolidays, setAutoCloseHolidays] = useState<boolean>(true); // Default true
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef<ShopHoursConfig | null>(null);

  useEffect(() => {
    if (!isBrowser) return;

    const cached = readCachedHours();
    if (cached) {
      setShopHours(cached);
    }
    setExtraOpening(readExtraOpeningFromStorage());

    // Try to fetch from backend even without auth token (for client booking)
    // The RLS policies allow public read access to shop hours
    const authToken = localStorage.getItem('auth_token');
    const shopId = localStorage.getItem('current_shop_id');
    
    // If we have a shop_id, try to load hours even without auth
    // This is important for client booking calendar
    if (!authToken && (!shopId || shopId === 'default')) {
      // No auth token and no shop_id - use cached data or defaults, mark as loaded
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
        
        // Load shop auto_close_holidays setting (only if authenticated)
        if (authToken) {
          try {
            const shop = await apiService.getShop();
            if (!isMounted) return;
            setAutoCloseHolidays(shop.auto_close_holidays ?? true);
          } catch (shopError) {
            // If shop fetch fails, use default (true)
            setAutoCloseHolidays(true);
          }
        }
      } catch (error) {
        console.error('❌ Error loading shop hours from backend:', error);
        // Se c'è un errore, mantieni i dati dalla cache locale invece di usare i default
        // I dati dalla cache sono già stati impostati all'inizio dell'useEffect
        // Se non c'è cache, usa i default solo come ultima risorsa
        if (!cached) {
          setShopHours(createDefaultShopHoursConfig());
        } else {
        }
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

    let lastShopId: string | null = null;

    const loadShopHours = async () => {
      const authToken = localStorage.getItem('auth_token');
      const shopId = localStorage.getItem('current_shop_id');
      
      // Load hours even without auth if we have a shop_id (for client booking)
      if (!authToken && (!shopId || shopId === 'default')) {
        return;
      }

      try {
        const remoteHours = await apiService.getDailyShopHours();
        setShopHours(remoteHours);
        persistHoursLocally(remoteHours);
        
        // Load shop auto_close_holidays setting (only if authenticated)
        if (authToken) {
          try {
            const shop = await apiService.getShop();
            setAutoCloseHolidays(shop.auto_close_holidays ?? true);
          } catch (shopError) {
            setAutoCloseHolidays(true);
          }
        }
      } catch (error) {
        console.error('❌ Error reloading shop hours:', error);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === EXTRA_OPENING_STORAGE_KEY) {
        setExtraOpening(readExtraOpeningFromStorage());
      } else if (event.key === 'current_shop_id') {
        // Shop changed - reload shop hours
        const newShopId = event.newValue;
        if (newShopId && newShopId !== lastShopId && newShopId !== 'default') {
          lastShopId = newShopId;
          loadShopHours();
        }
      }
    };

    // Also listen for same-tab changes (storage event only fires for other tabs)
    const checkShopIdChange = () => {
      const currentShopId = localStorage.getItem('current_shop_id');
      if (currentShopId && currentShopId !== lastShopId && currentShopId !== 'default') {
        lastShopId = currentShopId;
        loadShopHours();
      }
    };

    const handleExtraOpeningEvent = (event: Event) => {
      const customEvent = event as CustomEvent<ExtraOpeningConfig | null>;
      setExtraOpening(customEvent.detail ?? null);
    };

    // Initial check
    lastShopId = localStorage.getItem('current_shop_id');

    window.addEventListener('storage', handleStorage);
    window.addEventListener(EXTRA_OPENING_EVENT, handleExtraOpeningEvent as EventListener);
    
    // Check for shop changes periodically (for same-tab changes)
    const intervalId = setInterval(checkShopIdChange, 1000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(EXTRA_OPENING_EVENT, handleExtraOpeningEvent as EventListener);
      clearInterval(intervalId);
    };
  }, []);

  const performSave = useCallback(async (hoursToSave: ShopHoursConfig) => {
    try {
      const wasSaved = await apiService.saveDailyShopHours(hoursToSave);
      
      // NON fare il reload automatico dopo il salvataggio
      // Il reload sovrascrive lo stato locale e può causare problemi
      // Lo stato locale è già sincronizzato con quello che è stato salvato
      if (wasSaved) {
        // Non fare reload - lo stato locale è già corretto
      } else {
      }
    } catch (error) {
      console.error('❌ Error saving daily shop hours:', error);
      // Mostra un messaggio di errore all'utente
      alert(`Errore nel salvataggio degli orari: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    }
  }, []);

  const updateShopHours = useCallback((newHours: ShopHoursConfig) => {
    setShopHours(newHours);
    shopHoursRef.current = newHours; // Aggiorna anche il ref
    persistHoursLocally(newHours);
    // NON salvare automaticamente - solo aggiorna lo stato locale
    // Il salvataggio sarà fatto manualmente quando l'utente clicca su "Salva"
  }, []);

  // Funzione per salvataggio manuale - usa un ref per evitare problemi di stale closure
  const shopHoursRef = useRef<ShopHoursConfig>(shopHours);
  
  // Aggiorna il ref ogni volta che shopHours cambia
  useEffect(() => {
    shopHoursRef.current = shopHours;
  }, [shopHours]);

  const saveShopHours = useCallback(async (): Promise<boolean> => {
    try {
      // Leggi lo stato corrente dal ref invece di usare la closure
      // Questo evita problemi di stale closure
      const currentHours = shopHoursRef.current;
      const wasSaved = await apiService.saveDailyShopHours(currentHours);
      if (wasSaved) {
        // Dopo il salvataggio, ricarica i dati dal database per sincronizzare
        try {
          const reloadedHours = await apiService.getDailyShopHours();
          setShopHours(reloadedHours);
          shopHoursRef.current = reloadedHours;
          persistHoursLocally(reloadedHours);
        } catch (reloadError) {
          console.error('⚠️ Error reloading shop hours after save:', reloadError);
        }
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('❌ Error saving shop hours:', error);
      throw error;
    }
  }, []); // Nessuna dipendenza - usa sempre il ref aggiornato

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

  const getExtraTimeSlots = (date: Date, slotDurationMinutes: number = 15): string[] => {
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
    // Usa una funzione di aggiornamento per leggere sempre lo stato corrente
    setShopHours((currentHours) => {
      const newHours = { ...currentHours, [dayOfWeek]: dayHours };
      persistHoursLocally(newHours);
      shopHoursRef.current = newHours; // Aggiorna anche il ref
      return newHours;
    });
  };

  const addTimeSlot = (dayOfWeek: number, timeSlot: TimeSlot) => {
    setShopHours((currentHours) => {
      const dayHours = currentHours[dayOfWeek];
      const newTimeSlots = [...dayHours.timeSlots, timeSlot];
      const newHours = { ...currentHours, [dayOfWeek]: { ...dayHours, timeSlots: newTimeSlots } };
      persistHoursLocally(newHours);
      shopHoursRef.current = newHours;
      return newHours;
    });
  };

  const removeTimeSlot = (dayOfWeek: number, slotIndex: number) => {
    setShopHours((currentHours) => {
      const dayHours = currentHours[dayOfWeek];
      const newTimeSlots = dayHours.timeSlots.filter((_, index) => index !== slotIndex);
      const newHours = { ...currentHours, [dayOfWeek]: { ...dayHours, timeSlots: newTimeSlots } };
      persistHoursLocally(newHours);
      shopHoursRef.current = newHours;
      return newHours;
    });
  };

  const updateTimeSlot = (dayOfWeek: number, slotIndex: number, timeSlot: TimeSlot) => {
    setShopHours((currentHours) => {
      const dayHours = currentHours[dayOfWeek];
      const newTimeSlots = dayHours.timeSlots.map((slot, index) => 
        index === slotIndex ? timeSlot : slot
      );
      const newHours = { ...currentHours, [dayOfWeek]: { ...dayHours, timeSlots: newTimeSlots } };
      persistHoursLocally(newHours);
      shopHoursRef.current = newHours;
      return newHours;
    });
  };

  const toggleDayOpen = (dayOfWeek: number) => {
    setShopHours((currentHours) => {
      const dayHours = currentHours[dayOfWeek];
      const newHours = { ...currentHours, [dayOfWeek]: { ...dayHours, isOpen: !dayHours.isOpen } };
      persistHoursLocally(newHours);
      shopHoursRef.current = newHours;
      return newHours;
    });
  };

  // Check if a specific date is open
  const isDateOpen = (date: Date): boolean => {
    // If shop hours are not loaded yet, return false to be safe
    // This prevents showing days as available before we know the actual schedule
    if (!shopHoursLoaded) {
      return false;
    }
    
    // Check if there's an extra opening for this date first
    if (isExtraOpeningActiveForDate(date)) return true;
    
    // Check if it's an Italian holiday and auto_close_holidays is enabled
    if (autoCloseHolidays && isItalianHoliday(date)) {
      return false;
    }
    
    // Check regular shop hours
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
  const getAvailableTimeSlots = (date: Date, slotDurationMinutes: number = 15): string[] => {
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
    saveShopHours, // Funzione per salvataggio manuale
  };
};
