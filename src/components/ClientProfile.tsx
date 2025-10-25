import React, { useState, useEffect } from 'react';
import { User, Calendar, Clock, Edit, Save, X, Shield, FileText, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { PrivacyPolicy } from './PrivacyPolicy';
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile, type UserProfileData } from '../hooks/useUserProfile';
import { useClientRegistration } from '../hooks/useClientRegistration';
import { useAppointments } from '../hooks/useAppointments';
import type { RegisteredClient } from '../types/auth';

export const ClientProfile: React.FC = () => {
  const { user, logout } = useAuth();
  const { updateUserProfile, getUserProfile, isLoading } = useUserProfile();
  const { deleteRegisteredClient, getClientByEmail } = useClientRegistration();
  const { appointments } = useAppointments();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<UserProfileData>({
    full_name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [clientData, setClientData] = useState<RegisteredClient | null>(null);

  // Carica i dati del profilo all'inizializzazione
  useEffect(() => {
    if (user) {
      const profileData = getUserProfile(user);
      setFormData(profileData);
      
      // Carica anche i dati del cliente registrato (con consensi privacy)
      if (user.email) {
        const registeredClient = getClientByEmail(user.email);
        setClientData(registeredClient);
      }
    }
  }, [user]);

  // Filter appointments for this client
  const clientAppointments = appointments.filter(apt => 
    apt.client_id === user?.id || apt.clients?.first_name === user?.full_name?.split(' ')[0]
  );

  const handleSave = async () => {
    if (!user) return;
    
    try {
      const success = await updateUserProfile(user.id, formData);
      
      if (success) {
        setMessage({ type: 'success', text: 'Profilo aggiornato con successo!' });
        setIsEditing(false);
        
        // Rimuovi il messaggio dopo 3 secondi
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: 'Errore nel salvataggio del profilo' });
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      setMessage({ type: 'error', text: 'Errore nel salvataggio del profilo' });
    }
  };

  const handleCancel = () => {
    if (user) {
      const profileData = getUserProfile(user);
      setFormData(profileData);
    }
    setIsEditing(false);
    setMessage(null);
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Il Mio Profilo</h1>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)}>
            <Edit className="w-4 h-4 mr-2" />
            Modifica Profilo
          </Button>
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
          <div className="text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {formData.full_name}
            </h2>
            <p className="text-gray-600">Cliente</p>
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

      {/* Appuntamenti */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-6">I Miei Appuntamenti</h3>
        
        {clientAppointments.length > 0 ? (
          <div className="space-y-4">
            {clientAppointments.map((appointment) => (
              <div key={appointment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {appointment.services?.name || 'Servizio'}
                    </div>
                    <div className="text-sm text-gray-600">
                      {appointment.staff?.full_name || 'Barbiere'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900">
                    {new Date(appointment.start_at).toLocaleDateString('it-IT')}
                  </div>
                  <div className="text-sm text-gray-600 flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {new Date(appointment.start_at).toLocaleTimeString('it-IT', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: false // Forza formato 24 ore
                    })}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    appointment.status === 'confirmed' 
                      ? 'bg-green-100 text-green-800'
                      : appointment.status === 'scheduled'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {appointment.status === 'confirmed' ? 'Confermato' : 
                     appointment.status === 'scheduled' ? 'Programmato' : 
                     appointment.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Nessun appuntamento trovato</p>
          </div>
        )}
      </Card>

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
    </div>
  );
};
