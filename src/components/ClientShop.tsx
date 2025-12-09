import { useState, useEffect } from 'react';
import { Building2, MapPin, Phone, Mail, Clock, MessageCircle } from 'lucide-react';
import { Card } from './ui/Card';
import { apiService } from '../services/api';
import { useDailyShopHours } from '../hooks/useDailyShopHours';
import type { Shop } from '../types';

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

export const ClientShop = () => {
  const [shop, setShop] = useState<Shop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { shopHours, shopHoursLoaded, getShopHoursSummary } = useDailyShopHours();

  useEffect(() => {
    const loadShopData = async () => {
      try {
        setIsLoading(true);
        const shopData = await apiService.getShop();
        setShop(shopData);
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
      <Card className="!border-2 !border-green-500">
        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="flex items-center justify-center w-full h-full">
            <img
              src="/Logo retro barbershop glass copy copy.png"
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
                    className="text-green-600 hover:text-green-700 font-medium"
                  >
                    {shop.email}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Orari di Apertura */}
      <Card className="!border-2 !border-indigo-400">
        <div className="p-6">
          <div className="flex items-center mb-6">
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mr-4">
              <Clock className="w-6 h-6 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">Orari di Apertura</h2>
          </div>

          {!shopHoursLoaded ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Caricamento orari...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {DAYS_OF_WEEK.map((day) => {
                const dayHours = shopHours[day.key];
                const isOpen = dayHours.isOpen && dayHours.timeSlots.length > 0;

                return (
                  <div
                    key={day.key}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center">
                      <span className="text-lg font-semibold text-gray-900 w-24">
                        {day.name}
                      </span>
                    </div>
                    <div className="flex-1 ml-4">
                      {isOpen ? (
                        <div className="flex flex-wrap gap-2">
                          {dayHours.timeSlots.map((slot, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800"
                            >
                              {formatTimeSlot(slot)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                          Chiuso
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {shopHoursLoaded && getShopHoursSummary && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Nota:</strong> {getShopHoursSummary()}
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

