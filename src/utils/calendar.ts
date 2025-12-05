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
 * Scarica un file .ics generato
 * Su iOS/Safari usa un data URL che apre direttamente l'app Calendario
 */
export function downloadICSFile(icsContent: string, filename: string = 'appuntamento.ics'): void {
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

