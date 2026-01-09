import { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, CalendarPlus, Sun, Flag, Package, Calendar, Bell, Mail, Clock, Save, X, Palette, Scissors, ChevronDown, ChevronUp, Check, Loader2, MessageCircle, CreditCard } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { TimePicker } from './ui/TimePicker';
import { Input } from './ui/Input';

import { Modal } from './ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useVacationMode } from '../hooks/useVacationMode';
import { useShop } from '../contexts/ShopContext';
import { apiService } from '../services/api';
import { API_CONFIG } from '../config/api';
import type { Shop } from '../types';
import { ThemeSelector } from './ThemeSelector';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemePaletteId } from '../theme/palettes';
import { Billing } from './Billing';

const formatDateForDisplay = (isoDate?: string | null): string => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return '';
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
};

const parseDisplayDate = (displayDate: string): string | null => {
  if (!displayDate) return null;
  const trimmed = displayDate.trim();
  if (!trimmed) return null;

  const match = /^([0-3]?\d)\/([0-1]?\d)\/(\d{4})$/.exec(trimmed);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`;
};

const LOCAL_SHOP_STORAGE_KEY = 'localShopData';
const LOCAL_NOTIFICATION_PREFS_KEY = 'notificationPreferences';

type NotificationPrefs = {
  email: {
    newClient: boolean;
    newAppointment: boolean;
    cancelAppointment: boolean;
    clientWelcome: boolean;
    clientConfirmation: boolean;
  };
  reminder: {
    enabled: boolean;
    offset: '24h' | '2h' | '1h';
    channel: 'email' | 'in-app' | 'both';
  };
  inApp: {
    chat: boolean;
    system: boolean;
    waitlist: boolean;
  };
};

const defaultNotificationPrefs: NotificationPrefs = {
  email: {
    newClient: true,
    newAppointment: true,
    cancelAppointment: true,
    clientWelcome: true,
    clientConfirmation: true,
  },
  reminder: {
    enabled: true,
    offset: '24h',
    channel: 'both',
  },
  inApp: {
    chat: true,
    system: true,
    waitlist: true,
  },
};

const loadNotificationPrefs = (): NotificationPrefs => {
  if (typeof window === 'undefined') return defaultNotificationPrefs;
  const raw = localStorage.getItem(LOCAL_NOTIFICATION_PREFS_KEY);
  if (!raw) return defaultNotificationPrefs;
  try {
    const parsed = JSON.parse(raw) as NotificationPrefs;
    return {
      email: { ...defaultNotificationPrefs.email, ...(parsed.email || {}) },
      reminder: { ...defaultNotificationPrefs.reminder, ...(parsed.reminder || {}) },
      inApp: { ...defaultNotificationPrefs.inApp, ...(parsed.inApp || {}) },
    };
  } catch {
    return defaultNotificationPrefs;
  }
};

const persistNotificationPrefs = (prefs: NotificationPrefs) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
  } catch (error) {
    console.error('Errore nel salvataggio delle notifiche:', error);
  }
};

const loadShopFromLocal = (): Shop | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(LOCAL_SHOP_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Shop;
  } catch (error) {
    console.error('Errore nel parsing dei dati shop locali:', error);
    return null;
  }
};

const persistShopLocally = (shopData: Shop) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_SHOP_STORAGE_KEY, JSON.stringify(shopData));
  } catch (error) {
    console.error('Errore nel salvataggio locale dello shop:', error);
  }
};

// Toggle Component with auto-save
interface AutoSaveToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => Promise<void>;
  disabled?: boolean;
}

const AutoSaveToggle = ({ label, description, checked, onChange, disabled }: AutoSaveToggleProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleChange = async (newValue: boolean) => {
    if (disabled || isLoading) return;
    setIsLoading(true);
    try {
      await onChange(newValue);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 surface-card transition-colors">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center space-x-2">
        {isLoading && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
        {showSuccess && <Check className="w-4 h-4 text-green-500" />}
        <button
          onClick={() => handleChange(!checked)}
          disabled={disabled || isLoading}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${checked ? 'bg-green-500' : 'bg-gray-300'
            } ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'
              }`}
          />
        </button>
      </div>
    </div>
  );
};

