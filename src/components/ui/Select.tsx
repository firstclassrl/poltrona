import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({ label, error, options, className, ...props }) => {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-200">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          className={cn(
            'w-full pl-3 pr-10 py-2 bg-white border border-green-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 appearance-none touch-target',
            error && 'border-red-500/50 focus:ring-red-500/50',
            className
          )}
          aria-describedby={error ? `${props.id || 'select'}-error` : undefined}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-white text-gray-900">
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
      </div>
      {error && (
        <p id={`${props.id || 'select'}-error`} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};