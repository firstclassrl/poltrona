import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Search, Filter, Package, Euro, Eye, Edit, X, Warehouse, Save } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { Select } from './ui/Select';
import { ProductForm } from './ProductForm';
import { apiService } from '../services/api';
import type { Service, Profile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Toast } from './ui/Toast';
import { useToast } from '../hooks/useToast';

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

// Database Product type (from types/index.ts)
interface DatabaseProduct {
  id: string;
  shop_id: string | null;
  name: string;
  description?: string | null;
  brand?: string | null;
  price: number | null; // numeric(10,2)
  imageurl?: string | null;
  instock?: boolean | null;
  stockquantity?: number | null;
  active: boolean | null;
  created_at: string;
  updated_at?: string;
}

interface CartItem extends Product {
  quantity: number;
}

// const mockProducts: Product[] = [];

const categories = [
  { value: 'all', label: 'Tutti i prodotti' },
  { value: 'styling', label: 'Styling' },
  { value: 'cura-barba', label: 'Cura Barba' },
  { value: 'rasatura', label: 'Rasatura' },
];

// Convert database product to UI product
const convertDatabaseToUI = (dbProduct: DatabaseProduct): Product => ({
  id: dbProduct.id,
  name: dbProduct.name,
  description: dbProduct.description || '',
  price: Number(dbProduct.price || 0),
  originalPrice: undefined,
  category: 'styling',
  brand: dbProduct.brand || '',
  imageUrl: dbProduct.imageurl || 'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=400',
  inStock: dbProduct.instock ?? true,
  stockQuantity: dbProduct.stockquantity ?? 0,
  isOnSale: false,
  features: [],
});

// Convert UI product to database product
const convertUIToDatabase = (uiProduct: Partial<Product>): Partial<DatabaseProduct> => ({
  name: uiProduct.name,
  description: uiProduct.description,
  brand: uiProduct.brand,
  price: uiProduct.price,
  imageurl: uiProduct.imageUrl,
  instock: uiProduct.inStock,
  stockquantity: uiProduct.stockQuantity,
  active: true,
});

