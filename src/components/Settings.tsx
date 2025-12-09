import { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, CalendarPlus, Sun, Flag, Package, Calendar, Bell, Mail, Clock, Edit, Save, X } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { TimePicker } from './ui/TimePicker';
import { Modal } from './ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useVacationMode } from '../hooks/useVacationMode';
import { apiService } from '../services/api';
import { API_CONFIG } from '../config/api';
import type { Shop } from '../types';

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

export const Settings = () => {
  const { user } = useAuth();
  const [shop, setShop] = useState<Shop | null>(null);
  const initialNotificationPrefsRef = useRef<NotificationPrefs>(defaultNotificationPrefs);
  
  // Products
  const [productsEnabled, setProductsEnabled] = useState(true);
  const [productsMessage, setProductsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isEditingProducts, setIsEditingProducts] = useState(false);
  const [isSavingProducts, setIsSavingProducts] = useState(false);
  
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
  const [isEditingAutoCloseHolidays, setIsEditingAutoCloseHolidays] = useState(false);
  const [isSavingAutoCloseHolidays, setIsSavingAutoCloseHolidays] = useState(false);
  const [autoCloseHolidaysMessage, setAutoCloseHolidaysMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Calendar View
  const [calendarViewMode, setCalendarViewMode] = useState<'split' | 'full'>('split');
  const [isEditingCalendarView, setIsEditingCalendarView] = useState(false);
  const [isSavingCalendarView, setIsSavingCalendarView] = useState(false);
  const [calendarViewMessage, setCalendarViewMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // Notifications
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(defaultNotificationPrefs);
  const [isEditingNotifications, setIsEditingNotifications] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
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
      setAutoCloseHolidays(syncedShop.auto_close_holidays ?? true);
      setCalendarViewMode(syncedShop.calendar_view_mode ?? 'split');
      setExtraOpeningForm({
        date: formatDateForDisplay(syncedShop.extra_opening_date),
        morningStart: syncedShop.extra_morning_start ?? '',
        morningEnd: syncedShop.extra_morning_end ?? '',
        afternoonStart: syncedShop.extra_afternoon_start ?? '',
        afternoonEnd: syncedShop.extra_afternoon_end ?? '',
      });
    } catch (error) {
      console.error('Error loading shop data:', error);
      const localShop = loadShopFromLocal();
      if (localShop) {
        const syncedShop = persistShopState(localShop, false);
        setProductsEnabled(syncedShop.products_enabled ?? true);
        setAutoCloseHolidays(syncedShop.auto_close_holidays ?? true);
        setCalendarViewMode(syncedShop.calendar_view_mode ?? 'split');
        setExtraOpeningForm({
          date: formatDateForDisplay(syncedShop.extra_opening_date),
          morningStart: syncedShop.extra_morning_start ?? '',
          morningEnd: syncedShop.extra_morning_end ?? '',
          afternoonStart: syncedShop.extra_afternoon_start ?? '',
          afternoonEnd: syncedShop.extra_afternoon_end ?? '',
        });
      }
    }
  };

  // Products handlers
  const handleCancelProducts = () => {
    if (shop) {
      setProductsEnabled(shop.products_enabled ?? true);
    }
    setIsEditingProducts(false);
  };

  const handleSaveProducts = async () => {
    if (!shop) {
      showMessage(setProductsMessage, 'error', 'Impossibile salvare: dati negozio non disponibili.', 5000);
      return;
    }

    setIsSavingProducts(true);
    const updatedShop: Shop = {
      ...shop,
      products_enabled: productsEnabled,
    };
    try {
      await apiService.updateShop(updatedShop);
      persistShopState(updatedShop);
      setIsEditingProducts(false);
      showMessage(setProductsMessage, 'success', 'Sistema prodotti aggiornato!');
    } catch (error) {
      console.error('Error saving products setting:', error);
      showMessage(setProductsMessage, 'error', 'Errore durante il salvataggio del sistema prodotti.', 5000);
    } finally {
      setIsSavingProducts(false);
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
        ? 'Apertura straordinaria aggiornata con successo!'
        : 'Apertura straordinaria rimossa.';
      showMessage(setExtraOpeningMessage, 'success', successMessage);
    } catch (error) {
      console.error('Error saving extra opening:', error);
      showMessage(setExtraOpeningMessage, 'error', 'Errore durante il salvataggio dell\'apertura straordinaria.', 5000);
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
      showMessage(setVacationMessage, 'error', 'Date non valide. Inserisci date corrette.', 5000);
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
        ? 'Modalità ferie attivata! Tutti gli appuntamenti nel periodo sono stati cancellati.'
        : 'Modalità ferie attivata! Le prenotazioni per questo periodo sono bloccate.';
      
      showMessage(setVacationMessage, 'success', messageText, 5000);
      window.dispatchEvent(new CustomEvent('vacation-period-updated'));
    } catch (error) {
      console.error('Error activating vacation mode:', error);
      showMessage(setVacationMessage, 'error', 'Errore durante l\'attivazione della modalità ferie', 5000);
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
      showMessage(setVacationMessage, 'error', 'Errore durante la disattivazione della modalità ferie', 5000);
    }
  };

  // Auto Close Holidays handlers
  const handleCancelAutoCloseHolidays = () => {
    if (shop) {
      setAutoCloseHolidays(shop.auto_close_holidays ?? true);
    }
    setIsEditingAutoCloseHolidays(false);
  };

  const handleSaveAutoCloseHolidays = async () => {
    if (!shop) {
      showMessage(setAutoCloseHolidaysMessage, 'error', 'Impossibile salvare: dati negozio non disponibili.', 5000);
      return;
    }

    setIsSavingAutoCloseHolidays(true);
    try {
      await apiService.updateShopAutoCloseHolidays(autoCloseHolidays);
      const updatedShop: Shop = {
        ...shop,
        auto_close_holidays: autoCloseHolidays,
      };
      persistShopLocally(updatedShop);
      setShop(updatedShop);
      setIsEditingAutoCloseHolidays(false);
      showMessage(setAutoCloseHolidaysMessage, 'success', 'Impostazione chiusura automatica feste aggiornata!');
    } catch (error) {
      console.error('Error saving auto close holidays setting:', error);
      showMessage(setAutoCloseHolidaysMessage, 'error', 'Errore durante il salvataggio. Riprova.', 5000);
    } finally {
      setIsSavingAutoCloseHolidays(false);
    }
  };

  // Calendar View handlers
  const handleCancelCalendarView = () => {
    if (shop) {
      setCalendarViewMode(shop.calendar_view_mode ?? 'split');
    }
    setIsEditingCalendarView(false);
  };

  const handleSaveCalendarView = async () => {
    if (!shop) {
      showMessage(setCalendarViewMessage, 'error', 'Impossibile salvare: dati negozio non disponibili.', 5000);
      return;
    }

    setIsSavingCalendarView(true);
    try {
      const updatedShop: Shop = {
        ...shop,
        calendar_view_mode: calendarViewMode,
      };
      await apiService.updateShop(updatedShop);
      persistShopLocally(updatedShop);
      setShop(updatedShop);
      setIsEditingCalendarView(false);
      showMessage(setCalendarViewMessage, 'success', 'Impostazione visualizzazione calendario aggiornata!');
      window.dispatchEvent(new CustomEvent('calendar-view-mode-updated', { detail: calendarViewMode }));
    } catch (error) {
      console.error('Error saving calendar view mode setting:', error);
      showMessage(setCalendarViewMessage, 'error', 'Errore durante il salvataggio. Riprova.', 5000);
    } finally {
      setIsSavingCalendarView(false);
    }
  };

  // Notification handlers (client-side only)
  const handleCancelNotifications = () => {
    setNotificationPrefs(initialNotificationPrefsRef.current);
    setIsEditingNotifications(false);
  };

  const handleSaveNotifications = () => {
    setIsSavingNotifications(true);
    try {
      persistNotificationPrefs(notificationPrefs);
      initialNotificationPrefsRef.current = notificationPrefs;
      setIsEditingNotifications(false);
      showMessage(setNotificationMessage, 'success', 'Notifiche aggiornate!');
    } catch (error) {
      console.error('Error saving notifications prefs:', error);
      showMessage(setNotificationMessage, 'error', 'Errore durante il salvataggio delle notifiche.', 5000);
    } finally {
      setIsSavingNotifications(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
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
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center">
            <SettingsIcon className="w-6 h-6 text-gray-700" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Opzioni</h1>
        </div>
      </div>

      {/* Sezione Operativa */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2 mb-4">
          <CalendarPlus className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900">Operativa</h2>
        </div>

        {/* Apertura Straordinaria */}
        <Card className="border border-gray-200 shadow-sm">
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center">
                  <CalendarPlus className="w-5 h-5 text-pink-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Apertura Straordinaria</h3>
                  <p className="text-sm text-gray-600">Apri in un giorno extra rispetto al calendario standard.</p>
                </div>
              </div>
              {!isEditingExtraOpening ? (
                <Button
                  onClick={() => setIsEditingExtraOpening(true)}
                  size="sm"
                  className="bg-pink-600 hover:bg-pink-700 text-white border-pink-600"
                >
                  <Edit className="w-4 h-4 mr-2" />
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
                    <X className="w-4 h-4 mr-2" />
                    Annulla
                  </Button>
                  <Button
                    onClick={handleSaveExtraOpening}
                    size="sm"
                    loading={isSavingExtraOpening}
                    disabled={isSavingExtraOpening}
                    className="bg-pink-600 hover:bg-pink-700 text-white border-pink-600"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Salva
                  </Button>
                </div>
              )}
            </div>

            {extraOpeningMessage && (
              <div
                className={`p-3 rounded-lg ${
                  extraOpeningMessage.type === 'success'
                    ? 'bg-pink-50 border border-pink-200 text-pink-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}
              >
                <p className="text-sm font-medium">{extraOpeningMessage.text}</p>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleClearExtraOpening}
                disabled={!isEditingExtraOpening || (!extraOpeningForm.date && !extraOpeningForm.morningStart && !extraOpeningForm.morningEnd && !extraOpeningForm.afternoonStart && !extraOpeningForm.afternoonEnd)}
              >
                Rimuovi apertura
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data (gg/mm/aaaa)</label>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 disabled:bg-gray-100"
                />
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Fascia mattina</h4>
                <div className="grid grid-cols-2 gap-3">
                  <TimePicker
                    label="Apertura"
                    value={extraOpeningForm.morningStart}
                    onChange={(value) =>
                      setExtraOpeningForm(prev => ({
                        ...prev,
                        morningStart: value,
                      }))
                    }
                    disabled={!isEditingExtraOpening || !extraOpeningForm.date}
                    placeholder="--:--"
                  />
                  <TimePicker
                    label="Chiusura"
                    value={extraOpeningForm.morningEnd}
                    onChange={(value) =>
                      setExtraOpeningForm(prev => ({
                        ...prev,
                        morningEnd: value,
                      }))
                    }
                    disabled={!isEditingExtraOpening || !extraOpeningForm.date}
                    placeholder="--:--"
                  />
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Fascia pomeriggio</h4>
                <div className="grid grid-cols-2 gap-3">
                  <TimePicker
                    label="Apertura"
                    value={extraOpeningForm.afternoonStart}
                    onChange={(value) =>
                      setExtraOpeningForm(prev => ({
                        ...prev,
                        afternoonStart: value,
                      }))
                    }
                    disabled={!isEditingExtraOpening || !extraOpeningForm.date}
                    placeholder="--:--"
                  />
                  <TimePicker
                    label="Chiusura"
                    value={extraOpeningForm.afternoonEnd}
                    onChange={(value) =>
                      setExtraOpeningForm(prev => ({
                        ...prev,
                        afternoonEnd: value,
                      }))
                    }
                    disabled={!isEditingExtraOpening || !extraOpeningForm.date}
                    placeholder="--:--"
                  />
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Lascia vuoto il campo data per rimuovere l'apertura straordinaria. Puoi specificare solo la mattina o solo il pomeriggio.
            </p>
          </div>
        </Card>

        {/* Modalità Ferie */}
        <Card className="border border-gray-200 shadow-sm">
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <Sun className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Modalità Ferie</h3>
                  <p className="text-sm text-gray-600">Imposta un periodo di chiusura temporanea.</p>
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
                  className="bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
                >
                  <Edit className="w-4 h-4 mr-2" />
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
                  className="bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Termina
                </Button>
              )}
            </div>

            {vacationMessage && (
              <div
                className={`p-3 rounded-lg ${
                  vacationMessage.type === 'success'
                    ? 'bg-orange-50 border border-orange-200 text-orange-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}
              >
                <p className="text-sm font-medium">{vacationMessage.text}</p>
              </div>
            )}

            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-4">
              {vacationPeriod && (() => {
                let period = vacationPeriod;
                if (typeof period === 'string') {
                  try {
                    period = JSON.parse(period);
                  } catch (e) {
                    console.error('Error parsing vacationPeriod:', e);
                    return null;
                  }
                }
                
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
                    const date = new Date(dateStr);
                    if (isNaN(date.getTime())) {
                      return 'Data non valida';
                    }
                    return date.toLocaleDateString('it-IT', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    });
                  } catch (e) {
                    console.error('Error formatting date:', e, dateStr);
                    return 'Data non valida';
                  }
                };
                
                const startDateFormatted = formatVacationDate(period.start_date || '');
                const endDateFormatted = formatVacationDate(period.end_date || '');
                
                return (
                  <div className="p-3 bg-white border border-orange-200 rounded-lg">
                    <p className="text-sm font-medium text-orange-700">Modalità ferie attiva</p>
                    <p className="text-xs text-orange-600">
                      Periodo corrente: {startDateFormatted} - {endDateFormatted}
                    </p>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data inizio</label>
                  <input
                    type="date"
                    value={vacationStartDate}
                    onChange={(e) => setVacationStartDate(e.target.value)}
                    disabled={!isEditingVacation}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data fine</label>
                  <input
                    type="date"
                    value={vacationEndDate}
                    onChange={(e) => setVacationEndDate(e.target.value)}
                    disabled={!isEditingVacation}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="danger"
                  onClick={() => setShowVacationConfirm(true)}
                  disabled={!isEditingVacation || !vacationStartDate || !vacationEndDate}
                >
                  Attiva Modalità Ferie
                </Button>
                {vacationPeriod && (
                  <Button
                    variant="secondary"
                    onClick={handleDeactivateVacation}
                    disabled={!isEditingVacation}
                  >
                    Disattiva Modalità Ferie
                  </Button>
                )}
              </div>

              {!isEditingVacation && (
                <p className="text-xs text-gray-500">
                  Clicca su Modifica per impostare o disattivare il periodo di ferie.
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Chiusura Automatica Festivi */}
        <Card className="border border-gray-200 shadow-sm">
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Flag className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Chiusura Automatica Giorni Festivi</h3>
                  <p className="text-sm text-gray-600">Chiudi automaticamente il negozio nei giorni festivi nazionali italiani (feste rosse).</p>
                </div>
              </div>
              {!isEditingAutoCloseHolidays ? (
                <Button
                  onClick={() => setIsEditingAutoCloseHolidays(true)}
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Modifica
                </Button>
              ) : (
                <div className="flex space-x-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCancelAutoCloseHolidays}
                    disabled={isSavingAutoCloseHolidays}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Annulla
                  </Button>
                  <Button
                    onClick={handleSaveAutoCloseHolidays}
                    size="sm"
                    loading={isSavingAutoCloseHolidays}
                    disabled={isSavingAutoCloseHolidays}
                    className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Salva
                  </Button>
                </div>
              )}
            </div>

            {autoCloseHolidaysMessage && (
              <div
                className={`p-3 rounded-lg ${
                  autoCloseHolidaysMessage.type === 'success'
                    ? 'bg-red-50 border border-red-200 text-red-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}
              >
                <p className="text-sm font-medium">{autoCloseHolidaysMessage.text}</p>
              </div>
            )}

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">
                {autoCloseHolidays 
                  ? 'Il negozio chiude automaticamente nei giorni festivi nazionali italiani.' 
                  : 'Il negozio rimane aperto anche nei giorni festivi nazionali.'}
              </p>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCloseHolidays}
                  onChange={(e) => setAutoCloseHolidays(e.target.checked)}
                  disabled={!isEditingAutoCloseHolidays}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>

            {!isEditingAutoCloseHolidays && (
              <p className="text-xs text-gray-500">
                Clicca su Modifica per cambiare l'impostazione.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Sezione Sistema */}
      <div className="space-y-4 mt-8">
        <div className="flex items-center space-x-2 mb-4">
          <SettingsIcon className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900">Sistema</h2>
        </div>

        {/* Sistema Prodotti */}
        <Card className="border border-gray-200 shadow-sm">
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <Package className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Sistema Prodotti</h3>
                  <p className="text-sm text-gray-600">Attiva o disattiva il catalogo prodotti e l'upsell.</p>
                </div>
              </div>
              {!isEditingProducts ? (
                <Button
                  onClick={() => setIsEditingProducts(true)}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Modifica
                </Button>
              ) : (
                <div className="flex space-x-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCancelProducts}
                    disabled={isSavingProducts}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Annulla
                  </Button>
                  <Button
                    onClick={handleSaveProducts}
                    size="sm"
                    loading={isSavingProducts}
                    disabled={isSavingProducts}
                    className="bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Salva
                  </Button>
                </div>
              )}
            </div>

            {productsMessage && (
              <div
                className={`p-3 rounded-lg ${
                  productsMessage.type === 'success'
                    ? 'bg-purple-50 border border-purple-200 text-purple-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}
              >
                <p className="text-sm font-medium">{productsMessage.text}</p>
              </div>
            )}

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">
                {productsEnabled ? 'Il catalogo prodotti è attivo.' : 'Il catalogo prodotti è disattivato.'}
              </p>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={productsEnabled}
                  onChange={(e) => setProductsEnabled(e.target.checked)}
                  disabled={!isEditingProducts}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>
        </Card>

        {/* Visualizzazione Calendario */}
        <Card className="border border-gray-200 shadow-sm">
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Visualizzazione Calendario</h3>
                  <p className="text-sm text-gray-600">Scegli come visualizzare il calendario: diviso tra mattina e pomeriggio o giornata intera.</p>
                </div>
              </div>
              {!isEditingCalendarView ? (
                <Button
                  onClick={() => setIsEditingCalendarView(true)}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Modifica
                </Button>
              ) : (
                <div className="flex space-x-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCancelCalendarView}
                    disabled={isSavingCalendarView}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Annulla
                  </Button>
                  <Button
                    onClick={handleSaveCalendarView}
                    size="sm"
                    loading={isSavingCalendarView}
                    disabled={isSavingCalendarView}
                    className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Salva
                  </Button>
                </div>
              )}
            </div>

            {calendarViewMessage && (
              <div
                className={`p-3 rounded-lg ${
                  calendarViewMessage.type === 'success'
                    ? 'bg-blue-50 border border-blue-200 text-blue-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}
              >
                <p className="text-sm font-medium">{calendarViewMessage.text}</p>
              </div>
            )}

            <div className="space-y-3">
              <div className="p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Modalità di visualizzazione
                </label>
                <div className="space-y-2">
                  <label className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    calendarViewMode === 'split'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  } ${!isEditingCalendarView ? 'opacity-60 cursor-not-allowed' : ''}`}>
                    <input
                      type="radio"
                      name="calendarViewMode"
                      value="split"
                      checked={calendarViewMode === 'split'}
                      onChange={(e) => isEditingCalendarView && setCalendarViewMode(e.target.value as 'split' | 'full')}
                      disabled={!isEditingCalendarView}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Diviso (Mattina / Pomeriggio)</div>
                      <div className="text-sm text-gray-600">Il calendario mostra separatamente la mattina e il pomeriggio con toggle per passare tra le due viste.</div>
                    </div>
                  </label>
                  <label className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    calendarViewMode === 'full'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  } ${!isEditingCalendarView ? 'opacity-60 cursor-not-allowed' : ''}`}>
                    <input
                      type="radio"
                      name="calendarViewMode"
                      value="full"
                      checked={calendarViewMode === 'full'}
                      onChange={(e) => isEditingCalendarView && setCalendarViewMode(e.target.value as 'split' | 'full')}
                      disabled={!isEditingCalendarView}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Giornata Intera</div>
                      <div className="text-sm text-gray-600">Il calendario mostra l'intera giornata in un'unica vista senza divisione tra mattina e pomeriggio.</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {!isEditingCalendarView && (
              <p className="text-xs text-gray-500">
                Clicca su Modifica per cambiare la modalità di visualizzazione del calendario.
              </p>
            )}
          </div>
        </Card>

        {/* Notifiche */}
        <Card className="border border-gray-200 shadow-sm">
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <Bell className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Notifiche</h3>
                  <p className="text-sm text-gray-600">Gestisci le notifiche email e in-app.</p>
                </div>
              </div>
              {!isEditingNotifications ? (
                <Button
                  onClick={() => setIsEditingNotifications(true)}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Modifica
                </Button>
              ) : (
                <div className="flex space-x-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCancelNotifications}
                    disabled={isSavingNotifications}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Annulla
                  </Button>
                  <Button
                    onClick={handleSaveNotifications}
                    size="sm"
                    loading={isSavingNotifications}
                    disabled={isSavingNotifications}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Salva
                  </Button>
                </div>
              )}
            </div>

            {notificationMessage && (
              <div
                className={`p-3 rounded-lg ${
                  notificationMessage.type === 'success'
                    ? 'bg-indigo-50 border border-indigo-200 text-indigo-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}
              >
                <p className="text-sm font-medium">{notificationMessage.text}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Email */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center space-x-2 mb-3">
                  <Mail className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-sm font-semibold text-gray-900">Notifiche Email</h4>
                </div>
                <div className="space-y-2 text-sm text-gray-700">
                  {[
                    { key: 'newClient', label: 'Nuovo cliente' },
                    { key: 'newAppointment', label: 'Nuovo appuntamento' },
                    { key: 'cancelAppointment', label: 'Annullamento appuntamento' },
                    { key: 'clientWelcome', label: 'Benvenuto cliente' },
                    { key: 'clientConfirmation', label: 'Conferma appuntamento (cliente)' },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className={`flex items-center justify-between p-2 rounded hover:bg-white ${
                        !isEditingNotifications ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    >
                      <span>{item.label}</span>
                      <input
                        type="checkbox"
                        checked={notificationPrefs.email[item.key as keyof NotificationPrefs['email']]}
                        onChange={(e) =>
                          isEditingNotifications &&
                          setNotificationPrefs((prev) => ({
                            ...prev,
                            email: { ...prev.email, [item.key]: e.target.checked },
                          }))
                        }
                        disabled={!isEditingNotifications}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Reminder */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center space-x-2 mb-3">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-sm font-semibold text-gray-900">Reminder Automatici</h4>
                </div>
                <div className={`flex items-center justify-between p-2 rounded mb-3 ${!isEditingNotifications ? 'opacity-60 cursor-not-allowed' : ''}`}>
                  <span className="text-sm text-gray-700">Abilita reminder</span>
                  <input
                    type="checkbox"
                    checked={notificationPrefs.reminder.enabled}
                    onChange={(e) =>
                      isEditingNotifications &&
                      setNotificationPrefs((prev) => ({
                        ...prev,
                        reminder: { ...prev.reminder, enabled: e.target.checked },
                      }))
                    }
                    disabled={!isEditingNotifications}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-3 text-sm text-gray-700">
                  <div>
                    <p className="font-medium mb-1">Anticipo invio</p>
                    <div className="space-y-1">
                      {['24h', '2h', '1h'].map((offset) => (
                        <label
                          key={offset}
                          className={`flex items-center space-x-2 p-2 rounded hover:bg-white ${
                            !isEditingNotifications ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                        >
                          <input
                            type="radio"
                            name="reminder-offset"
                            value={offset}
                            checked={notificationPrefs.reminder.offset === offset}
                            onChange={(e) =>
                              isEditingNotifications &&
                              setNotificationPrefs((prev) => ({
                                ...prev,
                                reminder: { ...prev.reminder, offset: e.target.value as NotificationPrefs['reminder']['offset'] },
                              }))
                            }
                            disabled={!isEditingNotifications}
                          />
                          <span>{offset === '24h' ? '24 ore prima' : offset === '2h' ? '2 ore prima' : '1 ora prima'}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="font-medium mb-1">Canale</p>
                    <div className="space-y-1">
                      {[
                        { value: 'both', label: 'Email + In-app' },
                        { value: 'email', label: 'Solo Email' },
                        { value: 'in-app', label: 'Solo In-app' },
                      ].map((channel) => (
                        <label
                          key={channel.value}
                          className={`flex items-center space-x-2 p-2 rounded hover:bg-white ${
                            !isEditingNotifications ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                        >
                          <input
                            type="radio"
                            name="reminder-channel"
                            value={channel.value}
                            checked={notificationPrefs.reminder.channel === channel.value}
                            onChange={(e) =>
                              isEditingNotifications &&
                              setNotificationPrefs((prev) => ({
                                ...prev,
                                reminder: { ...prev.reminder, channel: e.target.value as NotificationPrefs['reminder']['channel'] },
                              }))
                            }
                            disabled={!isEditingNotifications}
                          />
                          <span>{channel.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* In-App */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center space-x-2 mb-3">
                  <Bell className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-sm font-semibold text-gray-900">Notifiche In-App</h4>
                </div>
                <div className="space-y-2 text-sm text-gray-700">
                  {[
                    { key: 'chat', label: 'Chat' },
                    { key: 'system', label: 'Sistema' },
                    { key: 'waitlist', label: 'Lista d’attesa' },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className={`flex items-center justify-between p-2 rounded hover:bg-white ${
                        !isEditingNotifications ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    >
                      <span>{item.label}</span>
                      <input
                        type="checkbox"
                        checked={notificationPrefs.inApp[item.key as keyof NotificationPrefs['inApp']]}
                        onChange={(e) =>
                          isEditingNotifications &&
                          setNotificationPrefs((prev) => ({
                            ...prev,
                            inApp: { ...prev.inApp, [item.key]: e.target.checked },
                          }))
                        }
                        disabled={!isEditingNotifications}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Modal Conferma Attivazione Ferie */}
      <Modal
        isOpen={showVacationConfirm}
        onClose={() => setShowVacationConfirm(false)}
        title="Conferma Attivazione Ferie"
      >
        <div className="text-red-600 font-semibold mb-4">
          ⚠️ ATTENZIONE: Tutti gli appuntamenti nel periodo selezionato verranno cancellati (se il backend è configurato)
        </div>
        <p className="mb-4">
          Periodo ferie: {vacationStartDate ? new Date(vacationStartDate).toLocaleDateString('it-IT') : ''} - {vacationEndDate ? new Date(vacationEndDate).toLocaleDateString('it-IT') : ''}
        </p>
        <div className="flex space-x-3 mt-6">
          <Button variant="secondary" onClick={() => setShowVacationConfirm(false)}>
            Annulla
          </Button>
          <Button variant="danger" onClick={handleActivateVacation} loading={isSavingVacation}>
            Conferma e Cancella Appuntamenti
          </Button>
        </div>
      </Modal>
    </div>
  );
};

