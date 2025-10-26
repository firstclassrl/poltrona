import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Filter, Package, Sun, Moon, User, Clock, MapPin } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Select } from './ui/Select';
import { formatTime, formatDate } from '../utils/date';
import { useDailyShopHours } from '../hooks/useDailyShopHours';
import { useChairAssignment } from '../hooks/useChairAssignment';
import { useAppointments } from '../hooks/useAppointments';

export const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedChair, setSelectedChair] = useState('all');
  const [timePeriod, setTimePeriod] = useState<'morning' | 'afternoon'>('morning');
  const { shopHours, getAvailableTimeSlots, isDateOpen, getShopHoursSummary } = useDailyShopHours();
  const { getAssignedChairs } = useChairAssignment();
  const { appointments } = useAppointments();
  
  // Mobile-specific states
  const [isMobile, setIsMobile] = useState(false);
  const [currentDay, setCurrentDay] = useState(new Date());
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const getWeekDays = () => {
    const start = new Date(currentDate);
    start.setDate(currentDate.getDate() - currentDate.getDay() + 1); // Monday
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      return day;
    }).filter(day => isDateOpen(day)); // Filtra solo i giorni aperti
  };

  const weekDays = getWeekDays();
  
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
    const newDay = new Date(currentDay);
    if (direction === 'prev') {
      newDay.setDate(currentDay.getDate() - 1);
    } else {
      newDay.setDate(currentDay.getDate() + 1);
    }
    setCurrentDay(newDay);
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
  const getTimeSlotsForDate = (date: Date, period: 'morning' | 'afternoon') => {
    const dayOfWeek = date.getDay();
    const dayHours = shopHours[dayOfWeek];
    
    if (!dayHours.isOpen || dayHours.timeSlots.length === 0) return [];
    
    const filteredSlots: string[] = [];
    
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
        const slotDurationMinutes = 30;
        
        while (currentTime + slotDurationMinutes <= endTime) {
          const hours = Math.floor(currentTime / 60);
          const minutes = currentTime % 60;
          const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          filteredSlots.push(timeString);
          currentTime += slotDurationMinutes;
        }
      }
    });
    
    return filteredSlots.sort();
  };

  // Calcola l'insieme degli slot per l'intera settimana in base al turno selezionato
  // Evita che la griglia si limiti agli slot del primo giorno (che potrebbe non avere orario continuato)
  const getWeekTimeSlots = (period: 'morning' | 'afternoon') => {
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


  const assignedChairs = getAssignedChairs();
  
  const filteredAppointments = appointments.filter(apt => {
    const chairMatch = selectedChair === 'all' || apt.staff?.chair_id === selectedChair;
    return chairMatch;
  });

  return (
    <div className="space-y-6">
      {/* Header - Both Mobile and Desktop */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Calendario</h1>
          <p className="text-sm text-gray-600 mt-1">
            Orari configurati per ogni giorno della settimana
          </p>
        </div>
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
          
          {/* Controlli Mattina/Pomeriggio */}
          <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
            <Button
              variant={timePeriod === 'morning' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setTimePeriod('morning')}
              className="flex items-center space-x-1"
            >
              <Sun className="w-4 h-4" />
              <span>Mattina</span>
            </Button>
            <Button
              variant={timePeriod === 'afternoon' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setTimePeriod('afternoon')}
              className="flex items-center space-x-1"
            >
              <Moon className="w-4 h-4" />
              <span>Pomeriggio</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop Calendar Grid */}
      <div className="hidden md:block">

      <Card>
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
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="secondary" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filtri
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-full">
            {/* Week Header */}
            <div className={`grid gap-1 mb-4`} style={{ gridTemplateColumns: `60px repeat(${weekDays.length}, 1fr)` }}>
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
            <div className="grid gap-1" style={{ gridTemplateColumns: `60px repeat(${weekDays.length}, 1fr)` }}>
              {/* Usa l'unione degli slot della settimana per costruire la griglia */}
              {(() => {
                const gridTimeSlots = getWeekTimeSlots(timePeriod);
                return gridTimeSlots.map((time) => (
                  <React.Fragment key={time}>
                    <div className="p-2 text-right text-sm text-gray-600 border-r border-gray-200">
                      {time}
                    </div>
                    {weekDays.map((day, dayIndex) => {
                      const dayTimeSlots = getTimeSlotsForDate(day, timePeriod);
                      const isTimeSlotAvailable = dayTimeSlots.includes(time);
                      
                      return (
                        <div
                          key={`${time}-${dayIndex}`}
                          className={`min-h-[60px] p-1 border border-gray-100 transition-colors ${
                            isTimeSlotAvailable 
                              ? 'hover:bg-gray-50 cursor-pointer' 
                              : 'bg-gray-200 text-gray-600 cursor-not-allowed'
                          }`}
                        >
                          {/* Render appointments for this time slot */}
                          {isTimeSlotAvailable && filteredAppointments
                            .filter(apt => {
                              const aptDate = new Date(apt.start_at);
                              const aptTime = formatTime(apt.start_at);
                              const isSameDate = aptDate.toDateString() === day.toDateString();
                              const isSameTime = aptTime === time;
                              
                              return isSameDate && isSameTime;
                            })
                            .map(apt => (
                              <div
                                key={apt.id}
                                className={`p-2 rounded text-xs border ${getStatusColor(apt.status || 'scheduled')} cursor-pointer hover:scale-105 transition-transform`}
                                draggable
                                onDragStart={(e) => e.dataTransfer.setData('appointmentId', apt.id || '')}
                                title={`${apt.clients?.first_name} ${apt.clients?.last_name || ''} - ${apt.services?.name || 'Servizio'}`}
                              >
                                <div className="font-medium truncate">
                                  {apt.clients?.first_name} {apt.clients?.last_name || ''}
                                </div>
                                <div className="opacity-75 truncate text-xs">
                                  {apt.services?.name || 'Servizio'}
                                </div>
                                <div className="opacity-60 truncate text-xs">
                                  {apt.staff?.full_name}
                                </div>
                                {apt.products && apt.products.length > 0 && (
                                  <div className="flex items-center justify-center mt-1">
                                    <div className="flex items-center space-x-1 bg-green-100 text-green-700 px-1 py-0.5 rounded-full">
                                      <Package className="w-2.5 h-2.5" />
                                      <span className="text-xs font-medium">{apt.products.length}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))
                          }
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
              className="flex items-center space-x-2"
            >
              <ChevronRight className="w-6 h-6" />
            </Button>
          </div>

          {/* Mobile Filters */}
          <div className="space-y-4">
            {/* Morning/Afternoon Toggle */}
            <div className="flex items-center justify-center space-x-2 bg-gray-100 rounded-lg p-1">
              <Button
                variant={timePeriod === 'morning' ? 'primary' : 'ghost'}
                size="lg"
                onClick={() => setTimePeriod('morning')}
                className="flex items-center space-x-2 flex-1"
              >
                <Sun className="w-5 h-5" />
                <span>Mattina</span>
              </Button>
              <Button
                variant={timePeriod === 'afternoon' ? 'primary' : 'ghost'}
                size="lg"
                onClick={() => setTimePeriod('afternoon')}
                className="flex items-center space-x-2 flex-1"
              >
                <Moon className="w-5 h-5" />
                <span>Pomeriggio</span>
              </Button>
            </div>

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
              <Card className="p-4">
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

          {/* Appointments List */}
          <div className="space-y-3">
            {isDateOpen(currentDay) ? (
              getFilteredAppointmentsForDay(currentDay, timePeriod).length > 0 ? (
                getFilteredAppointmentsForDay(currentDay, timePeriod).map((appointment) => (
                  <Card key={appointment.id} className="p-4">
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
                            {appointment.clients?.first_name?.[0]}{appointment.clients?.last_name?.[0]}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-gray-900 font-medium text-lg">
                            {appointment.clients?.first_name} {appointment.clients?.last_name}
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
                        
                        {appointment.products && appointment.products.length > 0 && (
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
                <Card className="p-8 text-center">
                  <div className="text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-3" />
                    <p className="text-lg font-medium">Nessun appuntamento</p>
                    <p className="text-sm">in questo periodo per {currentDay.toLocaleDateString('it-IT')}</p>
                  </div>
                </Card>
              )
            ) : (
              <Card className="p-8 text-center">
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

    </div>
  );
};