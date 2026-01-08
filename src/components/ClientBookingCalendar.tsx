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
import { useTheme } from '../contexts/ThemeContext';
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
  const { palette } = useTheme();
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
  const [selectedProducts, setSelectedProducts] = useState<{ productId: string; quantity: number; productName?: string; productPrice?: number }[]>([]);
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

    // Check if the shop is closed on this day - this is the key check!
    if (!isDateOpen(date)) {
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
        // Don't allow clicking on closed days or vacation days
        if (shopHoursLoaded && !isDateInVacation(clickedDate) && isDateOpen(clickedDate)) {
          setSelectedDayForDetail(date);
          setCurrentView('day_detail');
        }
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

  const handleUpsellConfirm = async (products: { productId: string; quantity: number; productName?: string; productPrice?: number }[]) => {
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
    <div className="p-0 page-container-chat-style pb-52">
      <div className="w-full">
        <div className="flex flex-col space-y-8">
          <div className="space-y-8">
            {/* Header / Welcome Section */}
            {/* Header / Welcome Section */}
            <div
              className="relative overflow-hidden rounded-3xl shadow-xl mb-8 p-6 md:p-10 transition-all duration-300"
              style={{
                background: `linear-gradient(135deg, ${palette.colors.primaryStrong} 0%, ${palette.colors.primary} 100%)`,
                color: palette.colors.accent
              }}
            >
              <div className="relative z-10">
                <h1
                  className="text-2xl md:text-3xl font-bold mb-2"
                  style={{ color: palette.colors.accent }}
                >
                  Ciao, {userName}!
                </h1>
                <p
                  className="text-lg max-w-xl opacity-90"
                  style={{ color: palette.colors.accentSoft }}
                >
                  È il momento di prenderti cura di te. Prenota il tuo prossimo taglio.
                </p>
              </div>

              {/* Decorative elements */}
              <div
                className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 rounded-full blur-3xl opacity-20"
                style={{ background: palette.colors.accent }}
              ></div>
              <div
                className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 rounded-full blur-3xl opacity-20"
                style={{ background: palette.colors.primary }}
              ></div>
            </div>

            {/* Step 1: scelta servizio e barbiere */}
            <div className="max-w-3xl mx-auto space-y-8">

              {/* Service Selection - Dropdown (Reverted as requested) */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 px-1">
                  <Scissors className="w-5 h-5 text-gray-700" />
                  <h3 className="text-lg font-semibold text-gray-900">Seleziona Servizio</h3>
                </div>

                <div className="relative">
                  <select
                    value={selectedService}
                    onChange={(e) => {
                      setSelectedService(e.target.value);
                      setSelectedDate(null);
                      setSelectedTime('');
                      setCurrentView('monthly');
                    }}
                    className="w-full appearance-none bg-white border-2 border-gray-200 text-gray-900 text-lg rounded-xl px-4 py-4 pr-8 leading-tight focus:outline-none focus:bg-white focus:border-gray-500 focus:ring-4 focus:ring-gray-100 transition-all shadow-sm cursor-pointer"
                    disabled={isLoading}
                  >
                    <option value="" className="text-gray-500">
                      {isLoading ? 'Caricamento servizi...' : 'Scegli il trattamento...'}
                    </option>
                    {services
                      .filter((service) => service.active)
                      .map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name} ({service.duration_min} min) - €{(service.price_cents || 0) / 100}
                        </option>
                      ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-600">
                    <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Barber Selection - Horizontal Scroll (Kept as requested) */}
              <div className={`space-y-4 transition-all duration-300 ${!selectedService ? 'opacity-50 grayscale pointer-events-none' : 'opacity-100'}`}>
                <div className="flex items-center space-x-2 px-1">
                  <User className="w-5 h-5 text-gray-700" />
                  <h3 className="text-lg font-semibold text-gray-900">Scegli Barbiere</h3>
                </div>

                <div className="flex space-x-4 overflow-x-auto pb-4 px-1 scrollbar-hide -mx-4 md:mx-0 px-4 md:px-0">
                  {isLoading ? (
                    // Loading skeletons
                    [1, 2, 3].map((i) => (
                      <div key={i} className="flex-shrink-0 w-20 flex flex-col items-center space-y-2">
                        <div className="w-16 h-16 rounded-full bg-gray-200 animate-pulse"></div>
                        <div className="w-12 h-3 bg-gray-200 rounded animate-pulse"></div>
                      </div>
                    ))
                  ) : (
                    availableBarbers.map((barber) => {
                      const isSelected = selectedBarber === barber.id;
                      const initials = barber.full_name
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2);

                      return (
                        <button
                          key={barber.id}
                          onClick={() => {
                            setSelectedBarber(barber.id);
                            setSelectedDate(null);
                            setSelectedTime('');
                            setCurrentView('monthly');
                          }}
                          className="flex-shrink-0 flex flex-col items-center space-y-2 group touch-target focus:outline-none"
                        >
                          <div className={`
                            relative w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center overflow-hidden transition-all duration-200 border-2
                            ${isSelected
                              ? 'border-gray-900 ring-4 ring-gray-100 scale-105 shadow-xl'
                              : 'border-transparent bg-white shadow-md hover:scale-105'}
                          `}>
                            {barber.profile_photo_url ? (
                              <img
                                src={barber.profile_photo_url}
                                alt={barber.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className={`text-xl font-bold ${isSelected ? 'text-gray-900' : 'text-gray-400'}`}>
                                {initials}
                              </span>
                            )}
                            {isSelected && (
                              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                <Check className="w-6 h-6 text-white drop-shadow-md" strokeWidth={3} />
                              </div>
                            )}
                          </div>
                          <span className={`text-sm font-medium whitespace-nowrap px-3 py-1 rounded-full transition-colors ${isSelected ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-600 bg-white/60'
                            }`}>
                            {barber.full_name.split(' ')[0]}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {bookingDuration && selectedBarber && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mt-0.5">
                      <Check className="h-5 w-5 text-green-600" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-gray-900">Ottima scelta!</h3>
                      <div className="mt-1 text-sm text-gray-600">
                        <p>
                          Hai selezionato <strong>{services.find(s => s.id === selectedService)?.name}</strong> con <strong>{staff.find(s => s.id === selectedBarber)?.full_name}</strong>.
                        </p>
                        <p className="mt-1">
                          {/* Additional content for the paragraph can go here */}
                        </p>
                      </div>
                    </div>
                  </div>
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
                    // A day is clickable only if: it's in current month, has availability, is today or future, shop is open, and not in vacation
                    const isShopOpen = shopHoursLoaded && isDateOpen(date);
                    const isNotInVacation = !isDateInVacation(date);
                    const isClickable = isCurrentMonthDay && hasAvailability && clickedDate >= today && isShopOpen && isNotInVacation;

                    // Calculate availability level (0-3) for traffic light indicators
                    const percentage = availability.total > 0 ? availability.available / availability.total : 0;

                    // 1 (Low/Full) = < 33% free slots (includes 0%)
                    // 2 (Medium) = 33-66% free slots
                    // 3 (High) = > 66% free slots
                    // Change: 0% availability should show as Red (Level 1) not Grey (Level 0)
                    const signalLevel = percentage < 0.33 ? 1
                      : percentage < 0.66 ? 2
                        : 3;

                    const isOpenAndAvailable = isShopOpen && isNotInVacation;

                    // Se il giorno è chiuso o in ferie, renderizza una cella vuota/invisibile
                    if (!isOpenAndAvailable) {
                      return (
                        <div
                          key={index}
                          className="aspect-square p-1.5 border border-transparent rounded-lg opacity-20 bg-gray-50 pointer-events-none"
                          aria-hidden="true"
                        >
                          {/* Cella vuota per mantenere la griglia allineata */}
                        </div>
                      );
                    }

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
                    relative flex flex-col items-center justify-between
                    min-h-[90px] w-full
                    p-1 sm:p-1.5 
                    border rounded-lg transition-all overflow-hidden touch-target
                    ${isCurrentMonthDay ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'}
                    ${isTodayDate ? 'ring-2 ring-blue-500 ring-offset-1 z-10' : ''}
                    ${isClickable ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500' : 'cursor-not-allowed opacity-60'}
                  `}
                      >
                        {/* Day Number */}
                        <div className={`
                    text-sm sm:text-base font-medium mt-1
                    ${isCurrentMonthDay ? (isTodayDate ? 'text-blue-600' : 'text-gray-900') : 'text-gray-400'}
                  `}>
                          {date.getDate()}
                        </div>

                        {/* Availability Indicators - Fixed 3 bars (Traffic Light) */}
                        {isOpenAndAvailable && availability.total > 0 && (
                          <div className="flex-shrink-0 flex gap-0.5 sm:gap-1 h-1.5 sm:h-2 w-full px-0.5 sm:px-1 mb-1 sm:mb-2">
                            {[1, 2, 3].map((level) => {
                              // Determine color based on current signalLevel
                              let colorClass = 'bg-gray-200';
                              if (level <= signalLevel) {
                                if (signalLevel === 1) colorClass = 'bg-red-400';
                                else if (signalLevel === 2) colorClass = 'bg-yellow-400';
                                else colorClass = 'bg-green-500';
                              }

                              return (
                                <div
                                  key={level}
                                  className={`flex-1 rounded-full transition-colors ${colorClass}`}
                                />
                              );
                            })}
                          </div>
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
                    <div className="text-center py-12 text-gray-500 bg-gray-50 border border-gray-200 rounded-lg aurora-modal-bg-white">
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
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 aurora-modal-bg-white">
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

          {/* Physical Spacer to force scroll past bottom nav */}
          <div className="h-32 w-full flex-shrink-0" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
};
