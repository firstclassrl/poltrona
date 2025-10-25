import { useState, useEffect } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import type { Service } from '../types';

interface ProductFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: Partial<Service>) => void;
  product?: Service | null;
  mode: 'add' | 'edit';
}

// Repurpose this component as ProductBasicForm for products (name, price, brand, active)
export const ProductForm = ({
  isOpen,
  onClose,
  onSave,
  product,
  mode,
}: ProductFormProps) => {
  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    brand: '',
    active: true,
  });
  const [priceText, setPriceText] = useState<string>('');
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (product && mode === 'edit') {
        setFormData({
          name: product.name || '',
          price: (product as any).price || 0,
          brand: (product as any).brand || '',
          active: (product as any).active !== false,
        });
        setPriceText(((product as any).price || 0).toFixed(2));
      } else {
        setFormData({
          name: '',
          price: 0,
          brand: '',
          active: true,
        });
        setPriceText('');
      }
      setErrors({});
    }
  }, [isOpen, product, mode]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nome servizio è obbligatorio';
    }

    if (formData.price < 0) {
      newErrors.price = 'Prezzo non può essere negativo';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const productData = {
        name: formData.name.trim(),
        price: Number(priceText || formData.price || 0),
        brand: formData.brand.trim(),
        active: formData.active,
      } as any;

      await onSave(productData);
      handleClose();
    } catch (error) {
      console.error('Error saving product:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      price: 0,
      brand: '',
      active: true,
    });
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
        {/* Nome Servizio */}
        <Input
          label="Nome Servizio"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="es. Taglio Capelli, Barba, etc."
          error={errors.name}
          required
        />

        {/* Durata e Prezzo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Durata (minuti)"
            type="number"
            value={30}
            onChange={(e) => {/* Duration not used in products */}}
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
              // Consenti solo numeri e un punto
              if (/^\d*(?:\.|\d)?\d*$/.test(raw)) {
                setPriceText(e.target.value);
                const parsed = parseFloat(raw);
                setFormData(prev => ({ ...prev, price_cents: Number.isNaN(parsed) ? 0 : Math.round(parsed * 100) }));
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

        {/* Stato Attivo */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="active"
            checked={formData.active}
            onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="active" className="text-sm font-medium text-gray-700">
            Servizio attivo
          </label>
        </div>

        {/* Anteprima */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Anteprima:</h4>
          <p className="text-sm text-gray-600">
            <strong>{formData.name || 'Nome prodotto'}</strong> - €{priceText || '0.00'}
          </p>
        </div>

        {/* Bottoni */}
        <div className="flex space-x-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            className="flex-1"
            disabled={isLoading}
          >
            <X className="w-4 h-4 mr-2" />
            Annulla
          </Button>
          
          <Button
            type="submit"
            variant="primary"
            className="flex-1"
            loading={isLoading}
            disabled={isLoading}
          >
            <Save className="w-4 h-4 mr-2" />
            {submitText}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
