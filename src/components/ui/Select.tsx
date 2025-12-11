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
        <label className="block text-sm font-medium text-on-surface">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          className={cn(
            'w-full px-3 py-2 rounded-lg text-[var(--theme-text)] bg-[var(--theme-surface-alt)] border border-[color-mix(in_srgb,var(--theme-border)_30%,transparent)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)] focus:border-transparent transition-all duration-200 appearance-none',
            error && 'border-red-500/50 focus:ring-red-500/50',
            className
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-[var(--theme-surface)] text-[var(--theme-text)]">
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
      </div>
      {error && (
        <p className="text-sm text-[var(--theme-danger)]">{error}</p>
      )}
    </div>
  );
};