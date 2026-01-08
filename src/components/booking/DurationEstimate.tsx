import React, { useState } from 'react';
import { Clock, ChevronDown, ChevronUp, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DurationResult } from '@/types/hairProfile';

interface DurationEstimateProps {
    result: DurationResult;
    onAccept: (minutes: number) => void;
    onModifyProfile: () => void;
}

/**
 * Card che mostra il risultato del calcolo durata
 */
export function DurationEstimate({
    result,
    onAccept,
    onModifyProfile
}: DurationEstimateProps) {
    const [showBreakdown, setShowBreakdown] = useState(false);

    return (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 overflow-hidden shadow-lg">
            {/* Main display */}
            <div className="p-6 text-center">
                {/* Icon */}
                <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-md mb-4">
                    <Clock className="w-8 h-8 text-emerald-600" />
                </div>

                {/* Title */}
                <h3 className="text-lg font-medium text-gray-700 mb-2">
                    Tempo consigliato per te
                </h3>

                {/* Duration */}
                <div className="text-4xl font-bold text-emerald-600 mb-2">
                    {result.display}
                </div>

                {/* Subtitle */}
                <p className="text-sm text-gray-500">
                    Basato sul tuo profilo capelli
                </p>
            </div>

            {/* Breakdown toggle */}
            <button
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="w-full px-6 py-3 bg-white/50 border-t border-emerald-100 flex items-center justify-center gap-2 text-sm text-emerald-700 hover:bg-white/70 transition-colors"
            >
                <span>Vedi dettaglio calcolo</span>
                {showBreakdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {/* Breakdown panel */}
            {showBreakdown && (
                <div className="px-6 py-4 bg-white/30 border-t border-emerald-100 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Tempo base servizi</span>
                        <span className="font-medium text-gray-800">{result.breakdown.base} min</span>
                    </div>

                    {result.breakdown.after_hair_type > result.breakdown.base && (
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">+ Adattamento tipo capello</span>
                            <span className="font-medium text-amber-600">
                                +{Math.round(result.breakdown.after_hair_type - result.breakdown.base)} min
                            </span>
                        </div>
                    )}

                    {result.breakdown.after_length > result.breakdown.after_hair_type && (
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">+ Adattamento lunghezza</span>
                            <span className="font-medium text-amber-600">
                                +{Math.round(result.breakdown.after_length - result.breakdown.after_hair_type)} min
                            </span>
                        </div>
                    )}

                    {result.breakdown.color_extra > 0 && (
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">+ Extra colore</span>
                            <span className="font-medium text-purple-600">
                                +{result.breakdown.color_extra} min
                            </span>
                        </div>
                    )}

                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">+ Buffer sicurezza</span>
                        <span className="font-medium text-gray-600">+{result.breakdown.buffer} min</span>
                    </div>

                    <div className="flex justify-between text-sm pt-2 border-t border-dashed border-emerald-200">
                        <span className="font-medium text-gray-800">Totale arrotondato</span>
                        <span className="font-bold text-emerald-600">{result.breakdown.final} min</span>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="p-6 bg-white border-t border-emerald-100 space-y-3">
                <Button
                    variant="primary"
                    onClick={() => onAccept(result.rounded_minutes)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                    <Check size={18} className="mr-2" />
                    Prenota con questa durata
                </Button>

                <button
                    onClick={onModifyProfile}
                    className="w-full py-2 text-sm text-emerald-700 hover:text-emerald-800 flex items-center justify-center gap-2"
                >
                    <RefreshCw size={14} />
                    I miei capelli sono cambiati
                </button>
            </div>
        </div>
    );
}
