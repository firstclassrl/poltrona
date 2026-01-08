import React, { useState, useEffect } from 'react';
import { ShoppingBag, Plus, Minus, Package, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { apiService } from '../services/api';
import type { Product } from '../types';

interface ProductUpsellProps {
  isOpen: boolean;
  onClose: () => void;
  onCancel: () => void;
  onConfirm: (selectedProducts: { productId: string; quantity: number; productName: string; productPrice: number }[]) => void;
  isSubmitting?: boolean;
}

export const ProductUpsell: React.FC<ProductUpsellProps> = ({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  isSubmitting = false,
}) => {
  const [selectedProducts, setSelectedProducts] = useState<{ [key: string]: number }>({});
  const [randomProducts, setRandomProducts] = useState<Product[]>([]);
  const [showAllProducts, setShowAllProducts] = useState(false);

  // Seleziona 3 prodotti casuali dal catalogo
  useEffect(() => {
    const load = async () => {
      const products = await apiService.getProducts();
      const shuffled = [...products].sort(() => 0.5 - Math.random());
      setRandomProducts(shuffled.slice(0, 3));
    };
    if (isOpen) void load();
  }, [isOpen]);

  const handleQuantityChange = (productId: string, change: number) => {
    setSelectedProducts(prev => {
      const currentQuantity = prev[productId] || 0;
      const newQuantity = Math.max(0, currentQuantity + change);

      if (newQuantity === 0) {
        const { [productId]: removed, ...rest } = prev;
        return rest;
      }

      return { ...prev, [productId]: newQuantity };
    });
  };

  const handleConfirm = () => {
    const productsArray = Object.entries(selectedProducts).map(([productId, quantity]) => {
      const product = randomProducts.find(p => p.id === productId);
      return {
        productId,
        quantity,
        productName: product?.name || 'Prodotto',
        productPrice: product?.price_cents || 0,
      };
    });
    onConfirm(productsArray);
  };

  const getTotalPrice = () => {
    return Object.entries(selectedProducts).reduce((total, [productId, quantity]) => {
      const product = randomProducts.find(p => p.id === productId);
      return total + (product ? (product.price_cents || 0) * quantity : 0);
    }, 0);
  };

  const formatPrice = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[95vh] bg-white border border-gray-200 rounded-xl shadow-2xl flex flex-col aurora-modal">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Aggiungi Prodotti</h2>
              <p className="text-sm text-gray-600">Prenota prodotti da ritirare durante l'appuntamento</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 flex-1 overflow-y-auto">
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-medium text-gray-900">
                {showAllProducts ? 'Tutti i Prodotti Disponibili' : 'Prodotti Consigliati per Te'}
              </h3>
              <span className="text-sm font-bold text-green-800">
                Prenota ORA per assicurarti lo SCONTO!
              </span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-600">
                {showAllProducts
                  ? 'Scegli tra tutti i prodotti disponibili nel nostro catalogo'
                  : 'Questi prodotti completano perfettamente il tuo servizio'
                }
              </p>
              {!showAllProducts && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllProducts(true)}
                  className="text-xs text-green-600 hover:text-green-700 hover:bg-green-50 px-2 py-1"
                >
                  Vedi tutti i prodotti
                </Button>
              )}
            </div>
          </div>

          {/* Show All Products Button */}
          {showAllProducts && (
            <div className="mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllProducts(false)}
                className="text-xs text-gray-600 hover:text-gray-700 hover:bg-gray-50 px-2 py-1 aurora-modal-bg-white"
              >
                ← Torna ai prodotti consigliati
              </Button>
            </div>
          )}

          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
            {(showAllProducts ? randomProducts : randomProducts).map((product) => {
              const quantity = selectedProducts[product.id] || 0;
              const isSelected = quantity > 0;

              return (
                <Card
                  key={product.id}
                  className={`p-2 transition-all duration-200 aurora-modal-bg-white ${isSelected ? 'ring-2 ring-green-500 bg-green-50' : 'hover:shadow-md'
                    }`}
                >
                  <div className="text-center">
                    {/* Product Image */}
                    <div className="w-12 h-12 mx-auto mb-1 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden aurora-modal-bg-white">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="w-4 h-4 text-gray-400" />
                      )}
                    </div>

                    {/* Product Info */}
                    <h4 className="font-medium text-gray-900 mb-1 text-xs">{product.name}</h4>
                    <p className="text-xs text-gray-600 mb-1 line-clamp-1">
                      {product.description}
                    </p>
                    <p className="text-xs font-semibold text-green-600 mb-1">
                      {formatPrice(product.price_cents || 0)}
                    </p>

                    {/* Quantity Controls */}
                    <div className="flex items-center justify-center space-x-1">
                      <button
                        onClick={() => handleQuantityChange(product.id, -1)}
                        disabled={quantity === 0}
                        className="w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors aurora-modal-bg-white"
                      >
                        <Minus className="w-2.5 h-2.5" />
                      </button>

                      <span className="w-5 text-center font-medium text-xs">
                        {quantity}
                      </span>

                      <button
                        onClick={() => handleQuantityChange(product.id, 1)}
                        className="w-5 h-5 rounded-full bg-green-100 hover:bg-green-200 flex items-center justify-center transition-colors"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Selected Products Summary */}
          {Object.keys(selectedProducts).length > 0 && (
            <div className="bg-gray-50 rounded-lg p-2 mb-2 aurora-modal-bg-white">
              <h4 className="font-medium text-gray-900 mb-1 text-xs">Prodotti Selezionati</h4>
              <div className="space-y-0.5">
                {Object.entries(selectedProducts).map(([productId, quantity]) => {
                  const product = randomProducts.find(p => p.id === productId);
                  if (!product) return null;

                  return (
                    <div key={productId} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700">
                        {product.name} × {quantity}
                      </span>
                      <span className="font-medium text-gray-900">
                        {formatPrice((product.price_cents || 0) * quantity)}
                      </span>
                    </div>
                  );
                })}
                <div className="border-t border-gray-200 pt-0.5 mt-0.5">
                  <div className="flex items-center justify-between font-semibold text-xs">
                    <span className="text-gray-900">Totale Prodotti</span>
                    <span className="text-green-600">{formatPrice(getTotalPrice())}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-2 aurora-modal-bg-white">
            <div className="flex items-start space-x-1">
              <div className="w-3 h-3 bg-blue-100 rounded-full flex items-center justify-center mt-0.5 aurora-modal-bg-white">
                <Package className="w-2 h-2 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium text-blue-900 mb-0.5 text-xs">Ritiro al Momento</h4>
                <p className="text-xs text-blue-700">
                  Prodotti preparati per il ritiro durante l'appuntamento. Pagamento in negozio.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t border-gray-200 bg-gray-50 aurora-modal-bg-white">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Annulla
          </button>

          <div className="flex items-center space-x-3">
            {Object.keys(selectedProducts).length > 0 && (
              <span className="text-sm text-gray-600">
                Totale: <span className="font-semibold text-green-600">{formatPrice(getTotalPrice())}</span>
              </span>
            )}
            <Button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? 'Confermando...' : 'Conferma Prenotazione'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
