import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Scissors, Plus, Check } from 'lucide-react';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { Card } from './ui/Card';
import { useDailyShopHours } from '../hooks/useDailyShopHours';
import { apiService } from '../services/api';
import type { Service, Staff } from '../types';

export const ClientBooking: React.FC = () => {
  const { getAvailableTimeSlots, isDateOpen } = useDailyShopHours();
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedBarber, setSelectedBarber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load services and staff from API
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [servicesData, staffData] = await Promise.all([
          apiService.getServices(),
          apiService.getStaff()
        ]);
        setServices(servicesData);
        setStaff(staffData);
      } catch (error) {
        console.error('Error loading booking data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Get available time slots for selected date
  const timeSlots = selectedDate ? getAvailableTimeSlots(new Date(selectedDate)) : [];

  // Filter barbers based on selected service and availability
  const availableBarbers = staff.filter(staff => 
    staff.active && staff.chair_id // Only assigned barbers
  );

  // Check if date is valid (shop is open)
  const isDateValid = (date: Date) => {
    return isDateOpen(date);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setIsSuccess(true);
      // Reset form
      setSelectedDate('');
      setSelectedTime('');
      setSelectedService('');
      setSelectedBarber('');
      
      // Hide success message after 3 seconds
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (error) {
      console.error('Error booking appointment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = selectedDate && selectedTime && selectedService && selectedBarber;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Prenota Appuntamento</h1>
        <p className="text-gray-600 mt-2">Scegli il servizio e prenota il tuo appuntamento</p>
      </div>

      {isSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Check className="w-5 h-5 text-green-600" />
            <p className="text-green-800 font-medium">Appuntamento prenotato con successo!</p>
          </div>
        </div>
      )}

      <Card className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {/* Servizio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Scissors className="w-4 h-4 inline mr-2" />
              Servizio
            </label>
            <Select
              value={selectedService}
              onChange={(e) => {
                setSelectedService(e.target.value);
                setSelectedBarber(''); // Reset barber when service changes
              }}
              options={[
                { value: '', label: isLoading ? 'Caricamento servizi...' : 'Seleziona un servizio' },
                ...services
                  .filter(service => service.active)
                  .map(service => ({
                    value: service.id,
                    label: `${service.name} - €${(service.price_cents || 0) / 100} (${service.duration_min} min)`,
                  })),
              ]}
              required
              disabled={isLoading}
            />
          </div>

          {/* Barbiere */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-2" />
              Barbiere
            </label>
            <Select
              value={selectedBarber}
              onChange={(e) => setSelectedBarber(e.target.value)}
              options={[
                { value: '', label: isLoading ? 'Caricamento barbieri...' : 'Seleziona un barbiere' },
                ...availableBarbers.map(barber => ({
                  value: barber.id,
                  label: barber.full_name,
                })),
              ]}
              required
              disabled={!selectedService || isLoading}
            />
          </div>

          {/* Data */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Data
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedTime(''); // Reset time when date changes
              }}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            {selectedDate && !isDateValid(new Date(selectedDate)) && (
              <p className="text-red-500 text-sm mt-1">Il negozio è chiuso la domenica</p>
            )}
          </div>

          {/* Orario */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="w-4 h-4 inline mr-2" />
              Orario
            </label>
            <Select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              options={[
                { value: '', label: 'Seleziona un orario' },
                ...timeSlots.map(time => ({ value: time, label: time })),
              ]}
              required
              disabled={!selectedDate || !isDateValid(new Date(selectedDate))}
            />
            {selectedDate && timeSlots.length === 0 && isDateValid(new Date(selectedDate)) && (
              <p className="text-gray-500 text-sm mt-1">Nessun orario disponibile per questa data</p>
            )}
          </div>

          {/* Riepilogo */}
          {isFormValid && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">Riepilogo Prenotazione</h3>
              <div className="space-y-1 text-sm text-blue-800">
                <p><strong>Servizio:</strong> {services.find(s => s.id === selectedService)?.name}</p>
                <p><strong>Barbiere:</strong> {availableBarbers.find(b => b.id === selectedBarber)?.full_name}</p>
                <p><strong>Data:</strong> {new Date(selectedDate).toLocaleDateString('it-IT')}</p>
                <p><strong>Orario:</strong> {selectedTime}</p>
                <p><strong>Durata:</strong> {services.find(s => s.id === selectedService)?.duration_min} minuti</p>
                <p><strong>Prezzo:</strong> €{(services.find(s => s.id === selectedService)?.price_cents || 0) / 100}</p>
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!isFormValid || isSubmitting}
          >
            {isSubmitting ? (
              'Prenotazione in corso...'
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Prenota Appuntamento
              </>
            )}
          </Button>
        </form>
      </Card>

      {/* Informazioni */}
      <Card className="max-w-2xl mx-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Informazioni</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>Orari: 09:00 - 19:00 (Chiuso la domenica)</span>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>Prenotazione minima: 1 ora di anticipo</span>
            </div>
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span>Puoi modificare o cancellare la prenotazione fino a 2 ore prima</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
