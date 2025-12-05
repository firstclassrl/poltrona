import { useState, useEffect } from 'react';
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
  const [vacationPeriod, setVacationPeriod] = useState<VacationPeriod | null>(null);

  useEffect(() => {
    // Load vacation period from localStorage
    const loadVacationPeriod = () => {
      const savedVacation = localStorage.getItem(VACATION_STORAGE_KEY);
      if (savedVacation) {
        try {
          const parsed = JSON.parse(savedVacation);
          setVacationPeriod(parsed);
        } catch (error) {
          console.error('Error loading vacation period:', error);
          setVacationPeriod(null);
        }
      } else {
        setVacationPeriod(null);
      }
    };
    
    // Load initially
    loadVacationPeriod();
    
    // Listen for storage changes (sync across tabs/components)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === VACATION_STORAGE_KEY) {
        loadVacationPeriod();
      }
    };
    
    // Listen for custom events (sync within same tab)
    const handleCustomEvent = () => {
      loadVacationPeriod();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('vacation-period-updated', handleCustomEvent);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('vacation-period-updated', handleCustomEvent);
    };
  }, []);

  const isDateInVacation = (date: Date): boolean => {
    if (!vacationPeriod) return false;
    
    const checkDate = new Date(date);
    const startDate = new Date(vacationPeriod.start_date);
    const endDate = new Date(vacationPeriod.end_date);
    
    // Set time to start of day for accurate comparison
    checkDate.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    return checkDate >= startDate && checkDate <= endDate;
  };

  const setVacationPeriodData = (start: string, end: string): void => {
    // Ensure dates are in YYYY-MM-DD format
    const startDate = start.includes('T') ? start.split('T')[0] : start;
    const endDate = end.includes('T') ? end.split('T')[0] : end;
    
    const newVacationPeriod: VacationPeriod = {
      start_date: startDate,
      end_date: endDate,
      created_at: new Date().toISOString()
    };
    
    setVacationPeriod(newVacationPeriod);
    localStorage.setItem(VACATION_STORAGE_KEY, JSON.stringify(newVacationPeriod));
    // Dispatch custom event to sync across components in same tab
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
