import React, { useState, useEffect } from 'react';
import { User, Scissors, Check, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { ProductUpsell } from './ProductUpsell';
import { useDailyShopHours } from '../hooks/useDailyShopHours';
import { useChairAssignment } from '../hooks/useChairAssignment';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { useAppointments } from '../hooks/useAppointments';
import { emailService } from '../services/emailServiceBrowser';
import { apiService } from '../services/api';
import type { Service, Staff, Shop } from '../types';

export const ClientBookingCalendar: React.FC = () => {
  const { getAvailableTimeSlots, isDateOpen } = useDailyShopHours();
  const { availableStaff } = useChairAssignment();
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const { createAppointment, isTimeSlotBooked } = useAppointments();
  const [currentWeek, setCurrentWeek] = useState(0);
  // Removed timePeriod state - now using daily configured hours
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedBarber, setSelectedBarber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<{ productId: string; quantity: number }[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shop, setShop] = useState<Shop | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load services, staff, and shop data from API
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [servicesData, staffData, shopData] = await Promise.all([
          apiService.getServices(),
          apiService.getStaff(),
          apiService.getShop()
        ]);
        setServices(servicesData);
        setStaff(staffData);
        setShop(shopData);
      } catch (error) {
        console.error('Error loading booking data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Generate 2 weeks from today, filtering out closed days
  const generateWeeks = () => {
    const weeks = [];
    const today = new Date();
    
    for (let week = 0; week < 2; week++) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + (week * 7));
      
      const days = [];
      for (let day = 0; day < 7; day++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + day);
        
        // Only include days that are not closed
        if (isDateOpen(date)) {
          days.push(date);
        }
      }
      weeks.push(days);
    }
    
    return weeks;
  };

  const weeks = generateWeeks();
  const currentWeekDays = weeks[currentWeek] || [];


  // Get available barbers (those assigned to chairs)
  const availableBarbers = availableStaff.filter(staff => staff.active && staff.chair_id);

  // Check if a time slot is available
  const isTimeSlotAvailable = (date: Date, time: string) => {
    if (!isDateOpen(date)) return false;
    
    const timeSlots = getTimeSlotsForDate(date);
    if (!timeSlots.includes(time)) return false;
    
    // Check if there's already an appointment at this time (from saved appointments)
    return !isTimeSlotBooked(date, time);
  };

  // Get time slots for a specific date using daily configured hours
  const getTimeSlotsForDate = (date: Date) => {
    // Use the new daily shop hours system
    return getAvailableTimeSlots(date, 30); // 30 minutes slots
  };

  const handleTimeSlotClick = (date: Date, time: string) => {
    if (isTimeSlotAvailable(date, time)) {
      setSelectedDate(date);
      setSelectedTime(time);
      setShowBookingModal(true);
    }
  };

  const handleBookingSubmit = async () => {
    if (!selectedDate || !selectedTime || !selectedService || !selectedBarber) return;
    
    // Check if products are enabled before showing upsell
    if (shop && shop.products_enabled === false) {
      // Skip upsell and directly confirm appointment
      await handleUpsellConfirm([]);
    } else {
      // Close booking modal and show upsell modal
      setShowBookingModal(false);
      setShowUpsellModal(true);
    }
  };

  const handleUpsellConfirm = async (products: { productId: string; quantity: number }[]) => {
    setSelectedProducts(products);
    setIsSubmitting(true);
    
    try {
      // Get service and barber details
      const service = services.find(s => s.id === selectedService);
      const barber = staff.find(b => b.id === selectedBarber);
      
      if (!selectedDate || !selectedTime || !selectedService || !selectedBarber || !user) {
        throw new Error('Dati mancanti per la prenotazione');
      }
      
      // Create and save the appointment
      const startDateTime = new Date(`${selectedDate.toISOString().split('T')[0]}T${selectedTime}:00`);
      const endDateTime = new Date(startDateTime.getTime() + (service?.duration_min || 60) * 60000);
      
      const appointmentData = {
        client_id: user.id,
        staff_id: selectedBarber,
        service_id: selectedService,
        start_at: startDateTime.toISOString(),
        end_at: endDateTime.toISOString(),
        notes: '',
        products: products
      };
      
      const savedAppointment = await createAppointment(appointmentData);
      console.log('✅ Appuntamento salvato con successo:', savedAppointment);
      
      // Send notification to the barber
      if (barber) {
        const productNames = products.map(p => `${p.productId} (x${p.quantity})`).join(', ');
        
        addNotification({
          type: 'appointment',
          title: 'Nuova Prenotazione',
          message: `Nuovo appuntamento prenotato per ${selectedDate?.toLocaleDateString('it-IT')} alle ${selectedTime}. Servizio: ${service?.name || 'N/A'}${products.length > 0 ? `. Prodotti: ${productNames}` : ''}`,
          barberId: barber.id,
          appointmentId: Date.now().toString(),
        });

        // Send email notification to the barber
        if (barber.email && user) {
          const emailData = {
            clientName: user.full_name || 'Cliente',
            clientEmail: user.email || '',
            clientPhone: user.phone || '',
            barberName: barber.full_name,
            barberEmail: barber.email,
            appointmentDate: selectedDate?.toLocaleDateString('it-IT') || '',
            appointmentTime: selectedTime,
            serviceName: service?.name || 'N/A',
            servicePrice: (service?.price_cents || 0) / 100,
            products: products.map(p => ({ name: p.productId, quantity: p.quantity, price: 0 })),
            totalPrice: ((service?.price_cents || 0) / 100),
            notes: ''
          };

          // Send email in background (non-blocking)
          emailService.sendAppointmentNotification(emailData).then(success => {
            if (success) {
              console.log('📧 Email inviata con successo al barbiere:', barber.email);
            } else {
              console.error('❌ Errore nell\'invio email al barbiere');
            }
          });
        }
      }
      
      // Show success message
      setIsSuccess(true);
      setShowUpsellModal(false);
      
      // Reset form
      setSelectedDate(null);
      setSelectedTime('');
      setSelectedService('');
      setSelectedBarber('');
      setSelectedProducts([]);
      
      // Hide success message after 3 seconds
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (error) {
      console.error('Error booking appointment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpsellSkip = async () => {
    await handleUpsellConfirm([]);
  };

  const handleUpsellCancel = () => {
    // Solo chiude la modale senza confermare l'appuntamento
    setShowUpsellModal(false);
    setShowBookingModal(true); // Torna alla modale di prenotazione
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('it-IT', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
  };

  const formatTime = (time: string) => {
    return time;
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Prenota Appuntamento</h1>
        <p className="text-gray-600 mt-2">Scegli data e orario disponibili</p>
      </div>

      {isSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Check className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-green-800 font-medium">Appuntamento prenotato con successo!</p>
              {selectedProducts.length > 0 && (
                <p className="text-green-700 text-sm">
                  Prodotti aggiunti: {selectedProducts.length} articoli
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          onClick={() => setCurrentWeek(Math.max(0, currentWeek - 1))}
          disabled={currentWeek === 0}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Settimana Precedente
        </Button>
        
        <h2 className="text-xl font-semibold text-gray-900">
          Settimana {currentWeek + 1} di 2
        </h2>
        
        <Button
          variant="secondary"
          onClick={() => setCurrentWeek(Math.min(1, currentWeek + 1))}
          disabled={currentWeek === 1}
        >
          Settimana Successiva
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      {/* Info banner rimosso per visualizzazione cliente */}

      {/* Calendar Grid */}
      <div 
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${currentWeekDays.length}, 1fr)` }}
      >

        {/* Calendar Days */}
        {currentWeekDays.map((date, index) => {
          const timeSlots = getTimeSlotsForDate(date);
          const isToday = date.toDateString() === new Date().toDateString();
          
          return (
            <div key={index} className="flex flex-col">
              <div className="text-center mb-3 h-8 flex items-center justify-center">
                <div className={`text-sm font-medium ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                  {formatDate(date)}
                </div>
                {isToday && (
                  <div className="text-xs text-blue-500">Oggi</div>
                )}
              </div>
              
              <div className="space-y-1">
                {timeSlots.map((time) => {
                  const isAvailable = isTimeSlotAvailable(date, time);
                  
                  return (
                    <button
                      key={time}
                      onClick={() => handleTimeSlotClick(date, time)}
                      disabled={!isAvailable}
                      className={`w-full text-xs py-1 px-2 rounded transition-colors ${
                        isAvailable
                          ? 'bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer'
                          : 'bg-gray-100 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {formatTime(time)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-6 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-green-100 rounded"></div>
          <span className="text-gray-600">Disponibile</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-gray-100 rounded"></div>
          <span className="text-gray-600">Occupato</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-gray-500">📅 Orari configurati per giorno</span>
        </div>
      </div>

      {/* Booking Modal */}
      <Modal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        title="Completa Prenotazione"
        size="medium"
      >
        <div className="space-y-6">
          {/* Selected Date and Time */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Dettagli Prenotazione</h3>
            <div className="text-sm text-blue-800">
              <p><strong>Data:</strong> {selectedDate?.toLocaleDateString('it-IT')}</p>
              <p><strong>Orario:</strong> {selectedTime}</p>
            </div>
          </div>

          {/* Service Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Scissors className="w-4 h-4 inline mr-2" />
              Servizio
            </label>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isLoading}
            >
              <option value="">{isLoading ? 'Caricamento servizi...' : 'Seleziona un servizio'}</option>
              {services
                .filter(service => service.active)
                .map(service => (
                  <option key={service.id} value={service.id}>
                    {service.name} - €{(service.price_cents || 0) / 100} ({service.duration_min} min)
                  </option>
                ))}
            </select>
          </div>

          {/* Barber Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-2" />
              Barbiere
            </label>
            <select
              value={selectedBarber}
              onChange={(e) => setSelectedBarber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isLoading}
            >
              <option value="">{isLoading ? 'Caricamento barbieri...' : 'Seleziona un barbiere'}</option>
              {staff
                .filter(barber => barber.active && barber.chair_id)
                .map(barber => (
                  <option key={barber.id} value={barber.id}>
                    {barber.full_name}
                  </option>
                ))}
            </select>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={() => setShowBookingModal(false)}
            >
              Annulla
            </Button>
            <Button
              onClick={handleBookingSubmit}
              disabled={!selectedService || !selectedBarber || isSubmitting}
            >
              {isSubmitting ? 'Prenotazione in corso...' : 'Conferma Prenotazione'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Product Upsell Modal - Only show if products are enabled */}
      {shop && shop.products_enabled !== false && (
        <ProductUpsell
          isOpen={showUpsellModal}
          onClose={handleUpsellSkip}
          onCancel={handleUpsellCancel}
          onConfirm={handleUpsellConfirm}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
};
