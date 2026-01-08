import React, { useState } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
    HairProfile,
    HairType,
    HairLength,
    ColorSituation,
    HAIR_TYPE_OPTIONS,
    HAIR_LENGTH_OPTIONS,
    COLOR_SITUATION_OPTIONS
} from '@/types/hairProfile';
import type { QuestionType } from '@/hooks/useHairQuestionnaire';

interface HairQuestionnaireProps {
    existingProfile?: HairProfile | null;
    questionsToAsk: QuestionType[];
    onComplete: (profile: Partial<HairProfile>) => void;
    onClose?: () => void;
}

/**
 * Modal/Overlay con questionario step-by-step
 */
export function HairQuestionnaire({
    existingProfile,
    questionsToAsk,
    onComplete,
    onClose
}: HairQuestionnaireProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [hairType, setHairType] = useState<HairType | null>(existingProfile?.hair_type || null);
    const [hairLength, setHairLength] = useState<HairLength | null>(existingProfile?.hair_length || null);
    const [colorSituation, setColorSituation] = useState<ColorSituation | null>(existingProfile?.color_situation || null);

    const totalSteps = questionsToAsk.length;
    const progress = ((currentStep + 1) / totalSteps) * 100;
    const currentQuestion = questionsToAsk[currentStep];

    const handleSelection = (value: HairType | HairLength | ColorSituation) => {
        // Set value based on current question
        if (currentQuestion === 'hair_type') {
            setHairType(value as HairType);
        } else if (currentQuestion === 'hair_length') {
            setHairLength(value as HairLength);
        } else if (currentQuestion === 'color_situation') {
            setColorSituation(value as ColorSituation);
        }

        // Auto-advance after 300ms
        setTimeout(() => {
            if (currentStep < totalSteps - 1) {
                setCurrentStep(currentStep + 1);
            } else {
                // Complete questionnaire
                onComplete({
                    hair_type: currentQuestion === 'hair_type' ? (value as HairType) : hairType,
                    hair_length: currentQuestion === 'hair_length' ? (value as HairLength) : hairLength,
                    has_color_history: currentQuestion === 'color_situation' || colorSituation !== null,
                    color_situation: currentQuestion === 'color_situation' ? (value as ColorSituation) : colorSituation
                });
            }
        }, 300);
    };

    const getQuestionTitle = (): string => {
        switch (currentQuestion) {
            case 'hair_type':
                return existingProfile ? 'Conferma il tuo tipo di capello' : 'Com\'è il tuo capello?';
            case 'hair_length':
                return existingProfile ? 'Conferma la lunghezza' : 'Quanto sono lunghi?';
            case 'color_situation':
                return 'Qual è la situazione del colore?';
            default:
                return '';
        }
    };

    const getQuestionSubtitle = (): string => {
        switch (currentQuestion) {
            case 'hair_type':
                return 'Questo ci aiuta a stimare la durata corretta';
            case 'hair_length':
                return 'La lunghezza influenza il tempo necessario';
            case 'color_situation':
                return 'Per i servizi colore, abbiamo bisogno di sapere da dove partiamo';
            default:
                return '';
        }
    };

    const renderOptions = () => {
        switch (currentQuestion) {
            case 'hair_type':
                return (
                    <div className="grid grid-cols-2 gap-4">
                        {HAIR_TYPE_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => handleSelection(option.value)}
                                className={`p-5 rounded-2xl border-2 text-left transition-all transform hover:scale-[1.02] active:scale-[0.98] ${hairType === option.value
                                        ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200 shadow-md'
                                        : 'border-gray-200 hover:border-purple-300 hover:shadow-md bg-white'
                                    }`}
                            >
                                <div className="text-3xl mb-2">{option.icon}</div>
                                <div className="font-semibold text-gray-900">{option.label}</div>
                                <div className="text-xs text-gray-500 mt-1">{option.description}</div>
                            </button>
                        ))}
                    </div>
                );

            case 'hair_length':
                return (
                    <div className="space-y-3">
                        {HAIR_LENGTH_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => handleSelection(option.value)}
                                className={`w-full p-5 rounded-2xl border-2 text-left transition-all flex items-center justify-between transform hover:scale-[1.01] active:scale-[0.99] ${hairLength === option.value
                                        ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200 shadow-md'
                                        : 'border-gray-200 hover:border-purple-300 hover:shadow-md bg-white'
                                    }`}
                            >
                                <div>
                                    <div className="font-semibold text-gray-900">{option.label}</div>
                                    <div className="text-sm text-gray-500">{option.description}</div>
                                </div>
                                <span className="font-mono text-2xl text-purple-600 tracking-wider">
                                    {option.visual}
                                </span>
                            </button>
                        ))}
                    </div>
                );

            case 'color_situation':
                return (
                    <div className="space-y-3">
                        {COLOR_SITUATION_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => handleSelection(option.value)}
                                className={`w-full p-5 rounded-2xl border-2 text-left transition-all transform hover:scale-[1.01] active:scale-[0.99] ${colorSituation === option.value
                                        ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200 shadow-md'
                                        : 'border-gray-200 hover:border-purple-300 hover:shadow-md bg-white'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">🎨</span>
                                    <div>
                                        <div className="font-semibold text-gray-900">{option.label}</div>
                                        <div className="text-sm text-gray-500">{option.description}</div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-6 pb-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span className="text-purple-600 font-semibold">{currentStep + 1}</span>
                            <span>di</span>
                            <span>{totalSteps}</span>
                        </div>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 pb-6">
                    {/* Question */}
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            {getQuestionTitle()}
                        </h2>
                        <p className="text-gray-500">
                            {getQuestionSubtitle()}
                        </p>
                    </div>

                    {/* Options */}
                    <div className="overflow-y-auto max-h-[50vh]">
                        {renderOptions()}
                    </div>
                </div>

                {/* Footer info */}
                {existingProfile && currentStep === 0 && (
                    <div className="px-6 pb-6 pt-0">
                        <p className="text-xs text-center text-gray-400">
                            💡 Abbiamo già alcune informazioni sui tuoi capelli. Conferma o aggiorna se sono cambiati.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
