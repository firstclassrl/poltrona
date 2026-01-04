import React, { useState, useEffect, useMemo } from 'react';
import { User, Scissors, Check, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Calendar, X, AlertCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { ProductUpsell } from './ProductUpsell';
import { useDailyShopHours } from '../hooks/useDailyShopHours';
import { useChairAssignment } from '../hooks/useChairAssignment';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { useShop } from '../contexts/ShopContext';
import { useAppointments } from '../hooks/useAppointments';
import { useVacationMode } from '../hooks/useVacationMode';
import { useUserProfile } from '../hooks/useUserProfile';
import { apiService } from '../services/api';
import type { Service, Staff, Shop, Appointment } from '../types';
import { findAvailableSlotsForDuration } from '../utils/availability';
import { getSlotDateTime, addMinutes } from '../utils/date';
import { generateICSFile, downloadICSFile } from '../utils/calendar';

interface ClientBookingCalendarProps {
  onNavigateToProfile?: () => void;
  initialParams?: { date?: string; serviceId?: string; staffId?: string };
}

export const ClientBookingCalendar: React.FC<ClientBookingCalendarProps> = ({ onNavigateToProfile, initialParams }) => {
  const { getAvailableTimeSlots, isDateOpen, shopHoursLoaded } = useDailyShopHours();
  const { availableStaff } = useChairAssignment();
  const { refreshUnreadCount } = useNotifications();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { currentShop, currentShopId, isLoading: shopLoading } = useShop();
  const { getUserProfile } = useUserProfile();
  const { appointments, createAppointment } = useAppointments();
  const { isDateInVacation, vacationPeriod, getVacationPeriod } = useVacationMode();
  
  // Force reload vacation period on mount - sometimes the hook doesn't load it initially
  useEffect(() => {
    // Check if vacation period is loaded
    const currentPeriod = getVacationPeriod();
    
    // Always check localStorage directly and compare with hook state
    try {
      const saved = localStorage.getItem('vacationPeriod');
      
      if (saved && !currentPeriod) {
        // Parse and manually set if hook didn't load it
        try {
          JSON.parse(saved);
          // Force reload by dispatching event multiple times
          window.dispatchEvent(new CustomEvent('vacation-period-updated'));
          setTimeout(() => window.dispatchEvent(new CustomEvent('vacation-period-updated')), 100);
          setTimeout(() => window.dispatchEvent(new CustomEvent('vacation-period-updated')), 500);
        } catch (e) {
          console.error('Error parsing vacation period from localStorage:', e);
        }
      }
    } catch (e) {
      console.error('Error reading localStorage:', e);
    }
  }, []); // Only run once on mount
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
  const [notifyIfEarlierSlot, setNotifyIfEarlierSlot] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<{ productId: string; quantity: number }[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastAppointmentData, setLastAppointmentData] = useState<{
    service: Service | null;
    barber: Staff | null;
    startDateTime: Date;
    endDateTime: Date;
  } | null>(null);
  const areProductsEnabled = currentShop?.products_enabled === true;

  // Apply initial params from notification (if any)
  useEffect(() => {
    if (initialParams && services.length > 0 && staff.length > 0) {
      if (initialParams.date) {
        const date = new Date(initialParams.date);
        setSelectedDate(date);
        // Switch to day detail view if date is provided
        setCurrentView('day_detail');
        setSelectedDayForDetail(date);
      }
      if (initialParams.serviceId && services.find(s => s.id === initialParams.serviceId)) {
        setSelectedService(initialParams.serviceId);
      }
      if (initialParams.staffId && staff.find(s => s.id === initialParams.staffId)) {
        setSelectedBarber(initialParams.staffId);
      }
    }
  }, [initialParams, services, staff]);

  // Load services and staff from API - wait for shop to be loaded first
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let globalTimeoutId: NodeJS.Timeout | null = null;
    let isMounted = true;
    let hasLoaded = false;
    let isLoadingData = false; // Flag per prevenire caricamenti simultanei

    // Timeout globale di sicurezza: dopo 5 secondi, imposta sempre loading a false
    globalTimeoutId = setTimeout(() => {
      if (isMounted && !hasLoaded) {
        console.warn('⚠️ Global timeout: forcing loading to false');
        setIsLoading(false);
      }
    }, 5000);

    const loadData = async (shopIdToUse: string | null) => {
      // Prevenire caricamenti duplicati o simultanei
      if (hasLoaded || isLoadingData) {
        console.log('⏭️ ClientBookingCalendar: Skipping duplicate load request');
        return;
      }
      
      isLoadingData = true;
      hasLoaded = true;

      try {
        setIsLoading(true);
        
        // Verifica che il token sia disponibile
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        console.log('🔄 ClientBookingCalendar: Loading services and staff', {
          shopId: shopIdToUse,
          hasToken: !!token,
          tokenLocation: localStorage.getItem('auth_token') ? 'localStorage' : (sessionStorage.getItem('auth_token') ? 'sessionStorage' : 'none'),
          isAuthenticated,
          user: user?.email
        });
        
        // Ensure shop_id is in localStorage before calling getServices
        if (shopIdToUse && shopIdToUse !== 'default') {
          localStorage.setItem('current_shop_id', shopIdToUse);
        }
        
        // Timeout per le chiamate API (8 secondi)
        const apiTimeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('API timeout')), 8000);
        });

        const [servicesData, staffData] = await Promise.race([
          Promise.all([
            apiService.getServices(),
            apiService.getStaff()
          ]),
          apiTimeout
        ]) as [Service[], Staff[]];
        
        console.log('✅ ClientBookingCalendar: Loaded services:', servicesData.length, 'staff:', staffData.length);
        
        if (isMounted) {
          setServices(servicesData);
          setStaff(staffData);
        }
      } catch (error) {
        console.error('❌ ClientBookingCalendar: Error loading booking data:', error);
        // Se l'errore è ERR_INSUFFICIENT_RESOURCES, non riprovare immediatamente
        if (error instanceof Error && error.message.includes('ERR_INSUFFICIENT_RESOURCES')) {
          console.warn('⚠️ Too many requests, will not retry immediately');
          // Reset hasLoaded dopo un delay per permettere un retry futuro
          setTimeout(() => {
            hasLoaded = false;
            isLoadingData = false;
          }, 5000);
        }
        if (isMounted) {
          setServices([]);
          setStaff([]);
        }
      } finally {
        isLoadingData = false;
        if (isMounted) {
          setIsLoading(false);
        }
        if (globalTimeoutId) {
          clearTimeout(globalTimeoutId);
        }
      }
    };

    // Determina quale shop_id usare (priorità: currentShopId > currentShop.id > localStorage)
    const shopIdToUse = currentShopId || currentShop?.id || null;
    const fallbackShopId = typeof window !== 'undefined' 
      ? localStorage.getItem('current_shop_id') 
      : null;
    
    const effectiveShopId = shopIdToUse || (fallbackShopId && fallbackShopId !== 'default' ? fallbackShopId : null);

    console.log('📊 ClientBookingCalendar: Shop loading state:', {
      shopLoading,
      currentShopId,
      currentShop: currentShop?.id,
      fallbackShopId,
      effectiveShopId
    });

    // Se abbiamo un shop_id valido (da qualsiasi fonte), carica i dati immediatamente
    if (effectiveShopId) {
      // Carica immediatamente se abbiamo shop_id, anche se shopLoading è true
      loadData(effectiveShopId);
    } else {
      // Se non abbiamo shop_id, aspetta al massimo 1.5 secondi per il caricamento del negozio
      if (shopLoading) {
        timeoutId = setTimeout(() => {
          if (isMounted && !hasLoaded && !isLoadingData) {
            const finalShopId = currentShopId || currentShop?.id || fallbackShopId;
            if (finalShopId && finalShopId !== 'default') {
              loadData(finalShopId);
            } else {
              console.warn('⚠️ ClientBookingCalendar: No shop_id available, attempting to load anyway');
              loadData(null);
            }
          }
        }, 1500);
      } else {
        if (!hasLoaded && !isLoadingData) {
          loadData(effectiveShopId);
        }
      }
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (globalTimeoutId) clearTimeout(globalTimeoutId);
      isMounted = false;
      hasLoaded = false;
      isLoadingData = false;
    };
  }, [shopLoading, currentShopId, currentShop?.id, isAuthenticated, user?.id]);
    
  // Force reload vacation period after component mounts
  // This ensures we get the latest vacation period even if it was set before this component mounted
  // Try multiple times with increasing delays to catch the period if it's being set asynchronously
  useEffect(() => {
    const checkVacationPeriod = () => {
      try {
        const saved = localStorage.getItem('vacationPeriod');
        if (saved) {
          window.dispatchEvent(new CustomEvent('vacation-period-updated'));
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

  const bookingDuration = selectedServiceObj?.duration_min ?? null;

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
    setNotifyIfEarlierSlot(false);
    setShowBookingModal(true);
  };

  const handleBookingSubmit = async () => {
    if (!selectedDate || !selectedTime || !selectedService || !selectedBarber) return;
    
    // Check if products are enabled before showing upsell
    if (!areProductsEnabled) {
      // Skip upsell and directly confirm appointment
      await handleUpsellConfirm([]);
      return;
    }
    // Close booking modal and show upsell modal
    setShowBookingModal(false);
    setShowUpsellModal(true);
  };

  const handleUpsellConfirm = async (products: { productId: string; quantity: number }[]) => {
    setSelectedProducts(products);
    setIsSubmitting(true);
    
    try {
      // Get service and barber details
      const service = services.find(s => s.id === selectedService);
      const barber = staff.find(b => b.id === selectedBarber);
      
      // Verifica autenticazione
      if (!isAuthenticated || !user) {
        throw new Error('Devi essere autenticato per prenotare un appuntamento. Vai al login.');
      }

      // Verifica token
      const accessToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      if (!accessToken) {
        throw new Error('Token di autenticazione mancante. Effettua il login di nuovo.');
      }

      if (!selectedDate || !selectedTime || !selectedService || !selectedBarber) {
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

      // Optional: enable earlier-slot waitlist for this appointment
      if (notifyIfEarlierSlot) {
        try {
          const resolvedShopId = currentShop?.id || currentShopId;
          if (resolvedShopId) {
            const already = await apiService.isClientInWaitlist(clientId, savedAppointment.id);
            if (!already) {
              await apiService.joinWaitlist({
                shop_id: resolvedShopId,
                client_id: clientId,
                appointment_id: savedAppointment.id,
                staff_id: selectedBarber,
                appointment_duration_min: service?.duration_min || 60,
                notify_if_earlier: true,
                expires_at: startDateTime.toISOString(),
                notes: 'notify_if_earlier',
              });
            }
          }
        } catch (e) {
          // Failed to enable earlier slot notification
        }
      }
      
      // Save appointment data for calendar export
      setLastAppointmentData({
        service: service || null,
        barber: barber || null,
        startDateTime,
        endDateTime,
      });
      
      // Nota: La notifica in-app viene creata automaticamente dal trigger del database
      // quando viene inserito l'appuntamento (vedi sql/triggers.sql - notify_barber_on_appointment_created)
      // Non è necessario crearla manualmente qui per evitare duplicati
      
      // Play notification sound using Web Audio API
      if (barber && user) {
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
        
        // Refresh notifications count (il trigger del database ha già creato la notifica)
        refreshUnreadCount();
        
        // Emails disabilitate lato app: invio gestito da webhooks Supabase
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
      setNotifyIfEarlierSlot(false);
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
      setNotifyIfEarlierSlot(false);
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
    if (currentShop?.name) {
      locationParts.push(currentShop.name);
    }
    if (currentShop?.address) {
      locationParts.push(currentShop.address);
    }
    if (currentShop?.city) {
      locationParts.push(currentShop.city);
    }
    const location = locationParts.join(', ');

    // Build description
    const descriptionParts: string[] = [];
    descriptionParts.push(`Barbiere: ${barber.full_name}`);
    if (currentShop?.name) {
      descriptionParts.push(`Negozio: ${currentShop.name}`);
    }
    if (currentShop?.phone) {
      descriptionParts.push(`Telefono: ${currentShop.phone}`);
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

  // Verifica anche direttamente il token per essere sicuri
  const hasToken = typeof window !== 'undefined' && (
    localStorage.getItem('auth_token') || 
    sessionStorage.getItem('auth_token')
  );

  // Mostra messaggio se l'utente non è autenticato O se non c'è token
  if ((!authLoading && !isAuthenticated) || (!authLoading && !hasToken && !user)) {
    return (
      <div className="p-0 page-container-chat-style">
      <div className="w-full">
      <div className="flex flex-col space-y-8">
      <div className="space-y-8">
        <div className="text-center mb-6 md:mb-10 glass-panel">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Prenota Appuntamento</h1>
        </div>
        <div className="glass-panel max-w-2xl mx-auto">
          <div className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Autenticazione Richiesta</h2>
            <p className="text-gray-600 mb-4">
              Devi effettuare il login per prenotare un appuntamento.
            </p>
            <Button
              onClick={() => {
                window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
              }}
            >
              Vai al Login
            </Button>
          </div>
        </div>
      </div>
      </div>
      </div>
    </div>
    );
  }

  // Mostra loading se l'autenticazione è in corso
  if (authLoading) {
    return (
      <div className="p-0 page-container-chat-style">
        <div className="w-full">
        <div className="flex flex-col space-y-8">
        <div className="space-y-8">
          <div className="text-center mb-6 md:mb-10 glass-panel">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Prenota Appuntamento</h1>
            <p className="text-gray-600">Caricamento...</p>
          </div>
        </div>
        </div>
        </div>
      </div>
    );
  }

  // Get user profile for welcome message
  const userProfile = user ? getUserProfile(user) : null;
  const userName = userProfile?.full_name || user?.full_name || 'Cliente';

  return (
    <div className="p-0 page-container-chat-style">
      <div className="w-full">
      <div className="flex flex-col space-y-8">
      <div className="space-y-8">
      {/* Welcome Section */}
      <div className="text-center mb-6 md:mb-10 glass-panel">
        <div className="mb-3">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Benvenuto, {userName}! 👋
          </h2>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Prenota Appuntamento</h1>
        <p className="text-lg text-gray-700 max-w-2xl mx-auto">
          Seleziona il servizio e il barbiere per visualizzare gli orari disponibili!
        </p>
      </div>

      {/* Step 1: scelta servizio e barbiere */}
      <div className="max-w-3xl mx-auto rounded-3xl border border-white/30 shadow-2xl p-6 md:p-8 space-y-6 ring-1 ring-white/30 bg-white/50 backdrop-blur-2xl">
        <div className="space-y-2">
          <label className="block text-base font-semibold text-gray-800 flex items-center">
            <Scissors className="w-5 h-5 mr-2 text-green-600" />
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
            className="w-full px-4 py-3 border-2 border-white/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-base bg-white/80 text-gray-900 transition-all hover:border-white shadow-lg backdrop-blur touch-target"
            disabled={isLoading}
            aria-label="Seleziona servizio"
            aria-describedby="service-description"
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

        <div className="space-y-2">
          <label className="block text-base font-semibold text-gray-800 flex items-center">
            <User className="w-5 h-5 mr-2 text-green-600" />
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
            className="w-full px-4 py-3 border-2 border-white/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-base bg-white/80 text-gray-900 transition-all hover:border-white shadow-lg backdrop-blur touch-target"
            disabled={!selectedService || isLoading}
            aria-label="Seleziona barbiere"
            aria-describedby="barber-description"
          >
            <option value="">{isLoading ? 'Caricamento barbieri...' : 'Seleziona un barbiere'}</option>
            {availableBarbers.map((barber) => (
              <option key={barber.id} value={barber.id}>
                {barber.full_name}
              </option>
            ))}
          </select>
        </div>

        {bookingDuration && selectedBarber && (
          <div className="mt-2 p-4 bg-green-50/70 border border-green-200/70 rounded-xl shadow-inner backdrop-blur">
            <p className="text-sm text-green-800">
              <span className="font-semibold">Durata appuntamento:</span> {bookingDuration} minuti.
              Mostriamo solo slot con almeno questo tempo libero entro 6 mesi.
            </p>
          </div>
        )}
      </div>

      {/* Calendar View */}
      {!shopHoursLoaded ? (
        <div className="bg-white/40 border border-white/30 rounded-2xl p-6 text-center text-gray-700 shadow-lg backdrop-blur-xl">
          Caricamento orari del negozio...
        </div>
      ) : !bookingDuration || !selectedBarber ? (
        <div className="text-center py-12 text-gray-700 bg-white/40 border border-white/30 rounded-2xl shadow-lg backdrop-blur-xl">
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
              className="flex items-center space-x-2 touch-target"
              aria-label="Mese precedente"
            >
              <ChevronLeft className="w-6 h-6" aria-hidden="true" />
            </Button>
            
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
              {formatMonthYear(currentMonth)}
            </h2>
            
            <Button
              variant="ghost"
              size="lg"
              onClick={() => navigateMonth('next')}
              className="flex items-center space-x-2 touch-target"
              aria-label="Mese successivo"
            >
              <ChevronRight className="w-6 h-6" aria-hidden="true" />
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
                  role={isClickable ? "button" : undefined}
                  tabIndex={isClickable ? 0 : -1}
                  onClick={() => isClickable && handleDayClick(date)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && isClickable) {
                      e.preventDefault();
                      handleDayClick(date);
                    }
                  }}
                  aria-label={isClickable ? `Giorno ${date.getDate()} ${date.toLocaleDateString('it-IT', { month: 'long' })} - ${hasAvailability ? `${availability.available} slot disponibili` : 'Nessuno slot disponibile'}` : `Giorno ${date.getDate()} - non disponibile`}
                  aria-disabled={!isClickable}
                  className={`
                    aspect-square p-1.5 border rounded-lg transition-all overflow-hidden touch-target
                    ${isCurrentMonthDay ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'}
                    ${isTodayDate ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                    ${isClickable ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500' : 'cursor-not-allowed opacity-60'}
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
                className="flex items-center space-x-2 touch-target"
                aria-label="Torna al calendario mensile"
              >
                <ArrowLeft className="w-5 h-5" aria-hidden="true" />
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
                    className="py-3 px-4 rounded-lg text-center transition-colors bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer border border-green-200 font-medium client-time-slot touch-target focus:outline-none focus:ring-2 focus:ring-green-500"
                    aria-label={`Prenota alle ${time}`}
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
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center space-x-2 touch-target"
                  aria-label="Aggiungi appuntamento al calendario del dispositivo"
                >
                  <Calendar className="w-5 h-5" aria-hidden="true" />
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

          {/* Earlier slot waitlist */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <label className="flex items-start gap-3 cursor-pointer touch-target">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 touch-target"
                checked={notifyIfEarlierSlot}
                onChange={(e) => setNotifyIfEarlierSlot(e.target.checked)}
                aria-label="Avvisami se si libera uno slot prima"
              />
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  AVVISAMI SE SI LIBERA UNO SLOT PRIMA
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Se si libera un posto prima, ti invieremo una mail e una notifica su questa app!
                </div>
              </div>
            </label>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={() => setShowBookingModal(false)}
              className="touch-target"
              aria-label="Annulla prenotazione"
            >
              Annulla
            </Button>
            <Button
              onClick={handleBookingSubmit}
              disabled={!selectedService || !selectedBarber || isSubmitting}
              className="touch-target"
              aria-label={isSubmitting ? 'Prenotazione in corso' : 'Conferma prenotazione'}
            >
              {isSubmitting ? 'Prenotazione in corso...' : 'Conferma Prenotazione'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Product Upsell Modal - Only show if products are enabled */}
      {areProductsEnabled && (
        <ProductUpsell
          isOpen={showUpsellModal}
          onClose={handleUpsellSkip}
          onCancel={handleUpsellCancel}
          onConfirm={handleUpsellConfirm}
          isSubmitting={isSubmitting}
        />
      )}
      </div>
      </div>
      </div>
    </div>
  );
};
