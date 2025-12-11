import React, { useState, useEffect } from 'react';
import { User, Calendar, Clock, Edit, Save, X, Shield, FileText, Trash2, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { PrivacyPolicy } from './PrivacyPolicy';
import { useAuth } from '../contexts/AuthContext';
import { useClientRegistration } from '../hooks/useClientRegistration';
import { useAppointments } from '../hooks/useAppointments';
import { apiService } from '../services/api';
import type { RegisteredClient } from '../types/auth';
import type { Appointment } from '../types';

export const ClientProfile: React.FC = () => {
  const { user, logout } = useAuth();
  const { deleteRegisteredClient, getClientByEmail } = useClientRegistration();
  const { appointments, loadAppointments } = useAppointments();
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    profile_photo_url: '',
    profile_photo_path: '',
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [clientData, setClientData] = useState<RegisteredClient | null>(null);
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Carica i dati del profilo all'inizializzazione
  useEffect(() => {
    if (!user) return;

    // Base: dati da auth
    setFormData(prev => ({
      ...prev,
      full_name: user.full_name || '',
      email: user.email || '',
      phone: user.phone || '',
    }));

    // Carica anche i dati del cliente registrato (con consensi privacy)
    if (user.email) {
      const registeredClient = getClientByEmail(user.email);
      setClientData(registeredClient);
    }

    // Carica sempre i dati dal bucket tramite record cliente
    if (user.email) {
      apiService.getClientByEmailExact(user.email).then((client) => {
        if (client) {
          setFormData(prev => ({
            ...prev,
            full_name: client.first_name && client.last_name
              ? `${client.first_name} ${client.last_name}`.trim()
              : (client.first_name || prev.full_name),
            phone: client.phone_e164 || prev.phone,
            profile_photo_url: client.photo_url || prev.profile_photo_url,
          }));
        }
      }).catch(() => {});
    }
  }, [user, getClientByEmail]);

  // Helper per confrontare email normalizzate
  const normalizeEmail = (email?: string | null) => email?.trim().toLowerCase() || '';
  const authEmail = normalizeEmail(user?.email);
  const registeredEmail = normalizeEmail(clientData?.email);
  const registeredClientId = clientData?.id;

  // Filter appointments for this client (match per client_id o email)
  const clientAppointments = appointments.filter(apt => {
    const appointmentClientId = apt.client_id || apt.clients?.id;
    const appointmentEmail = normalizeEmail(apt.clients?.email);

    const matchesClientId = Boolean(
      (user?.id && appointmentClientId === user.id) ||
      (registeredClientId && appointmentClientId === registeredClientId)
    );

    const matchesEmail = Boolean(
      (authEmail && appointmentEmail === authEmail) ||
      (registeredEmail && appointmentEmail === registeredEmail)
    );

    return matchesClientId || matchesEmail;
  });

  const normalizePhone = (phone: string): string => {
    if (!phone) return '+39000000000';
    let cleaned = phone.replace(/\s/g, '').replace(/[^0-9+]/g, '');
    if (cleaned.startsWith('0039')) cleaned = cleaned.substring(4);
    else if (cleaned.startsWith('+39')) cleaned = cleaned.substring(3);
    else if (cleaned.startsWith('39') && cleaned.length > 10) cleaned = cleaned.substring(2);
    return `+39${cleaned}`;
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

  const handleSave = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const email = formData.email || user.email;
      if (!email) throw new Error('Email mancante');

      await apiService.updateClientByEmail(email, {
        first_name: formData.full_name.split(' ')[0] || 'Cliente',
        last_name: formData.full_name.split(' ').slice(1).join(' ') || null,
        phone_e164: normalizePhone(formData.phone || ''),
        photo_url: formData.profile_photo_url || null,
      });

      setMessage({ type: 'success', text: 'Profilo aggiornato con successo!' });
      setIsEditing(false);
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
      setMessage({ type: 'error', text: 'Errore nel salvataggio del profilo' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        full_name: user.full_name || prev.full_name,
        email: user.email || prev.email,
        phone: user.phone || prev.phone,
      }));
    }
    setIsEditing(false);
    setMessage(null);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Carica solo file immagine' });
      return;
    }
    if (!user) {
      setMessage({ type: 'error', text: 'Utente non autenticato' });
      return;
    }
    try {
      setPhotoMessage('Caricamento in corso...');
      const compressed = await compressImage(file, 512, 0.75);
      const { path, publicUrl } = await apiService.uploadClientPhotoPublic(compressed, user.id);
      setFormData(prev => ({
        ...prev,
        profile_photo_url: publicUrl,
        profile_photo_path: path,
      }));
      // Salva subito la foto nel record cliente per riflesso immediato sulla chat
      const targetEmail = formData.email || user.email;
      if (targetEmail) {
        apiService.updateClientByEmail(targetEmail, {
          first_name: formData.full_name.split(' ')[0] || 'Cliente',
          last_name: formData.full_name.split(' ').slice(1).join(' ') || null,
          phone_e164: formData.phone || '',
          photo_url: publicUrl,
          profile_photo_path: path,
        }).catch((err) => console.warn('Non sono riuscito ad aggiornare la foto cliente:', err));
      }
      setPhotoMessage('Foto caricata con successo');
      setTimeout(() => setPhotoMessage(null), 2000);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Errore durante il caricamento della foto' });
      setPhotoMessage(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !clientData) return;
    
    try {
      // Elimina il cliente registrato
      const success = deleteRegisteredClient(clientData.id);
      
      if (success) {
        setMessage({ type: 'success', text: 'Account eliminato. Verrai disconnesso...' });
        
        // Disconnetti l'utente dopo 2 secondi
        setTimeout(() => {
          logout();
        }, 2000);
      } else {
        setMessage({ type: 'error', text: 'Errore nell\'eliminazione dell\'account' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Errore nell\'eliminazione dell\'account' });
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  // Verifica se un appuntamento può essere cancellato (almeno 2 ore prima)
  const canCancelAppointment = (appointment: Appointment): boolean => {
    const appointmentTime = new Date(appointment.start_at);
    const now = new Date();
    const hoursUntilAppointment = (appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilAppointment >= 2 && appointment.status !== 'cancelled' && appointment.status !== 'completed';
  };

  // Handle appointment cancellation
  const handleCancelAppointment = async () => {
    if (!appointmentToCancel || !user) return;
    
    setIsCancelling(true);
    
    try {
      // 1. Annulla l'appuntamento nel database
      await apiService.cancelAppointmentDirect(appointmentToCancel.id);
      
      // 2. Ottieni i dettagli completi dell'appuntamento per la notifica
      const appointmentDetails = await apiService.getAppointmentById(appointmentToCancel.id);
      
      // 3. Prepara i dati per le notifiche e email
      const shop = await apiService.getShop();
      const detailedAppointment = appointmentDetails || appointmentToCancel;
      const clientInfo = detailedAppointment?.clients || appointmentToCancel.clients;
      const staffInfo = detailedAppointment?.staff;
      const serviceInfo = detailedAppointment?.services || appointmentToCancel.services;
      
      const clientName = clientInfo 
        ? `${clientInfo.first_name} ${clientInfo.last_name || ''}`.trim()
        : user.full_name || 'Cliente';
      const clientEmail = clientInfo?.email || user.email || undefined;
      const clientPhone = clientInfo?.phone_e164 || user.phone || 'Non fornito';
      
      const appointmentDate = new Date(appointmentToCancel.start_at).toLocaleDateString('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      
      const appointmentTime = new Date(appointmentToCancel.start_at).toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      
      const serviceName = serviceInfo?.name || 'Servizio';
      
      // Ottieni i dettagli dello staff se disponibile
      let staffDetails = staffInfo;
      if (appointmentToCancel.staff_id && !staffDetails) {
        try {
          const staff = await apiService.getStaffById(appointmentToCancel.staff_id);
          staffDetails = staff || undefined;
        } catch (error) {
          console.error('❌ Errore recupero dettagli staff:', error);
        }
      }
      
      const barberName = staffDetails?.full_name || 'Staff';
      const barberUserId = staffDetails?.user_id || staffDetails?.id || appointmentToCancel.staff_id;

      // 4. Crea notifica in-app per il barbiere (se staff_id disponibile)
      if (appointmentToCancel.staff_id && barberUserId) {
        try {
          await apiService.createNotification({
            user_id: barberUserId,
            user_type: 'staff',
            type: 'appointment_cancelled',
            title: '❌ Appuntamento Annullato',
            message: `${clientName} ha annullato l'appuntamento per ${serviceName} del ${appointmentDate} alle ${appointmentTime}`,
            data: {
              appointment_id: appointmentToCancel.id,
              client_name: clientName,
              client_phone: clientPhone,
              service_name: serviceName,
              appointment_date: appointmentDate,
              appointment_time: appointmentTime,
              staff_id: appointmentToCancel.staff_id,
            }
          });
          console.log('✅ Notifica annullamento creata. user_id:', barberUserId, 'staff_id:', appointmentToCancel.staff_id);
        } catch (notifError) {
          console.error('❌ Errore creazione notifica annullamento:', notifError);
        }
      }
      
      // Prepara i dati comuni per le email
      const cancellationData = {
        clientName: clientName,
        clientEmail: clientEmail,
        clientPhone: clientPhone,
        serviceName: serviceName,
        appointmentDate: appointmentDate,
        appointmentTime: appointmentTime,
        barberName: barberName,
        shopName: shop?.name || 'Barbershop',
      };
      
      // Email disabilitate lato app: invio gestito da webhooks Supabase
      
      // Ricarica gli appuntamenti per mostrare lo stato aggiornato
      await loadAppointments();
      
      setMessage({ type: 'success', text: 'Appuntamento annullato con successo!' });
      setAppointmentToCancel(null);
      
      // Rimuovi il messaggio dopo 3 secondi
      setTimeout(() => setMessage(null), 3000);
      
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      setMessage({ type: 'error', text: 'Errore nell\'annullamento dell\'appuntamento. Riprova.' });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div
      className="space-y-8 rounded-3xl p-6 md:p-10"
      style={{
        backgroundImage:
          'linear-gradient(135deg, rgba(16,185,129,0.22), rgba(34,197,94,0.28) 40%, rgba(22,163,74,0.25) 70%, rgba(5,150,105,0.28))',
        backgroundColor: 'rgba(236,253,245,0.6)',
      }}
    >
      <div className="flex items-center justify-between glass-panel pb-2">
        <h1 className="text-3xl font-bold text-gray-900">Il Mio Profilo</h1>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)}>
            <Edit className="w-4 h-4 mr-2" />
            Modifica Profilo
          </Button>
        ) : (
          <div className="flex space-x-2">
            <Button variant="secondary" onClick={handleCancel}>
              <X className="w-4 h-4 mr-2" />
              Annulla
            </Button>
            <Button onClick={handleSave} loading={isLoading}>
              <Save className="w-4 h-4 mr-2" />
              Salva
            </Button>
          </div>
        )}
      </div>

      {/* Messaggio di feedback */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profilo */}
        <Card className="lg:col-span-1">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              {formData.profile_photo_url ? (
                <img
                  src={formData.profile_photo_url}
                  alt={formData.full_name || 'Foto profilo'}
                  className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-28 h-28 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto shadow-lg">
                  <User className="w-12 h-12 text-white" />
                </div>
              )}
            </div>

            {photoMessage && (
              <p className="text-xs text-gray-600">{photoMessage}</p>
            )}

            {isEditing && (
              <div className="flex justify-center">
                <label className="cursor-pointer text-sm font-semibold text-green-700 hover:text-green-800">
                  Carica foto
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </label>
              </div>
            )}

            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {formData.full_name}
              </h2>
              <p className="text-gray-600">Cliente</p>
            </div>
          </div>
        </Card>

        {/* Informazioni */}
        <Card className="lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Informazioni Personali</h3>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Nome Completo"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                disabled={!isEditing}
                required
              />

              <Input
                label="Telefono"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                disabled={!isEditing}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                disabled={!isEditing}
                required
              />

              <Input
                label="Indirizzo"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                disabled={!isEditing}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Note</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                disabled={!isEditing}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Note aggiuntive..."
              />
            </div>
          </div>

          {isEditing && (
            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="secondary" onClick={handleCancel}>
                <X className="w-4 h-4 mr-2" />
                Annulla
              </Button>
              <Button onClick={handleSave} disabled={isLoading}>
                <Save className="w-4 h-4 mr-2" />
                Salva Modifiche
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Sezione appuntamenti rimossa: ora gestita dalla pagina \"Le mie prenotazioni\" */}

      {/* Privacy e Consensi - Solo per clienti registrati */}
      {clientData && clientData.privacyConsent && (
        <Card>
          <div className="flex items-center mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-4">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Privacy e Consensi</h3>
              <p className="text-gray-600 text-sm">Gestisci i tuoi dati personali e consensi</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Consenso Privacy */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-green-900">Informativa Privacy Accettata</h4>
                  <p className="text-sm text-green-700 mt-1">
                    Hai accettato l'informativa privacy il{' '}
                    {new Date(clientData.privacyConsent.acceptedAt).toLocaleDateString('it-IT', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Versione: {clientData.privacyConsent.version}
                  </p>
                </div>
              </div>
            </div>

            {/* Visualizza Privacy Policy */}
            <div>
              <Button
                variant="secondary"
                onClick={() => setShowPrivacyPolicy(true)}
                className="w-full flex items-center justify-center"
              >
                <FileText className="w-4 h-4 mr-2" />
                Visualizza Informativa Privacy
              </Button>
            </div>

            {/* I tuoi diritti GDPR */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">I Tuoi Diritti GDPR</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Diritto di accesso ai tuoi dati personali</li>
                <li>• Diritto di rettifica (modifica profilo)</li>
                <li>• Diritto alla cancellazione (elimina account)</li>
                <li>• Diritto di portabilità dei dati</li>
              </ul>
            </div>

            {/* Elimina Account */}
            <div className="border-t border-gray-200 pt-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-medium text-red-900 mb-2">Zona Pericolosa</h4>
                <p className="text-sm text-red-700 mb-3">
                  L'eliminazione dell'account comporterà la cancellazione permanente di tutti i tuoi dati
                  personali e consensi. Questa azione non può essere annullata.
                </p>
                <Button
                  variant="secondary"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="bg-red-100 text-red-700 hover:bg-red-200 border-red-300 flex items-center"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Elimina Account e Revoca Consensi
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Privacy Policy Modal */}
      <PrivacyPolicy 
        isOpen={showPrivacyPolicy} 
        onClose={() => setShowPrivacyPolicy(false)} 
      />

      {/* Conferma Eliminazione Account */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Conferma Eliminazione</h3>
            </div>
            
            <p className="text-gray-700 mb-6">
              Sei sicuro di voler eliminare il tuo account? Questa azione eliminerà:
            </p>
            <ul className="text-sm text-gray-600 space-y-1 mb-6 ml-4">
              <li>• Tutti i tuoi dati personali</li>
              <li>• I consensi privacy</li>
              <li>• Le prenotazioni future</li>
              <li>• L'accesso al sistema</li>
            </ul>
            <p className="text-red-600 font-medium text-sm mb-6">
              Questa azione non può essere annullata.
            </p>
            
            <div className="flex space-x-3">
              <Button
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1"
              >
                Annulla
              </Button>
              <Button
                onClick={handleDeleteAccount}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Elimina Definitivamente
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Conferma Annullamento Appuntamento */}
      {appointmentToCancel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Conferma Annullamento</h3>
            </div>
            
            <p className="text-gray-700 mb-4">
              Sei sicuro di voler annullare questo appuntamento?
            </p>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Servizio:</span>
                  <span className="font-medium text-gray-900">
                    {appointmentToCancel.services?.name || 'Servizio'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Barbiere:</span>
                  <span className="font-medium text-gray-900">
                    {appointmentToCancel.staff?.full_name || 'Barbiere'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Data:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(appointmentToCancel.start_at).toLocaleDateString('it-IT', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long'
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Orario:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(appointmentToCancel.start_at).toLocaleTimeString('it-IT', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: false
                    })}
                  </span>
                </div>
              </div>
            </div>
            
            <p className="text-orange-600 text-sm mb-6">
              Il barbiere verrà notificato dell'annullamento.
            </p>
            
            <div className="flex space-x-3">
              <Button
                variant="secondary"
                onClick={() => setAppointmentToCancel(null)}
                className="flex-1"
                disabled={isCancelling}
              >
                Indietro
              </Button>
              <Button
                onClick={handleCancelAppointment}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Annullamento...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 mr-2" />
                    Annulla Appuntamento
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
