import { useState, useEffect, useCallback } from 'react';
import type { VacationPeriod } from '../types';

const VACATION_STORAGE_KEY = 'vacationPeriod';

interface UseVacationModeReturn {
  vacationPeriod: VacationPeriod | null;
  isDateInVacation: (date: Date) => boolean;
  setVacationPeriod: (start: string, end: string) => void;
  clearVacationPeriod: () => void;
  getVacationPeriod: () => VacationPeriod | null;
}

export const useVacationMode = (): UseVacationModeReturn => {
  // Initialize state by reading from localStorage immediately
  const getInitialVacationPeriod = (): VacationPeriod | null => {
    if (typeof window === 'undefined') return null;
    try {
      const savedVacation = localStorage.getItem(VACATION_STORAGE_KEY);
      if (savedVacation) {
        const parsed = JSON.parse(savedVacation);
        console.log('📅 Initial vacation period from localStorage:', parsed);
        return parsed;
      }
    } catch (error) {
      console.error('Error reading initial vacation period:', error);
    }
    return null;
  };
  
  const [vacationPeriod, setVacationPeriod] = useState<VacationPeriod | null>(getInitialVacationPeriod());

  useEffect(() => {
    // Load vacation period from localStorage
    const loadVacationPeriod = () => {
      try {
        const savedVacation = localStorage.getItem(VACATION_STORAGE_KEY);
        if (savedVacation) {
          try {
            const parsed = JSON.parse(savedVacation);
            console.log('📅 Loading vacation period from localStorage:', parsed);
            setVacationPeriod(parsed);
          } catch (error) {
            console.error('Error parsing vacation period:', error);
            setVacationPeriod(null);
          }
        } else {
          console.log('📅 No vacation period found in localStorage');
          setVacationPeriod(null);
        }
      } catch (error) {
        console.error('Error accessing localStorage:', error);
        setVacationPeriod(null);
      }
    };
    
    // Load initially
    loadVacationPeriod();
    
    // Listen for storage changes (sync across tabs/components)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === VACATION_STORAGE_KEY) {
        console.log('📅 Storage event detected, reloading vacation period');
        loadVacationPeriod();
      }
    };
    
    // Listen for custom events (sync within same tab)
    const handleCustomEvent = () => {
      console.log('📅 Custom event detected, reloading vacation period');
      loadVacationPeriod();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('vacation-period-updated', handleCustomEvent);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('vacation-period-updated', handleCustomEvent);
    };
  }, []);

  const isDateInVacation = useCallback((date: Date): boolean => {
    if (!vacationPeriod) {
      return false;
    }
    
    // Create date objects in local timezone to avoid timezone issues
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    // Parse YYYY-MM-DD format dates in local timezone
    const parseLocalDate = (dateStr: string): Date => {
      if (!dateStr) return new Date(0);
      const parts = dateStr.split('-');
      if (parts.length !== 3) {
        console.warn('Invalid date format in vacation period:', dateStr);
        return new Date(0);
      }
      const [year, month, day] = parts.map(Number);
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        console.warn('Invalid date values in vacation period:', dateStr);
        return new Date(0);
      }
      return new Date(year, month - 1, day, 0, 0, 0, 0);
    };
    
    const startDate = parseLocalDate(vacationPeriod.start_date);
    const endDate = parseLocalDate(vacationPeriod.end_date);
    endDate.setHours(23, 59, 59, 999);
    
    const isInVacation = checkDate >= startDate && checkDate <= endDate;
    
    // Debug log for specific dates (2 and 3 January 2026)
    const checkDateStr = checkDate.toISOString().split('T')[0];
    if (checkDateStr === '2026-01-02' || checkDateStr === '2026-01-03') {
      console.log('🔍 Checking vacation for date:', {
        checkDate: checkDateStr,
        checkDateObj: checkDate,
        startDate: vacationPeriod.start_date,
        endDate: vacationPeriod.end_date,
        startDateObj: startDate.toISOString().split('T')[0],
        endDateObj: endDate.toISOString().split('T')[0],
        isInVacation,
        vacationPeriod
      });
    }
    
    return isInVacation;
  }, [vacationPeriod]);

  const setVacationPeriodData = (start: string, end: string): void => {
    // Ensure dates are in YYYY-MM-DD format
    const startDate = start.includes('T') ? start.split('T')[0] : start;
    const endDate = end.includes('T') ? end.split('T')[0] : end;
    
    const newVacationPeriod: VacationPeriod = {
      start_date: startDate,
      end_date: endDate,
      created_at: new Date().toISOString()
    };
    
    console.log('💾 setVacationPeriodData called with:', { startDate, endDate, newVacationPeriod });
    
    setVacationPeriod(newVacationPeriod);
    localStorage.setItem(VACATION_STORAGE_KEY, JSON.stringify(newVacationPeriod));
    
    // Verify it was saved
    const saved = localStorage.getItem(VACATION_STORAGE_KEY);
    console.log('✅ Vacation period saved to localStorage:', saved);
    
    // Dispatch custom event to sync across components in same tab
    console.log('📢 Dispatching vacation-period-updated event');
    window.dispatchEvent(new CustomEvent('vacation-period-updated'));
  };

  const clearVacationPeriod = (): void => {
    setVacationPeriod(null);
    localStorage.removeItem(VACATION_STORAGE_KEY);
    // Dispatch custom event to sync across components in same tab
    window.dispatchEvent(new CustomEvent('vacation-period-updated'));
  };

  const getVacationPeriod = (): VacationPeriod | null => {
    return vacationPeriod;
  };

  return {
    vacationPeriod,
    isDateInVacation,
    setVacationPeriod: setVacationPeriodData,
    clearVacationPeriod,
    getVacationPeriod
  };
};
