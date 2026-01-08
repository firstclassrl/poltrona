import React from 'react';
import { Edit, Clock } from 'lucide-react';
import { HairProfile, getHairTypeLabel, getHairLengthLabel, getColorSituationLabel, getHairTypeIcon, getHairLengthVisual } from '@/types/hairProfile';

interface HairProfileBadgeProps {
    profile: HairProfile | null;
    compact?: boolean;
    showEditButton?: boolean;
    onEdit?: () => void;
}

/**
 * Componente compatto per mostrare il profilo capelli
 * Usato in: calendario, modal appuntamento, liste
 */
export function HairProfileBadge({
    profile,
    compact = false,
    showEditButton = false,
    onEdit
}: HairProfileBadgeProps) {

    // Calcola tempo dall'ultimo aggiornamento
    const getRelativeTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'oggi';
        if (diffDays === 1) return 'ieri';
        if (diffDays < 7) return `${diffDays} giorni fa`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} settimane fa`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} mesi fa`;
        return `${Math.floor(diffDays / 365)} anni fa`;
    };

    // Se non c'è profilo
    if (!profile || (!profile.hair_type && !profile.hair_length)) {
        return (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <div className="flex items-center gap-2 text-gray-500">
                    <span className="text-lg">💇</span>
                    <span className="text-sm">Profilo capelli non disponibile</span>
                </div>
                {showEditButton && onEdit && (
                    <button
                        onClick={onEdit}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    >
                        <Edit size={14} />
                        Aggiungi
                    </button>
                )}
            </div>
        );
    }

    // Versione compatta - solo icone inline
    if (compact) {
        return (
            <div className="flex items-center gap-2 text-sm">
                <span title={getHairTypeLabel(profile.hair_type)}>
                    {getHairTypeIcon(profile.hair_type)}
                </span>
                <span className="font-mono text-gray-600" title={getHairLengthLabel(profile.hair_length)}>
                    {getHairLengthVisual(profile.hair_length)}
                </span>
                {profile.has_color_history && (
                    <span title={getColorSituationLabel(profile.color_situation)}>🎨</span>
                )}
                {showEditButton && onEdit && (
                    <button
                        onClick={onEdit}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <Edit size={12} />
                    </button>
                )}
            </div>
        );
    }

    // Versione normale
    return (
        <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
            <div className="flex items-start justify-between">
                <div className="space-y-2">
                    {/* Tipo capello */}
                    <div className="flex items-center gap-2">
                        <span className="text-xl">{getHairTypeIcon(profile.hair_type)}</span>
                        <span className="font-medium text-gray-800">
                            {getHairTypeLabel(profile.hair_type)}
                        </span>
                    </div>

                    {/* Lunghezza */}
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-lg tracking-wider text-purple-600">
                            {getHairLengthVisual(profile.hair_length)}
                        </span>
                        <span className="text-sm text-gray-600">
                            {getHairLengthLabel(profile.hair_length)}
                        </span>
                    </div>

                    {/* Situazione colore */}
                    {profile.has_color_history && profile.color_situation && (
                        <div className="flex items-center gap-2">
                            <span className="text-lg">🎨</span>
                            <span className="text-sm text-gray-600">
                                {getColorSituationLabel(profile.color_situation)}
                            </span>
                        </div>
                    )}
                </div>

                {/* Edit button */}
                {showEditButton && onEdit && (
                    <button
                        onClick={onEdit}
                        className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                    >
                        <Edit size={18} />
                    </button>
                )}
            </div>

            {/* Last update */}
            <div className="mt-3 pt-3 border-t border-purple-100 flex items-center gap-1 text-xs text-gray-500">
                <Clock size={12} />
                <span>Aggiornato {getRelativeTime(profile.updated_at)}</span>
            </div>
        </div>
    );
}
