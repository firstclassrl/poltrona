import React, { useState, useEffect, useMemo } from 'react';
import { User, Scissors, Check, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { ProductUpsell } from './ProductUpsell';
import { useDailyShopHours } from '../hooks/useDailyShopHours';
import { useChairAssignment } from '../hooks/useChairAssignment';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { useAppointments } from '../hooks/useAppointments';
import { useVacationMode } from '../hooks/useVacationMode';
import { emailNotificationService } from '../services/emailNotificationService';
import { apiService } from '../services/api';
import type { Service, Staff, Shop, Appointment } from '../types';
import { findAvailableSlotsForDuration } from '../utils/availability';
import { getSlotDateTime, addMinutes } from '../utils/date';
import { generateICSFile, downloadICSFile } from '../utils/calendar';

interface ClientBookingCalendarProps {
  onNavigateToProfile?: () => void;
}

export const ClientBookingCalendar: React.FC<ClientBookingCalendarProps> = ({ onNavigateToProfile }) => {
  const { getAvailableTimeSlots, isDateOpen, shopHoursLoaded } = useDailyShopHours();
  const { availableStaff } = useChairAssignment();
  const { refreshUnreadCount } = useNotifications();
  const { user } = useAuth();
  const { appointments, createAppointment } = useAppointments();
  const { isDateInVacation, vacationPeriod, getVacationPeriod } = useVacationMode();
  
  // Force reload vacation period on mount - sometimes the hook doesn't load it initially
  useEffect(() => {
    // Check if vacation period is loaded
    const currentPeriod = getVacationPeriod();
    console.log('🔄 ClientBookingCalendar mounted - current vacationPeriod from hook:', currentPeriod);
    
    // Always check localStorage directly and compare with hook state
    try {
      const saved = localStorage.getItem('vacationPeriod');
      console.log('🔍 Direct localStorage check on mount:', saved);
      
      if (saved && !currentPeriod) {
        console.log('⚠️ Found vacation period in localStorage but not in hook state, forcing reload');
        // Parse and manually set if hook didn't load it
        try {
          const parsed = JSON.parse(saved);
          console.log('📅 Parsed vacation period from localStorage:', parsed);
          // Force reload by dispatching event multiple times
          window.dispatchEvent(new CustomEvent('vacation-period-updated'));
          setTimeout(() => window.dispatchEvent(new CustomEvent('vacation-period-updated')), 100);
          setTimeout(() => window.dispatchEvent(new CustomEvent('vacation-period-updated')), 500);
        } catch (e) {
          console.error('Error parsing vacation period from localStorage:', e);
        }
      } else if (!saved && !currentPeriod) {
        console.log('⚠️ No vacation period in localStorage or hook state');
      } else if (saved && currentPeriod) {
        console.log('✅ Vacation period found in both localStorage and hook state');
      }
    } catch (e) {
      console.error('Error reading localStorage:', e);
    }
  }, []); // Only run once on mount
  
  // Debug: log vacation period when it changes
  useEffect(() => {
    console.log('🔄 ClientBookingCalendar - vacationPeriod changed:', vacationPeriod);
    if (vacationPeriod) {
      console.log('📅 Active vacation period:', {
        start: vacationPeriod.start_date,
        end: vacationPeriod.end_date
      });
    } else {
      console.log('📅 No active vacation period in ClientBookingCalendar');
    }
  }, [vacationPeriod]);
  // View state: 'monthly' | 'day_detail'
  const [currentView, setCurrentView] = useState<'monthly' | 'day_detail'>('monthly');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDayForDetail, setSelectedDayForDetail] = useState<Date | null>(null);
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedBarber, setSelectedBarber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<{ productId: string; quantity: number }[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shop, setShop] = useState<Shop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastAppointmentData, setLastAppointmentData] = useState<{
    service: Service | null;
    barber: Staff | null;
    startDateTime: Date;
    endDateTime: Date;
  } | null>(null);

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
    
    // Force reload vacation period after component mounts
    // This ensures we get the latest vacation period even if it was set before this component mounted
    // Try multiple times with increasing delays to catch the period if it's being set asynchronously
    const checkVacationPeriod = () => {
      try {
        const saved = localStorage.getItem('vacationPeriod');
        if (saved) {
          console.log('✅ Found vacation period in localStorage during mount check:', saved);
          window.dispatchEvent(new CustomEvent('vacation-period-updated'));
        } else {
          console.log('⚠️ No vacation period in localStorage during mount check');
        }
      } catch (e) {
        console.error('Error checking localStorage:', e);
      }
    };
    
    // Check immediately
    checkVacationPeriod();
    
    // Check again after delays to catch async saves
    setTimeout(checkVacationPeriod, 100);
    setTimeout(checkVacationPeriod, 500);
    setTimeout(checkVacationPeriod, 1000);
  }, []);


  // Get available barbers (those assigned to chairs)
  const availableBarbers = availableStaff.filter(staff => staff.active && staff.chair_id);

  const selectedServiceObj = useMemo(
    () => services.find((s) => s.id === selectedService) || null,
    [services, selectedService]
  );

  const bookingDuration = selectedServiceObj?.duration_min || 0;

  // Pre-calculated available slots for the next 6 months based on selected service duration
  const availableSlots = useMemo(() => {
    if (!shopHoursLoaded || !bookingDuration || !selectedBarber) return [];

    const today = new Date();
    const startDate = new Date(today);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(today);
    // Cerca disponibilità per i prossimi 6 mesi
    endDate.setMonth(endDate.getMonth() + 6);
    endDate.setHours(0, 0, 0, 0);

    return findAvailableSlotsForDuration({
      startDate,
      endDate,
      durationMin: bookingDuration,
      appointments,
      isDateOpen,
      isDateInVacation,
      getAvailableTimeSlots,
      staffId: selectedBarber,
    });
  }, [
    appointments,
    bookingDuration,
    getAvailableTimeSlots,
    isDateInVacation,
    isDateOpen,
    selectedBarber,
    shopHoursLoaded,
    vacationPeriod, // Recalculate when vacation period changes
  ]);

  // Calculate approximate availability for a day (for calendar preview bars)
  const getDayAvailabilityPreview = (date: Date): { available: number; total: number } => {
    if (!shopHoursLoaded || !bookingDuration || !selectedBarber) {
      return { available: 0, total: 0 };
    }

    // If date is in vacation mode, return no availability
    const dateStr = date.toISOString().split('T')[0];
    const inVacation = isDateInVacation(date);
    
    // Debug log for specific dates
    if (dateStr === '2026-01-02' || dateStr === '2026-01-03') {
      console.log('📊 getDayAvailabilityPreview for', dateStr, {
        inVacation,
        vacationPeriod,
        isDateInVacation: isDateInVacation(date)
      });
    }
    
    if (inVacation) {
      return { available: 0, total: 0 };
    }

    // Get all possible slots for the day
    const allSlots = getAvailableTimeSlots(date, 15);
    if (allSlots.length === 0) {
      return { available: 0, total: 0 };
    }

    // Count how many slots are available (not overlapping with appointments)
    const availableCount = allSlots.filter(slot => {
      const slotStart = getSlotDateTime(date, slot);
      const slotEnd = addMinutes(slotStart, bookingDuration);

      // Check if this slot overlaps with any appointment for the selected barber
      const overlaps = appointments.some((apt: Appointment) => {
        if (apt.status === 'cancelled') return false;
        if (apt.staff_id !== selectedBarber) return false;

        const aptStart = new Date(apt.start_at);
        const aptEnd = apt.end_at
          ? new Date(apt.end_at)
          : addMinutes(aptStart, apt.services?.duration_min || bookingDuration);

        // Same day check
        if (aptStart.toDateString() !== date.toDateString()) return false;

        // Overlap check
        return slotStart < aptEnd && slotEnd > aptStart;
      });

      return !overlaps;
    }).length;

    return {
      available: availableCount,
      total: allSlots.length
    };
  };

  // Generate calendar days for current month
  // Memoize to recalculate when month or vacation period changes
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);
    
    // Start from Monday of the week containing the first day
    const startDate = new Date(firstDay);
    const dayOfWeek = firstDay.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sunday (0) to 6
    startDate.setDate(firstDay.getDate() - daysToSubtract);
    
    // End on Sunday of the week containing the last day
    const endDate = new Date(lastDay);
    const lastDayOfWeek = lastDay.getDay();
    const daysToAdd = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
    endDate.setDate(lastDay.getDate() + daysToAdd);
    
    const days: Date[] = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  }, [currentMonth, vacationPeriod]); // Recalculate when month or vacation period changes

  // Get time slots for a specific date using pre-computed availability
  const getTimeSlotsForDate = (date: Date) => {
    if (!shopHoursLoaded || !bookingDuration || !selectedBarber) return [];
    const iso = date.toISOString().split('T')[0];
    return availableSlots
      .filter((slot) => slot.date.toISOString().split('T')[0] === iso)
      .map((slot) => slot.time);
  };

  // Navigate months
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(currentMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(currentMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  // Handle day click - show detail view
  const handleDayClick = (date: Date) => {
    // Only allow clicking on days that are in the current month and have availability
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const dayYear = date.getFullYear();
    const dayMonth = date.getMonth();
    
    // Allow clicking on current month days
    if (dayYear === year && dayMonth === month) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const clickedDate = new Date(date);
      clickedDate.setHours(0, 0, 0, 0);
      
      // Only allow clicking on today or future dates
      if (clickedDate >= today) {
        setSelectedDayForDetail(date);
        setCurrentView('day_detail');
      }
    }
  };

  const handleTimeSlotClick = (date: Date, time: string) => {
    // Protection: allow click only if the slot is in our computed availability
    if (!shopHoursLoaded || !bookingDuration || !selectedBarber) return;

    const iso = date.toISOString().split('T')[0];
    const exists = availableSlots.some(
      (slot) => slot.date.toISOString().split('T')[0] === iso && slot.time === time
    );
    if (!exists) return;

    setSelectedDate(date);
    setSelectedTime(time);
    setShowBookingModal(true);
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
      
      // Check if date is in vacation mode
      if (isDateInVacation(selectedDate)) {
        throw new Error('Non è possibile prenotare durante il periodo di ferie');
      }
      
      // Get or create client record in clients table
      const clientRecord = await apiService.getOrCreateClientFromUser({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
      });
      const clientId = clientRecord.id;
      const clientPhone = clientRecord.phone_e164 || user.phone || '';
      
      // Create and save the appointment
      // Use local date methods to avoid timezone issues
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const startDateTime = new Date(selectedDate);
      startDateTime.setHours(hours, minutes, 0, 0);
      const endDateTime = new Date(startDateTime.getTime() + (service?.duration_min || 60) * 60000);
      
      const appointmentData = {
        client_id: clientId,
        staff_id: selectedBarber,
        service_id: selectedService,
        start_at: startDateTime.toISOString(),
        end_at: endDateTime.toISOString(),
        notes: '',
        products: products
      };
      
      const savedAppointment = await createAppointment(appointmentData);
      console.log('✅ Appuntamento salvato con successo:', savedAppointment);
      
      // Save appointment data for calendar export
      setLastAppointmentData({
        service: service || null,
        barber: barber || null,
        startDateTime,
        endDateTime,
      });
      
      // Send notification to the barber
      if (barber && user) {
        // Format date and time for notification
        const appointmentDate = selectedDate?.toLocaleDateString('it-IT', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }) || '';
        
        const clientName = user.full_name || 'Cliente';
        const serviceName = service?.name || 'Servizio';
        
        // Create in-app notification for the barber
        // Usa user_id se disponibile (collegato a auth.users), altrimenti usa id
        const barberUserId = barber.user_id || barber.id;
        try {
          await apiService.createNotification({
            user_id: barberUserId,
            user_type: 'staff',
            type: 'new_appointment',
            title: '🔔 Nuovo Appuntamento!',
            message: `${clientName} ha prenotato ${serviceName} per ${appointmentDate} alle ${selectedTime}`,
            data: {
              appointment_id: savedAppointment.id,
              client_name: clientName,
              client_email: user.email,
              client_phone: clientPhone,
              service_name: serviceName,
              appointment_date: appointmentDate,
              appointment_time: selectedTime,
              staff_id: barber.id, // Mantieni anche lo staff_id originale
            }
          });
          console.log('✅ Notifica in-app creata per il barbiere. user_id:', barberUserId, 'staff_id:', barber.id);
          
          // Play notification sound using Web Audio API
          try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 880; // A5 note
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
          } catch {
            // Audio not available
          }
        } catch (notifError) {
          console.error('❌ Errore creazione notifica:', notifError);
        }
        
        // Refresh notifications count
        refreshUnreadCount();

        // Send email notification to the shop's notification email
        if (shop?.notification_email) {
          const emailData = {
            clientName: user.full_name || 'Cliente',
            clientEmail: user.email || '',
            clientPhone: clientPhone || 'Non fornito',
            barberName: barber.full_name,
            serviceName: service?.name || 'N/A',
            appointmentDate: selectedDate?.toLocaleDateString('it-IT') || '',
            appointmentTime: selectedTime,
            shopName: shop.name || 'Barbershop',
          };

          // Send email to shop in background (non-blocking)
          emailNotificationService.sendNewAppointmentNotification(emailData, shop.notification_email)
            .then(result => {
              if (result.success) {
                console.log('📧 Email inviata con successo al negozio:', shop.notification_email);
              } else {
                console.error('❌ Errore nell\'invio email al negozio:', result.error);
              }
            });
        } else {
          console.log('ℹ️ Email notifiche non configurata per il negozio');
        }

        // Send confirmation email to the client
        if (user.email) {
          const clientEmailData = {
            clientName: user.full_name || 'Cliente',
            clientEmail: user.email,
            clientPhone: clientPhone || 'Non fornito',
            barberName: barber.full_name,
            serviceName: service?.name || 'N/A',
            appointmentDate: selectedDate?.toLocaleDateString('it-IT', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            }) || '',
            appointmentTime: selectedTime,
            shopName: shop?.name || 'Barbershop',
          };

          // Send email to client in background (non-blocking)
          emailNotificationService.sendClientAppointmentConfirmation(clientEmailData)
            .then(result => {
              if (result.success) {
                console.log('📧 Email di conferma inviata con successo al cliente:', user.email);
              } else {
                console.error('❌ Errore nell\'invio email di conferma al cliente:', result.error);
              }
            });
        } else {
          console.log('ℹ️ Email cliente non disponibile per invio conferma');
        }
      }
      
      // Close all modals
      setShowUpsellModal(false);
      setShowBookingModal(false);
      
      // Show success message
      setIsSuccess(true);
      setError(null); // Clear any previous errors
      
      // Reset form
      setSelectedDate(null);
      setSelectedTime('');
      setSelectedService('');
      setSelectedBarber('');
      setSelectedProducts([]);
      setCurrentView('monthly');
      
      // Navigate to profile after 5 seconds (increased to allow time for calendar action)
      setTimeout(() => {
        setIsSuccess(false);
        setLastAppointmentData(null);
        if (onNavigateToProfile) {
          onNavigateToProfile();
        }
      }, 5000);
    } catch (error) {
      console.error('Error booking appointment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Errore durante la prenotazione. Riprova.';
      setError(errorMessage);
      // Close modals on error too
      setShowUpsellModal(false);
      setShowBookingModal(false);
      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
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

  const handleAddToCalendar = () => {
    if (!lastAppointmentData || !lastAppointmentData.service || !lastAppointmentData.barber) {
      console.error('Dati appuntamento non disponibili per il calendario');
      return;
    }

    const { service, barber, startDateTime, endDateTime } = lastAppointmentData;
    
    // Build location string
    const locationParts: string[] = [];
    if (shop?.name) {
      locationParts.push(shop.name);
    }
    if (shop?.address) {
      locationParts.push(shop.address);
    }
    if (shop?.city) {
      locationParts.push(shop.city);
    }
    const location = locationParts.join(', ');

    // Build description
    const descriptionParts: string[] = [];
    descriptionParts.push(`Barbiere: ${barber.full_name}`);
    if (shop?.name) {
      descriptionParts.push(`Negozio: ${shop.name}`);
    }
    if (shop?.phone) {
      descriptionParts.push(`Telefono: ${shop.phone}`);
    }
    const description = descriptionParts.join('\n');

    // Generate calendar event
    const icsContent = generateICSFile({
      title: service.name,
      startDate: startDateTime,
      endDate: endDateTime,
      description,
      location: location || undefined,
      uid: `appointment-${Date.now()}@poltrona`,
    });

    // Download the file
    const filename = `appuntamento-${service.name.toLowerCase().replace(/\s+/g, '-')}-${startDateTime.toISOString().split('T')[0]}.ics`;
    downloadICSFile(icsContent, filename);
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

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('it-IT', {
      month: 'long',
      year: 'numeric'
    });
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth() && 
           date.getFullYear() === currentMonth.getFullYear();
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Prenota Appuntamento</h1>
        <p className="text-gray-600 mt-2">
          Seleziona prima il servizio e il barbiere, poi scegli tra gli orari disponibili entro 6 mesi.
        </p>
      </div>

      {/* Step 1: scelta servizio e barbiere */}
      <div className="max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Scissors className="w-4 h-4 inline mr-2" />
            Servizio
          </label>
          <select
            value={selectedService}
            onChange={(e) => {
              setSelectedService(e.target.value);
              // reset eventuale selezione precedente
              setSelectedDate(null);
              setSelectedTime('');
              setCurrentView('monthly');
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          >
            <option value="">{isLoading ? 'Caricamento servizi...' : 'Seleziona un servizio'}</option>
            {services
              .filter((service) => service.active)
              .map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} - €{(service.price_cents || 0) / 100} ({service.duration_min} min)
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <User className="w-4 h-4 inline mr-2" />
            Barbiere
          </label>
          <select
            value={selectedBarber}
            onChange={(e) => {
              setSelectedBarber(e.target.value);
              setSelectedDate(null);
              setSelectedTime('');
              setCurrentView('monthly');
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!selectedService || isLoading}
          >
            <option value="">{isLoading ? 'Caricamento barbieri...' : 'Seleziona un barbiere'}</option>
            {availableBarbers.map((barber) => (
              <option key={barber.id} value={barber.id}>
                {barber.full_name}
              </option>
            ))}
          </select>
        </div>

        {!bookingDuration || !selectedBarber ? (
          <p className="text-xs text-gray-500">
            Seleziona servizio e barbiere per vedere solo gli orari con tempo sufficiente disponibile.
          </p>
        ) : (
          <p className="text-xs text-gray-600">
            Durata appuntamento: <span className="font-medium">{bookingDuration} minuti</span>.
            Mostriamo solo slot con almeno questo tempo libero entro 6 mesi.
          </p>
        )}
      </div>

      {/* Calendar View */}
      {!shopHoursLoaded ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-600">
          Caricamento orari del negozio...
        </div>
      ) : !bookingDuration || !selectedBarber ? (
        <div className="text-center py-12 text-gray-500 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-lg font-semibold">Seleziona servizio e barbiere</p>
          <p className="text-sm mt-1">Poi vedrai il calendario mensile con gli orari disponibili.</p>
        </div>
      ) : currentView === 'monthly' ? (
        /* Monthly Calendar View */
        <div className="w-full">
          {/* Month Header */}
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => navigateMonth('prev')}
              className="flex items-center space-x-2"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
              {formatMonthYear(currentMonth)}
            </h2>
            
            <Button
              variant="ghost"
              size="lg"
              onClick={() => navigateMonth('next')}
              className="flex items-center space-x-2"
            >
              <ChevronRight className="w-6 h-6" />
            </Button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((day, index) => (
              <div key={index} className="text-center text-sm font-semibold text-gray-600 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((date, index) => {
              const isCurrentMonthDay = isCurrentMonth(date);
              const isTodayDate = isToday(date);
              const availability = getDayAvailabilityPreview(date);
              const hasAvailability = availability.available > 0;
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const clickedDate = new Date(date);
              clickedDate.setHours(0, 0, 0, 0);
              const isClickable = isCurrentMonthDay && hasAvailability && clickedDate >= today;
              
              // Calculate bar count (approximate visual representation - fewer and smaller)
              const totalBars = 4; // Maximum number of bars to show (reduced from 8)
              const availableBars = availability.total > 0 
                ? Math.max(1, Math.round((availability.available / availability.total) * totalBars))
                : 0;
              const occupiedBars = totalBars - availableBars;

              return (
                <div
                  key={index}
                  onClick={() => isClickable && handleDayClick(date)}
                  className={`
                    aspect-square p-1.5 border rounded-lg transition-all overflow-hidden
                    ${isCurrentMonthDay ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'}
                    ${isTodayDate ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                    ${isClickable ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-300' : 'cursor-not-allowed opacity-60'}
                  `}
                >
                  {/* Day Number */}
                  <div className={`
                    text-xs sm:text-sm font-medium mb-0.5
                    ${isCurrentMonthDay ? (isTodayDate ? 'text-blue-600' : 'text-gray-900') : 'text-gray-400'}
                  `}>
                    {date.getDate()}
                  </div>

                  {/* Availability Bars - smaller and contained */}
                  {/* Only show bars if date is not in vacation mode and has availability */}
                  {isCurrentMonthDay && !isDateInVacation(date) && availability.total > 0 && (
                    <div className="flex flex-wrap gap-0.5 items-end h-4 overflow-hidden">
                      {/* Available bars (green) */}
                      {Array.from({ length: availableBars }).map((_, i) => (
                        <div
                          key={`available-${i}`}
                          className="flex-1 bg-green-500 rounded-sm min-w-[2px]"
                          style={{ height: `${40 + (i % 3) * 20}%` }}
                        />
                      ))}
                      {/* Occupied bars (gray) */}
                      {Array.from({ length: occupiedBars }).map((_, i) => (
                        <div
                          key={`occupied-${i}`}
                          className="flex-1 bg-gray-300 rounded-sm min-w-[2px]"
                          style={{ height: `${40 + (i % 3) * 20}%` }}
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* Closed/Vacation indicator */}
                  {isCurrentMonthDay && (isDateInVacation(date) || !isDateOpen(date)) && (
                    <div className="text-xs text-red-500 mt-1">Chiuso</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Day Detail View */
        selectedDayForDetail && (
          <div className="w-full space-y-6">
            {/* Back Button and Date Header */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setCurrentView('monthly')}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Torna al calendario</span>
              </Button>
              
              <div className="text-center">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                  {selectedDayForDetail.toLocaleDateString('it-IT', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </h2>
                {isToday(selectedDayForDetail) && (
                  <div className="text-sm text-blue-600 font-medium mt-1">Oggi</div>
                )}
              </div>
              
              <div className="w-32"></div> {/* Spacer for centering */}
            </div>

            {/* Time Slots */}
            {isDateInVacation(selectedDayForDetail) ? (
              <div className="text-center py-12 text-red-600 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-lg font-semibold">CHIUSO PER FERIE</p>
                <p className="text-sm">Il negozio è chiuso per le vacanze in questa data</p>
              </div>
            ) : !isDateOpen(selectedDayForDetail) ? (
              <div className="text-center py-12 text-gray-500 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-lg font-semibold">Il negozio è chiuso in questa data</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {getTimeSlotsForDate(selectedDayForDetail).map((time) => (
                  <button
                    key={time}
                    onClick={() => handleTimeSlotClick(selectedDayForDetail, time)}
                    className="py-3 px-4 rounded-lg text-center transition-colors bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer border border-green-200 font-medium"
                  >
                    {time}
                  </button>
                ))}
              </div>
            )}

            {getTimeSlotsForDate(selectedDayForDetail).length === 0 && isDateOpen(selectedDayForDetail) && !isDateInVacation(selectedDayForDetail) && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg font-semibold">Nessun orario disponibile</p>
                <p className="text-sm mt-1">Non ci sono slot disponibili per questo giorno.</p>
              </div>
            )}
          </div>
        )
      )}

      {/* Success Message */}
      {isSuccess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Grazie per la prenotazione!</h2>
            <p className="text-gray-600 mb-6">
              Il tuo appuntamento è stato confermato con successo.
            </p>
            
            {/* Add to Calendar Button */}
            {lastAppointmentData && (
              <div className="mb-6">
                <Button
                  onClick={handleAddToCalendar}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center space-x-2"
                >
                  <Calendar className="w-5 h-5" />
                  <span>Aggiungi al calendario</span>
                </Button>
              </div>
            )}
            
            <p className="text-sm text-gray-500">
              Verrai reindirizzato al tuo profilo...
            </p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <X className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Errore nella prenotazione</h2>
            <p className="text-gray-600 mb-6">
              {error}
            </p>
            <Button
              onClick={() => setError(null)}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              Chiudi
            </Button>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      <Modal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        title="Conferma Prenotazione"
        size="medium"
      >
        <div className="space-y-6">
          {/* Selected Date and Time */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Dettagli Prenotazione</h3>
            <div className="text-sm text-blue-800">
              <p><strong>Data:</strong> {selectedDate?.toLocaleDateString('it-IT')}</p>
              <p><strong>Orario:</strong> {selectedTime}</p>
              {selectedServiceObj && (
                <p>
                  <strong>Servizio:</strong> {selectedServiceObj.name} ({selectedServiceObj.duration_min} min)
                </p>
              )}
              {selectedBarber && (
                <p>
                  <strong>Barbiere:</strong>{' '}
                  {staff.find((b) => b.id === selectedBarber)?.full_name || ''}
                </p>
              )}
            </div>
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
