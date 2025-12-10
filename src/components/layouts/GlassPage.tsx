import React from 'react';
import { cn } from '../../utils/cn';

interface GlassPageProps {
  className?: string;
  children: React.ReactNode;
}

/**
 * GlassPage: wrapper per pagine in stile "liquid glass" con gradienti verdi.
 */
export const GlassPage: React.FC<GlassPageProps> = ({ className = '', children }) => {
  return (
    <div className={cn('rounded-3xl p-2 md:p-4', className)}>
      <div
        className="rounded-3xl p-6 md:p-10"
        style={{
          backgroundImage:
            'linear-gradient(135deg, rgba(16,185,129,0.22), rgba(34,197,94,0.28) 40%, rgba(22,163,74,0.25) 70%, rgba(5,150,105,0.28))',
          backgroundColor: 'rgba(236,253,245,0.6)',
        }}
      >
        <div className="bg-white/60 backdrop-blur-2xl border border-white/30 shadow-2xl rounded-3xl p-4 md:p-6 space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
};

