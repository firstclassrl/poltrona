import React, { useState, useEffect } from 'react';
import { User, Edit, Save, X, Shield, FileText, Trash2, XCircle, AlertTriangle, Sparkles } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { Modal } from './ui/Modal';
import { PrivacyPolicy } from './PrivacyPolicy';
import { useAuth } from '../contexts/AuthContext';
import { useClientRegistration } from '../hooks/useClientRegistration';
import { useAppointments } from '../hooks/useAppointments';
import { useShop } from '../contexts/ShopContext';
import { useClientHairProfile } from '../hooks/useClientHairProfile';
import { apiService } from '../services/api';
import type { RegisteredClient } from '../types/auth';
import type { Appointment } from '../types';
import { HairProfileBadge } from './client/HairProfileBadge';
import { HairProfileEditor } from './client/HairProfileEditor';

export const ClientProfile: React.FC = () => {
  const { user, logout } = useAuth();
  const { deleteRegisteredClient, getClientByEmail } = useClientRegistration();
  const { loadAppointments } = useAppointments();
  const { currentShop } = useShop();

  // State
  const [dbClientId, setDbClientId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    notes: '',
    profile_photo_url: '',
    profile_photo_path: '',
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showHairProfileEditor, setShowHairProfileEditor] = useState(false);

  // Data
  const [clientData, setClientData] = useState<RegisteredClient | null>(null);
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Hair Profile Hook
  const { profile: hairProfile, saveProfile: saveHairProfile, loading: loadingHairProfile } = useClientHairProfile(
    dbClientId,
    currentShop?.id || null
  );

  // Initialize
  useEffect(() => {
    if (!user) return;

    // 1. Set basic auth data
    setFormData(prev => ({
      ...prev,
      full_name: user.full_name || '',
      email: user.email || '',
      phone: user.phone || '+39 ',
    }));

    // 2. Get Registered Client (for privacy consent)
    if (user.email) {
      const registered = getClientByEmail(user.email);
      setClientData(registered);
    }

    // 3. Get DB Client (for ID and profile data)
    const fetchDbClient = async () => {
      try {
        // Usa getOrCreateClientFromUser per assicurarsi di avere un ID valido
        const client = await apiService.getOrCreateClientFromUser({
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          phone: user.phone
        });

        if (client) {
          const clientAny = client as any;
          setDbClientId(client.id);
          setFormData(prev => ({
            ...prev,
            full_name: clientAny.first_name && clientAny.last_name
              ? `${clientAny.first_name} ${clientAny.last_name}`.trim()
              : (clientAny.first_name || prev.full_name),
            phone: clientAny.phone_e164 || prev.phone,
            profile_photo_url: clientAny.photo_url || prev.profile_photo_url,
            notes: clientAny.notes || ''
          }));
        }
      } catch (err) {
        console.error("Error fetching DB client:", err);
      }
    };
    fetchDbClient();

  }, [user, getClientByEmail]);

  // Helpers
  const normalizePhone = (phone: string): string => {
    if (!phone) return '';
    let cleaned = phone.replace(/[^0-9+]/g, '');
    if (!cleaned.startsWith('+')) {
      if (cleaned.startsWith('39') && cleaned.length > 10) {
        cleaned = '+' + cleaned;
      } else {
        cleaned = '+39' + cleaned;
      }
    }
    return cleaned;
  };

  const compressImage = async (file: File, maxDimension = 512, quality = 0.75): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
          const width = Math.round(img.width * scale);
          const height = Math.round(img.height * scale);
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Compression failed'));
                return;
              }
              const compressedFile = new File([blob], file.name.replace(/\.(\w+)$/, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => reject(new Error('Image load error'));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsDataURL(file);
    });
  };

  // Actions
  const handleSave = async () => {
    if (!user || !dbClientId) return;
    setIsLoading(true);
    try {
      const email = formData.email || user.email;
      if (!email) throw new Error('Email mancante');

      const phoneToSave = formData.phone?.trim();
      const cleanPhone = phoneToSave?.replace(/[^0-9+]/g, '');

      if (!phoneToSave || phoneToSave === '+39' || (cleanPhone && cleanPhone.length < 8)) {
        throw new Error('Inserisci un numero di telefono valido');
      }

      await apiService.updateClient(dbClientId, {
        first_name: formData.full_name.split(' ')[0] || 'Cliente',
        last_name: formData.full_name.split(' ').slice(1).join(' ') || null,
        phone_e164: normalizePhone(phoneToSave),
        notes: formData.notes
      });

      setMessage({ type: 'success', text: 'Profilo aggiornato con successo!' });
      setIsEditing(false);
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      setMessage({ type: 'error', text: error.message || 'Errore nel salvataggio. Riprova.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset logic could be improved by re-fetching, but keeping it simple for now
    setIsEditing(false);
    setMessage(null);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Carica solo file immagine' });
      return;
    }

    try {
      setPhotoMessage('Caricamento...');
      const compressed = await compressImage(file, 512, 0.75);
      const { path, publicUrl } = await apiService.uploadClientPhotoPublic(compressed, user.id);

      setFormData(prev => ({
        ...prev,
        profile_photo_url: publicUrl,
        profile_photo_path: path,
      }));

      // Update DB immediately
      if (dbClientId) {
        await apiService.updateClient(dbClientId, { photo_url: publicUrl });
      }

      setPhotoMessage('Foto caricata!');
      setTimeout(() => setPhotoMessage(null), 2000);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Errore caricamento foto' });
      setPhotoMessage(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (!clientData) return;
    try {
      const success = deleteRegisteredClient(clientData.id);
      if (success) {
        setMessage({ type: 'success', text: 'Account eliminato. Disconnessione...' });
        setTimeout(() => logout(), 2000);
      } else {
        setMessage({ type: 'error', text: 'Errore eliminazione account' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Errore eliminazione account' });
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!appointmentToCancel) return;
    setIsCancelling(true);
    try {
      await apiService.cancelAppointmentDirect(appointmentToCancel.id);
      await loadAppointments();
      setMessage({ type: 'success', text: 'Appuntamento annullato' });
      setAppointmentToCancel(null);
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Errore annullamento' });
    } finally {
      setIsCancelling(false);
    }
  };

  const isHairQuestionnaireEnabled = currentShop?.hair_questionnaire_enabled === true;

  return (
    <div className="p-0 page-container-chat-style">
      <div className="w-full max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl relative overflow-hidden">
          {/* Background Decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 rounded-full blur-3xl -z-10 opacity-60 pointer-events-none transform translate-x-1/3 -translate-y-1/3" />

          <div className="flex items-center gap-6 z-10">
            <div className="relative group">
              {formData.profile_photo_url ? (
                <img
                  src={formData.profile_photo_url}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-xl"
                />
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center border-4 border-white shadow-xl">
                  <User className="w-10 h-10 text-white" />
                </div>
              )}
              {isEditing && (
                <label className="absolute bottom-0 right-0 bg-white p-2 rounded-full shadow-lg cursor-pointer hover:bg-gray-50 transition-colors border border-gray-100">
                  <Edit className="w-4 h-4 text-gray-600" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </label>
              )}
            </div>

            <div>
              <h1 className="text-3xl font-bold text-gray-900">{formData.full_name || 'Benvenuto'}</h1>
              <p className="text-gray-500 font-medium">{formData.email}</p>
              {photoMessage && <p className="text-xs text-green-600 mt-1">{photoMessage}</p>}
            </div>
          </div>

          <div className="flex gap-3 z-10">
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} variant="secondary" className="shadow-sm">
                <Edit className="w-4 h-4 mr-2" />
                Modifica
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={handleCancel}>
                  <X className="w-4 h-4 mr-2" />
                  Annulla
                </Button>
                <Button onClick={handleSave} disabled={isLoading} className="shadow-lg shadow-blue-500/20">
                  <Save className="w-4 h-4 mr-2" />
                  Salva
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Feedback Message */}
        {message && (
          <div className={`p-4 rounded-xl flex items-center gap-3 ${message.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-100'
            : 'bg-red-50 text-red-800 border border-red-100'
            }`}>
            {message.type === 'success' ? <Sparkles className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <span className="font-medium">{message.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Personal Info & Hair Profile */}
          <div className="lg:col-span-2 space-y-6">

            {/* Personal Information */}
            <Card className="shadow-lg border-opacity-50">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Dati Personali</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Nome Completo"
                  value={formData.full_name}
                  onChange={(e) => setFormData(p => ({ ...p, full_name: e.target.value }))}
                  disabled={!isEditing}
                  labelClassName="font-medium text-gray-700"
                />
                <Input
                  label="Email"
                  value={formData.email}
                  disabled={true} // Email usually not editable directly
                  className="bg-gray-50"
                  labelClassName="font-medium text-gray-700"
                />
                <Input
                  label="Telefono"
                  value={formData.phone}
                  onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                  disabled={!isEditing}
                  type="tel"
                  labelClassName="font-medium text-gray-700"
                />

              </div>
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Note (Visibili solo a te)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                  disabled={!isEditing}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 resize-none"
                  placeholder="Aggiungi qui eventuali note..."
                />
              </div>
            </Card>

            {/* Hair Profile Card */}
            {isHairQuestionnaireEnabled && (
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl blur-xl -z-10" />
                <Card className="border-purple-100 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">Profilo Capelli</h2>
                        <p className="text-sm text-gray-500">Le tue caratteristiche per un servizio perfetto</p>
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => setShowHairProfileEditor(true)} className="bg-white hover:bg-purple-50 text-purple-700 border-purple-200">
                      <Edit className="w-4 h-4 mr-2" />
                      Modifica
                    </Button>
                  </div>

                  {loadingHairProfile ? (
                    <div className="text-center py-8 text-gray-400">Caricamento profilo...</div>
                  ) : hairProfile ? (
                    <HairProfileBadge profile={hairProfile} />
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <p className="text-gray-500 mb-3">Non hai ancora compilato il tuo profilo capelli</p>
                      <Button onClick={() => setShowHairProfileEditor(true)}>Compila Ora</Button>
                    </div>
                  )}

                  <Modal
                    isOpen={showHairProfileEditor}
                    onClose={() => setShowHairProfileEditor(false)}
                    title="Modifica Profilo Capelli"
                    size="large"
                  >
                    {dbClientId && currentShop?.id ? (
                      <HairProfileEditor
                        clientId={dbClientId}
                        shopId={currentShop.id}
                        initialProfile={hairProfile}
                        onSave={async (p) => {
                          await saveHairProfile(p);
                          setShowHairProfileEditor(false);
                        }}
                        onCancel={() => setShowHairProfileEditor(false)}
                      />
                    ) : (
                      <div className="text-center p-4">Errore: Dati mancanti per la modifica</div>
                    )}
                  </Modal>
                </Card>
              </div>
            )}
          </div>

          {/* Right Column: Privacy & Settings */}
          <div className="space-y-6">
            {/* Privacy Card */}
            {clientData && clientData.privacyConsent && (
              <Card className="bg-gradient-to-br from-white to-gray-50 border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">Privacy & Sicurezza</h2>
                </div>

                <div className="space-y-4">
                  <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Stato Consenso</p>
                    <div className="flex items-center text-green-700 gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="font-medium">Accettato il {new Date(clientData.privacyConsent.acceptedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => setShowPrivacyPolicy(true)}
                  >
                    <FileText className="w-4 h-4 mr-2 text-gray-400" />
                    Leggi Informativa
                  </Button>
                </div>
              </Card>
            )}

            {/* Danger Zone */}
            {clientData && (
              <Card className="border-red-100 bg-red-50/50">
                <h3 className="text-red-900 font-bold mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Zona Pericolosa
                </h3>
                <p className="text-sm text-red-700 mb-4 opacity-80">
                  L'eliminazione dell'account è irreversibile e rimuoverà tutti i tuoi dati.
                </p>
                <Button
                  variant="danger"
                  className="w-full bg-white hover:bg-red-50 text-red-600 border border-red-200"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Elimina Account
                </Button>
              </Card>
            )}
          </div>
        </div>

        {/* Floating Modals */}
        <PrivacyPolicy
          isOpen={showPrivacyPolicy}
          onClose={() => setShowPrivacyPolicy(false)}
        />

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          title="Elimina Account"
          size="small"
        >
          <div className="space-y-4">
            <div className="bg-red-50 p-4 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">
                Sei sicuro di voler eliminare definitivamente il tuo account?
                Perderai lo storico appuntamenti e tutti i dati salvati.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>Annulla</Button>
              <Button variant="danger" onClick={handleDeleteAccount}>Elimina per sempre</Button>
            </div>
          </div>
        </Modal>

        {/* Cancel Appointment Modal */}
        <Modal
          isOpen={!!appointmentToCancel}
          onClose={() => setAppointmentToCancel(null)}
          title="Annulla Appuntamento"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Confermi di voler annullare l'appuntamento? Il negozio verrà avvisato.
            </p>
            {appointmentToCancel && (
              <div className="bg-gray-50 p-3 rounded-lg text-sm border border-gray-100">
                <p><strong>Servizio:</strong> {appointmentToCancel.services?.name}</p>
                <p><strong>Data:</strong> {new Date(appointmentToCancel.start_at).toLocaleDateString()} ore {new Date(appointmentToCancel.start_at).toLocaleTimeString().slice(0, 5)}</p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setAppointmentToCancel(null)} disabled={isCancelling}>Indietro</Button>
              <Button variant="danger" onClick={handleCancelAppointment} loading={isCancelling}>Conferma Annullamento</Button>
            </div>
          </div>
        </Modal>
        {/* Physical Spacer to force scroll past bottom nav */}
        <div className="h-32 w-full flex-shrink-0" aria-hidden="true" />
      </div>
    </div>
  );
};
