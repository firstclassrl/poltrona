import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
    HairProfile,
    HairType,
    HairLength,
    ColorSituation,
    LastColorTime,
    HAIR_TYPE_OPTIONS,
    HAIR_LENGTH_OPTIONS,
    COLOR_SITUATION_OPTIONS,
    LAST_COLOR_TIME_OPTIONS
} from '@/types/hairProfile';

interface HairProfileEditorProps {
    clientId: string;
    shopId: string;
    initialProfile?: HairProfile | null;
    onSave: (profile: Partial<HairProfile>) => Promise<void>;
    onCancel: () => void;
}

/**
 * Form per creare/modificare profilo capelli
 * Usato da: staff nella scheda cliente
 */
export function HairProfileEditor({
    clientId,
    shopId,
    initialProfile,
    onSave,
    onCancel
}: HairProfileEditorProps) {
    const [hairType, setHairType] = useState<HairType | null>(initialProfile?.hair_type || null);
    const [hairLength, setHairLength] = useState<HairLength | null>(initialProfile?.hair_length || null);
    const [colorSituation, setColorSituation] = useState<ColorSituation | null>(initialProfile?.color_situation || null);
    const [lastColorTime, setLastColorTime] = useState<LastColorTime | null>(initialProfile?.last_color_time || null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset last_color_time if virgin is selected
    useEffect(() => {
        if (colorSituation === 'virgin') {
            setLastColorTime('never');
        } else if (colorSituation && lastColorTime === 'never') {
            // If switching from virgin to non-virgin, reset to null so user must select
            setLastColorTime(null);
        }
    }, [colorSituation]);

    const isValid = hairType && hairLength && colorSituation && (colorSituation === 'virgin' || lastColorTime);

    const handleSave = async () => {
        if (!isValid) return;

        setSaving(true);
        setError(null);

        try {
            await onSave({
                client_id: clientId,
                shop_id: shopId,
                hair_type: hairType,
                hair_length: hairLength,
                has_color_history: colorSituation !== 'virgin',
                color_situation: colorSituation,
                last_color_time: colorSituation === 'virgin' ? 'never' : lastColorTime
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore durante il salvataggio');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Profilo Capelli</h3>
                <button
                    onClick={onCancel}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Error message */}
            {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            {/* Tipo di capello */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                    Tipo di capello <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                    {HAIR_TYPE_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => setHairType(option.value)}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${hairType === option.value
                                ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                                : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">{option.icon}</span>
                                <div>
                                    <div className="font-medium text-gray-900">{option.label}</div>
                                    <div className="text-xs text-gray-500">{option.description}</div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Lunghezza */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                    Lunghezza <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                    {HAIR_LENGTH_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => setHairLength(option.value)}
                            className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between ${hairLength === option.value
                                ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                                : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                                }`}
                        >
                            <div>
                                <div className="font-medium text-gray-900">{option.label}</div>
                                <div className="text-xs text-gray-500">{option.description}</div>
                            </div>
                            <span className="font-mono text-lg text-purple-600 tracking-wider">
                                {option.visual}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Situazione colore (obbligatorio) */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                    Situazione colore <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                    {COLOR_SITUATION_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => setColorSituation(option.value)}
                            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${colorSituation === option.value
                                ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                                : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                                }`}
                        >
                            <div className="font-medium text-gray-900">{option.label}</div>
                            <div className="text-xs text-gray-500">{option.description}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Ultimo trattamento colore (solo se NON virgin) */}
            {colorSituation && colorSituation !== 'virgin' && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        Ultimo trattamento colore <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                        {LAST_COLOR_TIME_OPTIONS.filter(o => o.value !== 'never').map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setLastColorTime(option.value)}
                                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${lastColorTime === option.value
                                    ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                                    : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                                    }`}
                            >
                                <div className="font-medium text-gray-900">{option.label}</div>
                                <div className="text-xs text-gray-500">{option.description}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
                <Button
                    variant="secondary"
                    onClick={onCancel}
                    className="flex-1"
                    disabled={saving}
                >
                    Annulla
                </Button>
                <Button
                    variant="primary"
                    onClick={handleSave}
                    className="flex-1"
                    disabled={!isValid || saving}
                >
                    {saving ? (
                        <>
                            <span className="animate-spin mr-2">⏳</span>
                            Salvataggio...
                        </>
                    ) : (
                        <>
                            <Check size={18} className="mr-2" />
                            Salva profilo
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
