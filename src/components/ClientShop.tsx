import { useState, useEffect } from 'react';
import { Building2, MapPin, Phone, Mail, Clock, MessageCircle, User as UserIcon } from 'lucide-react';
import { Card } from './ui/Card';
import { apiService } from '../services/api';
import { useDailyShopHours } from '../hooks/useDailyShopHours';
import type { Shop, Staff } from '../types';
import { API_CONFIG } from '../config/api';

const DAYS_OF_WEEK = [
  { key: 0, name: 'Domenica', shortName: 'Dom' },
  { key: 1, name: 'Lunedì', shortName: 'Lun' },
  { key: 2, name: 'Martedì', shortName: 'Mar' },
  { key: 3, name: 'Mercoledì', shortName: 'Mer' },
  { key: 4, name: 'Giovedì', shortName: 'Gio' },
  { key: 5, name: 'Venerdì', shortName: 'Ven' },
  { key: 6, name: 'Sabato', shortName: 'Sab' },
];

const formatTimeSlot = (slot: { start: string; end: string }): string => {
  return `${slot.start} - ${slot.end}`;
};


const formatAddress = (shop: Shop): string => {
  const parts: string[] = [];
  if (shop.address) parts.push(shop.address);
  if (shop.postal_code || shop.city) {
    const cityParts: string[] = [];
    if (shop.postal_code) cityParts.push(shop.postal_code);
    if (shop.city) cityParts.push(shop.city);
    if (cityParts.length > 0) parts.push(cityParts.join(' '));
  }
  if (shop.province) parts.push(`(${shop.province})`);
  return parts.join(', ') || 'Indirizzo non disponibile';
};

const getLogoUrl = (shop: Shop): string => {
  const logoUrl = (shop as any).logo_url as string | undefined;
  const logoPath = (shop as any).logo_path as string | undefined;

  if (logoUrl && logoUrl.trim() && logoUrl !== 'null' && logoUrl !== 'undefined') {
    return logoUrl;
  }

  if (logoPath) {
    return `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/public/shop-logos/${logoPath}`;
  }

  return '';
};

