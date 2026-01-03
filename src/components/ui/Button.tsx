import React from 'react';
import { cn } from '../../utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className,
  disabled,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed aurora-button';
  
  const variantClasses = {
    primary:
      'bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-strong)] text-white border border-[color-mix(in_srgb,var(--theme-accent)_25%,transparent)] focus:ring-[var(--theme-accent)] focus:ring-offset-[var(--theme-surface)]',
    secondary:
      'bg-[var(--theme-surface-alt)] text-[var(--theme-text)] border border-[color-mix(in_srgb,var(--theme-border)_70%,transparent)] hover:bg-[color-mix(in_srgb,var(--theme-surface-alt)_85%,var(--theme-surface))] focus:ring-[var(--theme-primary)] focus:ring-offset-[var(--theme-surface)]',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 focus:ring-offset-[var(--theme-surface)]',
    ghost: 'text-[var(--theme-primary)] hover:bg-[var(--theme-nav-hover)] focus:ring-[var(--theme-primary)] focus:ring-offset-[var(--theme-surface)]',
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
};