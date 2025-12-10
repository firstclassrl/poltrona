import { useState, useEffect } from 'react';
import { Building2, MapPin, Edit, Save, X, Clock, Image as ImageIcon, FileText } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { DailyHoursManager } from './DailyHoursManager';
import { apiService } from '../services/api';
import type { Shop } from '../types';
import { PhotoUpload } from './PhotoUpload';

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
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [logoPath, setLogoPath] = useState<string>('');
  const [logoMessage, setLogoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isEditingHours, setIsEditingHours] = useState(false);

  const showMessage = (
    setter: (value: { type: 'success' | 'error'; text: string } | null) => void,
    type: 'success' | 'error',
    text: string,
    timeout: number = 3000
  ) => {
    setter({ type, text });
    setTimeout(() => setter(null), timeout);
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
      const incomingLogoPath = (syncedShop as any).logo_path || '';
      const incomingLogoUrl = (syncedShop as any).logo_url || '';
      setLogoPath(incomingLogoPath);
      if (incomingLogoPath) {
        try {
          const signed = await apiService.getSignedShopLogoUrl(incomingLogoPath);
          setLogoUrl(signed);
        } catch (e) {
          console.error('Error signing logo URL', e);
          setLogoUrl(incomingLogoUrl || '');
        }
      } else {
        setLogoUrl(incomingLogoUrl || '');
      }
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
        const incomingLogoPath = (syncedShop as any).logo_path || '';
        const incomingLogoUrl = (syncedShop as any).logo_url || '';
        setLogoPath(incomingLogoPath);
        if (incomingLogoPath) {
          try {
            const signed = await apiService.getSignedShopLogoUrl(incomingLogoPath);
            setLogoUrl(signed);
          } catch (e) {
            console.error('Error signing logo URL', e);
            setLogoUrl(incomingLogoUrl || '');
          }
        } else {
          setLogoUrl(incomingLogoUrl || '');
        }
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

  const handleUploadLogo = async (file: File) => {
    if (!shop) {
      showMessage(setLogoMessage, 'error', 'Dati negozio non disponibili.', 4000);
      throw new Error('Shop not loaded');
    }
    if (!isAdmin) {
      showMessage(setLogoMessage, 'error', 'Solo l\'admin può aggiornare il logo.', 4000);
      throw new Error('Not allowed');
    }
    try {
      const { path, signedUrl } = await apiService.uploadShopLogo(file, shop.id);
      setLogoPath(path);
      setLogoUrl(signedUrl);
      const updatedShop: Shop = { ...shop, logo_path: path, logo_url: signedUrl };
      await apiService.updateShop(updatedShop);
      persistShopState(updatedShop);
      showMessage(setLogoMessage, 'success', 'Logo aggiornato!');
      return signedUrl;
    } catch (error) {
      console.error('Error uploading shop logo:', error);
      showMessage(setLogoMessage, 'error', 'Errore durante il caricamento del logo.', 5000);
      throw error;
    }
  };

  const handleRemoveLogo = async () => {
    if (!shop || !isAdmin) return;
    const updatedShop: Shop = { ...shop, logo_path: null, logo_url: null };
    try {
      await apiService.updateShop(updatedShop);
      persistShopState(updatedShop);
      setLogoPath('');
      setLogoUrl('');
      showMessage(setLogoMessage, 'success', 'Logo rimosso.');
    } catch (error) {
      console.error('Error removing logo:', error);
      showMessage(setLogoMessage, 'error', 'Errore durante la rimozione del logo.', 5000);
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


  const isClient = user?.role === 'client';
  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">
          {isClient ? 'Informazioni Negozio' : 'Gestione Negozio'}
        </h1>
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
            {!isClient && (
              !isEditingBasic ? (
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
              )
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

          {/* Logo negozio (solo admin modifica) */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <h3 className="text-md font-medium text-gray-900">Logo negozio</h3>
                  <p className="text-xs text-gray-500">PNG / JPG / PDF, max 5MB</p>
                </div>
              </div>
            </div>

            {logoMessage && (
              <div
                className={`mb-3 p-3 rounded-lg ${
                  logoMessage.type === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}
              >
                <p className="text-sm font-medium">{logoMessage.text}</p>
              </div>
            )}

            {isAdmin ? (
              <PhotoUpload
                onUpload={handleUploadLogo}
                currentImageUrl={!logoPath?.toLowerCase().endsWith('.pdf') ? logoUrl : undefined}
                onRemove={logoPath ? handleRemoveLogo : undefined}
                accept=".png,.jpg,.jpeg,.pdf"
                allowPdf
                maxSize={5}
                title="Trascina il logo qui"
                subtitle="oppure"
                helper="PNG, JPG o PDF fino a 5MB"
                className="max-w-md"
              />
            ) : (
              <div className="flex items-center space-x-3">
                {logoUrl && !logoPath?.toLowerCase().endsWith('.pdf') ? (
                  <img
                    src={logoUrl}
                    alt="Logo negozio"
                    className="w-20 h-20 object-contain rounded-lg border border-gray-200"
                  />
                ) : logoPath ? (
                  <div className="flex items-center space-x-2 text-sm text-gray-700">
                    <FileText className="w-4 h-4" />
                    <span>Logo (PDF)</span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Nessun logo caricato.</p>
                )}
              </div>
            )}
          </div>

          {/* Informazioni Principali */}
          <div className="mb-6">
            <h3 className="text-md font-medium text-gray-900 mb-3">Informazioni Principali</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Nome Negozio"
                value={basicFormData.name}
                onChange={(e) => setBasicFormData(prev => ({ ...prev, name: e.target.value }))}
                disabled={!isEditingBasic || isClient}
                required
              />
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrizione
                </label>
                <textarea
                  value={basicFormData.description}
                  onChange={(e) => setBasicFormData(prev => ({ ...prev, description: e.target.value }))}
                  disabled={!isEditingBasic || isClient}
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
                disabled={!isEditingBasic || isClient}
                placeholder="Via Roma 123"
              />
              </div>
              
              <Input
                label="CAP"
                value={basicFormData.postal_code}
                onChange={(e) => setBasicFormData(prev => ({ ...prev, postal_code: e.target.value }))}
                disabled={!isEditingBasic || isClient}
                placeholder="00100"
                maxLength={5}
              />
              
              <Input
                label="Città"
                value={basicFormData.city}
                onChange={(e) => setBasicFormData(prev => ({ ...prev, city: e.target.value }))}
                disabled={!isEditingBasic || isClient}
                placeholder="Roma"
              />
              
              <Input
                label="Provincia"
                value={basicFormData.province}
                onChange={(e) => setBasicFormData(prev => ({ ...prev, province: e.target.value }))}
                disabled={!isEditingBasic || isClient}
                placeholder="RM"
                maxLength={2}
              />
              
              <Input
                label="Telefono"
                value={basicFormData.phone}
                onChange={(e) => setBasicFormData(prev => ({ ...prev, phone: e.target.value }))}
                disabled={!isEditingBasic || isClient}
                placeholder="+39 06 1234567"
              />
              
              <Input
                label="WhatsApp"
                value={basicFormData.whatsapp}
                onChange={(e) => setBasicFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
                disabled={!isEditingBasic || isClient}
                placeholder="+39 06 1234567"
              />
              
              <Input
                label="Email"
                type="email"
                value={basicFormData.email}
                onChange={(e) => setBasicFormData(prev => ({ ...prev, email: e.target.value }))}
                disabled={!isEditingBasic || isClient}
                placeholder="info@retrobarbershop.it"
              />
              
              {/* Email Notifiche - Solo per admin */}
              {isAdmin && (
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
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Card Orari di Apertura - Visibile a tutti, editabile solo admin */}
          <Card className="!border-2 !border-indigo-400">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                    <Clock className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">Orari di Apertura</h3>
                <p className="text-sm text-gray-600">Gestisci l'apertura giornaliera del negozio.</p>
                  </div>
                </div>
            {isAdmin && (
              !isEditingHours ? (
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
              )
            )}
              </div>

          <DailyHoursManager disabled={!isEditingHours || !isAdmin} />

          {!isEditingHours && isAdmin && (
            <p className="text-xs text-gray-500">
              Clicca su Modifica per aggiornare i giorni e le fasce orarie.
            </p>
          )}
          
          {isClient && (
            <p className="text-xs text-gray-500">
              Visualizzazione in sola lettura. Contatta il negozio per informazioni o modifiche.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};
