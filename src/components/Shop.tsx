import { useState, useEffect } from 'react';
import { Building2, MapPin, Edit, Save, X, Lock } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { DailyHoursManager } from './DailyHoursManager';
import { useVacationMode } from '../hooks/useVacationMode';
import { apiService } from '../services/api';
import type { Shop } from '../types';

export const ShopManagement = () => {
  const { user } = useAuth();
  const [shop, setShop] = useState<Shop | null>(null);
  const [isEditingBasic, setIsEditingBasic] = useState(false);
  const [isEditingAdvanced, setIsEditingAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
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
  const [advancedFormData, setAdvancedFormData] = useState({
    products_enabled: true,
  });
  const [vacationStartDate, setVacationStartDate] = useState('');
  const [vacationEndDate, setVacationEndDate] = useState('');
  const [showVacationConfirm, setShowVacationConfirm] = useState(false);
  
  const { vacationPeriod, setVacationPeriod, clearVacationPeriod } = useVacationMode();

  useEffect(() => {
    loadShopData();
  }, []);


  const loadShopData = async () => {
    try {
      console.log('🔄 [DEBUG] Loading shop data...');
      const shopData = await apiService.getShop();
      console.log('📊 [DEBUG] Shop data loaded:', shopData);
      console.log('🔧 [DEBUG] products_enabled value:', shopData.products_enabled);
      console.log('🔧 [DEBUG] products_enabled type:', typeof shopData.products_enabled);
      
      setShop(shopData);
      setBasicFormData({
        name: shopData.name || '',
        address: shopData.address || '',
        postal_code: (shopData as any).postal_code || '',
        city: (shopData as any).city || '',
        province: (shopData as any).province || '',
        phone: shopData.phone || '',
        whatsapp: (shopData as any).whatsapp || '',
        email: shopData.email || '',
        notification_email: (shopData as any).notification_email || '',
        description: shopData.description || '',
      });
      
      const productsEnabled = shopData.products_enabled ?? true;
      console.log('🔧 [DEBUG] Setting advancedFormData.products_enabled to:', productsEnabled);
      
      setAdvancedFormData({
        products_enabled: productsEnabled,
      });
    } catch (error) {
      console.error('❌ [DEBUG] Error loading shop data:', error);
      setShop(null);
    }
  };

  const handleSaveBasic = async () => {
    if (!shop) return;
    
    setIsLoading(true);
    try {
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

      await apiService.updateShop(updatedShop);
      setShop(updatedShop);
      
      setIsEditingBasic(false);
      setMessage({ type: 'success', text: 'Informazioni negozio salvate con successo!' });
      
      // Rimuovi il messaggio dopo 3 secondi
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving shop:', error);
      setMessage({ type: 'error', text: 'Errore durante il salvataggio. Riprova.' });
      
      // Rimuovi il messaggio dopo 5 secondi
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAdvanced = async () => {
    if (!shop) return;
    
    setIsLoading(true);
    try {
      console.log('🔧 [DEBUG] Saving advanced settings:', {
        currentShop: shop,
        advancedFormData: advancedFormData,
        products_enabled: advancedFormData.products_enabled
      });

      const updatedShop: Shop = {
        ...shop,
        products_enabled: advancedFormData.products_enabled
      };

      console.log('🔧 [DEBUG] Updated shop data to save:', updatedShop);

      await apiService.updateShop(updatedShop);
      setShop(updatedShop);
      
      console.log('✅ [DEBUG] Advanced settings saved successfully');
      
      setIsEditingAdvanced(false);
      setMessage({ type: 'success', text: 'Impostazioni avanzate salvate con successo!' });
      
      // Rimuovi il messaggio dopo 3 secondi
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('❌ [DEBUG] Error saving advanced settings:', error);
      setMessage({ type: 'error', text: 'Errore durante il salvataggio delle impostazioni avanzate. Riprova.' });
      
      // Rimuovi il messaggio dopo 5 secondi
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setIsLoading(false);
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

  const handleCancelAdvanced = () => {
    // Ripristina i dati originali
    if (shop) {
      setAdvancedFormData({
        products_enabled: shop.products_enabled ?? true,
      });
    }
    setIsEditingAdvanced(false);
  };

  const handleActivateVacation = async () => {
    if (!vacationStartDate || !vacationEndDate) return;
    
    setIsLoading(true);
    try {
      // Try to cancel appointments (will skip if backend not configured)
      await apiService.cancelAppointmentsInRange(vacationStartDate, vacationEndDate);
      
      // Set vacation period
      setVacationPeriod(vacationStartDate, vacationEndDate);
      
      setShowVacationConfirm(false);
      setVacationStartDate('');
      setVacationEndDate('');
      
      // Check if backend is configured to show appropriate message
      const isBackendConfigured = localStorage.getItem('supabase_url') && localStorage.getItem('n8n_base_url');
      const messageText = isBackendConfigured 
        ? 'Modalità ferie attivata! Tutti gli appuntamenti nel periodo sono stati cancellati.'
        : 'Modalità ferie attivata! (Backend non configurato - appuntamenti non cancellati)';
      
      setMessage({ type: 'success', text: messageText });
    } catch (error) {
      console.error('Error activating vacation mode:', error);
      setMessage({ type: 'error', text: 'Errore durante l\'attivazione della modalità ferie' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Gestione Negozio</h1>
      </div>

      {/* Messaggio di feedback */}
      {message && (
        <div className={`p-3 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

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
                  disabled={isLoading}
                >
                  <X className="w-4 h-4 mr-2" />
                  Annulla
                </Button>
                <Button
                  onClick={handleSaveBasic}
                  size="sm"
                  loading={isLoading}
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Salva
                </Button>
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
        <Card className="!border-2 !border-purple-500">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                  <Lock className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Impostazioni Avanzate</h2>
              </div>
              {!isEditingAdvanced ? (
                <Button 
                  onClick={() => setIsEditingAdvanced(true)} 
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                >
                  <Edit className="w-4 h-4 mr-2 text-white" />
                  Modifica
                </Button>
              ) : (
                <div className="flex space-x-2">
                  <Button
                    variant="secondary"
                    onClick={handleCancelAdvanced}
                    size="sm"
                    disabled={isLoading}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Annulla
                  </Button>
                  <Button
                    onClick={handleSaveAdvanced}
                    size="sm"
                    loading={isLoading}
                    disabled={isLoading}
                    className="bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                  >
                    <Save className="w-4 h-4 mr-2 text-white" />
                    Salva
                  </Button>
                </div>
              )}
            </div>
            
            {/* Toggle Sistema Prodotti */}
            <div className="mb-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="text-base font-medium text-gray-900">Sistema Prodotti</h3>
                  <p className="text-sm text-gray-600">
                    Attiva/disattiva il catalogo prodotti e l'upsell durante le prenotazioni
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={advancedFormData.products_enabled}
                    onChange={(e) => setAdvancedFormData(prev => ({ ...prev, products_enabled: e.target.checked }))}
                    disabled={!isEditingAdvanced}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
            
            <DailyHoursManager />
            
            {/* Modalità Ferie */}
            <div className="mb-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="text-base font-medium text-gray-900 mb-2">
                  Modalità Ferie
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Imposta un periodo di chiusura per ferie
                </p>
                
                {/* Form date range */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Inizio
                    </label>
                    <input
                      type="date"
                      value={vacationStartDate}
                      onChange={(e) => setVacationStartDate(e.target.value)}
                      disabled={!isEditingAdvanced}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="gg/mm/aaaa"
                      lang="it-IT"
                      data-format="dd/mm/yyyy"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Fine
                    </label>
                    <input
                      type="date"
                      value={vacationEndDate}
                      onChange={(e) => setVacationEndDate(e.target.value)}
                      disabled={!isEditingAdvanced}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="gg/mm/aaaa"
                      lang="it-IT"
                      data-format="dd/mm/yyyy"
                    />
                  </div>
                </div>
                
                {/* Bottone attivazione */}
                <Button
                  onClick={() => setShowVacationConfirm(true)}
                  variant="danger"
                  disabled={!isEditingAdvanced || !vacationStartDate || !vacationEndDate}
                >
                  Attiva Modalità Ferie
                </Button>
              </div>
            </div>
          </div>
        </Card>
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
          <Button variant="danger" onClick={handleActivateVacation} loading={isLoading}>
            Conferma e Cancella Appuntamenti
          </Button>
        </div>
      </Modal>
    </div>
  );
};
