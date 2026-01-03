import React, { useEffect, useState } from 'react';
import { Edit, Plus, X } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import type { Service } from '../types';
import { ServiceForm } from './ServiceForm';

export const Services: React.FC = () => {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(user?.role === 'admin' || (user as any)?.role === 'manager');
    const load = async () => {
      try {
        const servs = await apiService.getServices();
        setServices(servs);
      } catch (e) {
        console.error('Failed loading services', e);
      }
    };
    load();
  }, [user]);

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

  const handleSaveService = async (serviceData: Partial<Service>) => {
    try {
      if (editingService) {
        const updatedService = { ...editingService, ...serviceData } as Service;
        const saved = await apiService.updateService(updatedService as any);
        setServices(prev => prev.map(s => (s.id === editingService.id ? saved : s)));
      } else {
        const saved = await apiService.createService(serviceData as any);
        setServices(prev => [...prev, saved]);
      }
      setShowServiceForm(false);
      setEditingService(null);
    } catch (error) {
      console.error('Error saving service:', error);
    }
  };

  const glassCard = 'bg-white/60 backdrop-blur-xl border border-white/30 shadow-xl';

  return (
    <div className="p-0 page-container-chat-style">
      <div className="w-full">
      <div className="flex flex-col space-y-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Servizi</h1>
          {isAdmin && (
            <Button onClick={() => setShowServiceForm(true)} variant="secondary">
              <Plus className="w-4 h-4 mr-2" />
              Aggiungi Servizio
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map(service => (
            <Card key={service.id} className={`p-4 ${glassCard}`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{service.name}</h3>
                {isAdmin && (
                  <div className="flex space-x-2">
                    <Button size="sm" variant="secondary" onClick={() => handleEditService(service)}>
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleDeleteService(service.id)}>
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

        <ServiceForm
          isOpen={showServiceForm}
          onClose={() => {
            setShowServiceForm(false);
            setEditingService(null);
          }}
          onSave={handleSaveService}
          service={editingService as any}
          mode={editingService ? 'edit' : 'add'}
        />
      </div>
      </div>
      </div>
    </div>
  );
};


