import React from 'react';

interface AvatarProps {
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  imageUrl?: string;
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg'
};

const normalizeName = (name?: string): string => {
  const trimmed = (name || '').trim();
  return trimmed.length > 0 ? trimmed : '?';
};

const getInitials = (name?: string): string => {
  const safeName = normalizeName(name);
  const initials = safeName
    .split(' ')
    .filter(Boolean)
    .map(word => word[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2);
  return initials || safeName[0]?.toUpperCase() || '?';
};

const getColorFromName = (name?: string): string => {
  const colors = [
    'bg-gradient-to-br from-blue-500 to-blue-600',
    'bg-gradient-to-br from-green-500 to-green-600',
    'bg-gradient-to-br from-purple-500 to-purple-600',
    'bg-gradient-to-br from-red-500 to-red-600',
    'bg-gradient-to-br from-yellow-500 to-yellow-600',
    'bg-gradient-to-br from-pink-500 to-pink-600',
    'bg-gradient-to-br from-indigo-500 to-indigo-600',
    'bg-gradient-to-br from-teal-500 to-teal-600',
  ];
  
  // Usa il nome per generare un indice consistente
  const safeName = normalizeName(name);
  const hash = safeName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

export const Avatar: React.FC<AvatarProps> = ({ 
  name, 
  size = 'md', 
  imageUrl, 
  className = '' 
}) => {
  const safeName = normalizeName(name);
  const initials = getInitials(safeName);
  const colorClass = getColorFromName(safeName);
  const sizeClass = sizeClasses[size];

  return (
    <div className={`${sizeClass} ${colorClass} rounded-full flex items-center justify-center text-white font-semibold overflow-hidden ${className}`}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={safeName}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Se l'immagine non si carica, mostra le iniziali
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.parentElement?.classList.remove('hidden');
          }}
        />
      ) : null}
      <span className={imageUrl ? 'hidden' : ''}>{initials}</span>
    </div>
  );
};






