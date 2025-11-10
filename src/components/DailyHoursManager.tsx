import React from 'react';
import { Clock, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from './ui/Button';
import { useDailyShopHours } from '../hooks/useDailyShopHours';
import type { TimeSlot } from '../types';

interface DailyHoursManagerProps {
  disabled?: boolean;
}

export const DailyHoursManager: React.FC<DailyHoursManagerProps> = ({ disabled = false }) => {
  const {
    shopHours,
    DAYS_OF_WEEK,
    updateDayHours,
    addTimeSlot,
    removeTimeSlot,
    updateTimeSlot,
    toggleDayOpen,
  } = useDailyShopHours();

  const handleAddTimeSlot = (dayOfWeek: number) => {
    if (disabled) return;
    const newSlot: TimeSlot = { start: '09:00', end: '18:00' }; // 24-hour format
    addTimeSlot(dayOfWeek, newSlot);
  };

  const handleTimeSlotChange = (dayOfWeek: number, slotIndex: number, field: 'start' | 'end', value: string) => {
    if (disabled) return;
    const dayHours = shopHours[dayOfWeek];
    const timeSlot = dayHours.timeSlots[slotIndex];
    const updatedSlot = { ...timeSlot, [field]: value };
    updateTimeSlot(dayOfWeek, slotIndex, updatedSlot);
  };
  
  const handleRemoveTimeSlot = (dayOfWeek: number, slotIndex: number) => {
    if (disabled) return;
    removeTimeSlot(dayOfWeek, slotIndex);
  };

  const validateTimeSlot = (slot: TimeSlot): boolean => {
    const [startHours, startMinutes] = slot.start.split(':').map(Number);
    const [endHours, endMinutes] = slot.end.split(':').map(Number);
    const startTime = startHours * 60 + startMinutes;
    const endTime = endHours * 60 + endMinutes;
    
    return startTime < endTime && startTime >= 0 && endTime <= 24 * 60;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 mb-3">
        <Clock className="w-5 h-5 text-purple-500" />
        <h2 className="text-lg font-bold text-gray-900">Orari di Apertura</h2>
      </div>

      {/* Layout a 3 colonne */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {DAYS_OF_WEEK.map((day) => {
          const dayHours = shopHours[day.key];
          const isOpen = dayHours.isOpen;
          
          return (
            <div key={day.key} className="border border-gray-200 rounded-lg p-3 bg-white hover:shadow-sm transition-shadow min-w-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">{day.name}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => !disabled && toggleDayOpen(day.key)}
                  disabled={disabled}
                  className="flex items-center space-x-1 px-2 py-1"
                >
                  {isOpen ? (
                    <>
                      <ToggleRight className="w-4 h-4 text-green-500" />
                      <span className="text-xs text-green-600 font-medium">Aperto</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-500">Chiuso</span>
                    </>
                  )}
                </Button>
              </div>

              {isOpen ? (
                <div className="space-y-2">
                  {dayHours.timeSlots.length === 0 ? (
                    <div className="text-center py-3 text-gray-400">
                      <Clock className="w-5 h-5 mx-auto mb-1 text-gray-300" />
                      <p className="text-xs">Nessun orario</p>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleAddTimeSlot(day.key)}
                        disabled={disabled}
                        className="mt-2 text-xs px-2 py-1"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Aggiungi
                      </Button>
                    </div>
                  ) : (
                    <>
                      {dayHours.timeSlots.map((slot, slotIndex) => {
                        const isValid = validateTimeSlot(slot);
                        
                        return (
                        <div
                          key={slotIndex}
                          className={`flex items-center justify-between p-3 rounded border ${
                            isValid ? 'border-gray-200 bg-gray-50' : 'border-red-200 bg-red-50'
                          }`}
                        >
                            <div className="flex items-center space-x-2">
                              <input
                                type="time"
                                value={slot.start}
                                onChange={(e) => handleTimeSlotChange(day.key, slotIndex, 'start', e.target.value)}
                                className="w-24 min-w-[6rem] px-2 py-1 border border-gray-300 rounded text-sm font-mono text-center time-24h"
                                lang="it-IT"
                                step={300}
                                data-format="24"
                                disabled={disabled}
                              />
                              <span className="text-gray-400 text-sm">-</span>
                              <input
                                type="time"
                                value={slot.end}
                                onChange={(e) => handleTimeSlotChange(day.key, slotIndex, 'end', e.target.value)}
                                className="w-24 min-w-[6rem] px-2 py-1 border border-gray-300 rounded text-sm font-mono text-center time-24h"
                                lang="it-IT"
                                step={300}
                                data-format="24"
                                disabled={disabled}
                              />
                            </div>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveTimeSlot(day.key, slotIndex)}
                              disabled={disabled}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        );
                      })}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleAddTimeSlot(day.key)}
                        disabled={disabled}
                        className="w-full text-xs px-2 py-1 mt-1"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Aggiungi fascia
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-400">
                  <p className="text-xs">Chiuso</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
        <p className="text-blue-800 text-xs">
          💡 {disabled ? 'Clicca su Modifica per aggiornare gli orari.' : 'Aggiorna gli orari cliccando su Aperto/Chiuso o aggiungendo nuove fasce orarie.'}
        </p>
      </div>
    </div>
  );
};
