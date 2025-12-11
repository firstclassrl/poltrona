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
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  value,
  onChange,
  title = 'Seleziona palette',
  layout = 'grid',
  showDescription = true,
}) => {
  const { palettes } = useTheme();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-on-surface">{title}</p>
          <p className="text-xs text-muted">Applica tema all\'interfaccia e all\'anteprima.</p>
        </div>
      </div>

      <div className={cn(layout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'flex flex-wrap gap-3')}>
        {palettes.map((palette) => {
          const isActive = palette.id === value;
          return (
            <button
              key={palette.id}
              type="button"
              onClick={() => onChange(palette.id)}
              className={cn(
                'relative overflow-hidden rounded-xl border transition-all duration-200 text-left focus:outline-none focus:ring-2 focus:ring-offset-2',
                isActive
                  ? 'border-[var(--theme-accent)] ring-2 ring-[var(--theme-accent)] ring-offset-2'
                  : 'border-transparent hover:border-[var(--theme-border)] hover:shadow-lg',
                'surface-card'
              )}
            >
              <div
                className="h-20 w-full"
                style={{ background: palette.previewGradient }}
              />
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{palette.name}</p>
                    <p className="text-xs text-muted">{palette.trend}</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--theme-nav-hover)] text-on-surface">
                    {isActive ? 'Attivo' : 'Scegli'}
                  </span>
                </div>
                {showDescription && (
                  <p className="text-xs text-muted leading-snug">{palette.description}</p>
                )}
                <div className="flex gap-1">
                  {(['primary', 'accent', 'surface', 'background'] as const).map((token) => (
                    <span
                      key={token}
                      className="h-6 w-6 rounded-md border border-white/20 shadow"
                      style={{ backgroundColor: palette.colors[token] as string }}
                    />
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
