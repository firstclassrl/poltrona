import { useState, useEffect, useCallback } from 'react';
import type { VacationPeriod } from '../types';
import { apiService } from '../services/api';

const VACATION_STORAGE_KEY = 'vacationPeriod'; // Keep for backward compatibility/fallback

interface UseVacationModeReturn {
  vacationPeriod: VacationPeriod | null;
  isDateInVacation: (date: Date) => boolean;
  setVacationPeriod: (start: string, end: string) => Promise<void>;
  clearVacationPeriod: () => Promise<void>;
  getVacationPeriod: () => VacationPeriod | null;
  isLoading: boolean;
}

export const useVacationMode = (): UseVacationModeReturn => {
  const [vacationPeriod, setVacationPeriod] = useState<VacationPeriod | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load vacation period from database
    const loadVacationPeriod = async () => {
      setIsLoading(true);
      try {
        const shop = await apiService.getShop();
        let period = shop.vacation_period || null;
        
        // Parse if it's a string (JSONB from database might come as string)
        if (period && typeof period === 'string') {
          try {
            period = JSON.parse(period);
            console.log('📅 Parsed vacation period from string:', period);
          } catch (parseError) {
            console.error('Error parsing vacation_period string:', parseError);
            period = null;
          }
        }
        
        console.log('📅 Loading vacation period from database:', period);
        setVacationPeriod(period);
        
        // Also sync to localStorage for backward compatibility
        if (period) {
          localStorage.setItem(VACATION_STORAGE_KEY, JSON.stringify(period));
        } else {
          localStorage.removeItem(VACATION_STORAGE_KEY);
        }
        
        return period;
      } catch (error) {
        console.error('Error loading vacation period from database:', error);
        // Fallback to localStorage if database fails
        try {
          const savedVacation = localStorage.getItem(VACATION_STORAGE_KEY);
          if (savedVacation) {
            const parsed = JSON.parse(savedVacation);
            console.log('📅 Fallback: Loading vacation period from localStorage:', parsed);
            setVacationPeriod(parsed);
            return parsed;
          }
        } catch (localError) {
          console.error('Error reading from localStorage fallback:', localError);
        }
        setVacationPeriod(null);
        return null;
      } finally {
        setIsLoading(false);
      }
    };
    
    // Load initially
    loadVacationPeriod();
    
    // Listen for custom events (sync within same tab)
    const handleCustomEvent = () => {
      console.log('📅 Custom event detected, reloading vacation period from database');
      loadVacationPeriod();
    };
    
    window.addEventListener('vacation-period-updated', handleCustomEvent);
    
    return () => {
      window.removeEventListener('vacation-period-updated', handleCustomEvent);
    };
  }, []); // Only run once on mount

  const isDateInVacation = useCallback((date: Date): boolean => {
    if (!vacationPeriod) {
      return false;
    }
    
    // Handle case where vacationPeriod might be a string (shouldn't happen, but defensive)
    let period = vacationPeriod;
    if (typeof period === 'string') {
      try {
        period = JSON.parse(period);
      } catch (e) {
        console.error('Error parsing vacationPeriod in isDateInVacation:', e);
        return false;
      }
    }
    
    // Ensure period has required fields
    if (!period || !period.start_date || !period.end_date) {
      console.warn('Invalid vacation period structure:', period);
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
    
    const startDate = parseLocalDate(period.start_date);
    const endDate = parseLocalDate(period.end_date);
    endDate.setHours(23, 59, 59, 999);
    
    const isInVacation = checkDate >= startDate && checkDate <= endDate;
    
    // Debug log for specific dates (2 and 3 January 2026)
    const checkDateStr = checkDate.toISOString().split('T')[0];
    if (checkDateStr === '2026-01-02' || checkDateStr === '2026-01-03') {
      console.log('🔍 Checking vacation for date:', {
        checkDate: checkDateStr,
        checkDateObj: checkDate,
        startDate: period.start_date,
        endDate: period.end_date,
        startDateObj: startDate.toISOString().split('T')[0],
        endDateObj: endDate.toISOString().split('T')[0],
        isInVacation,
        vacationPeriod: period
      });
    }
    
    return isInVacation;
  }, [vacationPeriod]);

  const setVacationPeriodData = async (start: string, end: string): Promise<void> => {
    // Ensure dates are in YYYY-MM-DD format
    const startDate = start.includes('T') ? start.split('T')[0] : start;
    const endDate = end.includes('T') ? end.split('T')[0] : end;
    
    const newVacationPeriod: VacationPeriod = {
      start_date: startDate,
      end_date: endDate,
      created_at: new Date().toISOString()
    };
    
    console.log('💾 setVacationPeriodData called with:', { startDate, endDate, newVacationPeriod });
    
    try {
      // Save to database
      await apiService.updateShopVacationPeriod(newVacationPeriod);
      console.log('✅ Vacation period saved to database');
      
      // Update local state
      setVacationPeriod(newVacationPeriod);
      
      // Also sync to localStorage for backward compatibility
      localStorage.setItem(VACATION_STORAGE_KEY, JSON.stringify(newVacationPeriod));
      
      // Dispatch custom event to sync across components in same tab
      console.log('📢 Dispatching vacation-period-updated event');
      window.dispatchEvent(new CustomEvent('vacation-period-updated'));
    } catch (error) {
      console.error('❌ Error saving vacation period to database:', error);
      // Fallback to localStorage if database fails
      setVacationPeriod(newVacationPeriod);
      localStorage.setItem(VACATION_STORAGE_KEY, JSON.stringify(newVacationPeriod));
      window.dispatchEvent(new CustomEvent('vacation-period-updated'));
      throw error;
    }
  };

  const clearVacationPeriod = async (): Promise<void> => {
    try {
      // Clear from database
      await apiService.updateShopVacationPeriod(null);
      console.log('✅ Vacation period cleared from database');
      
      // Update local state
      setVacationPeriod(null);
      
      // Also clear from localStorage
      localStorage.removeItem(VACATION_STORAGE_KEY);
      
      // Dispatch custom event to sync across components in same tab
      window.dispatchEvent(new CustomEvent('vacation-period-updated'));
    } catch (error) {
      console.error('❌ Error clearing vacation period from database:', error);
      // Fallback to localStorage if database fails
      setVacationPeriod(null);
      localStorage.removeItem(VACATION_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('vacation-period-updated'));
      throw error;
    }
  };

  const getVacationPeriod = (): VacationPeriod | null => {
    return vacationPeriod;
  };

  return {
    vacationPeriod,
    isDateInVacation,
    setVacationPeriod: setVacationPeriodData,
    clearVacationPeriod,
    getVacationPeriod,
    isLoading
  };
};
