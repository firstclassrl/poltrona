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
  const { getActiveStaff, updateStaff } = useChairAssignment();
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
  const [activeTab, setActiveTab] = useState<'profile' | 'assignment'>('profile');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadProfileData();
  }, []);

  useEffect(() => {
    const activeStaff = getActiveStaff();
    if (activeStaff) {
      setStaffData(activeStaff);
      const profileData = getBarberProfile(activeStaff);
      setFormData(profileData);
      setProfileImageUrl(profileData.profile_photo_url || '');
    }
  }, [getActiveStaff, getBarberProfile]);

  const loadProfileData = async () => {
    try {
      // Prima prova a caricare dal localStorage
      const savedProfile = localStorage.getItem('barberProfile');
      if (savedProfile) {
        const parsedProfile = JSON.parse(savedProfile);
        setStaffData(parsedProfile);
        setFormData({
          full_name: parsedProfile.full_name || '',
          role: parsedProfile.role || '',
          phone: '',
          email: '',
          specialties: '',
          bio: '',
          chair_id: parsedProfile.chair_id || '',
        });
        return;
      }

      // Carica i dati del barbiere
      const staff = await apiService.getStaffProfile();
      setStaffData(staff);
      
      // Popola il form con i dati esistenti
      if (staff) {
        const profileData = getBarberProfile(staff);
        setFormData(profileData);
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
      setStaffData(null);
    }
  };

  const handleSave = async () => {
    if (!staffData) return;
    
    try {
      // Prepara i dati del profilo con l'immagine aggiornata
      const profileData: BarberProfileData = {
        ...formData,
        profile_photo_url: profileImageUrl,
      };

      // Salva il profilo barbiere
      const success = await updateBarberProfile(staffData.id, profileData);
      
      if (success) {
        // Aggiorna anche i dati base del barbiere tramite il hook esistente
        const basicUpdates = {
          full_name: formData.full_name,
          role: formData.role,
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
      setMessage({ type: 'error', text: 'Errore nel salvataggio del profilo' });
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
    // Mock upload - in produzione useresti Supabase Storage
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setProfileImageUrl(result);
        resolve(result);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveProfileImage = () => {
    setProfileImageUrl('');
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Gestione Barbieri</h1>
        {activeTab === 'profile' && !isEditing && (
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

      {/* Selettore Barbiere */}
      {activeTab === 'profile' && (
        <div className="max-w-md">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Seleziona Barbiere
          </label>
          <BarberSelector />
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'profile' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Profilo Personale
        </button>
        <button
          onClick={() => setActiveTab('assignment')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'assignment' ? 'bg-yellow-100 text-yellow-900 shadow-sm border-2 border-yellow-300' : 'text-gray-600 hover:text-gray-900 bg-yellow-50 hover:bg-yellow-100'
          }`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          Gestione Poltrone
        </button>
      </div>

      {activeTab === 'profile' ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Foto Profilo */}
        <Card className="lg:col-span-1">
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

      {/* Statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">156</div>
            <div className="text-gray-600">Appuntamenti Completati</div>
          </div>
        </Card>
        
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">4.8</div>
            <div className="text-gray-600">Valutazione Media</div>
          </div>
        </Card>
        
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">2</div>
            <div className="text-gray-600">Anni di Esperienza</div>
          </div>
        </Card>
          </div>
        </div>
      ) : (
        <ChairAssignment />
      )}
    </div>
  );
};
