import React from 'react';
import { Package } from 'lucide-react';
import { formatDate, formatTime, doesAppointmentOverlapSlot, getAppointmentSlotCount, getAppointmentClientLabel } from '../utils/date';
import type { Appointment, ShopHoursConfig } from '../types';

import { useTheme } from '../contexts/ThemeContext';

interface CalendarGridProps {
    currentDate: Date;
    weekDays: Date[];
    timePeriod: 'morning' | 'afternoon';
    calendarViewMode: 'split' | 'full';
    shopHoursLoaded: boolean;
    shopHours: ShopHoursConfig;
    appointments: Appointment[];
    areProductsEnabled: boolean;
    isDateInVacation: (date: Date) => boolean;
    isDateOpen: (date: Date) => boolean;
    onAppointmentClick: (appointment: Appointment) => void;
    onEmptySlotClick: (day: Date, time: string) => void;
    getStatusColor: (status: string) => string;
    chairName: string;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
    currentDate,
    weekDays,
    timePeriod,
    calendarViewMode,
    shopHoursLoaded,
    shopHours,
    appointments,
    areProductsEnabled,
    isDateInVacation,
    isDateOpen,
    onAppointmentClick,
    onEmptySlotClick,
    getStatusColor,
    chairName
}) => {

    const getTimeSlotsForDate = (date: Date, period?: 'morning' | 'afternoon') => {
        if (!shopHoursLoaded) return [];
        const dayOfWeek = date.getDay();
        const dayHours = shopHours[dayOfWeek];

        if (!dayHours.isOpen || dayHours.timeSlots.length === 0) return [];

        const filteredSlots: string[] = [];

        if (calendarViewMode === 'full') {
            dayHours.timeSlots.forEach((slot) => {
                const [startHours, startMinutes] = slot.start.split(':').map(Number);
                const [endHours, endMinutes] = slot.end.split(':').map(Number);
                const startTime = startHours * 60 + startMinutes;
                const endTime = endHours * 60 + endMinutes;

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
            dayHours.timeSlots.forEach((slot, index) => {
                const [startHours, startMinutes] = slot.start.split(':').map(Number);
                const [endHours, endMinutes] = slot.end.split(':').map(Number);
                const startTime = startHours * 60 + startMinutes;
                const endTime = endHours * 60 + endMinutes;

                const isMorningSlot = index === 0 && startTime < 13 * 60;
                const isAfternoonSlot = index > 0 || startTime >= 13 * 60;

                if ((period === 'morning' && isMorningSlot) || (period === 'afternoon' && isAfternoonSlot)) {
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

    const getWeekTimeSlots = (period?: 'morning' | 'afternoon') => {
        const all = weekDays
            .flatMap((d) => getTimeSlotsForDate(d, period))
            .filter(Boolean);
        const unique = Array.from(new Set(all));
        unique.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        return unique;
    };

    const getAppointmentAtSlot = (day: Date, time: string): Appointment | null => {
        // Only look at appointments for THIS specific chair/grid
        // The appointments prop should pre-filtered for this chair
        const slotStart = new Date(day);
        const [hours, minutes] = time.split(':').map(Number);
        slotStart.setHours(hours, minutes, 0, 0);

        return appointments.find(apt => {
            if (apt.status === 'cancelled') return false;

            const aptStart = new Date(apt.start_at);
            // Ensure same day
            if (aptStart.getDate() !== slotStart.getDate() ||
                aptStart.getMonth() !== slotStart.getMonth() ||
                aptStart.getFullYear() !== slotStart.getFullYear()) {
                return false;
            }

            // Check exact start time match
            return aptStart.getHours() === slotStart.getHours() &&
                aptStart.getMinutes() === slotStart.getMinutes();
        }) || null;
    };

    const doesAppointmentOverlap = (apt: Appointment, day: Date, time: string) => {
        return doesAppointmentOverlapSlot(apt, day, time);
    };


    return (
        <div className="bg-white/60 backdrop-blur-xl border border-white/30 shadow-xl rounded-xl overflow-hidden">
            <div className="bg-gray-50/50 p-3 border-b border-gray-100">
                <h3 className="text-md font-semibold text-gray-800 text-center uppercase tracking-wide">
                    {chairName}
                </h3>
            </div>

            <div className="overflow-x-auto">
                <div className="min-w-full">
                    {/* Week Header */}
                    <div className="grid gap-1 mb-2 overflow-hidden" style={{ gridTemplateColumns: `60px repeat(${weekDays.length}, minmax(0, 1fr))` }}>
                        <div className="p-2 text-xs font-medium text-gray-500 uppercase text-center mt-auto">Orario</div>
                        {weekDays.map((day, index) => (
                            <div
                                key={index}
                                className="p-2 text-center border-b border-gray-100"
                            >
                                <div className="text-xs text-gray-500 uppercase">
                                    {day.toLocaleDateString('it-IT', { weekday: 'short' })}
                                </div>
                                <div className="text-lg font-semibold text-gray-800">
                                    {day.getDate()}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Time Slots */}
                    <div className="grid gap-1 overflow-hidden pb-4" style={{ gridTemplateColumns: `60px repeat(${weekDays.length}, minmax(0, 1fr))` }}>
                        {(() => {
                            const gridTimeSlots = getWeekTimeSlots(calendarViewMode === 'split' ? timePeriod : undefined);
                            return gridTimeSlots.map((time) => (
                                <React.Fragment key={time}>
                                    <div className="p-1 px-2 text-right text-xs text-gray-400 font-medium border-r border-gray-100 flex items-center justify-end">
                                        {time}
                                    </div>
                                    {weekDays.map((day, dayIndex) => {
                                        const dayTimeSlots = getTimeSlotsForDate(day, calendarViewMode === 'split' ? timePeriod : undefined);
                                        const isTimeSlotAvailable = dayTimeSlots.includes(time);
                                        const appointmentAtSlot = getAppointmentAtSlot(day, time);
                                        const slotCount = appointmentAtSlot ? getAppointmentSlotCount(appointmentAtSlot) : 0;

                                        const { themeId } = useTheme();
                                        const borderClass = themeId === 'heritage' ? 'border-[#25401c]/20' :
                                            themeId === 'terra-soft' ? 'border-[#b46a4b]/20' :
                                                themeId === 'dark-mode' ? 'border-white/20' :
                                                    themeId === 'sunset-neon' ? 'border-[#facc15]/30' :
                                                        themeId === 'cyber-lilac' ? 'border-[#9a7bff]/30' :
                                                            'border-gray-50/50';

                                        return (
                                            <div
                                                key={`${time}-${dayIndex}`}
                                                role={isTimeSlotAvailable ? "button" : undefined}
                                                tabIndex={isTimeSlotAvailable ? 0 : -1}
                                                aria-label={isTimeSlotAvailable ? `Slot ${time}` : 'Slot chiuso'}
                                                className={`
                          relative min-h-[50px] max-h-[50px] p-0.5 border ${borderClass} 
                          transition-all duration-200 touch-target
                          ${appointmentAtSlot ? 'overflow-visible z-10' : 'overflow-hidden'}
                          ${isTimeSlotAvailable
                                                        ? 'hover:bg-blue-50/30 cursor-pointer'
                                                        : 'bg-gray-100/50 text-gray-400 cursor-not-allowed'
                                                    }
                        `}
                                                onClick={(e) => {
                                                    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.appointment-block') === null) {
                                                        const hasAppointment = appointments.some(apt =>
                                                            doesAppointmentOverlap(apt, day, time)
                                                        );
                                                        if (!hasAppointment && isTimeSlotAvailable) {
                                                            onEmptySlotClick(day, time);
                                                        }
                                                    }
                                                }}
                                            >
                                                {/* Appointment Block */}
                                                {appointmentAtSlot && (
                                                    <div
                                                        role="button"
                                                        tabIndex={0}
                                                        className={`
                                appointment-block rounded-md text-[10px] border shadow-sm w-full 
                                ${getStatusColor(appointmentAtSlot.status || 'scheduled')} 
                                cursor-pointer hover:shadow-md hover:scale-[1.02] 
                                transition-all duration-200 z-20 absolute top-0 left-0 right-0 mx-1
                            `}
                                                        style={{
                                                            height: `${Math.max(slotCount * 50 - 4, 46)}px`, // Adjusted for new cell height
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onAppointmentClick(appointmentAtSlot);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.stopPropagation();
                                                                onAppointmentClick(appointmentAtSlot);
                                                            }
                                                        }}
                                                    >
                                                        <div className="p-1 h-full flex flex-col pt-1">
                                                            <div className="font-bold truncate text-gray-800 leading-tight">
                                                                {getAppointmentClientLabel(appointmentAtSlot)}
                                                            </div>
                                                            <div className="text-[9px] opacity-80 truncate mt-0.5">
                                                                {appointmentAtSlot.services?.name}
                                                            </div>
                                                            {areProductsEnabled && appointmentAtSlot.products && appointmentAtSlot.products.length > 0 && (
                                                                <div className="mt-auto flex items-center gap-0.5 text-orange-700 bg-white/50 w-fit px-1 rounded-sm">
                                                                    <Package className="w-2 h-2" />
                                                                    <span>{appointmentAtSlot.products.length}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Closed Label */}
                                                {!isTimeSlotAvailable && !appointmentAtSlot && !isDateInVacation(day) && (
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                                                        <div className="w-full h-px bg-gray-300 transform -rotate-45"></div>
                                                    </div>
                                                )}

                                                {/* Vacation Overlay */}
                                                {isDateInVacation(day) && (
                                                    <div className="absolute inset-0 bg-red-50/30 flex items-center justify-center pointer-events-none">
                                                        <span className="text-[10px] text-red-400 font-bold -rotate-45 opacity-50">FERIE</span>
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
        </div>
    );
};
