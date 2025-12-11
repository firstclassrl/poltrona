import React from 'react';
import { cn } from '../../utils/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  containerClassName?: string;
  'data-format'?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className,
  containerClassName,
  ...props
}) => {
  return (
    <div className={cn('space-y-1', containerClassName)}>
      {label && (
        <label className="block text-sm font-medium text-gray-200">
          {label}
        </label>
      )}
      <input
        className={cn(
          'w-full px-3 py-2 bg-white border border-green-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200',
          error && 'border-red-500/50 focus:ring-red-500/50',
          props.type === 'time' && 'time-24h', // Add class for time inputs
          className
        )}
        lang={props.type === 'time' ? 'it-IT' : props.lang}
        step={props.type === 'time' && props.step === undefined ? 60 : props.step}
        data-format={props.type === 'time' ? '24' : props['data-format']}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};