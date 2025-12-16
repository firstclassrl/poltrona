import type { ShopHoursConfig } from '../types';

const DEFAULT_TIME_SLOTS = [
  { start: '09:00', end: '13:00' },
  { start: '14:00', end: '19:00' },
];

export const createDefaultShopHoursConfig = (): ShopHoursConfig => ({
  0: { isOpen: false, timeSlots: [] }, // Domenica
  1: { isOpen: true, timeSlots: [...DEFAULT_TIME_SLOTS] },  // Lunedì
  2: { isOpen: true, timeSlots: [...DEFAULT_TIME_SLOTS] },  // Martedì
  3: { isOpen: true, timeSlots: [...DEFAULT_TIME_SLOTS] },  // Mercoledì
  4: { isOpen: true, timeSlots: [...DEFAULT_TIME_SLOTS] },  // Giovedì
  5: { isOpen: true, timeSlots: [...DEFAULT_TIME_SLOTS] },  // Venerdì
  6: { isOpen: true, timeSlots: [...DEFAULT_TIME_SLOTS] },  // Sabato
});

export const formatTimeToHHMM = (time: string): string => {
  if (!time) return '00:00';
  // Gestisce sia formato HH:MM che HH:MM:SS
  const parts = time.split(':');
  const hours = parts[0] || '00';
  const minutes = parts[1] || '00';
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
};

export const normalizeTimeString = (time: string): string => {
  if (!time) return '00:00:00';
  const [hours = '00', minutes = '00'] = time.split(':');
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
};