export const ClientShop = () => {
  const [shop, setShop] = useState<Shop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { shopHours, shopHoursLoaded, getShopHoursSummary } = useDailyShopHours();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState<string>('');

  useEffect(() => {
    const loadShopData = async () => {
      try {
        setIsLoading(true);
        const shopData = await apiService.getShop();
        setShop(shopData);

        // Carica anche i barbieri del negozio
        try {
          const staffList = await apiService.getStaff();
          setStaff(staffList);
          if (staffList.length > 0) {
            setSelectedBarberId(staffList[0].id);
          }
        } catch (staffError) {
          console.error('Error loading staff for client view:', staffError);
          setStaff([]);
        }
      } catch (error) {
        console.error('Error loading shop data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadShopData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Caricamento informazioni...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Card>
          <div className="p-8 text-center">
            <p className="text-gray-600">Impossibile caricare le informazioni del negozio.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="p-0 page-container-chat-style"
    >
      <div className="w-full">
        <div className="flex flex-col space-y-6">
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Il tuo Barbiere</h1>
              <p className="text-3xl font-extrabold text-green-700">{shop.name}</p>
              {shop.description && (
                <p className="text-gray-500 mt-3 max-w-2xl mx-auto">{shop.description}</p>
              )}
            </div>

            {/* Informazioni Principali */}
            <Card className="!border-2 !border-green-500 bg-white/70 backdrop-blur-xl shadow-2xl">
              <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                <div className="flex items-center justify-center w-full h-full">
                  <img
                    src={getLogoUrl(shop)}
                    alt={shop.name || 'Logo negozio'}
                    className="max-h-52 w-auto object-contain drop-shadow-lg"
                  />
                </div>
                <div className="md:col-span-2 space-y-4">
                  <div className="flex items-center mb-2">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mr-4">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-900">Informazioni</h2>
                  </div>

                  {/* Indirizzo */}
                  {shop.address && (
                    <div className="flex items-start">
                      <MapPin className="w-5 h-5 text-gray-500 mr-3 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Indirizzo</p>
                        <p className="text-gray-900">{formatAddress(shop)}</p>
                      </div>
                    </div>
                  )}

                  {/* Telefono */}
                  {shop.phone && (
                    <div className="flex items-start">
                      <Phone className="w-5 h-5 text-gray-500 mr-3 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Telefono</p>
                        <a
                          href={`tel:${shop.phone}`}
                          className="text-green-600 hover:text-green-700 font-medium"
                        >
                          {shop.phone}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* WhatsApp */}
                  {shop.whatsapp && (
                    <div className="flex items-start">
                      <MessageCircle className="w-5 h-5 text-gray-500 mr-3 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">WhatsApp</p>
                        <a
                          href={`https://wa.me/${shop.whatsapp.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-700 font-medium"
                        >
                          {shop.whatsapp}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Email */}
                  {shop.email && (
                    <div className="flex items-start">
                      <Mail className="w-5 h-5 text-gray-500 mr-3 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Email</p>
                        <a
                          href={`mailto:${shop.email}`}
                          className="text-green-600 hover:text-green-700 font-medium break-all"
                        >
                          {shop.email}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Orari di Apertura - riepilogo compatto */}
                  {shopHoursLoaded && getShopHoursSummary && (
                    <div className="flex items-start mt-4">
                      <Clock className="w-5 h-5 text-gray-500 mr-3 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Orari di apertura</p>
                        <p className="text-sm text-gray-900">
                          {getShopHoursSummary()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Card Barbieri */}
            {staff.length > 0 && (
              <Card className="!border-2 !border-purple-400 bg-white/70 backdrop-blur-xl shadow-2xl">
                <div className="p-6 space-y-4">
                  <div className="flex items-center mb-2">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                      <UserIcon className="w-5 h-5 text-purple-600" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900">Barbieri</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                    {/* Selettore */}
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Scegli il tuo barbiere
                      </label>
                      <select
                        value={selectedBarberId}
                        onChange={(e) => setSelectedBarberId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-white"
                      >
                        {staff.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.full_name || 'Barbiere'}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Dettagli barbiere */}
                    <div className="md:col-span-2">
                      {(() => {
                        const selected = staff.find((s) => s.id === selectedBarberId) || staff[0];
                        if (!selected) return null;

                        return (
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                              {selected.profile_photo_url ? (
                                <img
                                  src={selected.profile_photo_url}
                                  alt={selected.full_name || 'Barbiere'}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-white font-semibold text-lg">
                                  {(selected.full_name || 'B')
                                    .split(' ')
                                    .map((n) => n[0])
                                    .join('')
                                    .toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="space-y-1">
                              <p className="text-lg font-semibold text-gray-900">
                                {selected.full_name || 'Barbiere'}
                              </p>
                              {selected.role && (
                                <p className="text-sm text-gray-600">{selected.role}</p>
                              )}
                              <div className="text-sm text-gray-700 space-y-0.5">
                                {selected.phone && (
                                  <p>
                                    <span className="font-medium">Telefono:</span>{' '}
                                    {selected.phone}
                                  </p>
                                )}
                                {selected.email && (
                                  <p className="break-all">
                                    <span className="font-medium">Email:</span>{' '}
                                    {selected.email}
                                  </p>
                                )}
                                {selected.chair_id && (
                                  <p className="text-xs text-gray-500">
                                    Poltrona: {selected.chair_id.replace('chair_', 'Poltrona ')}
                                  </p>
                                )}
                              </div>
                              {selected.specialties && (
                                <p className="text-xs text-gray-600 mt-1">
                                  <span className="font-medium">Specialità:</span>{' '}
                                  {selected.specialties}
                                </p>
                              )}
                              {selected.bio && (
                                <p className="text-xs text-gray-600 mt-1">
                                  <span className="font-medium">Bio:</span>{' '}
                                  {selected.bio}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

