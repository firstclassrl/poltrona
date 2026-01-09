/**
 * Utility per generare file .ics (iCalendar format) per aggiungere appuntamenti al calendario
 */

export interface CalendarEventData {
  title: string;
  startDate: Date;
  endDate: Date;
  description?: string;
  location?: string;
  uid?: string;
}

/**
 * Formatta una data nel formato iCalendar (YYYYMMDDTHHMMSSZ)
 * Usa il formato UTC standard che Safari e tutti i calendari supportano
 * La data passata deve essere creata correttamente in locale (come nel componente)
 * Il timestamp è universale, quindi getUTC* restituisce i valori corretti
 */
function formatICalDate(date: Date): string {
  // Usa i metodi UTC - il timestamp della data è già corretto
  // Il calendario convertirà automaticamente l'UTC nel timezone locale quando visualizza
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Escape special characters in iCalendar text fields
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Genera un UID univoco per l'evento
 */
function generateUID(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `appointment-${timestamp}-${random}@poltrona`;
}

/**
 * Genera il contenuto di un file .ics per un evento calendario
 */
export function generateICSFile(data: CalendarEventData): string {
  const {
    title,
    startDate,
    endDate,
    description = '',
    location = '',
    uid = generateUID(),
  } = data;

  const now = new Date();
  const startFormatted = formatICalDate(startDate);
  const endFormatted = formatICalDate(endDate);
  const createdFormatted = formatICalDate(now);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Poltrona//Appointment Calendar//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${createdFormatted}`,
    `DTSTART:${startFormatted}`,
    `DTEND:${endFormatted}`,
    `SUMMARY:${escapeICalText(title)}`,
  ];

  if (description) {
    lines.push(`DESCRIPTION:${escapeICalText(description)}`);
  }

  if (location) {
    lines.push(`LOCATION:${escapeICalText(location)}`);
  }

  lines.push(
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR'
  );

  return lines.join('\r\n');
}

/**
 * Rileva se il browser è Safari su iOS
 */
function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

/**
 * Rileva se il browser è Safari (desktop o mobile)
 */
function isSafari(): boolean {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

/**
 * Rileva se il browser è Android
 */
function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

/**
 * Genera un URL per aggiungere l'evento a Google Calendar
 */
export function generateGoogleCalendarUrl(data: CalendarEventData): string {
  const { title, startDate, endDate, description = '', location = '' } = data;

  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.append('action', 'TEMPLATE');
  url.searchParams.append('text', title);
  url.searchParams.append('dates', `${fmt(startDate)}/${fmt(endDate)}`);
  if (description) url.searchParams.append('details', description);
  if (location) url.searchParams.append('location', location);

  return url.toString();
}

/**
 * Genera un URL per aggiungere l'evento a Outlook Calendar (web)
 */
export function generateOutlookCalendarUrl(data: CalendarEventData): string {
  const { title, startDate, endDate, description = '', location = '' } = data;

  const url = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
  url.searchParams.append('path', '/calendar/action/compose');
  url.searchParams.append('rru', 'addevent');
  url.searchParams.append('subject', title);
  url.searchParams.append('startdt', startDate.toISOString());
  url.searchParams.append('enddt', endDate.toISOString());
  if (description) url.searchParams.append('body', description);
  if (location) url.searchParams.append('location', location);

  return url.toString();
}

/**
 * Genera un URL per aggiungere l'evento a Yahoo Calendar
 */
export function generateYahooCalendarUrl(data: CalendarEventData): string {
  const { title, startDate, endDate, description = '', location = '' } = data;

  // Yahoo usa formato: YYYYMMDDTHHmmSS
  const fmt = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}00`;
  };

  const url = new URL('https://calendar.yahoo.com/');
  url.searchParams.append('v', '60');
  url.searchParams.append('title', title);
  url.searchParams.append('st', fmt(startDate));
  url.searchParams.append('et', fmt(endDate));
  if (description) url.searchParams.append('desc', description);
  if (location) url.searchParams.append('in_loc', location);

  return url.toString();
}

/**
 * Tipo per i provider di calendario supportati
 */
export type CalendarProvider = 'google' | 'outlook' | 'yahoo' | 'apple' | 'ics';

/**
 * Apre il calendario specificato con i dati dell'evento
 */
export function openCalendar(provider: CalendarProvider, data: CalendarEventData): void {
  const icsContent = generateICSFile(data);

  switch (provider) {
    case 'google':
      window.open(generateGoogleCalendarUrl(data), '_blank');
      break;
    case 'outlook':
      window.open(generateOutlookCalendarUrl(data), '_blank');
      break;
    case 'yahoo':
      window.open(generateYahooCalendarUrl(data), '_blank');
      break;
    case 'apple':
      // Su iOS, usa un data URL che aprirà direttamente l'app Calendario
      const dataUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;
      window.location.href = dataUrl;
      break;
    case 'ics':
    default:
      // Download file .ics come fallback
      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'appuntamento.ics';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      break;
  }
}

/**
 * Scarica un file .ics generato o apre l'URL del calendario appropriato
 * Su iOS/Safari usa un data URL che apre direttamente l'app Calendario
 * Su Android apre Google Calendar
 */
export function downloadICSFile(icsContent: string, filename: string = 'appuntamento.ics', eventData?: CalendarEventData): void {
  // Su Android, preferiamo Google Calendar perché gestisce meglio l'apertura automatica
  if (isAndroid() && eventData) {
    const googleUrl = generateGoogleCalendarUrl(eventData);
    window.open(googleUrl, '_blank');
    return;
  }

  // Su iOS, usa un data URL che aprirà direttamente l'app Calendario
  if (isIOS() || (isSafari() && /iPhone|iPad|iPod/.test(navigator.userAgent))) {
    const dataUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;
    window.location.href = dataUrl;
    return;
  }

  // Per altri browser, usa il metodo standard di download
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object after a short delay
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
}

