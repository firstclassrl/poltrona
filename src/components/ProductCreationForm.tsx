import { useState, useEffect } from 'react';
import { Package, Save, X, Plus } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { Select } from './ui/Select';
import { PhotoUpload } from './PhotoUpload';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: string;
  brand: string;
  imageUrl: string;
  inStock: boolean;
  stockQuantity: number;
  // rating and reviews removed
  isOnSale?: boolean;
  features: string[];
}

interface ProductCreationFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: Partial<Product>) => void;
  product?: Product | null;
  mode: 'add' | 'edit';
}

export const ProductCreationForm = ({
  isOpen,
  onClose,
  onSave,
  product,
  mode,
}: ProductCreationFormProps) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    originalPrice: 0,
    category: 'styling',
    brand: '',
    imageUrl: '',
    inStock: true,
    stockQuantity: 0,
    // rating and reviews removed
    isOnSale: false,
    features: [] as string[],
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [newFeature, setNewFeature] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const categories = [
    { value: 'styling', label: 'Styling' },
    { value: 'cura-barba', label: 'Cura Barba' },
    { value: 'rasatura', label: 'Rasatura' },
    { value: 'shampoo', label: 'Shampoo' },
    { value: 'accessori', label: 'Accessori' },
  ];


  useEffect(() => {
    if (isOpen) {
      if (product && mode === 'edit') {
        setFormData({
          name: product.name || '',
          description: product.description || '',
          price: product.price || 0,
          originalPrice: product.originalPrice || 0,
          category: product.category || 'styling',
          brand: product.brand || '',
          imageUrl: product.imageUrl || '',
          inStock: product.inStock !== false,
          stockQuantity: product.stockQuantity || 0,
          // rating and reviews removed
          isOnSale: product.isOnSale || false,
          features: product.features || [],
        });
      } else {
        setFormData({
          name: '',
          description: '',
          price: 0,
          originalPrice: 0,
          category: 'styling',
          brand: '',
          imageUrl: '',
          inStock: true,
          stockQuantity: 0,
          // rating and reviews removed
          isOnSale: false,
          features: [],
        });
      }
      setErrors({});
    }
  }, [isOpen, product, mode]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nome prodotto è obbligatorio';
    }

    // description is optional

    if (formData.price <= 0) {
      newErrors.price = 'Prezzo deve essere maggiore di 0';
    }

    // brand is optional

    if (formData.stockQuantity < 0) {
      newErrors.stockQuantity = 'Quantità non può essere negativa';
    }

    if (formData.originalPrice > 0 && formData.originalPrice <= formData.price) {
      newErrors.originalPrice = 'Prezzo originale deve essere maggiore del prezzo attuale';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: formData.price,
        brand: formData.brand.trim(),
        imageUrl: imageUrl || formData.imageUrl,
        inStock: formData.inStock,
        stockQuantity: formData.stockQuantity,
        isOnSale: formData.isOnSale,
        features: formData.features,
      };
      await onSave(productData);
      handleClose();
    } catch (error) {
      console.error('Error saving product:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerSubmit = () => {
    try {
      const fakeEvent = { preventDefault: () => {} } as unknown as React.FormEvent;
      void handleSubmit(fakeEvent);
    } catch (e) {
      console.error('Error submitting form:', e);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      price: 0,
      originalPrice: 0,
      category: 'styling',
      brand: '',
      imageUrl: '',
      inStock: true,
      stockQuantity: 0,
      // rating and reviews removed
      isOnSale: false,
      features: [],
    });
    setErrors({});
    setNewFeature('');
    onClose();
  };

  const addFeature = () => {
    if (newFeature.trim() && !formData.features.includes(newFeature.trim())) {
      setFormData(prev => ({
        ...prev,
        features: [...prev.features, newFeature.trim()]
      }));
      setNewFeature('');
    }
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    // Mock upload - in produzione useresti Supabase Storage
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setImageUrl(result);
        resolve(result);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = () => {
    setImageUrl('');
  };

  const removeFeature = (index: number) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  };

  if (!isOpen) return null;

  const title = mode === 'add' ? 'Nuovo Prodotto' : 'Modifica Prodotto';
  const submitText = mode === 'add' ? 'Crea Prodotto' : 'Salva Modifiche';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} size="medium">
      <form onSubmit={handleSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto">
        {/* Informazioni Base */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Nome Prodotto"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="es. Pomata Fissante Forte"
            error={errors.name}
            required
          />
          
          <Input
            label="Marca"
            value={formData.brand}
            onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
            placeholder="es. Reuzel"
            error={errors.brand}
          />
        </div>

        {/* Descrizione */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descrizione
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Descrizione dettagliata del prodotto..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
          {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
        </div>

        {/* Prezzi e Categoria */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            label="Prezzo (€)"
            type="number"
            step="0.01"
            value={formData.price}
            onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
            min="0"
            error={errors.price}
            required
          />
          
          <Input
            label="Prezzo Originale (€)"
            type="number"
            step="0.01"
            value={formData.originalPrice}
            onChange={(e) => setFormData(prev => ({ ...prev, originalPrice: parseFloat(e.target.value) || 0 }))}
            min="0"
            error={errors.originalPrice}
            placeholder="Solo se in sconto"
          />
          
          <Select
            label="Categoria"
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
            options={categories}
          />
        </div>

        {/* Stock */}
        <Input
          label="Quantità in Stock"
          type="number"
          value={formData.stockQuantity}
          onChange={(e) => setFormData(prev => ({ ...prev, stockQuantity: parseInt(e.target.value) || 0 }))}
          min="0"
          error={errors.stockQuantity}
          required
        />

        {/* Immagine Prodotto */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Immagine Prodotto
          </label>
          <PhotoUpload
            onUpload={handleImageUpload}
            currentImageUrl={imageUrl || formData.imageUrl}
            onRemove={handleRemoveImage}
            maxSize={5}
          />
        </div>

        {/* Caratteristiche */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Caratteristiche
          </label>
          <div className="flex space-x-2 mb-2">
            <Input
              value={newFeature}
              onChange={(e) => setNewFeature(e.target.value)}
              placeholder="Aggiungi caratteristica..."
              className="flex-1"
            />
            <Button type="button" onClick={addFeature} variant="secondary">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.features.map((feature, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
              >
                {feature}
                <button
                  type="button"
                  onClick={() => removeFeature(index)}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Opzioni */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="inStock"
              checked={formData.inStock}
              onChange={(e) => setFormData(prev => ({ ...prev, inStock: e.target.checked }))}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="inStock" className="text-sm font-medium text-gray-700">
              Prodotto disponibile
            </label>
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isOnSale"
              checked={formData.isOnSale}
              onChange={(e) => setFormData(prev => ({ ...prev, isOnSale: e.target.checked }))}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="isOnSale" className="text-sm font-medium text-gray-700">
              Prodotto in sconto
            </label>
          </div>
        </div>

        {/* Anteprima */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Anteprima:</h4>
          <div className="flex items-center space-x-3">
            <div className="w-16 h-16 rounded-lg overflow-hidden flex items-center justify-center bg-gray-200">
              {imageUrl || formData.imageUrl ? (
                <img
                  src={imageUrl || formData.imageUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Package className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900">{formData.name || 'Nome prodotto'}</p>
              <p className="text-sm text-gray-600">{formData.brand || 'Marca'}</p>
              <p className="text-sm font-medium text-gray-900">
                €{formData.price.toFixed(2)}
                {formData.isOnSale && formData.originalPrice > 0 && (
                  <span className="ml-2 text-red-500 line-through">
                    €{formData.originalPrice.toFixed(2)}
                  </span>
                )}
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
            disabled={isLoading}
          >
            <X className="w-4 h-4 mr-2" />
            Annulla
          </Button>
          
          <Button
            type="button"
            variant="primary"
            className="flex-1"
            loading={isLoading}
            disabled={isLoading}
            onClick={triggerSubmit}
          >
            <Save className="w-4 h-4 mr-2" />
            {submitText}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
