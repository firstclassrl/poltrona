import { useState, useEffect } from 'react';
import type { ShopHoursConfig, DailyHours, TimeSlot } from '../types';

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
  }, []);

  const updateShopHours = (newHours: ShopHoursConfig) => {
    setShopHours(newHours);
    localStorage.setItem('dailyShopHours', JSON.stringify(newHours));
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
    const dayOfWeek = date.getDay();
    return shopHours[dayOfWeek]?.isOpen || false;
  };

  // Check if a specific time is within opening hours for a date
  const isTimeWithinHours = (date: Date, time: string): boolean => {
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
  };
};
