import { useState, useEffect } from 'react';
import { Building2, MapPin, Edit, Save, X, Lock, CalendarPlus, Package, Clock, Sun, Flag } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { TimePicker } from './ui/TimePicker';
import { useAuth } from '../contexts/AuthContext';
import { DailyHoursManager } from './DailyHoursManager';
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

const isOfflineSaveError = (error: unknown): boolean => {
  return error instanceof Error && error.message?.toLowerCase().includes('supabase non configurato');
};

export const ShopManagement = () => {
  const { user } = useAuth();
  const [shop, setShop] = useState<Shop | null>(null);
  const [isEditingBasic, setIsEditingBasic] = useState(false);
  const [isSavingBasic, setIsSavingBasic] = useState(false);
  const [basicMessage, setBasicMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [basicFormData, setBasicFormData] = useState({
    name: '',
    address: '',
    postal_code: '',
    city: '',
    province: '',
    phone: '',
    whatsapp: '',
    email: '',
    notification_email: '',
    description: '',
  });
  const [productsEnabled, setProductsEnabled] = useState(true);
  const [extraOpeningForm, setExtraOpeningForm] = useState({
    date: '',
    morningStart: '',
    morningEnd: '',
    afternoonStart: '',
    afternoonEnd: '',
  });
  const [productsMessage, setProductsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [extraOpeningMessage, setExtraOpeningMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [vacationMessage, setVacationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isEditingProducts, setIsEditingProducts] = useState(false);
  const [isSavingProducts, setIsSavingProducts] = useState(false);
  const [isEditingHours, setIsEditingHours] = useState(false);
  const [isEditingExtraOpening, setIsEditingExtraOpening] = useState(false);
  const [isSavingExtraOpening, setIsSavingExtraOpening] = useState(false);
  const [isEditingVacation, setIsEditingVacation] = useState(false);
  const [isSavingVacation, setIsSavingVacation] = useState(false);
  const [vacationStartDate, setVacationStartDate] = useState('');
  const [vacationEndDate, setVacationEndDate] = useState('');
  const [showVacationConfirm, setShowVacationConfirm] = useState(false);
  const [autoCloseHolidays, setAutoCloseHolidays] = useState(true);
  const [isEditingAutoCloseHolidays, setIsEditingAutoCloseHolidays] = useState(false);
  const [isSavingAutoCloseHolidays, setIsSavingAutoCloseHolidays] = useState(false);
  const [autoCloseHolidaysMessage, setAutoCloseHolidaysMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
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
  }, []);


  const loadShopData = async () => {
     try {
       const shopData = await apiService.getShop();
      
      const syncedShop = persistShopState(shopData, false);
      setBasicFormData({
        name: syncedShop.name || '',
        address: syncedShop.address || '',
        postal_code: (syncedShop as any).postal_code || '',
        city: (syncedShop as any).city || '',
        province: (syncedShop as any).province || '',
        phone: syncedShop.phone || '',
        whatsapp: (syncedShop as any).whatsapp || '',
        email: syncedShop.email || '',
        notification_email: (syncedShop as any).notification_email || '',
        description: syncedShop.description || '',
      });
      
      const enabled = syncedShop.products_enabled ?? true;
 
      setProductsEnabled(enabled);
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
        setBasicFormData({
          name: syncedShop.name || '',
          address: syncedShop.address || '',
          postal_code: (syncedShop as any).postal_code || '',
          city: (syncedShop as any).city || '',
          province: (syncedShop as any).province || '',
          phone: syncedShop.phone || '',
          whatsapp: (syncedShop as any).whatsapp || '',
          email: syncedShop.email || '',
          notification_email: (syncedShop as any).notification_email || '',
          description: syncedShop.description || '',
        });
        setProductsEnabled(syncedShop.products_enabled ?? true);
        setAutoCloseHolidays(syncedShop.auto_close_holidays ?? true);
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

  const handleSaveBasic = async () => {
     if (!shop) {
       showMessage(setBasicMessage, 'error', 'Impossibile salvare: dati negozio non disponibili.', 5000);
       return;
     }
 
     setIsSavingBasic(true);
     const updatedShop: Shop = {
       ...shop,
       name: basicFormData.name,
       address: basicFormData.address,
       postal_code: basicFormData.postal_code,
       city: basicFormData.city,
       province: basicFormData.province,
       phone: basicFormData.phone,
       whatsapp: basicFormData.whatsapp,
       email: basicFormData.email,
       notification_email: basicFormData.notification_email,
       description: basicFormData.description,
     };
     try {
       await apiService.updateShop(updatedShop);
       persistShopState(updatedShop);
       setIsEditingBasic(false);
       showMessage(setBasicMessage, 'success', 'Informazioni negozio salvate con successo!');
     } catch (error) {
       console.error('Error saving shop:', error);
       showMessage(setBasicMessage, 'error', 'Errore durante il salvataggio. Riprova.', 5000);
     } finally {
       setIsSavingBasic(false);
     }
   };

  const handleCancelBasic = () => {
    // Ripristina i dati originali
    if (shop) {
      setBasicFormData({
        name: shop.name || '',
        address: shop.address || '',
        postal_code: (shop as any).postal_code || '',
        city: (shop as any).city || '',
        province: (shop as any).province || '',
        phone: shop.phone || '',
        whatsapp: (shop as any).whatsapp || '',
        email: shop.email || '',
        notification_email: (shop as any).notification_email || '',
        description: shop.description || '',
      });
    }
    setIsEditingBasic(false);
  };

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
         showMessage(setExtraOpeningMessage, 'error', 'La fascia mattina deve avere orario di chiusura successivo all’apertura.', 5000);
         return;
       }

       if (!isRangeValid(extraOpeningForm.afternoonStart, extraOpeningForm.afternoonEnd)) {
         showMessage(setExtraOpeningMessage, 'error', 'La fascia pomeriggio deve avere orario di chiusura successivo all’apertura.', 5000);
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
       showMessage(setExtraOpeningMessage, 'error', 'Errore durante il salvataggio dell’apertura straordinaria.', 5000);
     } finally {
       setIsSavingExtraOpening(false);
     }
   };

  const handleActivateVacation = async () => {
    if (!isEditingVacation) {
      setShowVacationConfirm(false);
      return;
    }
    if (!vacationStartDate || !vacationEndDate) return;
    
    // Validate dates
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
      // Ensure dates are in YYYY-MM-DD format (input type="date" already provides this)
      const startDateStr = vacationStartDate.includes('T') ? vacationStartDate.split('T')[0] : vacationStartDate;
      const endDateStr = vacationEndDate.includes('T') ? vacationEndDate.split('T')[0] : vacationEndDate;
      
      // Try to cancel appointments (will skip if backend not configured)
      await apiService.cancelAppointmentsInRange(startDateStr, endDateStr);
      
      // Set vacation period (now saves to database)
      console.log('💾 Saving vacation period to database:', { startDateStr, endDateStr });
      await setVacationPeriod(startDateStr, endDateStr);
      
      setShowVacationConfirm(false);
      setVacationStartDate('');
      setVacationEndDate('');
      
      // Check if backend is configured to show appropriate message
      // Use the same logic as in api.ts
      const isBackendConfigured = API_CONFIG.SUPABASE_EDGE_URL && 
                                  API_CONFIG.SUPABASE_ANON_KEY && 
                                  API_CONFIG.N8N_BASE_URL;
      const messageText = isBackendConfigured 
        ? 'Modalità ferie attivata! Tutti gli appuntamenti nel periodo sono stati cancellati.'
        : 'Modalità ferie attivata! Le prenotazioni per questo periodo sono bloccate.';
      
      showMessage(setVacationMessage, 'success', messageText, 5000);
      
      // Force reload of vacation period in all components
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

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Gestione Negozio</h1>
      </div>

      {/* Card Unica: Informazioni Negozio e Contatti */}
      <Card className="!border-2 !border-green-500">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mr-3">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Informazioni Negozio e Contatti</h2>
            </div>
            {!isEditingBasic ? (
              <Button 
                onClick={() => setIsEditingBasic(true)} 
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white border-green-600"
              >
                <Edit className="w-4 h-4 mr-2" />
                Modifica
              </Button>
            ) : (
              <div className="flex space-x-2">
                <Button
                  variant="secondary"
                  onClick={handleCancelBasic}
                  size="sm"
                  disabled={isSavingBasic}
                >
                  <X className="w-4 h-4 mr-2" />
                  Annulla
                </Button>
                <Button
                  onClick={handleSaveBasic}
                  size="sm"
                  loading={isSavingBasic}
                  disabled={isSavingBasic}
                  className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Salva
                </Button>
              </div>
            )}
          </div>
          {basicMessage && (
            <div
              className={`mb-4 p-3 rounded-lg ${
                basicMessage.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}
            >
              <p className="text-sm font-medium">{basicMessage.text}</p>
            </div>
          )}

          {/* Informazioni Principali */}
          <div className="mb-6">
            <h3 className="text-md font-medium text-gray-900 mb-3">Informazioni Principali</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Nome Negozio"
                value={basicFormData.name}
                onChange={(e) => setBasicFormData(prev => ({ ...prev, name: e.target.value }))}
                disabled={!isEditingBasic}
                required
              />
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrizione
                </label>
                <textarea
                  value={basicFormData.description}
                  onChange={(e) => setBasicFormData(prev => ({ ...prev, description: e.target.value }))}
                  disabled={!isEditingBasic}
                  placeholder="Descrizione del negozio..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 text-sm"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Contatti e Indirizzo */}
          <div>
            <div className="flex items-center mb-3">
              <MapPin className="w-5 h-5 text-gray-600 mr-2" />
              <h3 className="text-md font-medium text-gray-900">Contatti e Indirizzo</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-3">
                <Input
                  label="Indirizzo"
                  value={basicFormData.address}
                  onChange={(e) => setBasicFormData(prev => ({ ...prev, address: e.target.value }))}
                  disabled={!isEditingBasic}
                  placeholder="Via Roma 123"
                />
              </div>
              
              <Input
                label="CAP"
                value={basicFormData.postal_code}
                onChange={(e) => setBasicFormData(prev => ({ ...prev, postal_code: e.target.value }))}
                disabled={!isEditingBasic}
                placeholder="00100"
                maxLength={5}
              />
              
              <Input
                label="Città"
                value={basicFormData.city}
                onChange={(e) => setBasicFormData(prev => ({ ...prev, city: e.target.value }))}
                disabled={!isEditingBasic}
                placeholder="Roma"
              />
              
              <Input
                label="Provincia"
                value={basicFormData.province}
                onChange={(e) => setBasicFormData(prev => ({ ...prev, province: e.target.value }))}
                disabled={!isEditingBasic}
                placeholder="RM"
                maxLength={2}
              />
              
              <Input
                label="Telefono"
                value={basicFormData.phone}
                onChange={(e) => setBasicFormData(prev => ({ ...prev, phone: e.target.value }))}
                disabled={!isEditingBasic}
                placeholder="+39 06 1234567"
              />
              
              <Input
                label="WhatsApp"
                value={basicFormData.whatsapp}
                onChange={(e) => setBasicFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
                disabled={!isEditingBasic}
                placeholder="+39 06 1234567"
              />
              
              <Input
                label="Email"
                type="email"
                value={basicFormData.email}
                onChange={(e) => setBasicFormData(prev => ({ ...prev, email: e.target.value }))}
                disabled={!isEditingBasic}
                placeholder="info@retrobarbershop.it"
              />
              
              <div className="md:col-span-3">
                <Input
                  label="Email Notifiche"
                  type="email"
                  value={basicFormData.notification_email}
                  onChange={(e) => setBasicFormData(prev => ({ ...prev, notification_email: e.target.value }))}
                  disabled={!isEditingBasic}
                  placeholder="admin@negozio.it"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Email dove ricevere notifiche per nuove registrazioni clienti
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Card Impostazioni Avanzate - Solo Admin */}
      {user?.role === 'admin' ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Impostazioni Avanzate</h2>

          <Card className="!border-2 !border-purple-400">
            <div className="p-4 space-y-4">
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

          <Card className="!border-2 !border-indigo-400">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                    <Clock className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">Orari di Apertura</h3>
                    <p className="text-sm text-gray-600">Gestisci l’apertura giornaliera del negozio.</p>
                  </div>
                </div>
                {!isEditingHours ? (
                  <Button
                    onClick={() => setIsEditingHours(true)}
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Modifica
                  </Button>
                ) : (
                  <Button
                    onClick={() => setIsEditingHours(false)}
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Termina
                  </Button>
                )}
              </div>

              <DailyHoursManager disabled={!isEditingHours} />

              {!isEditingHours && (
                <p className="text-xs text-gray-500">
                  Clicca su Modifica per aggiornare i giorni e le fasce orarie.
                </p>
              )}
            </div>
          </Card>

          <Card className="!border-2 !border-pink-400">
            <div className="p-4 space-y-4">
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

          <Card className="!border-2 !border-orange-400">
            <div className="p-4 space-y-4">
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
                  // Ensure vacationPeriod is an object, not a string
                  let period = vacationPeriod;
                  if (typeof period === 'string') {
                    try {
                      period = JSON.parse(period);
                    } catch (e) {
                      console.error('Error parsing vacationPeriod:', e);
                      return null;
                    }
                  }
                  
                  // Format dates safely
                  const formatVacationDate = (dateStr: string): string => {
                    if (!dateStr) return 'Data non valida';
                    try {
                      // Handle YYYY-MM-DD format
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
                      // Fallback to standard Date parsing
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

          <Card className="!border-2 !border-red-400">
            <div className="p-4 space-y-4">
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
      ) : (
        <Card>
          <div className="p-4 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Impostazioni Avanzate</h3>
            <p className="text-sm text-gray-600">
              Solo l'amministratore può modificare le impostazioni.
            </p>
          </div>
        </Card>
      )}

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
