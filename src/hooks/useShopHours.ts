import { useState, useEffect } from 'react';

export interface ShopHours {
  morningOpening: string; // Format: "HH:MM"
  morningClosing: string; // Format: "HH:MM"
  afternoonOpening: string; // Format: "HH:MM"
  afternoonClosing: string; // Format: "HH:MM"
  isOpen: boolean;
  closedDays?: number[]; // Array of day numbers (0=Sunday, 1=Monday, etc.)
}

export const useShopHours = () => {
  const [shopHours, setShopHours] = useState<ShopHours>({
    morningOpening: '09:00',
    morningClosing: '13:00',
    afternoonOpening: '14:00',
    afternoonClosing: '19:00',
    isOpen: true,
    closedDays: [0, 1], // Chiuso domenica (0) e lunedì (1) di default
  });

  useEffect(() => {
    // Carica gli orari dal localStorage o dall'API
    const savedHours = localStorage.getItem('shopHours');
    if (savedHours) {
      setShopHours(JSON.parse(savedHours));
    }
  }, []);

  const isTimeWithinHours = (time: string): boolean => {
    const [hours, minutes] = time.split(':').map(Number);
    const timeInMinutes = hours * 60 + minutes;
    
    // Check morning hours
    const [morningStartHours, morningStartMinutes] = shopHours.morningOpening.split(':').map(Number);
    const [morningEndHours, morningEndMinutes] = shopHours.morningClosing.split(':').map(Number);
    const morningStartTime = morningStartHours * 60 + morningStartMinutes;
    const morningEndTime = morningEndHours * 60 + morningEndMinutes;
    
    // Check afternoon hours
    const [afternoonStartHours, afternoonStartMinutes] = shopHours.afternoonOpening.split(':').map(Number);
    const [afternoonEndHours, afternoonEndMinutes] = shopHours.afternoonClosing.split(':').map(Number);
    const afternoonStartTime = afternoonStartHours * 60 + afternoonStartMinutes;
    const afternoonEndTime = afternoonEndHours * 60 + afternoonEndMinutes;

    return (timeInMinutes >= morningStartTime && timeInMinutes < morningEndTime) ||
           (timeInMinutes >= afternoonStartTime && timeInMinutes < afternoonEndTime);
  };

  const isDateValid = (date: Date): boolean => {
    const dayOfWeek = date.getDay();
    // Controlla se il giorno è nei giorni di chiusura
    return !shopHours.closedDays?.includes(dayOfWeek);
  };

  const getAvailableTimeSlots = (date: Date, period?: 'morning' | 'afternoon'): string[] => {
    if (!isDateValid(date)) {
      return [];
    }

    const slots: string[] = [];
    
    // Mattina
    if (!period || period === 'morning') {
      const [morningStartHours, morningStartMinutes] = shopHours.morningOpening.split(':').map(Number);
      const [morningEndHours, morningEndMinutes] = shopHours.morningClosing.split(':').map(Number);
      
      const morningStartTime = morningStartHours * 60 + morningStartMinutes;
      const morningEndTime = morningEndHours * 60 + morningEndMinutes;
      
      for (let time = morningStartTime; time < morningEndTime; time += 30) {
        const hours = Math.floor(time / 60);
        const minutes = time % 60;
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        slots.push(timeString);
      }
    }
    
    // Pomeriggio
    if (!period || period === 'afternoon') {
      const [afternoonStartHours, afternoonStartMinutes] = shopHours.afternoonOpening.split(':').map(Number);
      const [afternoonEndHours, afternoonEndMinutes] = shopHours.afternoonClosing.split(':').map(Number);
      
      const afternoonStartTime = afternoonStartHours * 60 + afternoonStartMinutes;
      const afternoonEndTime = afternoonEndHours * 60 + afternoonEndMinutes;
      
      for (let time = afternoonStartTime; time < afternoonEndTime; time += 30) {
        const hours = Math.floor(time / 60);
        const minutes = time % 60;
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        slots.push(timeString);
      }
    }

    return slots;
  };

  const updateShopHours = (newHours: Partial<ShopHours>) => {
    const updatedHours = { ...shopHours, ...newHours };
    setShopHours(updatedHours);
    localStorage.setItem('shopHours', JSON.stringify(updatedHours));
  };

  return {
    shopHours,
    isTimeWithinHours,
    isDateValid,
    getAvailableTimeSlots,
    updateShopHours,
  };
};
