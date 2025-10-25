import React, { useState, useEffect } from 'react';
import { ShoppingBag, Package, Euro } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { apiService } from '../services/api';
import type { Product } from '../types';

interface ClientProductsProps {
  onNavigateToBooking?: () => void;
}

export const ClientProducts: React.FC<ClientProductsProps> = ({ onNavigateToBooking }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load products from API
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setIsLoading(true);
        const productsData = await apiService.getProducts();
        setProducts(productsData);
      } catch (error) {
        console.error('Error loading products:', error);
        // Fallback to empty array if API fails
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();
  }, []);

  // Categorie dei prodotti (basate sui nomi)
  const categories = [
    { id: 'all', name: 'Tutti i Prodotti' },
    { id: 'shampoo', name: 'Shampoo & Balsami' },
    { id: 'styling', name: 'Styling' },
    { id: 'barba', name: 'Cura Barba' },
    { id: 'trattamenti', name: 'Trattamenti' },
  ];

  // Filtra prodotti per categoria
  const filteredProducts = products.filter(product => {
    if (selectedCategory === 'all') return true;
    
    const name = product.name.toLowerCase();
    switch (selectedCategory) {
      case 'shampoo':
        return name.includes('shampoo') || name.includes('balsamo');
      case 'styling':
        return name.includes('cera') || name.includes('gel') || name.includes('styling');
      case 'barba':
        return name.includes('barba') || name.includes('olio');
      case 'trattamenti':
        return name.includes('maschera') || name.includes('trattamento');
      default:
        return true;
    }
  });

  const formatPrice = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'shampoo': return '🧴';
      case 'styling': return '💇';
      case 'barba': return '🧔';
      case 'trattamenti': return '✨';
      default: return '🛍️';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Catalogo Prodotti</h1>
        <p className="text-gray-900 font-bold mt-2">Se prenoti un prodotto da ritirare durante la tua seduta, ricevi uno SCONTO EXTRA!</p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 justify-center">
        {categories.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? 'primary' : 'secondary'}
            onClick={() => setSelectedCategory(category.id)}
            className="flex items-center space-x-2"
          >
            <span className="text-lg">{getCategoryIcon(category.id)}</span>
            <span>{category.name}</span>
          </Button>
        ))}
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Caricamento prodotti...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
          <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <div className="relative">
              {/* Product Image */}
              <div className="w-full h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="w-16 h-16 text-gray-400" />
                )}
              </div>

              {/* Product Info */}
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {product.name}
                </h3>
                
                {product.description && (
                  <p className="text-gray-600 mb-4 line-clamp-3">
                    {product.description}
                  </p>
                )}

                {/* Price */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Euro className="w-5 h-5 text-green-600" />
                    <span className="text-2xl font-bold text-green-600">
                      {formatPrice(product.price_cents || 0)}
                    </span>
                  </div>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <ShoppingBag className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-800 font-medium">
                      Disponibile per prenotazione
                    </span>
                  </div>
                  <p className="text-xs text-blue-700 mt-1">
                    Questo prodotto può essere prenotato durante il tuo appuntamento
                  </p>
                </div>
              </div>
            </div>
          </Card>
          ))}
        </div>
      )}
      
      {/* Empty State */}
      {!isLoading && filteredProducts.length === 0 && (
        <div className="text-center py-8">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Nessun prodotto disponibile in questa categoria</p>
        </div>
      )}

      {/* Info Section */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <ShoppingBag className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Come Prenotare i Prodotti
            </h3>
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Durante la prenotazione del tuo appuntamento, ti verranno mostrati prodotti consigliati</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Puoi selezionare i prodotti che desideri acquistare</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>I prodotti saranno preparati e pronti per il ritiro durante l'appuntamento</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Il pagamento avverrà direttamente in negozio</span>
              </div>
            </div>
            
            {/* Pulsante Prenota Ora */}
            {onNavigateToBooking && (
              <div className="mt-4">
                <Button
                  onClick={onNavigateToBooking}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Prenota Ora
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