// Collapsible Section Component
interface CollapsibleSectionProps {
  icon: React.ReactNode;
  title: string;
  color: 'blue' | 'purple' | 'indigo' | 'emerald';
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const CollapsibleSection = ({ icon, title, color, children, defaultOpen = true }: CollapsibleSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const colorClasses = {
    blue: 'bg-blue-50 border-blue-100 hover:bg-blue-100/50',
    purple: 'bg-purple-50 border-purple-100 hover:bg-purple-100/50',
    indigo: 'bg-indigo-50 border-indigo-100 hover:bg-indigo-100/50',
    emerald: 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100/50',
  };

  const iconColorClasses = {
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    indigo: 'text-indigo-600',
    emerald: 'text-emerald-600',
  };

  return (
    <div className={`rounded-xl border ${colorClasses[color]} transition-colors`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center space-x-3">
          <div className={iconColorClasses[color]}>{icon}</div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>
      {isOpen && <div className="px-4 pb-4 pt-4 space-y-3">{children}</div>}
    </div>
  );
};

export const Settings = () => {
  const { user } = useAuth();
  const { refreshShop } = useShop();
  const [shop, setShop] = useState<Shop | null>(null);
  const initialNotificationPrefsRef = useRef<NotificationPrefs>(defaultNotificationPrefs);

  // Products
  const [productsEnabled, setProductsEnabled] = useState(true);

  // Hair Questionnaire (solo hairdresser)
  const [hairQuestionnaireEnabled, setHairQuestionnaireEnabled] = useState(false);

  // Extra Opening
  const [extraOpeningForm, setExtraOpeningForm] = useState({
    date: '',
    morningStart: '',
    morningEnd: '',
    afternoonStart: '',
    afternoonEnd: '',
  });
  const [extraOpeningMessage, setExtraOpeningMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isEditingExtraOpening, setIsEditingExtraOpening] = useState(false);
  const [isSavingExtraOpening, setIsSavingExtraOpening] = useState(false);

  // Vacation
  const [vacationMessage, setVacationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isEditingVacation, setIsEditingVacation] = useState(false);
  const [isSavingVacation, setIsSavingVacation] = useState(false);
  const [vacationStartDate, setVacationStartDate] = useState('');
  const [vacationEndDate, setVacationEndDate] = useState('');
  const [showVacationConfirm, setShowVacationConfirm] = useState(false);

  // Auto Close Holidays
  const [autoCloseHolidays, setAutoCloseHolidays] = useState(true);

  // Calendar View
  const [calendarViewMode, setCalendarViewMode] = useState<'split' | 'full'>('split');
  const [isSavingCalendarView, setIsSavingCalendarView] = useState(false);

  // Notifications
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(defaultNotificationPrefs);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Theme
  const { themeId, setTheme } = useTheme();
  const [themePalette, setThemePalette] = useState<ThemePaletteId>(themeId);
  const [originalThemePalette, setOriginalThemePalette] = useState<ThemePaletteId>(themeId);
  const [isEditingTheme, setIsEditingTheme] = useState(false);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [themeMessage, setThemeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // WhatsApp Configuration State
  const [isEditingWhatsapp, setIsEditingWhatsapp] = useState(false);
  const [isSavingWhatsapp, setIsSavingWhatsapp] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [whatsappConfig, setWhatsappConfig] = useState({
    enabled: true,
    reminderTime: '20:00'
  });

  const { vacationPeriod, setVacationPeriod, clearVacationPeriod } = useVacationMode();

  const showMessage = (
    setter: (value: { type: 'success' | 'error'; text: string } | null) => void,
    type: 'success' | 'error',
    text: string,
    timeout: number = 3000
  ) => {
    setter({ type, text });
    setTimeout(() => setter(null), timeout);
  };

  const syncExtraOpeningStorage = (shopData: Shop) => {
    if (typeof window === 'undefined') return;

    const hasExtraDate = Boolean(shopData.extra_opening_date);
    if (hasExtraDate) {
      const detail = {
        date: shopData.extra_opening_date as string,
        morningStart: shopData.extra_morning_start ?? null,
        morningEnd: shopData.extra_morning_end ?? null,
        afternoonStart: shopData.extra_afternoon_start ?? null,
        afternoonEnd: shopData.extra_afternoon_end ?? null,
      };
      localStorage.setItem('extraShopOpening', JSON.stringify(detail));
      window.dispatchEvent(new CustomEvent('extra-opening-updated', { detail }));
    } else {
      localStorage.removeItem('extraShopOpening');
      window.dispatchEvent(new CustomEvent('extra-opening-updated', { detail: null }));
    }
  };

  const persistShopState = (shopData: Shop, updateTimestamp: boolean = true) => {
    const shopWithTimestamp: Shop = updateTimestamp
      ? {
        ...shopData,
        updated_at: new Date().toISOString(),
      }
      : shopData;
    persistShopLocally(shopWithTimestamp);
    setShop(shopWithTimestamp);
    syncExtraOpeningStorage(shopWithTimestamp);
    return shopWithTimestamp;
  };

  useEffect(() => {
    loadShopData();
    const loadedPrefs = loadNotificationPrefs();
    initialNotificationPrefsRef.current = loadedPrefs;
    setNotificationPrefs(loadedPrefs);
  }, []);

  const loadShopData = async () => {
    try {
      const shopData = await apiService.getShop();
      const syncedShop = persistShopState(shopData, false);
      setProductsEnabled(syncedShop.products_enabled ?? true);
      setHairQuestionnaireEnabled(syncedShop.hair_questionnaire_enabled ?? false);
      setAutoCloseHolidays(syncedShop.auto_close_holidays ?? true);
      setCalendarViewMode(syncedShop.calendar_view_mode ?? 'split');
      const paletteFromShop = (syncedShop.theme_palette as ThemePaletteId) || themeId;
      setThemePalette(paletteFromShop);
      setOriginalThemePalette(paletteFromShop);
      setExtraOpeningForm({
        date: formatDateForDisplay(syncedShop.extra_opening_date),
        morningStart: syncedShop.extra_morning_start ?? '',
        morningEnd: syncedShop.extra_morning_end ?? '',
        afternoonStart: syncedShop.extra_afternoon_start ?? '',
        afternoonEnd: syncedShop.extra_afternoon_end ?? '',
      });
      setWhatsappConfig({
        enabled: syncedShop.whatsapp_reminder_enabled ?? true,
        reminderTime: syncedShop.whatsapp_reminder_time || '20:00'
      });
    } catch (error) {
      console.error('Error loading shop data:', error);
      const localShop = loadShopFromLocal();
      if (localShop) {
        const syncedShop = persistShopState(localShop, false);
        setProductsEnabled(syncedShop.products_enabled ?? true);
        setHairQuestionnaireEnabled(syncedShop.hair_questionnaire_enabled ?? false);
        setAutoCloseHolidays(syncedShop.auto_close_holidays ?? true);
        setCalendarViewMode(syncedShop.calendar_view_mode ?? 'split');
        const paletteFromShop = (syncedShop.theme_palette as ThemePaletteId) || themeId;
        setThemePalette(paletteFromShop);
        setOriginalThemePalette(paletteFromShop);
        setExtraOpeningForm({
          date: formatDateForDisplay(syncedShop.extra_opening_date),
          morningStart: syncedShop.extra_morning_start ?? '',
          morningEnd: syncedShop.extra_morning_end ?? '',
          afternoonStart: syncedShop.extra_afternoon_start ?? '',
          afternoonEnd: syncedShop.extra_afternoon_end ?? '',
        });
        setWhatsappConfig({
          enabled: syncedShop.whatsapp_reminder_enabled ?? true,
          reminderTime: syncedShop.whatsapp_reminder_time || '20:00'
        });
      }
    }
  };

  // Auto-save handlers for simple toggles
  const handleSaveProducts = async (value: boolean) => {
    if (!shop) throw new Error('Shop data not available');
    const updatedShop: Shop = { ...shop, products_enabled: value };
    await apiService.updateShop(updatedShop);
    persistShopState(updatedShop);
    setProductsEnabled(value);
  };

  const handleSaveHairQuestionnaire = async (value: boolean) => {
    if (!shop) throw new Error('Shop data not available');
    const updatedShop: Shop = { ...shop, hair_questionnaire_enabled: value };
    await apiService.updateShop(updatedShop);
    persistShopState(updatedShop);
    setHairQuestionnaireEnabled(value);
  };

  const handleSaveAutoCloseHolidays = async (value: boolean) => {
    if (!shop) throw new Error('Shop data not available');
    await apiService.updateShopAutoCloseHolidays(value);
    const updatedShop: Shop = { ...shop, auto_close_holidays: value };
    persistShopLocally(updatedShop);
    setShop(updatedShop);
    setAutoCloseHolidays(value);
  };

  const handleSaveCalendarView = async (mode: 'split' | 'full') => {
    if (!shop) return;
    setIsSavingCalendarView(true);
    try {
      const updatedShop: Shop = { ...shop, calendar_view_mode: mode };
      await apiService.updateShop(updatedShop);
      persistShopLocally(updatedShop);
      setShop(updatedShop);
      setCalendarViewMode(mode);
      window.dispatchEvent(new CustomEvent('calendar-view-mode-updated', { detail: mode }));
    } finally {
      setIsSavingCalendarView(false);
    }
  };

  // Extra Opening handlers
  const resetExtraOpeningFromShop = () => {
    if (!shop) return;
    setExtraOpeningForm({
      date: formatDateForDisplay(shop.extra_opening_date),
      morningStart: shop.extra_morning_start ?? '',
      morningEnd: shop.extra_morning_end ?? '',
      afternoonStart: shop.extra_afternoon_start ?? '',
      afternoonEnd: shop.extra_afternoon_end ?? '',
    });
  };

  const handleCancelExtraOpening = () => {
    resetExtraOpeningFromShop();
    setIsEditingExtraOpening(false);
  };

  const handleClearExtraOpening = () => {
    setExtraOpeningForm({
      date: '',
      morningStart: '',
      morningEnd: '',
      afternoonStart: '',
      afternoonEnd: '',
    });
  };

  const handleSaveExtraOpening = async () => {
    if (!shop) {
      showMessage(setExtraOpeningMessage, 'error', 'Impossibile salvare: dati negozio non disponibili.', 5000);
      return;
    }

    const hasMorningRange = Boolean(extraOpeningForm.morningStart && extraOpeningForm.morningEnd);
    const hasAfternoonRange = Boolean(extraOpeningForm.afternoonStart && extraOpeningForm.afternoonEnd);

    const isoDate = extraOpeningForm.date ? parseDisplayDate(extraOpeningForm.date) : null;
    if (extraOpeningForm.date && !isoDate) {
      showMessage(setExtraOpeningMessage, 'error', 'Inserisci una data valida nel formato gg/mm/aaaa.', 5000);
      return;
    }

    if (isoDate) {
      if ((extraOpeningForm.morningStart && !extraOpeningForm.morningEnd) || (!extraOpeningForm.morningStart && extraOpeningForm.morningEnd)) {
        showMessage(setExtraOpeningMessage, 'error', 'Completa sia apertura che chiusura della fascia mattina oppure lasciala vuota.', 5000);
        return;
      }

      if ((extraOpeningForm.afternoonStart && !extraOpeningForm.afternoonEnd) || (!extraOpeningForm.afternoonStart && extraOpeningForm.afternoonEnd)) {
        showMessage(setExtraOpeningMessage, 'error', 'Completa sia apertura che chiusura della fascia pomeriggio oppure lasciala vuota.', 5000);
        return;
      }

      const isRangeValid = (start: string, end: string) => {
        if (!start || !end) return true;
        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);
        return startH * 60 + startM < endH * 60 + endM;
      };

      if (!isRangeValid(extraOpeningForm.morningStart, extraOpeningForm.morningEnd)) {
        showMessage(setExtraOpeningMessage, 'error', 'La fascia mattina deve avere orario di chiusura successivo all\'apertura.', 5000);
        return;
      }

      if (!isRangeValid(extraOpeningForm.afternoonStart, extraOpeningForm.afternoonEnd)) {
        showMessage(setExtraOpeningMessage, 'error', 'La fascia pomeriggio deve avere orario di chiusura successivo all\'apertura.', 5000);
        return;
      }

      if (!hasMorningRange && !hasAfternoonRange) {
        showMessage(setExtraOpeningMessage, 'error', 'Imposta almeno una fascia oraria (mattina o pomeriggio) per il giorno straordinario.', 5000);
        return;
      }
    }

    setIsSavingExtraOpening(true);
    const updatedShop: Shop = {
      ...shop,
      extra_opening_date: isoDate,
      extra_morning_start: isoDate && hasMorningRange ? extraOpeningForm.morningStart : null,
      extra_morning_end: isoDate && hasMorningRange ? extraOpeningForm.morningEnd : null,
      extra_afternoon_start: isoDate && hasAfternoonRange ? extraOpeningForm.afternoonStart : null,
      extra_afternoon_end: isoDate && hasAfternoonRange ? extraOpeningForm.afternoonEnd : null,
    };
    try {
      await apiService.updateShop(updatedShop);
      const storedShop = persistShopState(updatedShop);
      setExtraOpeningForm({
        date: formatDateForDisplay(storedShop.extra_opening_date),
        morningStart: storedShop.extra_morning_start ?? '',
        morningEnd: storedShop.extra_morning_end ?? '',
        afternoonStart: storedShop.extra_afternoon_start ?? '',
        afternoonEnd: storedShop.extra_afternoon_end ?? '',
      });

      setIsEditingExtraOpening(false);
      const successMessage = isoDate
        ? 'Apertura straordinaria aggiornata!'
        : 'Apertura straordinaria rimossa.';
      showMessage(setExtraOpeningMessage, 'success', successMessage);
    } catch (error) {
      console.error('Error saving extra opening:', error);
      showMessage(setExtraOpeningMessage, 'error', 'Errore durante il salvataggio.', 5000);
    } finally {
      setIsSavingExtraOpening(false);
    }
  };

  // Vacation handlers
  const handleActivateVacation = async () => {
    if (!isEditingVacation) {
      setShowVacationConfirm(false);
      return;
    }
    if (!vacationStartDate || !vacationEndDate) return;

    const startDate = new Date(vacationStartDate);
    const endDate = new Date(vacationEndDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      showMessage(setVacationMessage, 'error', 'Date non valide.', 5000);
      return;
    }

    if (startDate > endDate) {
      showMessage(setVacationMessage, 'error', 'La data di inizio deve essere precedente alla data di fine.', 5000);
      return;
    }

    setIsSavingVacation(true);
    try {
      const startDateStr = vacationStartDate.includes('T') ? vacationStartDate.split('T')[0] : vacationStartDate;
      const endDateStr = vacationEndDate.includes('T') ? vacationEndDate.split('T')[0] : vacationEndDate;

      await apiService.cancelAppointmentsInRange(startDateStr, endDateStr);
      await setVacationPeriod(startDateStr, endDateStr);

      setShowVacationConfirm(false);
      setVacationStartDate('');
      setVacationEndDate('');

      const isBackendConfigured = API_CONFIG.SUPABASE_EDGE_URL &&
        API_CONFIG.SUPABASE_ANON_KEY &&
        API_CONFIG.N8N_BASE_URL;
      const messageText = isBackendConfigured
        ? 'Modalità ferie attivata! Appuntamenti cancellati.'
        : 'Modalità ferie attivata!';

      showMessage(setVacationMessage, 'success', messageText, 5000);
      window.dispatchEvent(new CustomEvent('vacation-period-updated'));
    } catch (error) {
      console.error('Error activating vacation mode:', error);
      showMessage(setVacationMessage, 'error', 'Errore durante l\'attivazione.', 5000);
    } finally {
      setIsSavingVacation(false);
    }
  };

  const handleDeactivateVacation = async () => {
    if (!isEditingVacation) return;
    try {
      await clearVacationPeriod();
      showMessage(setVacationMessage, 'success', 'Modalità ferie disattivata!', 4000);
    } catch (error) {
      console.error('Error deactivating vacation mode:', error);
      showMessage(setVacationMessage, 'error', 'Errore durante la disattivazione.', 5000);
    }
  };

  // Notification handlers
  const handleSaveNotifications = () => {
    setIsSavingNotifications(true);
    try {
      persistNotificationPrefs(notificationPrefs);
      initialNotificationPrefsRef.current = notificationPrefs;
      showMessage(setNotificationMessage, 'success', 'Notifiche aggiornate!');
    } catch (error) {
      console.error('Error saving notifications prefs:', error);
      showMessage(setNotificationMessage, 'error', 'Errore durante il salvataggio.', 5000);
    } finally {
      setIsSavingNotifications(false);
    }
  };

  // Theme handlers
  const handleCancelTheme = () => {
    setThemePalette(originalThemePalette);
    setTheme(originalThemePalette, { persist: false });
    setIsEditingTheme(false);
  };

  const handleSaveTheme = async () => {
    if (!shop) {
      showMessage(setThemeMessage, 'error', 'Dati negozio non disponibili.', 5000);
      return;
    }
    setIsSavingTheme(true);
    const updatedShop: Shop = { ...shop, theme_palette: themePalette };
    try {
      await apiService.updateShop(updatedShop);
      await refreshShop();
      const syncedShop = persistShopState(updatedShop);
      setTheme(themePalette, { persist: true });
      setIsEditingTheme(false);
      setThemePalette((syncedShop.theme_palette as ThemePaletteId) || themePalette);
      setOriginalThemePalette((syncedShop.theme_palette as ThemePaletteId) || themePalette);
      showMessage(setThemeMessage, 'success', 'Tema salvato!');
    } catch (error) {
      console.error('Error saving theme palette:', error);
      showMessage(setThemeMessage, 'error', 'Errore durante il salvataggio.', 5000);
    } finally {
      setIsSavingTheme(false);
    }
  };

  const handleSaveWhatsapp = async () => {
    if (!shop) {
      showMessage(setWhatsappMessage, 'error', 'Impossibile salvare: dati negozio non disponibili.', 5000);
      return;
    }

    setIsSavingWhatsapp(true);
    const updatedShop: Shop = {
      ...shop,
      whatsapp_reminder_enabled: whatsappConfig.enabled,
      whatsapp_reminder_time: whatsappConfig.reminderTime
    };

    try {
      await apiService.updateShop(updatedShop);
      persistShopState(updatedShop);
      setIsEditingWhatsapp(false);
      showMessage(setWhatsappMessage, 'success', 'Configurazione WhatsApp salvata!');
    } catch (error) {
      console.error('Error saving WhatsApp config:', error);
      showMessage(setWhatsappMessage, 'error', 'Errore durante il salvataggio. Riprova.', 5000);
    } finally {
      setIsSavingWhatsapp(false);
    }
  };

  const handleCancelWhatsapp = () => {
    if (shop) {
      setWhatsappConfig({
        enabled: shop.whatsapp_reminder_enabled ?? true,
        reminderTime: shop.whatsapp_reminder_time || '20:00'
      });
    }
    setIsEditingWhatsapp(false);
  };

  const formatVacationDate = (dateStr: string): string => {
    if (!dateStr) return 'Data non valida';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts.map(Number);
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('it-IT', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
      return 'Data non valida';
    } catch {
      return 'Data non valida';
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="p-0 page-container-chat-style">
        <div className="w-full">
          <div className="flex flex-col space-y-4">
            <div className="space-y-4 max-w-7xl mx-auto">
              <Card>
                <div className="p-4 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <SettingsIcon className="w-6 h-6 text-gray-400" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">Opzioni</h3>
                  <p className="text-sm text-gray-600">
                    Solo l'amministratore può accedere alle opzioni.
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-0 page-container-chat-style">
      <div className="w-full min-h-[80vh]">
        <div className="flex flex-col space-y-4">
          <div className="space-y-4 max-w-3xl mx-auto w-full">
            {/* Header */}
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
                <SettingsIcon className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Opzioni</h1>
            </div>

            {/* Section 0: Abbonamento */}
            <CollapsibleSection
              icon={<CreditCard className="w-5 h-5" />}
              title="Gestione Abbonamento"
              color="emerald"
              defaultOpen={false}
            >
              <div className="-m-4 mt-0">
                <Billing embedded />
              </div>
            </CollapsibleSection>

            {/* Section 1: Calendario & Disponibilità */}
            <CollapsibleSection
              icon={<Calendar className="w-5 h-5" />}
              title="Calendario & Disponibilità"
              color="blue"
            >
              {/* Visualizzazione Calendario - Inline radio */}
              <div className="surface-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Visualizzazione Calendario</p>
                    <p className="text-xs text-gray-500">Come mostrare la griglia degli appuntamenti</p>
                  </div>
                  {isSavingCalendarView && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleSaveCalendarView('split')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${calendarViewMode === 'split'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    Diviso (Mattina/Pomeriggio)
                  </button>
                  <button
                    onClick={() => handleSaveCalendarView('full')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${calendarViewMode === 'full'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    Giornata Intera
                  </button>
                </div>
              </div>

              {/* Chiusura Automatica Festivi - Toggle */}
              <AutoSaveToggle
                label="Chiusura Automatica Festivi"
                description="Chiudi automaticamente nei giorni festivi nazionali"
                checked={autoCloseHolidays}
                onChange={handleSaveAutoCloseHolidays}
              />

              {/* Apertura Straordinaria - Complex form */}
              <Card className="surface-card">
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center">
                        <CalendarPlus className="w-4 h-4 text-pink-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Apertura Straordinaria</h3>
                        <p className="text-xs text-gray-500">Aggiungi un giorno extra</p>
                      </div>
                    </div>
                    {!isEditingExtraOpening ? (
                      <Button
                        onClick={() => setIsEditingExtraOpening(true)}
                        size="sm"
                        variant="secondary"
                      >
                        Modifica
                      </Button>
                    ) : (
                      <div className="flex space-x-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleCancelExtraOpening}
                          disabled={isSavingExtraOpening}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={handleSaveExtraOpening}
                          size="sm"
                          loading={isSavingExtraOpening}
                          disabled={isSavingExtraOpening}
                        >
                          <Save className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {extraOpeningMessage && (
                    <div
                      className={`p-2 rounded-lg text-sm ${extraOpeningMessage.type === 'success'
                        ? 'bg-green-50 border border-green-200 text-green-800'
                        : 'bg-red-50 border border-red-200 text-red-800'
                        }`}
                    >
                      {extraOpeningMessage.text}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Data (gg/mm/aaaa)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="\d{1,2}/\d{1,2}/\d{4}"
                        placeholder="gg/mm/aaaa"
                        value={extraOpeningForm.date}
                        onChange={(e) =>
                          setExtraOpeningForm(prev => ({
                            ...prev,
                            date: e.target.value.replace(/[^0-9/]/g, ''),
                          }))
                        }
                        onBlur={() => {
                          const iso = parseDisplayDate(extraOpeningForm.date);
                          if (extraOpeningForm.date && iso) {
                            setExtraOpeningForm(prev => ({
                              ...prev,
                              date: formatDateForDisplay(iso),
                            }));
                          }
                        }}
                        disabled={!isEditingExtraOpening}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                    </div>

                    <div className="bg-gray-50 rounded-lg p-2">
                      <h4 className="text-xs font-medium text-gray-700 mb-2">Mattina</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <TimePicker
                          label="Apre"
                          value={extraOpeningForm.morningStart}
                          onChange={(value) =>
                            setExtraOpeningForm(prev => ({ ...prev, morningStart: value }))
                          }
                          disabled={!isEditingExtraOpening || !extraOpeningForm.date}
                          placeholder="--:--"
                        />
                        <TimePicker
                          label="Chiude"
                          value={extraOpeningForm.morningEnd}
                          onChange={(value) =>
                            setExtraOpeningForm(prev => ({ ...prev, morningEnd: value }))
                          }
                          disabled={!isEditingExtraOpening || !extraOpeningForm.date}
                          placeholder="--:--"
                        />
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-2">
                      <h4 className="text-xs font-medium text-gray-700 mb-2">Pomeriggio</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <TimePicker
                          label="Apre"
                          value={extraOpeningForm.afternoonStart}
                          onChange={(value) =>
                            setExtraOpeningForm(prev => ({ ...prev, afternoonStart: value }))
                          }
                          disabled={!isEditingExtraOpening || !extraOpeningForm.date}
                          placeholder="--:--"
                        />
                        <TimePicker
                          label="Chiude"
                          value={extraOpeningForm.afternoonEnd}
                          onChange={(value) =>
                            setExtraOpeningForm(prev => ({ ...prev, afternoonEnd: value }))
                          }
                          disabled={!isEditingExtraOpening || !extraOpeningForm.date}
                          placeholder="--:--"
                        />
                      </div>
                    </div>
                  </div>

                  {isEditingExtraOpening && extraOpeningForm.date && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleClearExtraOpening}
                      className="text-red-600"
                    >
                      Rimuovi apertura
                    </Button>
                  )}
                </div>
              </Card>

              {/* Modalità Ferie - Complex form */}
              <Card className="surface-card">
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                        <Sun className="w-4 h-4 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Modalità Ferie</h3>
                        <p className="text-xs text-gray-500">Periodo di chiusura temporanea</p>
                      </div>
                    </div>
                    {!isEditingVacation ? (
                      <Button
                        onClick={() => {
                          setIsEditingVacation(true);
                          if (vacationPeriod) {
                            setVacationStartDate(vacationPeriod.start_date ? vacationPeriod.start_date.substring(0, 10) : '');
                            setVacationEndDate(vacationPeriod.end_date ? vacationPeriod.end_date.substring(0, 10) : '');
                          }
                        }}
                        size="sm"
                        variant="secondary"
                      >
                        Modifica
                      </Button>
                    ) : (
                      <Button
                        onClick={() => {
                          setIsEditingVacation(false);
                          setVacationStartDate('');
                          setVacationEndDate('');
                          setShowVacationConfirm(false);
                        }}
                        size="sm"
                        variant="secondary"
                      >
                        Chiudi
                      </Button>
                    )}
                  </div>

                  {vacationMessage && (
                    <div
                      className={`p-2 rounded-lg text-sm ${vacationMessage.type === 'success'
                        ? 'bg-green-50 border border-green-200 text-green-800'
                        : 'bg-red-50 border border-red-200 text-red-800'
                        }`}
                    >
                      {vacationMessage.text}
                    </div>
                  )}

                  {vacationPeriod && (() => {
                    let period = vacationPeriod;
                    if (typeof period === 'string') {
                      try {
                        period = JSON.parse(period);
                      } catch {
                        return null;
                      }
                    }

                    return (
                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <p className="text-sm font-medium text-orange-700">🏖️ Ferie attive</p>
                        <p className="text-xs text-orange-600">
                          {formatVacationDate(period.start_date || '')} - {formatVacationDate(period.end_date || '')}
                        </p>
                      </div>
                    );
                  })()}

                  {isEditingVacation && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Inizio</label>
                          <input
                            type="date"
                            value={vacationStartDate}
                            onChange={(e) => setVacationStartDate(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Fine</label>
                          <input
                            type="date"
                            value={vacationEndDate}
                            onChange={(e) => setVacationEndDate(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setShowVacationConfirm(true)}
                          disabled={!vacationStartDate || !vacationEndDate}
                        >
                          Attiva Ferie
                        </Button>
                        {vacationPeriod && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleDeactivateVacation}
                          >
                            Disattiva Ferie
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </CollapsibleSection>

            {/* Section 2: Funzionalità */}
            <CollapsibleSection
              icon={<Package className="w-5 h-5" />}
              title="Funzionalità"
              color="purple"
            >
              <AutoSaveToggle
                label="Sistema Prodotti"
                description="Catalogo prodotti e upsell durante la prenotazione"
                checked={productsEnabled}
                onChange={handleSaveProducts}
              />

              {shop?.shop_type === 'hairdresser' && (
                <AutoSaveToggle
                  label="Questionario Capelli"
                  description="Domande veloci per stimare la durata corretta"
                  checked={hairQuestionnaireEnabled}
                  onChange={handleSaveHairQuestionnaire}
                />
              )}
            </CollapsibleSection>

            {/* Section 3: Notifiche */}
            <CollapsibleSection
              icon={<Bell className="w-5 h-5" />}
              title="Notifiche"
              color="indigo"
              defaultOpen={false}
            >
              {notificationMessage && (
                <div
                  className={`p-2 rounded-lg text-sm ${notificationMessage.type === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                    }`}
                >
                  {notificationMessage.text}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Email */}
                <div className="p-3 surface-card">
                  <div className="flex items-center space-x-2 mb-2">
                    <Mail className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-sm font-semibold text-gray-900">Email</h4>
                  </div>
                  <div className="space-y-1">
                    {[
                      { key: 'newClient', label: 'Nuovo cliente' },
                      { key: 'newAppointment', label: 'Nuovo appuntamento' },
                      { key: 'cancelAppointment', label: 'Annullamento' },
                      { key: 'clientWelcome', label: 'Benvenuto cliente' },
                      { key: 'clientConfirmation', label: 'Conferma cliente' },
                    ].map((item) => (
                      <label
                        key={item.key}
                        className="flex items-center justify-between p-2 rounded hover:bg-gray-50 cursor-pointer"
                      >
                        <span className="text-xs text-gray-700">{item.label}</span>
                        <input
                          type="checkbox"
                          checked={notificationPrefs.email[item.key as keyof NotificationPrefs['email']]}
                          onChange={(e) =>
                            setNotificationPrefs((prev) => ({
                              ...prev,
                              email: { ...prev.email, [item.key]: e.target.checked },
                            }))
                          }
                          className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* In-App */}
                <div className="p-3 surface-card">
                  <div className="flex items-center space-x-2 mb-2">
                    <Bell className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-sm font-semibold text-gray-900">In-App</h4>
                  </div>
                  <div className="space-y-1">
                    {[
                      { key: 'chat', label: 'Chat' },
                      { key: 'system', label: 'Sistema' },
                      { key: 'waitlist', label: "Lista d'attesa" },
                    ].map((item) => (

                      <label
                        key={item.key}
                        className="flex items-center justify-between p-2 rounded hover:bg-gray-50 cursor-pointer"
                      >
                        <span className="text-xs text-gray-700">{item.label}</span>
                        <input
                          type="checkbox"
                          checked={notificationPrefs.inApp[item.key as keyof NotificationPrefs['inApp']]}
                          onChange={(e) =>
                            setNotificationPrefs((prev) => ({
                              ...prev,
                              inApp: { ...prev.inApp, [item.key]: e.target.checked },
                            }))
                          }
                          className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* Reminder Section */}
                <div className="p-3 surface-card md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-sm font-semibold text-gray-900">Reminder Automatici</h4>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationPrefs.reminder.enabled}
                      onChange={(e) =>
                        setNotificationPrefs((prev) => ({
                          ...prev,
                          reminder: { ...prev.reminder, enabled: e.target.checked },
                        }))
                      }
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                  </div>

                  {notificationPrefs.reminder.enabled && (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1">Anticipo</p>
                        <div className="flex flex-wrap gap-1">
                          {['24h', '2h', '1h'].map((offset) => (
                            <button
                              key={offset}
                              onClick={() =>
                                setNotificationPrefs((prev) => ({
                                  ...prev,
                                  reminder: { ...prev.reminder, offset: offset as NotificationPrefs['reminder']['offset'] },
                                }))
                              }
                              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${notificationPrefs.reminder.offset === offset
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                              {offset === '24h' ? '24 ore' : offset === '2h' ? '2 ore' : '1 ora'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1">Canale</p>
                        <div className="flex flex-wrap gap-1">
                          {[
                            { value: 'both', label: 'Entrambi' },
                            { value: 'email', label: 'Email' },
                            { value: 'in-app', label: 'In-app' },
                          ].map((channel) => (
                            <button
                              key={channel.value}
                              onClick={() =>
                                setNotificationPrefs((prev) => ({
                                  ...prev,
                                  reminder: { ...prev.reminder, channel: channel.value as NotificationPrefs['reminder']['channel'] },
                                }))
                              }
                              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${notificationPrefs.reminder.channel === channel.value
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                              {channel.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* WhatsApp Section Moved Here */}
                <div className="surface-card p-4 md:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <MessageCircle className="w-4 h-4 text-green-600" />
                        <h3 className="text-sm font-semibold text-gray-900">Reminder WhatsApp</h3>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Invia messaggi automatici ai clienti 24h prima dell'appuntamento</p>
                    </div>

                    {!isEditingWhatsapp ? (
                      <Button
                        onClick={() => setIsEditingWhatsapp(true)}
                        size="sm"
                        variant="secondary"
                      >
                        Modifica
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          onClick={handleCancelWhatsapp}
                          size="sm"
                          disabled={isSavingWhatsapp}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={handleSaveWhatsapp}
                          size="sm"
                          loading={isSavingWhatsapp}
                          disabled={isSavingWhatsapp}
                        >
                          <Save className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {whatsappMessage && (
                    <div
                      className={`p-3 rounded-lg text-sm ${whatsappMessage.type === 'success'
                        ? 'bg-green-50 text-green-800 border border-green-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                        }`}
                    >
                      {whatsappMessage.text}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    {/* Toggle */}
                    <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Attiva Reminder</span>
                      <div className="relative inline-block w-10 align-middle select-none transition duration-200 ease-in">
                        <div className={`w-10 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer ${whatsappConfig.enabled ? 'bg-green-500' : 'bg-gray-300'} ${!isEditingWhatsapp ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onClick={() => isEditingWhatsapp && setWhatsappConfig(prev => ({ ...prev, enabled: !prev.enabled }))}>
                          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ease-in-out ${whatsappConfig.enabled ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </div>
                      </div>
                    </div>

                    {/* Time Picker */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Orario di invio</label>
                      <Input
                        type="time"
                        value={whatsappConfig.reminderTime}
                        onChange={(e) => setWhatsappConfig(prev => ({ ...prev, reminderTime: e.target.value }))}
                        disabled={!isEditingWhatsapp || !whatsappConfig.enabled}
                        className="bg-white"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Ora locale per i messaggi del giorno dopo</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleSaveNotifications}
                  loading={isSavingNotifications}
                  disabled={isSavingNotifications}
                  className="w-full"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Salva Preferenze Notifiche
                </Button>
              </div>
            </CollapsibleSection>

            {/* Section 4: Aspetto */}
            <CollapsibleSection
              icon={<Palette className="w-5 h-5" />}
              title="Aspetto"
              color="emerald"
              defaultOpen={false}
            >
              <Card className="surface-card">
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Tema & Palette</h3>
                      <p className="text-xs text-gray-500">Personalizza i colori dell'app</p>
                    </div>
                    {!isEditingTheme ? (
                      <Button
                        onClick={() => {
                          setOriginalThemePalette(themeId);
                          setThemePalette(themeId);
                          setIsEditingTheme(true);
                        }}
                        size="sm"
                        variant="secondary"
                      >
                        Modifica
                      </Button>
                    ) : (
                      <div className="flex space-x-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleCancelTheme}
                          disabled={isSavingTheme}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={handleSaveTheme}
                          size="sm"
                          loading={isSavingTheme}
                          disabled={isSavingTheme}
                        >
                          <Save className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {themeMessage && (
                    <div
                      className={`p-2 rounded-lg text-sm ${themeMessage.type === 'success'
                        ? 'bg-green-50 border border-green-200 text-green-800'
                        : 'bg-red-50 border border-red-200 text-red-800'
                        }`}
                    >
                      {themeMessage.text}
                    </div>
                  )}

                  <ThemeSelector
                    value={themePalette}
                    onChange={(id) => {
                      setThemePalette(id);
                      setTheme(id, { persist: false });
                    }}
                    disabled={!isEditingTheme}
                  />

                  <p className="text-xs text-gray-500">
                    Il tema scelto verrà salvato per tutti i collaboratori.
                  </p>
                </div>
              </Card>
            </CollapsibleSection>

            {/* Modal Conferma Ferie */}
            <Modal
              isOpen={showVacationConfirm}
              onClose={() => setShowVacationConfirm(false)}
              title="Conferma Attivazione Ferie"
            >
              <div className="text-red-600 font-semibold mb-4">
                ⚠️ Gli appuntamenti nel periodo verranno cancellati
              </div>
              <p className="mb-4 text-sm text-gray-700">
                Periodo: {vacationStartDate ? new Date(vacationStartDate).toLocaleDateString('it-IT') : ''} - {vacationEndDate ? new Date(vacationEndDate).toLocaleDateString('it-IT') : ''}
              </p>
              <div className="flex space-x-3">
                <Button variant="secondary" onClick={() => setShowVacationConfirm(false)}>
                  Annulla
                </Button>
                <Button variant="danger" onClick={handleActivateVacation} loading={isSavingVacation}>
                  Conferma
                </Button>
              </div>
            </Modal>
          </div>
        </div>
      </div>
    </div>
  );
};
