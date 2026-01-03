import { useState, useEffect } from 'react';
import { Save, Edit, Users } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { PhotoUpload } from './PhotoUpload';
import { ChairAssignment } from './ChairAssignment';
import { BarberSelector } from './BarberSelector';
import { Avatar } from './ui/Avatar';
import { useChairAssignment } from '../hooks/useChairAssignment';
import { useBarberProfile, type BarberProfileData } from '../hooks/useBarberProfile';
import { apiService } from '../services/api';
import type { Staff } from '../types';

export const BarberProfile = () => {
  const [staffData, setStaffData] = useState<Staff | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const { getActiveStaff, updateStaff, activeStaffId, availableStaff } = useChairAssignment();
  const { updateBarberProfile, getBarberProfile, isLoading } = useBarberProfile();
  const [formData, setFormData] = useState<BarberProfileData>({
    full_name: '',
    role: '',
    phone: '',
    email: '',
    specialties: '',
    bio: '',
    chair_id: '',
    profile_photo_url: '',
  });
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Carica i dati dello staff attivo quando cambia la selezione o quando non si sta modificando
  useEffect(() => {
    // Non resettare il form se l'utente sta modificando
    if (isEditing) return;
    
    // Se non ci sono barbieri disponibili ancora, aspetta
    if (availableStaff.length === 0 && activeStaffId) {
      return;
    }
    
    // Se c'è un activeStaffId, trova il barbiere corrispondente
    if (activeStaffId) {
      const activeStaff = availableStaff.find(s => s.id === activeStaffId);
      if (activeStaff) {
        // Carica i dati se è un barbiere diverso o se i dati sono stati aggiornati
        const shouldReload = !staffData || 
                             staffData.id !== activeStaff.id || 
                             staffData.full_name !== activeStaff.full_name ||
                             staffData.email !== activeStaff.email ||
                             staffData.profile_photo_url !== activeStaff.profile_photo_url;
        
        if (shouldReload) {
          setStaffData(activeStaff);
          const profileData = getBarberProfile(activeStaff);
          setFormData(profileData);
          setProfileImageUrl(profileData.profile_photo_url || '');
          // Se abbiamo trovato un barbiere valido, rimuovi eventuali messaggi "nessun barbiere"
          setMessage((prev) =>
            prev && prev.type === 'info'
              ? null
              : prev
          );
        }
        return;
      }
    }
    
    // Se non c'è nessun barbiere selezionato, resetta il form
    if (!activeStaffId) {
      if (staffData !== null) {
        setStaffData(null);
        setFormData({
          full_name: '',
          role: '',
          phone: '',
          email: '',
          specialties: '',
          bio: '',
          chair_id: '',
          profile_photo_url: '',
        });
        setProfileImageUrl('');
      }
      // Mostra un messaggio informativo se non ci sono barbieri disponibili
      if (availableStaff.length === 0) {
        setMessage({ 
          type: 'info', 
          text: 'Nessun barbiere trovato. Vai su "Gestione Poltrone" per aggiungere un barbiere.' 
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStaffId, isEditing, availableStaff]);

  const handleSave = async () => {
    if (!staffData) {
      console.error('No staff data available for saving');
      setMessage({ type: 'error', text: 'Nessun dato barbiere disponibile per il salvataggio' });
      return;
    }
    
    console.log('Saving profile for staff:', staffData.id, formData);
    
    try {
      // Prepara i dati del profilo con l'immagine aggiornata
      const profileData: BarberProfileData = {
        ...formData,
        profile_photo_url: profileImageUrl,
      };

      console.log('Profile data to save:', profileData);

      // Salva il profilo barbiere
      const success = await updateBarberProfile(staffData.id, profileData);
      
      if (success) {
        // Aggiorna anche i dati base del barbiere tramite il hook esistente
        // Includi tutti i campi del profilo per assicurarti che vengano salvati nel database
        const basicUpdates = {
          full_name: formData.full_name,
          role: formData.role,
          email: formData.email,
          phone: formData.phone,
          specialties: formData.specialties,
          bio: formData.bio,
          chair_id: formData.chair_id,
          profile_photo_url: profileImageUrl,
        };
        updateStaff(staffData.id, basicUpdates);

        setMessage({ type: 'success', text: 'Profilo barbiere aggiornato con successo!' });
        setIsEditing(false);
        
        // Rimuovi il messaggio dopo 3 secondi
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: 'Errore nel salvataggio del profilo' });
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      setMessage({ type: 'error', text: `Errore nel salvataggio del profilo: ${error instanceof Error ? error.message : 'Errore sconosciuto'}` });
    }
  };

  const handleCancel = () => {
    if (staffData) {
      const profileData = getBarberProfile(staffData);
      setFormData(profileData);
      setProfileImageUrl(profileData.profile_photo_url || '');
    }
    setIsEditing(false);
    setMessage(null);
  };

  const handleProfileImageUpload = async (file: File): Promise<string> => {
    if (!staffData?.id) throw new Error('Staff non selezionato');
    const { publicUrl, path } = await apiService.uploadStaffPhotoPublic(file, staffData.id);
    setProfileImageUrl(publicUrl);
    setFormData(prev => ({ ...prev, profile_photo_url: publicUrl, profile_photo_path: path }));
    return publicUrl;
  };

  const handleRemoveProfileImage = () => {
    setProfileImageUrl('');
  };

  const glassCard = 'bg-white/60 backdrop-blur-xl border border-white/30 shadow-xl';

  return (
    <div className="min-h-screen p-0 page-container-chat-style">
      <div className="w-full h-full rounded-3xl p-4 md:p-6">
      <div className="h-full flex flex-col page-card-chat-style p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Gestione Poltrone</h1>
      </div>

      {/* Messaggio di feedback */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : message.type === 'info'
            ? 'bg-blue-100 text-blue-800 border border-blue-200'
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Sezione selezione barbiere e profilo personale */}
      <div className="space-y-8">
        <div className="max-w-md">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Seleziona Barbiere
          </label>
          <BarberSelector 
            onBarberSelect={(staffId) => {
              // Trova direttamente il barbiere da availableStaff usando lo staffId
              const selectedStaff = availableStaff.find(s => s.id === staffId);
              if (selectedStaff) {
                setStaffData(selectedStaff);
                const profileData = getBarberProfile(selectedStaff);
                setFormData(profileData);
                setProfileImageUrl(profileData.profile_photo_url || '');
                setIsEditing(false); // Esci dalla modalità modifica se attiva
                // Rimuovi eventuali messaggi informativi
                setMessage((prev) =>
                  prev && prev.type === 'info'
                    ? null
                    : prev
                );
              }
            }}
          />
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Profilo Personale</h2>
          {!isEditing && (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Modifica Profilo
            </Button>
          )}
        </div>

        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Foto Profilo */}
        <Card className={`lg:col-span-1 ${glassCard}`}>
          <div className="text-center">
            {isEditing ? (
              <div className="mb-4">
                <PhotoUpload
                  onUpload={handleProfileImageUpload}
                  currentImageUrl={profileImageUrl}
                  onRemove={handleRemoveProfileImage}
                  maxSize={3}
                  className="max-w-32 mx-auto"
                />
              </div>
            ) : (
              <div className="mx-auto mb-4">
                <Avatar 
                  name={formData.full_name}
                  size="xl"
                  imageUrl={profileImageUrl}
                  className="w-32 h-32 text-4xl"
                />
              </div>
            )}
            <h2 className="text-xl font-semibold text-gray-900 mt-4">
              {formData.full_name || 'Nome Barbiere'}
            </h2>
            <p className="text-gray-600">{formData.role || 'Ruolo'}</p>
          </div>
        </Card>

        {/* Informazioni */}
        <Card className={`lg:col-span-2 ${glassCard}`}>
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
                label="Ruolo"
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                disabled={!isEditing}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Poltrona Assegnata"
                value={formData.chair_id}
                onChange={(e) => setFormData(prev => ({ ...prev, chair_id: e.target.value }))}
                disabled={!isEditing}
                options={[
                  { value: '', label: 'Seleziona poltrona' },
                  { value: 'chair_1', label: 'Poltrona 1' },
                  { value: 'chair_2', label: 'Poltrona 2' },
                ]}
              />
              
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600">
                  {formData.chair_id ? `Assegnato a ${formData.chair_id.replace('chair_', 'Poltrona ')}` : 'Nessuna poltrona assegnata'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Telefono"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                disabled={!isEditing}
                placeholder="+39 123 456 7890"
              />
              
              <Input
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                disabled={!isEditing}
                placeholder="barbiere@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Specialità
              </label>
              <textarea
                value={formData.specialties}
                onChange={(e) => setFormData(prev => ({ ...prev, specialties: e.target.value }))}
                disabled={!isEditing}
                placeholder="Taglio classico, Barba, Rasatura, Styling..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bio
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                disabled={!isEditing}
                placeholder="Racconta qualcosa di te..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                rows={4}
              />
            </div>
          </div>

          {isEditing && (
            <div className="flex space-x-3 pt-6 border-t">
              <Button
                variant="secondary"
                onClick={handleCancel}
                className="flex-1"
                disabled={isLoading}
              >
                Annulla
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                className="flex-1"
                loading={isLoading}
                disabled={isLoading}
              >
                <Save className="w-4 h-4 mr-2" />
                Salva Modifiche
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Sezione statistiche rimossa su richiesta */}
      </div>
      </div>

      {/* Gestione Poltrone e Barbieri */}
      <ChairAssignment />
      </div>
      </div>
    </div>
  );
};
