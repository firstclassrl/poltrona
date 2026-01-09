import React from 'react';
import { Clock, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from './ui/Button';
import { TimePicker } from './ui/TimePicker';
import { useDailyShopHours } from '../hooks/useDailyShopHours';
import type { TimeSlot } from '../types';

interface DailyHoursManagerProps {
  disabled?: boolean;
  onStateChange?: (hours: import('../types').ShopHoursConfig) => void;
}

export const DailyHoursManager: React.FC<DailyHoursManagerProps> = ({ disabled = false, onStateChange }) => {
  const {
    shopHours,
    DAYS_OF_WEEK,
    updateDayHours,
    addTimeSlot,
    removeTimeSlot,
    updateTimeSlot,
    toggleDayOpen,
  } = useDailyShopHours();

  // Notifica il componente padre quando lo stato cambia
  React.useEffect(() => {
    if (onStateChange) {
      onStateChange(shopHours);
    }
  }, [shopHours, onStateChange]);

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
                            className={`flex items-center gap-2 py-1.5 ${!isValid ? 'bg-red-50 rounded px-2 -mx-2' : ''}`}
                          >
                            <TimePicker
                              value={slot.start}
                              onChange={(value) => handleTimeSlotChange(day.key, slotIndex, 'start', value)}
                              disabled={disabled}
                              placeholder="09:00"
                            />
                            <span className="text-gray-400 text-xs">—</span>
                            <TimePicker
                              value={slot.end}
                              onChange={(value) => handleTimeSlotChange(day.key, slotIndex, 'end', value)}
                              disabled={disabled}
                              placeholder="18:00"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveTimeSlot(day.key, slotIndex)}
                              disabled={disabled}
                              className="h-7 w-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full shrink-0 transition-all disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddTimeSlot(day.key)}
                        disabled={disabled}
                        className="w-full text-xs py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-dashed border-blue-200 hover:border-blue-300 rounded-lg transition-all mt-1"
                      >
                        <Plus className="w-3 h-3 mr-1.5" />
                        Aggiungi orario
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
