import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Filter, Package, Sun, Moon, User, Clock, MapPin, Plus, Trash2 } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Select } from './ui/Select';
import { Modal } from './ui/Modal';
import { formatTime, formatDate, doesAppointmentOverlapSlot, getAppointmentSlotCount, getSlotDateTime } from '../utils/date';
import { useDailyShopHours } from '../hooks/useDailyShopHours';
import { useChairAssignment } from '../hooks/useChairAssignment';
import { useAppointments } from '../hooks/useAppointments';
import { useVacationMode } from '../hooks/useVacationMode';
import { useShop } from '../contexts/ShopContext';
import { AppointmentForm } from './AppointmentForm';
import { DeleteConfirmation } from './DeleteConfirmation';
import { apiService } from '../services/api';
import type { Appointment, Shop } from '../types';

export const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedChair, setSelectedChair] = useState('all');
  const [timePeriod, setTimePeriod] = useState<'morning' | 'afternoon'>('morning');
  const [calendarViewMode, setCalendarViewMode] = useState<'split' | 'full'>('split');
  const { shopHours, getAvailableTimeSlots, isDateOpen, getShopHoursSummary, shopHoursLoaded } = useDailyShopHours();
  const { getAssignedChairs } = useChairAssignment();
  const { appointments, createAppointment, deleteAppointment, loadAppointments } = useAppointments();
  const { isDateInVacation } = useVacationMode();
  const { currentShop } = useShop();
  const areProductsEnabled = currentShop?.products_enabled === true;

  // Mobile-specific states
  const [isMobile, setIsMobile] = useState(false);
  const [currentDay, setCurrentDay] = useState(new Date());
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showCreateAppointmentModal, setShowCreateAppointmentModal] = useState(false);

  // Appointment details modal
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showAppointmentDetails, setShowAppointmentDetails] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pre-filled appointment data when clicking on empty slot
  const [prefilledAppointmentData, setPrefilledAppointmentData] = useState<{
    date: string;
    time: string;
    staff_id?: string;
  } | null>(null);

  const getAppointmentClientLabel = (apt: Appointment): string => {
    const fromClientRecord = `${apt.clients?.first_name || ''} ${apt.clients?.last_name || ''}`.trim();
    return (apt.client_name?.trim() || fromClientRecord || 'Cliente');
  };

  const getAppointmentClientInitials = (apt: Appointment): string => {
    const label = getAppointmentClientLabel(apt);
    const parts = label.split(' ').filter(Boolean);
    const a = parts[0]?.[0] ?? '?';
    const b = parts[1]?.[0] ?? '';
    return `${a}${b}`.toUpperCase();
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowAppointmentDetails(true);
  };

  const handleEmptySlotClick = (day: Date, time: string) => {
    // Check if slot is available
    const dayTimeSlots = getTimeSlotsForDate(day, calendarViewMode === 'split' ? timePeriod : undefined);
    if (!dayTimeSlots.includes(time)) return;

    // Check if slot is already occupied
    const hasAppointment = filteredAppointments.some(apt =>
      doesAppointmentOverlapSlot(apt, day, time)
    );
    if (hasAppointment) return;

    // Get staff_id from selected chair if not 'all'
    let staffId: string | undefined;
    if (selectedChair !== 'all') {
      const chairAssignment = assignedChairs.find(chair => chair.chairId === selectedChair);
      staffId = chairAssignment?.staffId || undefined;
    }

    // Set prefilled data and open modal
    const dateString = day.toISOString().split('T')[0];
    setPrefilledAppointmentData({
      date: dateString,
      time: time,
      staff_id: staffId,
    });
    setShowCreateAppointmentModal(true);
  };

  const getWeekDays = () => {
    if (!shopHoursLoaded) return [];
    const start = new Date(currentDate);
    start.setDate(currentDate.getDate() - currentDate.getDay() + 1); // Monday
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      return day;
    }).filter(day => isDateOpen(day) && !isDateInVacation(day)); // Mostra solo giorni aperti e NON in ferie
  };

  const weekDays = getWeekDays();

  // Load calendar view mode from shop
  useEffect(() => {
    const loadCalendarViewMode = async () => {
      try {
        const shop = await apiService.getShop();
        setCalendarViewMode(shop.calendar_view_mode ?? 'split');
      } catch (error) {
        console.error('Error loading calendar view mode:', error);
        // Fallback to local storage or default
        const localShop = localStorage.getItem('localShopData');
        if (localShop) {
          try {
            const parsed: Shop = JSON.parse(localShop);
            setCalendarViewMode(parsed.calendar_view_mode ?? 'split');
          } catch (e) {
            // Use default
            setCalendarViewMode('split');
          }
        }
      }
    };

    loadCalendarViewMode();

    // Listen for calendar view mode updates
    const handleCalendarViewModeUpdate = (event: CustomEvent) => {
      setCalendarViewMode(event.detail);
    };

    window.addEventListener('calendar-view-mode-updated', handleCalendarViewModeUpdate as EventListener);

    return () => {
      window.removeEventListener('calendar-view-mode-updated', handleCalendarViewModeUpdate as EventListener);
    };
  }, []);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Mobile navigation functions
  const navigateDay = (direction: 'prev' | 'next') => {
    let newDay = new Date(currentDay);
    let attempts = 0;
    const maxAttempts = 30; // Evita loop infiniti

    do {
      if (direction === 'prev') {
        newDay.setDate(newDay.getDate() - 1);
      } else {
        newDay.setDate(newDay.getDate() + 1);
      }
      attempts++;
    } while (attempts < maxAttempts && (!isDateOpen(newDay) || isDateInVacation(newDay)));

    if (attempts < maxAttempts) {
      setCurrentDay(newDay);
    }
  };

  // Check if we can navigate to previous day (not before today)
  const canNavigatePrev = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return currentDay > today;
  };

  // Get appointments for a specific day
  const getAppointmentsForDay = (date: Date) => {
    return filteredAppointments.filter(apt => {
      const aptDate = new Date(apt.start_at);
      return aptDate.toDateString() === date.toDateString();
    });
  };

  // Filter appointments by time period for mobile
  const getFilteredAppointmentsForDay = (date: Date, period: 'morning' | 'afternoon') => {
    const dayAppointments = getAppointmentsForDay(date);
    return dayAppointments.filter(apt => {
      const aptTime = new Date(apt.start_at);
      const hours = aptTime.getHours();
      if (period === 'morning') {
        return hours < 13; // Before 1 PM
      } else {
        return hours >= 13; // From 1 PM onwards
      }
    });
  };

  // Usa gli orari del negozio per generare i time slots filtrati per periodo
  const getTimeSlotsForDate = (date: Date, period?: 'morning' | 'afternoon') => {
    if (!shopHoursLoaded) return [];
    const dayOfWeek = date.getDay();
    const dayHours = shopHours[dayOfWeek];

    if (!dayHours.isOpen || dayHours.timeSlots.length === 0) return [];

    const filteredSlots: string[] = [];

    // Se calendar_view_mode è 'full', mostra tutti gli slot senza filtrare per periodo
    if (calendarViewMode === 'full') {
      dayHours.timeSlots.forEach((slot) => {
        const [startHours, startMinutes] = slot.start.split(':').map(Number);
        const [endHours, endMinutes] = slot.end.split(':').map(Number);
        const startTime = startHours * 60 + startMinutes;
        const endTime = endHours * 60 + endMinutes;

        // Genera tutti gli slot per questo timeSlot
        let currentTime = startTime;
        const slotDurationMinutes = 15;

        while (currentTime + slotDurationMinutes <= endTime) {
          const hours = Math.floor(currentTime / 60);
          const minutes = currentTime % 60;
          const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          filteredSlots.push(timeString);
          currentTime += slotDurationMinutes;
        }
      });
    } else {
      // Modalità 'split': filtra per periodo mattina/pomeriggio
      dayHours.timeSlots.forEach((slot, index) => {
        const [startHours, startMinutes] = slot.start.split(':').map(Number);
        const [endHours, endMinutes] = slot.end.split(':').map(Number);
        const startTime = startHours * 60 + startMinutes;
        const endTime = endHours * 60 + endMinutes;

        // Determina se questo slot appartiene al periodo mattina o pomeriggio
        // Mattina: primo slot (index 0) o slot che inizia prima delle 13:00
        // Pomeriggio: secondo slot (index 1) o slot che inizia dalle 13:00 in poi
        const isMorningSlot = index === 0 && startTime < 13 * 60;
        const isAfternoonSlot = index > 0 || startTime >= 13 * 60;

        if ((period === 'morning' && isMorningSlot) || (period === 'afternoon' && isAfternoonSlot)) {
          // Genera gli slot per questo timeSlot
          let currentTime = startTime;
          const slotDurationMinutes = 15;

          while (currentTime + slotDurationMinutes <= endTime) {
            const hours = Math.floor(currentTime / 60);
            const minutes = currentTime % 60;
            const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            filteredSlots.push(timeString);
            currentTime += slotDurationMinutes;
          }
        }
      });
    }

    return filteredSlots.sort();
  };

  // Calcola l'insieme degli slot per l'intera settimana in base al turno selezionato
  // Evita che la griglia si limiti agli slot del primo giorno (che potrebbe non avere orario continuato)
  const getWeekTimeSlots = (period?: 'morning' | 'afternoon') => {
    const all = weekDays
      .flatMap((d) => getTimeSlotsForDate(d, period))
      .filter(Boolean);
    // Unione + ordinamento HH:MM
    const unique = Array.from(new Set(all));
    unique.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return unique;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      scheduled: 'bg-yellow-100 border-yellow-400 text-green-800',
      confirmed: 'bg-green-100 border-green-400 text-green-800',
      in_progress: 'bg-green-100 border-green-300 text-green-800',
      completed: 'bg-green-100 border-green-300 text-green-800',
      cancelled: 'bg-red-100 border-red-300 text-red-800',
      no_show: 'bg-red-100 border-red-300 text-red-800',
    } as const;
    return colors[status as keyof typeof colors] || colors.scheduled;
  };

  // Helper function to find appointment that starts at a specific slot
  const getAppointmentAtSlot = (day: Date, time: string): Appointment | null => {
    const slotStart = getSlotDateTime(day, time);
    return filteredAppointments.find(apt => {
      if (apt.status === 'cancelled') return false;
      const aptStart = new Date(apt.start_at);
      const aptDate = new Date(aptStart.getFullYear(), aptStart.getMonth(), aptStart.getDate());
      const slotDate = new Date(day.getFullYear(), day.getMonth(), day.getDate());

      if (aptDate.getTime() !== slotDate.getTime()) return false;

      // Check if appointment starts exactly at this slot
      return aptStart.getHours() === slotStart.getHours() &&
        aptStart.getMinutes() === slotStart.getMinutes();
    }) || null;
  };


  const assignedChairs = getAssignedChairs();

  const filteredAppointments = appointments.filter(apt => {
    // Escludi appuntamenti cancellati - liberano il posto per altri utenti
    if (apt.status === 'cancelled') return false;
    const chairMatch = selectedChair === 'all' || apt.staff?.chair_id === selectedChair;
    return chairMatch;
  });

  const glassCard = 'bg-white/60 backdrop-blur-xl border border-white/30 shadow-xl';

  return (
    <div className="p-0 page-container-chat-style">
      <div className="w-full">
        <div className="flex flex-col space-y-6">
          <div className="space-y-6">
            {/* Header - Both Mobile and Desktop */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Calendario</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Orari configurati per ogni giorno della settimana
                </p>
              </div>
              {!shopHoursLoaded && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-600 mt-4 md:mt-0 md:ml-4">
                  Caricamento orari del negozio...
                </div>
              )}
              {/* Desktop Controls */}
              <div className="hidden md:flex items-center space-x-4">
                <Select
                  value={selectedChair}
                  onChange={(e) => setSelectedChair(e.target.value)}
                  options={[
                    { value: 'all', label: 'Tutte le poltrone' },
                    ...assignedChairs.map(chair => ({
                      value: chair.chairId,
                      label: `${chair.chairName} - ${chair.staffName}`
                    }))
                  ]}
                />

                {/* Controlli Mattina/Pomeriggio - Solo se modalità split */}
                {calendarViewMode === 'split' && (
                  <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                    <Button
                      variant={timePeriod === 'morning' ? 'primary' : 'ghost'}
                      size="sm"
                      onClick={() => setTimePeriod('morning')}
                      className="flex items-center space-x-1 touch-target"
                      aria-label="Mostra appuntamenti del mattino"
                      aria-pressed={timePeriod === 'morning'}
                    >
                      <Sun className="w-4 h-4" aria-hidden="true" />
                      <span>Mattina</span>
                    </Button>
                    <Button
                      variant={timePeriod === 'afternoon' ? 'primary' : 'ghost'}
                      size="sm"
                      onClick={() => setTimePeriod('afternoon')}
                      className="flex items-center space-x-1 touch-target"
                      aria-label="Mostra appuntamenti del pomeriggio"
                      aria-pressed={timePeriod === 'afternoon'}
                    >
                      <Moon className="w-4 h-4" aria-hidden="true" />
                      <span>Pomeriggio</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Desktop Calendar Grid */}
            <div className="hidden md:block">

              <Card className={glassCard}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newDate = new Date(currentDate);
                        newDate.setDate(currentDate.getDate() - 7);
                        setCurrentDate(newDate);
                      }}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {weekDays.length > 0 ? `${formatDate(weekDays[0])} - ${formatDate(weekDays[weekDays.length - 1])}` : 'Nessun giorno aperto'}
                    </h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newDate = new Date(currentDate);
                        newDate.setDate(currentDate.getDate() + 7);
                        setCurrentDate(newDate);
                      }}
                      className="touch-target"
                      aria-label="Settimana successiva"
                    >
                      <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {currentDate.toLocaleDateString('it-IT', {
                      month: 'long',
                      year: 'numeric'
                    }).charAt(0).toUpperCase() + currentDate.toLocaleDateString('it-IT', {
                      month: 'long',
                      year: 'numeric'
                    }).slice(1)}
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="overflow-x-auto">
                  <div className="min-w-full">
                    {/* Week Header */}
                    <div className={`grid gap-1 mb-4 overflow-hidden`} style={{ gridTemplateColumns: `60px repeat(${weekDays.length}, minmax(0, 1fr))` }}>
                      <div className="p-2 text-sm font-medium text-gray-600">Orario</div>
                      {weekDays.map((day, index) => (
                        <div
                          key={index}
                          className="p-2 text-center border-b border-gray-200"
                        >
                          <div className="text-sm text-gray-600">
                            {day.toLocaleDateString('it-IT', { weekday: 'short' })}
                          </div>
                          <div className="text-lg font-semibold text-gray-900">
                            {day.getDate()}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Time Slots */}
                    <div className="grid gap-1 overflow-hidden" style={{ gridTemplateColumns: `60px repeat(${weekDays.length}, minmax(0, 1fr))` }}>
                      {/* Usa l'unione degli slot della settimana per costruire la griglia */}
                      {(() => {
                        const gridTimeSlots = getWeekTimeSlots(calendarViewMode === 'split' ? timePeriod : undefined);
                        return gridTimeSlots.map((time) => (
                          <React.Fragment key={time}>
                            <div className="p-2 text-right text-sm text-gray-600 border-r border-gray-200">
                              {time}
                            </div>
                            {weekDays.map((day, dayIndex) => {
                              const dayTimeSlots = getTimeSlotsForDate(day, calendarViewMode === 'split' ? timePeriod : undefined);
                              const isTimeSlotAvailable = dayTimeSlots.includes(time);
                              const appointmentAtSlot = getAppointmentAtSlot(day, time);
                              const slotCount = appointmentAtSlot ? getAppointmentSlotCount(appointmentAtSlot) : 0;

                              return (
                                <div
                                  key={`${time}-${dayIndex}`}
                                  role={isTimeSlotAvailable ? "button" : undefined}
                                  tabIndex={isTimeSlotAvailable ? 0 : -1}
                                  aria-label={isTimeSlotAvailable ? `Slot disponibile ${time} del ${day.toLocaleDateString('it-IT')}` : `Slot non disponibile ${time}`}
                                  aria-disabled={!isTimeSlotAvailable}
                                  className={`calendar-time-slot min-h-[60px] max-h-[60px] p-1 border border-gray-100 transition-colors relative touch-target ${appointmentAtSlot ? 'overflow-visible' : 'overflow-hidden'
                                    } ${isTimeSlotAvailable
                                      ? 'hover:bg-gray-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500'
                                      : 'bg-gray-200 text-gray-600 cursor-not-allowed'
                                    }`}
                                  onClick={(e) => {
                                    // Only handle click if clicking on empty space (not on appointment)
                                    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.appointment-block') === null) {
                                      const hasAppointment = filteredAppointments.some(apt =>
                                        doesAppointmentOverlapSlot(apt, day, time)
                                      );
                                      if (!hasAppointment && isTimeSlotAvailable) {
                                        handleEmptySlotClick(day, time);
                                      }
                                    }
                                  }}
                                >
                                  {/* Render appointment only if it starts at this slot */}
                                  {appointmentAtSlot && (
                                    <div
                                      role="button"
                                      tabIndex={0}
                                      aria-label={`Appuntamento con ${getAppointmentClientLabel(appointmentAtSlot)} alle ${formatTime(appointmentAtSlot.start_at)}`}
                                      className={`appointment-block rounded text-xs border w-full ${getStatusColor(appointmentAtSlot.status || 'scheduled')} cursor-pointer hover:opacity-90 transition-opacity z-10 touch-target focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                      style={{
                                        height: `${slotCount * 46}px`,
                                        minHeight: `${slotCount * 46}px`,
                                        maxHeight: `${slotCount * 46}px`,
                                      }}
                                      draggable
                                      onDragStart={(e) => e.dataTransfer.setData('appointmentId', appointmentAtSlot.id || '')}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAppointmentClick(appointmentAtSlot);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleAppointmentClick(appointmentAtSlot);
                                        }
                                      }}
                                      title={`${getAppointmentClientLabel(appointmentAtSlot)} - ${appointmentAtSlot.services?.name || 'Servizio'} - ${appointmentAtSlot.staff?.full_name}`}
                                    >
                                      <div className="font-medium truncate whitespace-nowrap overflow-hidden text-ellipsis">
                                        {getAppointmentClientLabel(appointmentAtSlot)}
                                      </div>
                                      <div className="text-xs text-gray-600 mt-0.5 truncate">
                                        {appointmentAtSlot.services?.name || 'Servizio'}
                                      </div>
                                      {areProductsEnabled && appointmentAtSlot.products && appointmentAtSlot.products.length > 0 && (
                                        <div className="text-xs text-orange-700 mt-0.5 truncate flex items-center gap-1">
                                          <Package className="w-3 h-3 flex-shrink-0" />
                                          <span>{appointmentAtSlot.products.length} prodotto{appointmentAtSlot.products.length > 1 ? 'i' : ''}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Testo "Chiuso" per slot non disponibili */}
                                  {!isTimeSlotAvailable && !appointmentAtSlot && !isDateInVacation(day) && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                                      <span className="text-[10px] text-gray-400 font-medium opacity-75">Chiuso</span>
                                    </div>
                                  )}

                                  {/* Overlay per giorni in ferie */}
                                  {isDateInVacation(day) && (
                                    <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center z-20 pointer-events-none">
                                      <span className="text-red-600 font-bold text-sm transform -rotate-45">
                                        CHIUSO PER FERIE
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </React.Fragment>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Mobile Optimized View */}
            {isMobile && (
              <div className="md:hidden space-y-6">
                {/* Day Navigation */}
                <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border p-4">
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => navigateDay('prev')}
                    disabled={!canNavigatePrev()}
                    className="flex items-center space-x-2"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </Button>

                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">
                      {currentDay.toLocaleDateString('it-IT', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long'
                      })}
                    </div>
                    {currentDay.toDateString() === new Date().toDateString() && (
                      <div className="text-sm text-blue-600 font-medium">Oggi</div>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => navigateDay('next')}
                    className="flex items-center space-x-2 touch-target"
                    aria-label="Giorno successivo"
                  >
                    <ChevronRight className="w-6 h-6" aria-hidden="true" />
                  </Button>
                </div>

                {/* Mobile Filters */}
                <div className="space-y-4">
                  {/* Morning/Afternoon Toggle - Solo se modalità split */}
                  {calendarViewMode === 'split' && (
                    <div className="flex items-center justify-center space-x-2 bg-gray-100 rounded-lg p-1">
                      <Button
                        variant={timePeriod === 'morning' ? 'primary' : 'ghost'}
                        size="lg"
                        onClick={() => setTimePeriod('morning')}
                        className="flex items-center space-x-2 flex-1 touch-target"
                        aria-label="Mostra appuntamenti del mattino"
                        aria-pressed={timePeriod === 'morning'}
                      >
                        <Sun className="w-5 h-5" aria-hidden="true" />
                        <span>Mattina</span>
                      </Button>
                      <Button
                        variant={timePeriod === 'afternoon' ? 'primary' : 'ghost'}
                        size="lg"
                        onClick={() => setTimePeriod('afternoon')}
                        className="flex items-center space-x-2 flex-1 touch-target"
                        aria-label="Mostra appuntamenti del pomeriggio"
                        aria-pressed={timePeriod === 'afternoon'}
                      >
                        <Moon className="w-5 h-5" aria-hidden="true" />
                        <span>Pomeriggio</span>
                      </Button>
                    </div>
                  )}

                  {/* Chair Filter */}
                  <div className="flex items-center justify-between">
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={() => setShowMobileFilters(!showMobileFilters)}
                      className="flex items-center space-x-2"
                    >
                      <Filter className="w-4 h-4" />
                      <span>Filtri</span>
                    </Button>

                    {selectedChair !== 'all' && (
                      <Badge variant="info">
                        {assignedChairs.find(chair => chair.chairId === selectedChair)?.chairName || 'Poltrona'}
                      </Badge>
                    )}
                  </div>

                  {/* Expanded Filters */}
                  {showMobileFilters && (
                    <Card className={`p-4 ${glassCard}`}>
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">
                          Poltrona
                        </label>
                        <select
                          value={selectedChair}
                          onChange={(e) => setSelectedChair(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="all">Tutte le poltrone</option>
                          {assignedChairs.map(chair => (
                            <option key={chair.chairId} value={chair.chairId}>
                              {chair.chairName} - {chair.staffName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </Card>
                  )}
                </div>

                {/* Add Appointment Button */}
                <div className="flex justify-center">
                  <Button
                    onClick={() => setShowCreateAppointmentModal(true)}
                    className="flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Aggiungi Appuntamento</span>
                  </Button>
                </div>

                {/* Appointments List */}
                <div className="space-y-3">
                  {isDateInVacation(currentDay) ? (
                    <Card className={`p-8 text-center bg-red-50 border-red-300 ${glassCard}`}>
                      <div className="text-red-600">
                        <Clock className="w-12 h-12 mx-auto mb-3" />
                        <p className="text-lg font-bold">CHIUSO PER FERIE</p>
                      </div>
                    </Card>
                  ) : isDateOpen(currentDay) ? (
                    (calendarViewMode === 'full'
                      ? getAppointmentsForDay(currentDay)
                      : getFilteredAppointmentsForDay(currentDay, timePeriod)
                    ).length > 0 ? (
                      (calendarViewMode === 'full'
                        ? getAppointmentsForDay(currentDay)
                        : getFilteredAppointmentsForDay(currentDay, timePeriod)
                      ).map((appointment) => (
                        <Card
                          key={appointment.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`Appuntamento con ${getAppointmentClientLabel(appointment)} alle ${formatTime(appointment.start_at)}`}
                          className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${glassCard} touch-target focus:outline-none focus:ring-2 focus:ring-blue-500`}
                          onClick={() => handleAppointmentClick(appointment)}
                          onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleAppointmentClick(appointment);
                            }
                          }}
                        >
                          <div className="space-y-3">
                            {/* Header with time and status */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Clock className="w-4 h-4 text-gray-500" />
                                <span className="font-semibold text-gray-900">
                                  {formatTime(appointment.start_at)}
                                </span>
                              </div>
                              <Badge variant="info">{appointment.status}</Badge>
                            </div>

                            {/* Client Info */}
                            <div className="flex items-center space-x-3">
                              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                <span className="text-white font-semibold text-sm">
                                  {getAppointmentClientInitials(appointment)}
                                </span>
                              </div>
                              <div className="flex-1">
                                <h3 className="text-gray-900 font-medium text-lg">
                                  {getAppointmentClientLabel(appointment)}
                                </h3>
                                <div className="flex items-center space-x-1 text-gray-600 text-sm">
                                  <User className="w-3 h-3" />
                                  <span>{appointment.staff?.full_name}</span>
                                </div>
                              </div>
                            </div>

                            {/* Service and Products */}
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <MapPin className="w-4 h-4 text-gray-500" />
                                <span className="text-gray-700 font-medium">
                                  {appointment.services?.name || 'Servizio'}
                                </span>
                              </div>

                              {areProductsEnabled && appointment.products && appointment.products.length > 0 && (
                                <div className="flex items-center space-x-2">
                                  <Package className="w-4 h-4 text-orange-500" />
                                  <span className="text-orange-700 text-sm font-medium">
                                    {appointment.products.length} prodotto{appointment.products.length > 1 ? 'i' : ''} da preparare
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Notes if any */}
                            {appointment.notes && (
                              <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-gray-700 text-sm">{appointment.notes}</p>
                              </div>
                            )}
                          </div>
                        </Card>
                      ))
                    ) : (
                      <Card className={`p-8 text-center ${glassCard}`}>
                        <div className="text-gray-500">
                          <Clock className="w-12 h-12 mx-auto mb-3" />
                          <p className="text-lg font-medium">Nessun appuntamento</p>
                          <p className="text-sm">per {currentDay.toLocaleDateString('it-IT')}</p>
                        </div>
                      </Card>
                    )
                  ) : (
                    <Card className={`p-8 text-center ${glassCard}`}>
                      <div className="text-gray-500">
                        <Clock className="w-12 h-12 mx-auto mb-3" />
                        <p className="text-lg font-medium">Negozio chiuso</p>
                        <p className="text-sm">in questa data</p>
                      </div>
                    </Card>
                  )}
                </div>
              </div>
            )}

            {/* Create Appointment Modal */}
            <AppointmentForm
              isOpen={showCreateAppointmentModal}
              onClose={() => {
                setShowCreateAppointmentModal(false);
                setPrefilledAppointmentData(null);
              }}
              onSave={async (data) => {
                // Handle appointment creation
                try {
                  await createAppointment(data as any);
                  // Force reload appointments to update the calendar
                  await loadAppointments();
                  setShowCreateAppointmentModal(false);
                  setPrefilledAppointmentData(null);
                } catch (error) {
                  console.error('Error creating appointment:', error);
                  alert('Errore durante la creazione dell\'appuntamento');
                }
              }}
              appointment={null}
              prefilledData={prefilledAppointmentData || undefined}
            />

            {/* Delete Confirmation Modal */}
            <DeleteConfirmation
              isOpen={showDeleteConfirmation}
              onClose={() => {
                setShowDeleteConfirmation(false);
                // Reopen details modal if user cancels
                if (selectedAppointment) {
                  setTimeout(() => {
                    setShowAppointmentDetails(true);
                  }, 100);
                }
              }}
              onConfirm={async () => {
                if (!selectedAppointment?.id) return;

                setIsDeleting(true);
                try {
                  await deleteAppointment(selectedAppointment.id);
                  setShowDeleteConfirmation(false);
                  setShowAppointmentDetails(false);
                  setSelectedAppointment(null);
                } catch (error) {
                  console.error('Error deleting appointment:', error);
                  alert('Errore durante l\'eliminazione dell\'appuntamento');
                } finally {
                  setIsDeleting(false);
                }
              }}
              title="Elimina Appuntamento"
              message="Sei sicuro di voler eliminare questo appuntamento? Questa azione non può essere annullata."
              itemName={selectedAppointment ? `${getAppointmentClientLabel(selectedAppointment)} - ${formatTime(selectedAppointment.start_at)}` : ''}
              isLoading={isDeleting}
            />

            {/* Appointment Details Modal */}
            <Modal
              isOpen={showAppointmentDetails && !showDeleteConfirmation}
              onClose={() => {
                setShowAppointmentDetails(false);
                setSelectedAppointment(null);
              }}
              title="Dettagli Appuntamento"
            >
              {selectedAppointment && (
                <div className="space-y-6">
                  {/* Unified Card with all details */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
                    {/* Client Info */}
                    <div className="flex items-center space-x-4 pb-4 border-b border-gray-200">
                      <div className="w-16 h-16 bg-gradient-to-br from-green-600 to-green-800 rounded-full flex items-center justify-center">
                        <span className="text-yellow-300 font-bold text-xl">
                          {getAppointmentClientInitials(selectedAppointment)}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">
                          {getAppointmentClientLabel(selectedAppointment)}
                        </h3>
                        {selectedAppointment.clients?.phone_e164 ? (
                          <p className="text-gray-600">{selectedAppointment.clients?.phone_e164}</p>
                        ) : (
                          <p className="text-gray-500 text-sm">Cliente senza account</p>
                        )}
                      </div>
                    </div>

                    {/* Appointment Details */}
                    <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-200">
                      <div>
                        <p className="text-sm text-gray-600 font-medium mb-1">Data</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {new Date(selectedAppointment.start_at).toLocaleDateString('it-IT', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 font-medium mb-1">Orario</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {formatTime(selectedAppointment.start_at)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 pb-4 border-b border-gray-200">
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-600">Servizio</span>
                        <span className="font-medium text-gray-900">{selectedAppointment.services?.name || 'Non specificato'}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-600">Barbiere</span>
                        <span className="font-medium text-gray-900">{selectedAppointment.staff?.full_name}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-600">Durata</span>
                        <span className="font-medium text-gray-900">{selectedAppointment.services?.duration_min || 0} minuti</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-600">Stato</span>
                        <Badge variant="info">{selectedAppointment.status}</Badge>
                      </div>
                    </div>

                    {/* Products */}
                    {areProductsEnabled && selectedAppointment.products && selectedAppointment.products.length > 0 && (
                      <div className="pb-4 border-b border-gray-200">
                        <p className="text-sm text-gray-700 font-semibold mb-3 flex items-center gap-2">
                          <Package className="w-4 h-4 text-orange-600" />
                          Prodotti da preparare
                        </p>
                        <div className="space-y-2">
                          {selectedAppointment.products.map((product: any, index: number) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-orange-50 rounded-md">
                              <span className="text-gray-900 font-medium">
                                {product.productName || product.name || 'Prodotto'}
                              </span>
                              {product.quantity > 1 && (
                                <span className="text-sm text-gray-600 bg-white px-2 py-1 rounded">
                                  Quantità: {product.quantity}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {selectedAppointment.notes && (
                      <div>
                        <p className="text-sm text-gray-700 font-semibold mb-2">Note</p>
                        <p className="text-gray-700 bg-gray-50 p-3 rounded-md">{selectedAppointment.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-3 pt-4">
                    <Button
                      variant="secondary"
                      onClick={() => setShowAppointmentDetails(false)}
                      className="flex-1 touch-target"
                      aria-label="Chiudi dettagli appuntamento"
                    >
                      Chiudi
                    </Button>
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowAppointmentDetails(false);
                        // Small delay to ensure the details modal closes before opening confirmation
                        setTimeout(() => {
                          setShowDeleteConfirmation(true);
                        }, 100);
                      }}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white border-red-600 touch-target"
                      aria-label="Elimina appuntamento"
                    >
                      <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />
                      Elimina
                    </Button>
                  </div>
                </div>
              )}
            </Modal>

          </div>
        </div>
      </div>
    </div>
  );
};