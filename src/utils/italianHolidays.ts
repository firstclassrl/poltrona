/**
 * Utility per calcolare le feste nazionali italiane (feste rosse del calendario)
 * 
 * Feste nazionali italiane:
 * - Capodanno (1 gennaio)
 * - Epifania (6 gennaio)
 * - Pasqua (variabile)
 * - Lunedì dell'Angelo/Pasquetta (variabile, giorno dopo Pasqua)
 * - Festa della Liberazione (25 aprile)
 * - Festa del Lavoro (1 maggio)
 * - Festa della Repubblica (2 giugno)
 * - Ferragosto (15 agosto)
 * - Ognissanti (1 novembre)
 * - Immacolata Concezione (8 dicembre)
 * - Natale (25 dicembre)
 * - Santo Stefano (26 dicembre)
 */

/**
 * Calcola la data di Pasqua per un dato anno usando l'algoritmo di Gauss
 * @param year Anno per cui calcolare Pasqua
 * @returns Data di Pasqua
 */
function calculateEaster(year: number): Date {
  // Algoritmo di Gauss per calcolare la data di Pasqua
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  return new Date(year, month - 1, day);
}

/**
 * Calcola tutte le feste nazionali italiane per un dato anno
 * @param year Anno per cui calcolare le feste (default: anno corrente)
 * @returns Array di Date rappresentanti le feste nazionali
 */
export function getItalianHolidays(year?: number): Date[] {
  const targetYear = year || new Date().getFullYear();
  const holidays: Date[] = [];

  // Feste fisse
  holidays.push(new Date(targetYear, 0, 1));   // Capodanno (1 gennaio)
  holidays.push(new Date(targetYear, 0, 6));  // Epifania (6 gennaio)
  holidays.push(new Date(targetYear, 3, 25)); // Festa della Liberazione (25 aprile)
  holidays.push(new Date(targetYear, 4, 1));  // Festa del Lavoro (1 maggio)
  holidays.push(new Date(targetYear, 5, 2));  // Festa della Repubblica (2 giugno)
  holidays.push(new Date(targetYear, 7, 15)); // Ferragosto (15 agosto)
  holidays.push(new Date(targetYear, 10, 1)); // Ognissanti (1 novembre)
  holidays.push(new Date(targetYear, 11, 8)); // Immacolata Concezione (8 dicembre)
  holidays.push(new Date(targetYear, 11, 25)); // Natale (25 dicembre)
  holidays.push(new Date(targetYear, 11, 26)); // Santo Stefano (26 dicembre)

  // Feste variabili (Pasqua e Pasquetta)
  const easter = calculateEaster(targetYear);
  holidays.push(easter); // Pasqua
  
  // Pasquetta (giorno dopo Pasqua)
  const easterMonday = new Date(easter);
  easterMonday.setDate(easterMonday.getDate() + 1);
  holidays.push(easterMonday);

  return holidays;
}

/**
 * Verifica se una data è una festa nazionale italiana
 * @param date Data da verificare
 * @returns true se la data è una festa nazionale italiana, false altrimenti
 */
export function isItalianHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const holidays = getItalianHolidays(year);
  
  // Normalizza la data per confrontare solo giorno, mese e anno (ignora ore/minuti/secondi)
  const dateToCheck = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  return holidays.some(holiday => {
    const holidayDate = new Date(holiday.getFullYear(), holiday.getMonth(), holiday.getDate());
    return dateToCheck.getTime() === holidayDate.getTime();
  });
}

/**
 * Ottiene il nome della festa nazionale per una data, se presente
 * @param date Data da verificare
 * @returns Nome della festa o null se non è una festa
 */
export function getItalianHolidayName(date: Date): string | null {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  // Feste fisse
  if (month === 0 && day === 1) return 'Capodanno';
  if (month === 0 && day === 6) return 'Epifania';
  if (month === 3 && day === 25) return 'Festa della Liberazione';
  if (month === 4 && day === 1) return 'Festa del Lavoro';
  if (month === 5 && day === 2) return 'Festa della Repubblica';
  if (month === 7 && day === 15) return 'Ferragosto';
  if (month === 10 && day === 1) return 'Ognissanti';
  if (month === 11 && day === 8) return 'Immacolata Concezione';
  if (month === 11 && day === 25) return 'Natale';
  if (month === 11 && day === 26) return 'Santo Stefano';
  
  // Feste variabili
  const easter = calculateEaster(year);
  const easterDate = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate());
  const checkDate = new Date(year, month, day);
  
  if (checkDate.getTime() === easterDate.getTime()) return 'Pasqua';
  
  const easterMonday = new Date(easter);
  easterMonday.setDate(easterMonday.getDate() + 1);
  const easterMondayDate = new Date(easterMonday.getFullYear(), easterMonday.getMonth(), easterMonday.getDate());
  
  if (checkDate.getTime() === easterMondayDate.getTime()) return 'Pasquetta';
  
  return null;
}

