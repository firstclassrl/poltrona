import { useState, useEffect } from 'react';
import { User, Phone, MapPin, Save, UserPlus, X, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import type { Client } from '../types';

interface CustomerFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customerData: Partial<Client> & { password?: string }) => void;
  customer?: Client | null; // null for new customer, Client object for editing
  mode: 'add' | 'edit';
}

export const CustomerForm = ({
  isOpen,
  onClose,
  onSave,
  customer,
  mode,
}: CustomerFormProps) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone_e164: '',
    email: '',
    password: '',
    confirmPassword: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Initialize form data when customer prop changes or modal opens
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && customer) {
        setFormData({
          first_name: customer.first_name || '',
          last_name: customer.last_name || '',
          phone_e164: customer.phone_e164 || '',
          email: customer.email || '',
          password: '',
          confirmPassword: '',
          notes: customer.notes || '',
        });
      } else {
        // Reset form for new customer
        setFormData({
          first_name: '',
          last_name: '',
          phone_e164: '',
          email: '',
          password: '',
          confirmPassword: '',
          notes: '',
        });
      }
      setErrors({});
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [isOpen, customer, mode]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Required field validation
    if (!formData.first_name.trim()) {
      newErrors.first_name = 'Nome è obbligatorio';
    }

    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Cognome è obbligatorio';
    }

    if (!formData.phone_e164.trim()) {
      newErrors.phone_e164 = 'Telefono è obbligatorio';
    } else if (!/^\+?[\d\s\-\(\)]+$/.test(formData.phone_e164)) {
      newErrors.phone_e164 = 'Formato telefono non valido';
    }

    // Email validation (required)
    if (!formData.email.trim()) {
      newErrors.email = 'Email è obbligatoria';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Formato email non valido';
    }

    // Password validation (only for new customers)
    if (mode === 'add') {
      if (!formData.password.trim()) {
        newErrors.password = 'Password è obbligatoria';
      } else if (formData.password.length < 6) {
        newErrors.password = 'La password deve contenere almeno 6 caratteri';
      }

      if (!formData.confirmPassword.trim()) {
        newErrors.confirmPassword = 'Conferma password è obbligatoria';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Le password non coincidono';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const customerData: Partial<Client> & { password?: string } = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone_e164: formData.phone_e164,
        email: formData.email,
        notes: formData.notes,
        // Add ID for edit mode
        ...(mode === 'edit' && customer ? { id: customer.id } : {}),
        // Only include password for new customers
        ...(mode === 'add' && formData.password ? { password: formData.password } : {}),
      };
      
      await onSave(customerData);
      onClose();
    } catch (error) {
      console.error('Error saving customer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      first_name: '',
      last_name: '',
      phone_e164: '',
      email: '',
      password: '',
      confirmPassword: '',
      notes: '',
    });
    setErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
    onClose();
  };

  if (!isOpen) return null;

  const title = mode === 'add' ? 'Nuovo Cliente' : 'Modifica Cliente';
  const submitText = mode === 'add' ? 'Crea Cliente' : 'Salva Modifiche';
  const SubmitIcon = mode === 'add' ? UserPlus : Save;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 
          Horizontal Layout Grid - Responsive Design:
          - Desktop: 2 columns for optimal space usage
          - Tablet: 2 columns maintained for readability
          - Mobile: 1 column for touch-friendly interaction
        */}
        
        {/* Personal Information Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <User className="w-5 h-5 mr-2 text-blue-600" />
            Informazioni Personali
          </h3>
          
          {/* Name Fields - Horizontal Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nome *"
              value={formData.first_name}
              onChange={(e) => handleInputChange('first_name', e.target.value)}
              placeholder="Inserisci nome"
              error={errors.first_name}
              required
            />
            
            <Input
              label="Cognome *"
              value={formData.last_name}
              onChange={(e) => handleInputChange('last_name', e.target.value)}
              placeholder="Inserisci cognome"
              error={errors.last_name}
              required
            />
          </div>
        </div>

        {/* Contact Information Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Phone className="w-5 h-5 mr-2 text-green-600" />
            Contatti
          </h3>
          
          {/* Contact Fields - Horizontal Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Telefono *"
              value={formData.phone_e164}
              onChange={(e) => handleInputChange('phone_e164', e.target.value)}
              placeholder="+39 123 456 7890"
              error={errors.phone_e164}
              required
            />
            
            <Input
              label="Email *"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="Mail cliente"
              error={errors.email}
              required
            />
          </div>
        </div>

        {/* Password Section - Only for new customers */}
        {mode === 'add' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <UserPlus className="w-5 h-5 mr-2 text-orange-600" />
              Credenziali di Accesso
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Input
                  label="Password *"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="Password cliente"
                  error={errors.password}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              
              <div className="relative">
                <Input
                  label="Conferma Password *"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  placeholder="Conferma password"
                  error={errors.confirmPassword}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Additional Information Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-purple-600" />
            Note Aggiuntive
          </h3>
          
          {/* Notes Field - Full Width */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Preferenze, allergie, note speciali..."
              rows={3}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
            />
          </div>
        </div>

        {/* 
          Action Buttons - Horizontal Layout:
          - Justified distribution across available space
          - Equal width buttons for visual balance
          - Responsive stacking on mobile
        */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            className="flex-1 order-2 sm:order-1"
            disabled={isLoading}
          >
            <X className="w-4 h-4 mr-2" />
            Annulla
          </Button>
          
          <Button
            type="submit"
            variant="primary"
            className="flex-1 order-1 sm:order-2"
            loading={isLoading}
            disabled={isLoading}
          >
            <SubmitIcon className="w-4 h-4 mr-2" />
            {submitText}
          </Button>
        </div>
      </form>
    </Modal>
  );
};