export const Products: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  // const [showProductForm, setShowProductForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [, setUserProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'services'>('products');
  const [showStockManagement, setShowStockManagement] = useState(false);
  const [tempStockChanges, setTempStockChanges] = useState<Record<string, number>>({});
  const [hasStockChanges, setHasStockChanges] = useState(false);
  const { toast, showToast, hideToast } = useToast();
  // Add Product modal state (DB schema fields)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addBrand, setAddBrand] = useState('');
  const [addPrice, setAddPrice] = useState<string>('');
  const [addDescription, setAddDescription] = useState('');
  const [addImageUrl, setAddImageUrl] = useState('');
  const [addInStock, setAddInStock] = useState(true);
  const [addStockQty, setAddStockQty] = useState<number>(0);
  const [addActive, setAddActive] = useState(true);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [qaName, setQaName] = useState('');
  const [qaPrice, setQaPrice] = useState<number | ''>('');
  const [qaBrand, setQaBrand] = useState('');
  const [qaDesc, setQaDesc] = useState('');

  useEffect(() => {
    setIsAdmin(user?.role === 'admin' || (user as any)?.role === 'manager');
    const loadCatalog = async () => {
      const [dbProds, servs] = await Promise.all([
        apiService.getProducts(),
        apiService.getServices(),
      ]);
      // Convert database products to UI products
      const uiProducts = (dbProds as any).map(convertDatabaseToUI as any);
      setProducts(uiProducts);
      setServices(servs);
    };
    loadCatalog();
    console.log('Products mounted. isAdmin:', user?.role);
  }, [user]);

  const loadUserProfile = async () => {
    try {
      const profile = await apiService.getUserProfile();
      setUserProfile(profile);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [sortBy, setSortBy] = useState('name');

  const handleSaveService = async (serviceData: Partial<Service>) => {
    try {
      if (editingService) {
        // Aggiorna servizio esistente
        const updatedService = { ...editingService, ...serviceData };
        const saved = await apiService.updateService(updatedService as any);
        setServices(prev => prev.map(s => s.id === editingService.id ? saved : s));
      } else {
        // Crea nuovo servizio
        const saved = await apiService.createService(serviceData as any);
        setServices(prev => [...prev, saved]);
      }
      setShowServiceForm(false);
      setEditingService(null);
    } catch (error) {
      console.error('Error saving service:', error);
    }
  };

  const handleEditService = (service: Service) => {
    setEditingService(service);
    setShowServiceForm(true);
  };

  const handleDeleteService = async (serviceId: string) => {
    try {
      await apiService.deleteService(serviceId);
      setServices(prev => prev.filter(s => s.id !== serviceId));
    } catch (error) {
      console.error('Error deleting service:', error);
    }
  };

  const handleSaveProduct = async (productData: Partial<Product>) => {
    try {
      showToast('Salvataggio in corso…', 'info');
      if (editingProduct) {
        // Aggiorna prodotto esistente
        const dbProductData = convertUIToDatabase(productData);
        const updatedDbProduct = await apiService.updateProduct(editingProduct.id, dbProductData);
        const updatedUIProduct = convertDatabaseToUI(updatedDbProduct as any);
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? updatedUIProduct : p));
        showToast('Prodotto aggiornato con successo', 'success');
      } else {
        // Crea nuovo prodotto
        const dbProductData = convertUIToDatabase(productData);
        const newDbProduct = await apiService.createProduct(dbProductData as any);
        const newUIProduct = convertDatabaseToUI(newDbProduct as any);
        setProducts(prev => [...prev, newUIProduct]);
        showToast('Prodotto creato con successo', 'success');
      }
      setEditingProduct(null);
    } catch (error) {
      console.error('Error saving product:', error);
      showToast(error instanceof Error ? error.message : 'Errore salvataggio prodotto', 'error');
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsAddModalOpen(true);
    setAddName(product.name);
    setAddBrand(product.brand);
    setAddPrice(String(product.price));
    setAddDescription(product.description);
    setAddImageUrl(product.imageUrl);
    setAddInStock(product.inStock);
    setAddStockQty(product.stockQuantity);
    setAddActive(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await apiService.deleteProduct(productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  // Funzioni per gestione stock temporanea (solo admin)
  const updateTempStock = (productId: string, newQuantity: number) => {
    const currentQuantity = products.find(p => p.id === productId)?.stockQuantity || 0;
    const finalQuantity = Math.max(0, newQuantity);
    
    setTempStockChanges(prev => {
      const newChanges = { ...prev };
      if (finalQuantity === currentQuantity) {
        delete newChanges[productId];
      } else {
        newChanges[productId] = finalQuantity;
      }
      setHasStockChanges(Object.keys(newChanges).length > 0);
      return newChanges;
    });
  };

  const incrementTempStock = (productId: string) => {
    const currentQuantity = tempStockChanges[productId] || products.find(p => p.id === productId)?.stockQuantity || 0;
    updateTempStock(productId, currentQuantity + 1);
  };

  const decrementTempStock = (productId: string) => {
    const currentQuantity = tempStockChanges[productId] || products.find(p => p.id === productId)?.stockQuantity || 0;
    updateTempStock(productId, Math.max(0, currentQuantity - 1));
  };

  const getDisplayStock = (productId: string) => {
    return tempStockChanges[productId] ?? (products.find(p => p.id === productId)?.stockQuantity || 0);
  };

  const saveStockChanges = () => {
    setProducts(prev => prev.map(product => {
      const newQuantity = tempStockChanges[product.id];
      if (newQuantity !== undefined) {
        return { ...product, stockQuantity: newQuantity, inStock: newQuantity > 0 };
      }
      return product;
    }));
    setTempStockChanges({});
    setHasStockChanges(false);
  };

  const cancelStockChanges = () => {
    setTempStockChanges({});
    setHasStockChanges(false);
  };

  // Funzioni per gestione stock immediata (per le card prodotti)
  const updateStock = (productId: string, newQuantity: number) => {
    setProducts(prev => prev.map(p => 
      p.id === productId 
        ? { 
            ...p, 
            stockQuantity: Math.max(0, newQuantity),
            inStock: newQuantity > 0
          }
        : p
    ));
  };

  const incrementStock = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      updateStock(productId, product.stockQuantity + 1);
    }
  };

  const decrementStock = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      updateStock(productId, product.stockQuantity - 1);
    }
  };

  const filteredProducts = products
    .filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           product.brand.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        default:
          return a.name.localeCompare(b.name);
      }
    });

  const addToCart = (product: Product, quantity: number = 1) => {
    setCart(prev => {
      const existingItem = prev.find(item => item.id === product.id);
      if (existingItem) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + quantity, product.stockQuantity) }
            : item
        );
      }
      return [...prev, { ...product, quantity }];
    });
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== productId));
    } else {
      setCart(prev =>
        prev.map(item =>
          item.id === productId ? { ...item, quantity } : item
        )
      );
    }
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const openProductModal = (product: Product) => {
    setSelectedProduct(product);
    setIsProductModalOpen(true);
  };

  // rating UI removed

  return (
    <div className="space-y-6">
      <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={hideToast} />
      {/* debug button removed */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Prodotti & Servizi</h1>
        <div className="flex space-x-3">
          {isAdmin && (
            <>
              {activeTab === 'products' && (
                <>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Aggiungi Prodotto
                  </button>
                  {/* header debug button removed */}
                  <Button
                    variant="secondary"
                    className="bg-green-100 text-green-800 hover:bg-green-200 border border-green-300"
                    onClick={() => setShowStockManagement(true)}
                  >
                    <Warehouse className="w-4 h-4 mr-2" />
                    Gestione Stock
                  </Button>
                </>
              )}
              {activeTab === 'services' && (
                <Button
                  onClick={() => setShowServiceForm(true)}
                  variant="secondary"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Aggiungi Servizio
                </Button>
              )}
            </>
          )}
          <Button
            onClick={() => setIsCartOpen(true)}
            className="relative"
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            Carrello
            {getTotalItems() > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                {getTotalItems()}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg shadow-sm shadow-green-500/20">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'products'
              ? 'bg-green-100 text-green-900 shadow-sm border-2 border-green-300'
              : 'text-gray-600 hover:text-gray-900 bg-green-50 hover:bg-green-100'
          }`}
        >
          Prodotti ({products.length})
        </button>
        <button
          onClick={() => setActiveTab('services')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'services'
              ? 'bg-green-100 text-green-900 shadow-sm border-2 border-green-300'
              : 'text-gray-600 hover:text-gray-900 bg-green-50 hover:bg-green-100'
          }`}
        >
          Servizi ({services.length})
        </button>
      </div>

      {/* Filters and Search */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
            <Input
              type="text"
              placeholder="Cerca prodotti..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            options={categories}
          />
          
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            options={[
              { value: 'name', label: 'Nome A-Z' },
              { value: 'price-low', label: 'Prezzo: Basso → Alto' },
              { value: 'price-high', label: 'Prezzo: Alto → Basso' },
            ]}
          />
          
          <Button variant="secondary" className="flex items-center">
            <Filter className="w-4 h-4 mr-2" />
            Filtri Avanzati
          </Button>
        </div>
      </Card>

      {/* Content based on active tab */}
      {activeTab === 'services' ? (
        /* Services Section */
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">Servizi</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <Card key={service.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{service.name}</h3>
                  {isAdmin && (
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleEditService(service)}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleDeleteService(service.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Durata: {service.duration_min} min</p>
                  <p>Prezzo: €{(service.price_cents || 0) / 100}</p>
                  <Badge className={service.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                    {service.active ? 'Attivo' : 'Inattivo'}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        /* Products Grid */
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product) => (
          <Card key={product.id} className="group hover:scale-105 transition-transform">
            <div className="relative">
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
              {product.isOnSale && (
                <Badge className="absolute top-2 left-2 bg-red-500 text-white">
                  OFFERTA
                </Badge>
              )}
              {!product.inStock && (
                <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                  <span className="text-white font-semibold">Esaurito</span>
                </div>
              )}
              <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openProductModal(product)}
                >
                  <Eye className="w-4 h-4" />
                </Button>
                {isAdmin && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditProduct(product)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteProduct(product.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
                <p className="text-sm text-gray-600">{product.brand}</p>
              </div>

              <p className="text-gray-700 text-sm line-clamp-2">{product.description}</p>

              {/* rating section removed */}

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xl font-bold text-gray-900">€{product.price}</span>
                  {product.originalPrice && (
                    <span className="text-sm text-gray-500 line-through">€{product.originalPrice}</span>
                  )}
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Package className="w-4 h-4" />
                  {isAdmin ? (
                    <div className="flex items-center space-x-1 bg-gray-100 rounded-lg px-2 py-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => decrementStock(product.id)}
                        className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="font-semibold min-w-[2rem] text-center">
                        {product.stockQuantity}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => incrementStock(product.id)}
                        className="h-6 w-6 p-0 hover:bg-green-100 hover:text-green-600"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <span>{product.stockQuantity} pz</span>
                  )}
                </div>
              </div>

              <Button
                className="w-full"
                disabled={!product.inStock}
                onClick={() => addToCart(product)}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                {product.inStock ? 'Aggiungi al Carrello' : 'Esaurito'}
              </Button>
            </div>
          </Card>
        ))}
      </div>
      )}

      {/* Product Detail Modal */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title="Dettagli Prodotto"
      >
        {selectedProduct && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <img
                  src={selectedProduct.imageUrl}
                  alt={selectedProduct.name}
                  className="w-full h-64 object-cover rounded-lg"
                />
              </div>
              
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedProduct.name}</h2>
                  <p className="text-gray-600">{selectedProduct.brand}</p>
                </div>

                {/* rating section removed */}

                <div className="flex items-center space-x-3">
                  <span className="text-3xl font-bold text-gray-900">€{selectedProduct.price}</span>
                  {selectedProduct.originalPrice && (
                    <span className="text-lg text-gray-500 line-through">€{selectedProduct.originalPrice}</span>
                  )}
                  {selectedProduct.isOnSale && (
                    <Badge className="bg-red-500 text-white">OFFERTA</Badge>
                  )}
                </div>

                <div className="flex items-center space-x-2 text-sm">
                  <Package className="w-4 h-4 text-gray-600" />
                  {isAdmin ? (
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1 bg-gray-100 rounded-lg px-3 py-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => decrementStock(selectedProduct.id)}
                          className="h-7 w-7 p-0 hover:bg-red-100 hover:text-red-600"
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="font-semibold min-w-[2rem] text-center">
                          {selectedProduct.stockQuantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => incrementStock(selectedProduct.id)}
                          className="h-7 w-7 p-0 hover:bg-green-100 hover:text-green-600"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <span className={selectedProduct.inStock ? 'text-green-600' : 'text-red-600'}>
                        {selectedProduct.inStock ? 'disponibili' : 'Esaurito'}
                      </span>
                    </div>
                  ) : (
                    <span className={selectedProduct.inStock ? 'text-green-600' : 'text-red-600'}>
                      {selectedProduct.inStock ? `${selectedProduct.stockQuantity} disponibili` : 'Esaurito'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Descrizione</h3>
              <p className="text-gray-700">{selectedProduct.description}</p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Caratteristiche</h3>
              <div className="grid grid-cols-2 gap-2">
                {selectedProduct.features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    <span className="text-sm text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex space-x-3">
              <Button
                className="flex-1"
                disabled={!selectedProduct.inStock}
                onClick={() => {
                  addToCart(selectedProduct);
                  setIsProductModalOpen(false);
                }}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Aggiungi al Carrello
              </Button>
              <Button variant="secondary" onClick={() => setIsProductModalOpen(false)}>
                Chiudi
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cart Modal */}
      <Modal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        title="Carrello"
      >
        <div className="space-y-6">
          {cart.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Carrello vuoto</h3>
              <p className="text-gray-600">Aggiungi alcuni prodotti per iniziare</p>
            </div>
          ) : (
            <>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{item.name}</h4>
                      <p className="text-sm text-gray-600">{item.brand}</p>
                      <p className="text-lg font-bold text-gray-900">€{item.price}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                        disabled={item.quantity >= item.stockQuantity}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between text-xl font-bold text-gray-900 mb-4">
                  <span>Totale:</span>
                  <span>€{getTotalPrice().toFixed(2)}</span>
                </div>
                
                <div className="flex space-x-3">
                  <Button variant="secondary" className="flex-1" onClick={() => setIsCartOpen(false)}>
                    Continua Shopping
                  </Button>
                  <Button className="flex-1">
                    <Euro className="w-4 h-4 mr-2" />
                    Procedi al Pagamento
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>

        {/* Empty State */}
        {filteredProducts.length === 0 && (
          <Card className="text-center py-12">
            <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Nessun prodotto trovato</h3>
            <p className="text-gray-600 mb-4">
              Prova a modificare i filtri di ricerca
            </p>
            <Button onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}>
              Mostra tutti i prodotti
            </Button>
          </Card>
        )}

      {/* Service Form Modal */}
      <ProductForm
        isOpen={showServiceForm}
        onClose={() => {
          setShowServiceForm(false);
          setEditingService(null);
        }}
        onSave={handleSaveService}
        product={editingService}
        mode={editingService ? 'edit' : 'add'}
      />

      {/* Product Form Modal (basic) */}
      {/* Add Product Modal aligned to DB schema */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Nuovo Prodotto">
        <div className="space-y-3">
          <Input label="Nome" value={addName} onChange={(e) => setAddName(e.target.value)} required />
          <Input label="Marca" value={addBrand} onChange={(e) => setAddBrand(e.target.value)} />
          <Input label="Prezzo (€)" type="number" value={addPrice} onChange={(e) => setAddPrice(e.target.value)} />
          <Input label="Immagine URL" value={addImageUrl} onChange={(e) => setAddImageUrl(e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
            <textarea className="w-full border border-gray-300 rounded px-3 py-2" rows={3} value={addDescription} onChange={(e) => setAddDescription(e.target.value)} />
          </div>
          <div className="flex items-center space-x-4">
            <label className="inline-flex items-center space-x-2">
              <input type="checkbox" checked={addInStock} onChange={(e) => setAddInStock(e.target.checked)} />
              <span>Disponibile</span>
            </label>
            <div className="w-40">
              <Input label="Quantità" type="number" value={String(addStockQty)} onChange={(e) => setAddStockQty(parseInt(e.target.value) || 0)} />
            </div>
            <label className="inline-flex items-center space-x-2">
              <input type="checkbox" checked={addActive} onChange={(e) => setAddActive(e.target.checked)} />
              <span>Attivo</span>
            </label>
          </div>
          <div className="flex space-x-3 pt-2">
            <Button className="flex-1" onClick={async () => {
              try {
                if (!addName || !addPrice) { showToast('Nome e Prezzo obbligatori', 'error'); return; }
                showToast('Salvataggio in corso…', 'info');
                const payload = convertUIToDatabase({
                  name: addName,
                  description: addDescription,
                  brand: addBrand,
                  price: Number(addPrice),
                  imageUrl: addImageUrl,
                  inStock: addInStock,
                  stockQuantity: addStockQty,
                } as any);
                (payload as any).active = addActive;
                const created = await apiService.createProduct(payload as any);
                const ui = convertDatabaseToUI(created as any);
                setProducts(prev => [ui, ...prev]);
                setIsAddModalOpen(false);
                setAddName(''); setAddBrand(''); setAddPrice(''); setAddDescription(''); setAddImageUrl(''); setAddInStock(true); setAddStockQty(0); setAddActive(true);
                showToast('Prodotto creato', 'success');
              } catch (e) {
                console.error('Create product failed', e);
                showToast(e instanceof Error ? e.message : 'Errore salvataggio', 'error');
              }
            }}>Salva</Button>
            <Button variant="secondary" className="flex-1" onClick={() => setIsAddModalOpen(false)}>Annulla</Button>
          </div>
        </div>
      </Modal>

      {/* Quick Add Modal */}
      <Modal
        isOpen={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        title="Aggiunta Rapida"
      >
        <div className="space-y-3">
          <Input label="Nome" value={qaName} onChange={(e) => setQaName(e.target.value)} />
          <Input label="Prezzo (€)" type="number" value={qaPrice as any} onChange={(e) => setQaPrice(parseFloat(e.target.value) || '')} />
          <Input label="Marca" value={qaBrand} onChange={(e) => setQaBrand(e.target.value)} />
          <Input label="Descrizione" value={qaDesc} onChange={(e) => setQaDesc(e.target.value)} />
          <div className="flex space-x-3 pt-2">
            <Button
              className="flex-1"
              onClick={async () => {
                try {
                  if (!qaName || !qaPrice) { showToast('Nome e prezzo obbligatori', 'error'); return; }
                  const payload = convertUIToDatabase({
                    name: qaName,
                    price: Number(qaPrice),
                    brand: qaBrand,
                    description: qaDesc,
                    inStock: true,
                    stockQuantity: 0,
                  } as any);
                  const created = await apiService.createProduct(payload as any);
                  const ui = convertDatabaseToUI(created as any);
                  setProducts(prev => [ui, ...prev]);
                  setShowQuickAdd(false);
                  setQaName(''); setQaPrice(''); setQaBrand(''); setQaDesc('');
                  showToast('Prodotto creato', 'success');
                } catch (e) {
                  console.error('QuickAdd failed', e);
                  showToast(e instanceof Error ? e.message : 'Errore creazione', 'error');
                }
              }}
            >
              Salva
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setShowQuickAdd(false)}>Annulla</Button>
          </div>
        </div>
      </Modal>

      {/* Stock Management Modal */}
      <Modal
        isOpen={showStockManagement}
        onClose={() => setShowStockManagement(false)}
        title="Gestione Stock Magazzino"
        size="large"
      >
        <div className="space-y-6">
          {/* Header con statistiche */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Prodotti Totali</p>
                  <p className="text-2xl font-bold text-blue-900">{products.length}</p>
                </div>
                <Package className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">In Stock</p>
                  <p className="text-2xl font-bold text-green-900">
                    {products.filter(p => p.inStock).length}
                  </p>
                </div>
                <Package className="w-8 h-8 text-green-600" />
              </div>
            </div>
            
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">Esauriti</p>
                  <p className="text-2xl font-bold text-red-900">
                    {products.filter(p => !p.inStock).length}
                  </p>
                </div>
                <Package className="w-8 h-8 text-red-600" />
              </div>
            </div>
          </div>

          {/* Lista prodotti con gestione stock */}
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {products.map((product) => (
              <div key={product.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-4">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900">{product.name}</h3>
                    <p className="text-sm text-gray-600">{product.brand}</p>
                    <p className="text-sm text-gray-500">€{product.price}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  {/* Stock attuale */}
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Stock Attuale</p>
                    <p className={`text-2xl font-bold ${getDisplayStock(product.id) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {getDisplayStock(product.id)}
                    </p>
                    {tempStockChanges[product.id] !== undefined && (
                      <p className="text-xs text-blue-600 font-medium">Modificato</p>
                    )}
                  </div>
                  
                  {/* Controlli stock */}
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => decrementTempStock(product.id)}
                      className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    
                    <div className="w-16 text-center">
                      <input
                        type="number"
                        value={getDisplayStock(product.id)}
                        onChange={(e) => updateTempStock(product.id, parseInt(e.target.value) || 0)}
                        className="w-full text-center border border-gray-300 rounded px-2 py-1 text-sm"
                        min="0"
                      />
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => incrementTempStock(product.id)}
                      className="h-8 w-8 p-0 hover:bg-green-100 hover:text-green-600"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {/* Status badge */}
                  <div className="w-20">
                    {getDisplayStock(product.id) > 0 ? (
                      <Badge className="bg-green-100 text-green-800">Disponibile</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800">Esaurito</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>


          {/* Footer */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              {hasStockChanges ? (
                <span className="text-blue-600 font-medium">
                  {Object.keys(tempStockChanges).length} prodotto/i modificato/i
                </span>
              ) : (
                <span>Nessuna modifica</span>
              )}
            </div>
            
            <div className="flex space-x-3">
              <Button
                variant="secondary"
                onClick={() => {
                  cancelStockChanges();
                  setShowStockManagement(false);
                }}
                disabled={!hasStockChanges}
              >
                <X className="w-4 h-4 mr-2" />
                Annulla
              </Button>
              
              <Button
                variant="primary"
                onClick={() => {
                  saveStockChanges();
                  setShowStockManagement(false);
                }}
                disabled={!hasStockChanges}
              >
                <Save className="w-4 h-4 mr-2" />
                Salva
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};