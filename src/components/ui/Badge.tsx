import React from 'react';
import { cn } from '../../utils/cn';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className }) => {
  const variantClasses = {
    default: 'bg-[var(--theme-accent-soft)] text-[var(--theme-primary-strong)] border-[color-mix(in_srgb,var(--theme-primary)_35%,transparent)]',
    success: 'bg-[color-mix(in_srgb,var(--theme-success)_15%,var(--theme-surface))] text-[var(--theme-primary-strong)] border-[color-mix(in_srgb,var(--theme-success)_40%,transparent)]',
    warning: 'bg-[color-mix(in_srgb,var(--theme-warning)_16%,var(--theme-surface))] text-[var(--theme-primary-strong)] border-[color-mix(in_srgb,var(--theme-warning)_40%,transparent)]',
    danger: 'bg-[color-mix(in_srgb,var(--theme-danger)_14%,var(--theme-surface))] text-[var(--theme-primary-strong)] border-[color-mix(in_srgb,var(--theme-danger)_40%,transparent)]',
    info: 'bg-[color-mix(in_srgb,var(--theme-accent)_18%,var(--theme-surface))] text-[var(--theme-primary-strong)] border-[color-mix(in_srgb,var(--theme-accent)_40%,transparent)]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
};