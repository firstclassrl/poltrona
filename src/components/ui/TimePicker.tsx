import React, { useState, useRef, useEffect } from 'react';
import { Clock, ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

interface TimePickerProps {
  value: string; // Format: "HH:MM"
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

export const TimePicker: React.FC<TimePickerProps> = ({
  value,
  onChange,
  label,
  className,
  disabled = false,
  placeholder,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hours, setHours] = useState('09');
  const [minutes, setMinutes] = useState('00');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Parse initial value
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':');
      setHours(h || '09');
      setMinutes(m || '00');
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDisplayValue = (h: string, m: string) => {
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
  };

  const currentDisplayValue = value ? formatDisplayValue(hours, minutes) : (placeholder ?? '--:--');

  const handleHourClick = (h: string) => {
    setHours(h);
    onChange(formatDisplayValue(h, minutes));
    // Non chiudiamo il dropdown sull'ora, l'utente potrebbe voler cambiare anche i minuti
  };

  const handleMinuteClick = (m: string) => {
    setMinutes(m);
    onChange(formatDisplayValue(hours, m));
    setIsOpen(false); // Chiudiamo il dropdown dopo aver selezionato i minuti per velocizzare
  };

  // Genera griglia ore 00-23
  const hoursGrid = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));

  // Genera griglia minuti a step di 5 (00, 05, 10...)
  const minutesGrid = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          aria-label={label ? `${label}: ${currentDisplayValue}` : `Seleziona orario: ${currentDisplayValue}`}
          aria-expanded={isOpen}
          aria-haspopup="grid"
          className={cn(
            'w-full px-3 py-2 bg-white border border-green-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 flex items-center justify-between touch-target',
            disabled && 'opacity-50 cursor-not-allowed',
            isOpen && 'ring-2 ring-green-500 border-transparent shadow-sm'
          )}
        >
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="font-mono text-sm font-semibold tracking-wide text-gray-900">
              {currentDisplayValue}
            </span>
          </div>
          <ChevronDown
            className={cn('w-4 h-4 text-gray-400 transition-transform duration-200', isOpen && 'rotate-180')}
          />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 flex overflow-hidden min-w-[280px] sm:min-w-[320px] animate-in fade-in zoom-in-95 duration-100 origin-top-left">

            {/* Hours Column */}
            <div className="flex-1 p-2 sm:p-3 border-r border-gray-100 bg-gray-50/50">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center mb-2">Ore</div>
              <div className="grid grid-cols-4 gap-1">
                {hoursGrid.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleHourClick(h)}
                    className={cn(
                      'h-8 text-sm rounded-md transition-all font-medium',
                      hours === h
                        ? 'bg-green-600 text-white shadow-md scale-105'
                        : 'text-gray-700 hover:bg-green-100 hover:text-green-800'
                    )}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            {/* Minutes Column */}
            <div className="w-[100px] sm:w-[120px] p-2 sm:p-3 bg-white">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center mb-2">Minuti</div>
              <div className="grid grid-cols-2 gap-1">
                {minutesGrid.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleMinuteClick(m)}
                    className={cn(
                      'h-8 text-sm rounded-md transition-all font-medium',
                      minutes === m
                        ? 'bg-green-600 text-white shadow-md scale-105'
                        : 'text-gray-700 hover:bg-green-100 hover:text-green-800'
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
