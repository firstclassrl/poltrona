import React from 'react';
import { cn } from '../../utils/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className, onClick, ...props }) => {
  return (
    <div
      className={cn(
        'bg-white border border-gray-200 rounded-xl p-6 shadow-lg transition-all duration-200 hover:shadow-xl',
        'aurora-card',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
};