import { useState, useEffect } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { Select } from './ui/Select';
import { PhotoUpload } from './PhotoUpload';
import type { Staff } from '../types';

interface BarberFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Staff, 'id' | 'created_at'>) => void;
  staff?: Staff | null;
  mode: 'add' | 'edit';
}

export const BarberForm = ({ isOpen, onClose, onSave, staff, mode }: BarberFormProps) => {
  const [formData, setFormData] = useState({
    shop_id: '1',
    full_name: '',
    role: '',
    calendar_id: null as string | null,
    active: true,
    chair_id: '',
    profile_photo_url: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [profileImageUrl, setProfileImageUrl] = useState('');

  const roles = [
    { value: 'Barber', label: 'Barber' },
    { value: 'Stylist', label: 'Stylist' },
    { value: 'Master Barber', label: 'Master Barber' },
    { value: 'Junior Barber', label: 'Junior Barber' },
  ];

  useEffect(() => {
    if (isOpen) {
      if (staff && mode === 'edit') {
        setFormData({
          shop_id: staff.shop_id || '1',
          full_name: staff.full_name || '',
          role: staff.role || '',
          calendar_id: staff.calendar_id,
          active: staff.active ?? true,
          chair_id: staff.chair_id || '',
          profile_photo_url: staff.profile_photo_url || '',
        });
        setProfileImageUrl(staff.profile_photo_url || '');
      } else {
        resetForm();
      }
    }
  }, [isOpen, staff, mode]);

  const resetForm = () => {
    setFormData({
      shop_id: '1',
      full_name: '',
      role: '',
      calendar_id: null,
      active: true,
      chair_id: '',
      profile_photo_url: '',
    });
    setProfileImageUrl('');
    setErrors({});
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleImageUpload = async (file: File): Promise<string> => {
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

  const handleRemoveImage = () => {
    setProfileImageUrl('');
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.full_name.trim()) newErrors.full_name = 'Il nome è richiesto';
    if (!formData.role) newErrors.role = 'Il ruolo è richiesto';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;
    
    const dataToSave = {
      ...formData,
      profile_photo_url: profileImageUrl || formData.profile_photo_url,
    };
    
    onSave(dataToSave);
    handleClose();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  const title = mode === 'add' ? 'Aggiungi Nuovo Barbiere' : 'Modifica Barbiere';
  const submitText = mode === 'add' ? 'Aggiungi Barbiere' : 'Salva Modifiche';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} size="large">
      <div className="space-y-6 max-h-[80vh] overflow-y-auto">
        {/* Informazioni Base */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Nome Completo"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            error={errors.full_name}
            required
          />
          
          <Select
            label="Ruolo"
            name="role"
            value={formData.role}
            onChange={handleChange}
            options={[
              { value: '', label: 'Seleziona ruolo' },
              ...roles
            ]}
            error={errors.role}
            required
          />
        </div>

        {/* Foto Profilo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Foto Profilo
          </label>
          <PhotoUpload
            onUpload={handleImageUpload}
            currentImageUrl={profileImageUrl || formData.profile_photo_url}
            onRemove={handleRemoveImage}
            maxSize={3}
          />
        </div>

        {/* Stato Attivo */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="active"
            name="active"
            checked={formData.active}
            onChange={handleChange}
            className="form-checkbox h-5 w-5 text-blue-600 rounded"
          />
          <label htmlFor="active" className="text-gray-700">Barbiere Attivo</label>
        </div>

        {/* Anteprima */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Anteprima:</h4>
          <div className="flex items-center space-x-3">
            <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center bg-gray-200">
              {profileImageUrl || formData.profile_photo_url ? (
                <img
                  src={profileImageUrl || formData.profile_photo_url}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    {formData.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900">{formData.full_name || 'Nome barbiere'}</p>
              <p className="text-sm text-gray-600">{formData.role || 'Ruolo'}</p>
              <p className="text-sm text-gray-500">
                {formData.active ? 'Attivo' : 'Inattivo'}
              </p>
            </div>
          </div>
        </div>

        {/* Bottoni */}
        <div className="flex space-x-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            className="flex-1"
          >
            <X className="w-4 h-4 mr-2" />
            Annulla
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            className="flex-1"
          >
            <Save className="w-4 h-4 mr-2" />
            {submitText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
