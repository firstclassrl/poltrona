import { useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import type { Service } from '../types';

interface ServiceFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (serviceData: Partial<Service>) => void;
  service?: Service | null;
  mode: 'add' | 'edit';
}

export const ServiceForm = ({ isOpen, onClose, onSave, service, mode }: ServiceFormProps) => {
  const [formData, setFormData] = useState<Partial<Service>>({
    name: '',
    duration_min: 30,
    price_cents: 0,
    active: true,
    image_url: undefined,
    is_duration_variable: false,
  });

  const [priceText, setPriceText] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (service && mode === 'edit') {
      setFormData({
        id: service.id,
        name: service.name,
        duration_min: service.duration_min,
        price_cents: service.price_cents ?? 0,
        active: service.active !== false,
        image_url: service.image_url,
        is_duration_variable: !!service.is_duration_variable,
      });
      const priceEuro = ((service.price_cents ?? 0) / 100).toFixed(2).replace('.', '.');
      setPriceText(priceEuro);
    } else {
      setFormData({ name: '', duration_min: 30, price_cents: 0, active: true, is_duration_variable: false });
      setPriceText('');
    }
    setErrors({});
  }, [isOpen, service, mode]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.name || !formData.name.trim()) e.name = 'Nome servizio obbligatorio';
    if (!formData.duration_min || formData.duration_min < 5) e.duration_min = 'Durata minima 5 minuti';
    if ((formData.price_cents ?? 0) < 0) e.price_cents = 'Prezzo non valido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      await onSave({
        id: formData.id,
        name: formData.name?.trim(),
        duration_min: formData.duration_min,
        price_cents: formData.price_cents,
        active: formData.active,
        image_url: formData.image_url,
        is_duration_variable: formData.is_duration_variable,
      });
      handleClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ name: '', duration_min: 30, price_cents: 0, active: true, is_duration_variable: false });
    setPriceText('');
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  const title = mode === 'add' ? 'Nuovo Servizio' : 'Modifica Servizio';
  const submitText = mode === 'add' ? 'Crea Servizio' : 'Salva Modifiche';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          label="Nome Servizio"
          value={formData.name || ''}
          onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
          error={errors.name}
          required
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Durata (minuti)"
            type="number"
            value={String(formData.duration_min ?? 30)}
            onChange={e => setFormData(prev => ({ ...prev, duration_min: parseInt(e.target.value || '0', 10) }))}
            min="5"
            max="480"
            error={errors.duration_min}
            required
          />
          <Input
            label="Prezzo (€)"
            type="text"
            inputMode="decimal"
            value={priceText}
            onChange={(e) => {
              const raw = e.target.value.replace(',', '.');
              if (/^\d*(?:\.|\d)?\d*$/.test(raw)) {
                setPriceText(e.target.value);
                const parsed = parseFloat(raw);
                const cents = Number.isNaN(parsed) ? 0 : Math.round(parsed * 100);
                setFormData(prev => ({ ...prev, price_cents: cents }));
              }
            }}
            onBlur={() => {
              const raw = priceText.replace(',', '.');
              const parsed = parseFloat(raw);
              const normalized = Number.isNaN(parsed) ? 0 : parsed;
              const formatted = normalized.toFixed(2).replace('.', '.');
              setPriceText(formatted);
              setFormData(prev => ({ ...prev, price_cents: Math.round(normalized * 100) }));
            }}
            error={errors.price_cents}
            required
          />
        </div>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="active"
              checked={formData.active !== false}
              onChange={e => setFormData(prev => ({ ...prev, active: e.target.checked }))}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="active" className="text-sm font-medium text-gray-700">Servizio attivo</label>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is_duration_variable"
              checked={!!formData.is_duration_variable}
              onChange={e => setFormData(prev => ({ ...prev, is_duration_variable: e.target.checked }))}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_duration_variable" className="text-sm font-medium text-gray-700">
              Durata variabile (basata su profilo capelli)
            </label>
          </div>
        </div>
        <div className="flex space-x-3 pt-4">
          <Button type="button" variant="secondary" onClick={handleClose} className="flex-1" disabled={isLoading}>
            <X className="w-4 h-4 mr-2" />
            Annulla
          </Button>
          <Button type="submit" variant="primary" className="flex-1" loading={isLoading} disabled={isLoading}>
            <Save className="w-4 h-4 mr-2" />
            {submitText}
          </Button>
        </div>
      </form>
    </Modal>
  );
};


