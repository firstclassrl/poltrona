import React from 'react';
import { ThemePaletteId } from '../theme/palettes';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/cn';

interface ThemeSelectorProps {
  value: ThemePaletteId;
  onChange: (id: ThemePaletteId) => void;
  title?: string;
  layout?: 'grid' | 'inline';
  showDescription?: boolean;
  disabled?: boolean;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  value,
  onChange,
  layout = 'grid',
  showDescription = true,
  disabled = false,
}) => {
  const { palettes } = useTheme();

  return (
    <div className="space-y-3">
      <div className={cn(layout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'flex flex-wrap gap-3')}>
        {palettes.map((palette) => {
          const isActive = palette.id === value;
          return (
            <button
              key={palette.id}
              type="button"
              onClick={() => onChange(palette.id)}
              disabled={disabled}
              className={cn(
                'relative overflow-hidden rounded-2xl transition-all duration-200 text-left focus:outline-none focus:ring-2 focus:ring-offset-2 w-full flex flex-col',
                isActive
                  ? 'border-4 border-[var(--theme-primary)] shadow-xl ring-0'
                  : 'border border-gray-200 hover:border-gray-300 hover:shadow-lg',
                'p-0', /* Removed bg-white, using surface-card inside */
                disabled && 'opacity-50 cursor-not-allowed hover:border-gray-200 hover:shadow-none'
              )}
            >
              <div
                className="h-14 w-full shrink-0"
                style={{ background: palette.previewGradient }}
              />
              <div className="p-5 space-y-2 flex-1 surface-card border-t-0"> {/* Use semantic surface-card */}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-base font-bold">{palette.name}</p>
                </div>
                {showDescription && (
                  <p className="text-sm leading-normal opacity-80">{palette.description}</p>
                )}
              </div>
            </button>
          );

        })}
      </div>
    </div>
  );
};








