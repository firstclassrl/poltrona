import React, { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';
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

  const handleTimeChange = (newHours: string, newMinutes: string) => {
    setHours(newHours);
    setMinutes(newMinutes);
    onChange(formatDisplayValue(newHours, newMinutes));
  };

  const generateHours = () => {
    return Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  };

  const generateMinutes = () => {
    return Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
  };

  const currentDisplayValue = value ? formatDisplayValue(hours, minutes) : (placeholder ?? '--:--');

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
          className={cn(
            'w-full px-3 py-2 bg-white border border-green-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 flex items-center justify-between',
            disabled && 'opacity-50 cursor-not-allowed',
            isOpen && 'ring-2 ring-green-500 border-transparent'
          )}
        >
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="font-mono text-sm">
              {currentDisplayValue}
            </span>
          </div>
          <svg
            className={cn('w-4 h-4 text-gray-400 transition-transform', isOpen && 'rotate-180')}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-hidden">
            <div className="flex">
              {/* Hours */}
              <div className="flex-1 border-r border-gray-200">
                <div className="px-2 py-1 bg-gray-50 border-b border-gray-200">
                  <span className="text-xs font-medium text-gray-600">Ore</span>
                </div>
                <div className="max-h-32 overflow-y-auto">
                  {generateHours().map((hour) => (
                    <button
                      key={hour}
                      type="button"
                      onClick={() => handleTimeChange(hour, minutes)}
                      className={cn(
                        'w-full px-2 py-1 text-sm text-left hover:bg-green-50 transition-colors',
                        hours === hour && 'bg-green-100 text-green-700 font-medium'
                      )}
                    >
                      {hour}
                    </button>
                  ))}
                </div>
              </div>

              {/* Minutes */}
              <div className="flex-1">
                <div className="px-2 py-1 bg-gray-50 border-b border-gray-200">
                  <span className="text-xs font-medium text-gray-600">Minuti</span>
                </div>
                <div className="max-h-32 overflow-y-auto">
                  {generateMinutes().map((minute) => (
                    <button
                      key={minute}
                      type="button"
                      onClick={() => handleTimeChange(hours, minute)}
                      className={cn(
                        'w-full px-2 py-1 text-sm text-left hover:bg-green-50 transition-colors',
                        minutes === minute && 'bg-green-100 text-green-700 font-medium'
                      )}
                    >
                      {minute}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};





