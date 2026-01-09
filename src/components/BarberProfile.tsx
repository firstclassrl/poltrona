import { useState, useEffect } from 'react';
import { Save, Plus, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { PhotoUpload } from './PhotoUpload';
import { ChairAssignment } from './ChairAssignment';
import { Avatar } from './ui/Avatar';
import { DeleteConfirmation } from './DeleteConfirmation';
import { Toast } from './ui/Toast';
import { useChairAssignment } from '../hooks/useChairAssignment';
import { useBarberProfile, type BarberProfileData } from '../hooks/useBarberProfile';
import { apiService } from '../services/api';
import { genderOptions } from '../config/terminology';
import { useTerminology } from '../contexts/TerminologyContext';
import { useToast } from '../hooks/useToast';
import type { Staff, Gender } from '../types';

type ViewMode = 'list' | 'edit' | 'create';

export const BarberProfile = () => {
  const {
    availableStaff,
    updateStaff,
    addNewStaff,
    deleteStaff,
    refreshData
  } = useChairAssignment();
  const { updateBarberProfile, getBarberProfile, isLoading: isProfileLoading } = useBarberProfile();
  const { toast, showToast, hideToast } = useToast();
  const { professional, professionalPlural } = useTerminology();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<BarberProfileData & { active: boolean; gender: Gender }>({
    full_name: '',
    role: '',
    phone: '',
    email: '',
    specialties: '',
    bio: '',
    chair_id: '',
    profile_photo_url: '',
    active: true,
    gender: 'male',
  });
  const [profileImageUrl, setProfileImageUrl] = useState('');

  // Delete State
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load staff data when editing
  useEffect(() => {
    if (viewMode === 'edit' && selectedStaffId) {
      const staff = availableStaff.find(s => s.id === selectedStaffId);
      if (staff) {
        const profileData = getBarberProfile(staff);
        setFormData({
          ...profileData,
          active: staff.active ?? true,
          gender: staff.gender || 'male',
        });
        setProfileImageUrl(profileData.profile_photo_url || '');
      }
    } else if (viewMode === 'create') {
      // Reset form for create mode
      setFormData({
        full_name: '',
        role: '',
        phone: '',
        email: '',
        specialties: '',
        bio: '',
        chair_id: '',
        profile_photo_url: '',
        active: true,
        gender: 'male',
      });
      setProfileImageUrl('');
    }
  }, [viewMode, selectedStaffId, availableStaff, getBarberProfile]);

  const handleEditClick = (staffId: string) => {
    setSelectedStaffId(staffId);
    setViewMode('edit');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedStaffId(null);
    setProfileImageUrl('');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const staffDataToSave = {
        full_name: formData.full_name,
        role: formData.role,
        email: formData.email,
        phone: formData.phone,
        chair_id: formData.chair_id || null, // Ensure empty string becomes null if needed, or handle in backend
        profile_photo_url: profileImageUrl,
        active: formData.active,
        gender: formData.gender,
        specialties: formData.specialties,
        bio: formData.bio,
        calendar_id: null,
      };

      if (viewMode === 'create') {
        const newStaff = await addNewStaff({
          ...staffDataToSave,
          shop_id: null
        });

        // After creating staff, create/update profile
        const profileData: BarberProfileData = {
          ...formData,
          profile_photo_url: profileImageUrl,
        };
        await updateBarberProfile(newStaff.id, profileData);

        showToast(`${professional()} creato con successo!`, 'success');
        refreshData();
        handleBackToList();
      } else if (viewMode === 'edit' && selectedStaffId) {
        // 1. Update Staff table
        await updateStaff(selectedStaffId, staffDataToSave);

        // 2. Update BarberProfile table
        const profileData: BarberProfileData = {
          ...formData,
          profile_photo_url: profileImageUrl,
        };
        await updateBarberProfile(selectedStaffId, profileData);

        showToast('Profilo aggiornato con successo!', 'success');
        refreshData();
        handleBackToList();
      }
    } catch (error) {
      console.error('Error saving staff:', error);
      showToast('Errore nel salvataggio. Riprova.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (staff: Staff) => {
    setStaffToDelete(staff);
    setShowDeleteConfirmation(true);
  };

  const confirmDelete = async () => {
    if (!staffToDelete) return;
    setIsDeleting(true);
    try {
      await deleteStaff(staffToDelete.id);
      showToast(`${professional()} eliminato con successo!`, 'success');
      setShowDeleteConfirmation(false);
      setStaffToDelete(null);
    } catch (error) {
      console.error('Error deleting staff:', error);
      const message = error instanceof Error && error.message.includes('23503')
        ? 'Impossibile eliminare: ci sono appuntamenti collegati.'
        : 'Errore durante l\'eliminazione.';
      showToast(message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleProfileImageUpload = async (file: File): Promise<string> => {
    // If we're editing, we have an ID to associate the image with immediately
    // If creating, we might want to upload to a temp location or handle it differently.
    // However, existing logic usually requires an ID.
    // For now, let's allow upload if we have selectedStaffId. 
    // If creating, we might need to skip upload until staff is created or handle it via a different flow.
    // But the current API requires a staffId for path generation usually.
    // Let's assume for creation we might encounter issues if we don't have an ID.
    // WORKAROUND: For 'create', we can't easily upload before saving because of bucket paths often using staff ID.
    // We will disable upload in 'create' mode until the user saves first, or we need to change how uploads work.

    if (!selectedStaffId && viewMode === 'create') {
      showToast('Salva prima il profilo per caricare la foto.', 'info');
      throw new Error('Save first');
    }

    if (selectedStaffId) {
      const { publicUrl, path } = await apiService.uploadStaffPhotoPublic(file, selectedStaffId);
      setProfileImageUrl(publicUrl);
      setFormData(prev => ({ ...prev, profile_photo_url: publicUrl }));
      return publicUrl;
    }
    return '';
  };

  const handleRemoveProfileImage = () => {
    setProfileImageUrl('');
    setFormData(prev => ({ ...prev, profile_photo_url: '' }));
  };

  const glassCard = 'bg-white/60 backdrop-blur-xl border border-white/30 shadow-xl';

  return (
    <div className="p-0 page-container-chat-style">
      <div className="w-full">
        <div className="flex flex-col space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">Gestione Poltrone</h1>
          </div>

          <Toast
            message={toast.message}
            type={toast.type}
            isVisible={toast.isVisible}
            onClose={hideToast}
          />

          {viewMode === 'list' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              {/* 1. Chair Assignment Visualization */}
              <ChairAssignment />

              {/* 2. Staff List */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Il Tuo Team</h3>
                    <p className="text-sm text-gray-600">Gestisci i profili dei tuoi {professionalPlural().toLowerCase()}.</p>
                  </div>
                  <Button onClick={() => setViewMode('create')}>
                    <Plus className="w-5 h-5 mr-2" />
                    Aggiungi {professional()}
                  </Button>
                </div>

                {availableStaff.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">Nessun membro del team trovato.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {availableStaff.map((staff) => (
                      <div key={staff.id} className="group relative bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                        <div className="p-5 flex items-center space-x-4">
                          <Avatar
                            name={staff.full_name}
                            imageUrl={staff.profile_photo_url || undefined}
                            size="lg"
                            className="w-16 h-16 text-xl border-2 border-white shadow-sm"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 truncate">{staff.full_name}</h4>
                            <p className="text-sm text-gray-500 mb-1">{staff.role}</p>
                            <div className="flex items-center text-xs text-gray-400">
                              <div className={`w-2 h-2 rounded-full mr-1.5 ${staff.active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                              {staff.active ? 'Attivo' : 'Inattivo'}
                            </div>
                          </div>
                        </div>

                        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                          <span className="text-xs text-gray-500 font-medium">
                            {staff.chair_id ? staff.chair_id.replace('chair_', 'Poltrona ') : 'Non assegnato'}
                          </span>
                          <div className="flex space-x-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => handleEditClick(staff.id)}
                            >
                              <Edit className="w-3.5 h-3.5 mr-1.5" />
                              Modifica
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-8 px-2 !text-red-600 hover:!text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteClick(staff)}
                            >
                              <Trash2 className="w-3.5 h-3.5 !text-red-600" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {(viewMode === 'edit' || viewMode === 'create') && (
            <div className="animate-in slide-in-from-right duration-300">
              <Button
                variant="secondary"
                onClick={handleBackToList}
                className="mb-6"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Torna alla lista
              </Button>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Photo & Basic Info Card */}
                <Card className={`lg:col-span-1 ${glassCard}`}>
                  <div className="text-center p-4">
                    {viewMode === 'create' && !profileImageUrl ? (
                      <div className="mb-6 mx-auto w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300">
                        <span className="text-xs text-center px-2">Salva per caricare foto</span>
                      </div>
                    ) : (
                      <div className="mb-6">
                        <PhotoUpload
                          onUpload={handleProfileImageUpload}
                          currentImageUrl={profileImageUrl}
                          onRemove={handleRemoveProfileImage}
                          maxSize={3}
                          className="max-w-[150px] mx-auto"
                        />
                      </div>
                    )}

                    <h2 className="text-xl font-bold text-gray-900 mb-1">
                      {formData.full_name || 'Nuovo Membro'}
                    </h2>
                    <p className="text-gray-500 mb-4">{formData.role || 'Ruolo'}</p>

                    <div className="flex items-center justify-center space-x-2 mb-6">
                      <label className="flex items-center cursor-pointer">
                        <div className="relative">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={formData.active}
                            onChange={(e) => setFormData(p => ({ ...p, active: e.target.checked }))}
                          />
                          <div className={`block w-10 h-6 rounded-full transition-colors ${formData.active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                          <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.active ? 'translate-x-4' : ''}`}></div>
                        </div>
                        <span className="ml-3 text-sm font-medium text-gray-700">
                          {formData.active ? 'Profilo Attivo' : 'Profilo Inattivo'}
                        </span>
                      </label>
                    </div>
                  </div>
                </Card>

                {/* Detailed Info Form */}
                <Card className={`lg:col-span-2 ${glassCard}`}>
                  <div className="p-2 space-y-6">
                    <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Dettagli Profilo</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <Input
                        label="Nome Completo"
                        value={formData.full_name}
                        onChange={(e) => setFormData(p => ({ ...p, full_name: e.target.value }))}
                        required
                      />
                      <Input
                        label="Ruolo"
                        value={formData.role}
                        onChange={(e) => setFormData(p => ({ ...p, role: e.target.value }))}
                        required
                        placeholder="es. Senior Barber"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <Input
                        label="Email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                        required
                      />
                      <Input
                        label="Telefono"
                        value={formData.phone}
                        onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <Select
                        label="Genere"
                        value={formData.gender}
                        onChange={(e) => setFormData(p => ({ ...p, gender: e.target.value as Gender }))}
                        options={genderOptions.map(o => ({ value: o.value, label: o.label }))}
                      />
                      <Select
                        label="Poltrona Assegnata"
                        value={formData.chair_id}
                        onChange={(e) => setFormData(p => ({ ...p, chair_id: e.target.value }))}
                        options={[
                          { value: '', label: 'Nessuna assegnazione' },
                          { value: 'chair_1', label: 'Poltrona 1' },
                          { value: 'chair_2', label: 'Poltrona 2' },
                        ]}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Specialità</label>
                      <textarea
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[80px]"
                        placeholder="es. Taglio sfumato, Barba a lama..."
                        value={formData.specialties}
                        onChange={(e) => setFormData(p => ({ ...p, specialties: e.target.value }))}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                      <textarea
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px]"
                        placeholder="Descrivi l'esperienza e lo stile..."
                        value={formData.bio}
                        onChange={(e) => setFormData(p => ({ ...p, bio: e.target.value }))}
                      />
                    </div>

                    <div className="pt-4 flex items-center justify-end space-x-3 border-t">
                      <Button variant="secondary" onClick={handleBackToList}>Annulla</Button>
                      <Button onClick={handleSave} loading={isSaving || isProfileLoading}>
                        <Save className="w-4 h-4 mr-2" />
                        {viewMode === 'create' ? `Crea ${professional()}` : 'Salva Modifiche'}
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>

      <DeleteConfirmation
        isOpen={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        onConfirm={confirmDelete}
        title={`Elimina ${professional()}`}
        message={`Sei sicuro di voler eliminare ${staffToDelete?.full_name}? Questa azione non può essere annullata.`}
        itemName={staffToDelete?.full_name || ''}
        isLoading={isDeleting}
      />
    </div>
  );
};
