import React from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { X } from 'lucide-react';
import {
    CalendarEventData,
    CalendarProvider,
    openCalendar
} from '../utils/calendar';

interface CalendarPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventData: CalendarEventData | null;
}

/**
 * Rileva se il browser è su iOS
 */
function isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

/**
 * Icone SVG per i provider di calendario
 */
const GoogleCalendarIcon = () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="#4285F4" strokeWidth="2" />
        <path d="M16 2v4M8 2v4M3 10h18" stroke="#4285F4" strokeWidth="2" />
        <circle cx="12" cy="15" r="2" fill="#EA4335" />
    </svg>
);

const OutlookIcon = () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
        <rect x="2" y="4" width="20" height="16" rx="2" stroke="#0078D4" strokeWidth="2" />
        <path d="M2 8l10 6 10-6" stroke="#0078D4" strokeWidth="2" />
    </svg>
);

const YahooIcon = () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#6001D2" strokeWidth="2" />
        <path d="M2 7v10l10 5 10-5V7" stroke="#6001D2" strokeWidth="2" />
        <path d="M12 12v10" stroke="#6001D2" strokeWidth="2" />
    </svg>
);

const AppleIcon = () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
);

const DownloadIcon = () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);

interface CalendarOption {
    id: CalendarProvider;
    name: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    showOn: 'all' | 'ios' | 'non-ios';
}

const calendarOptions: CalendarOption[] = [
    {
        id: 'google',
        name: 'Google Calendar',
        icon: <GoogleCalendarIcon />,
        color: '#4285F4',
        bgColor: 'bg-blue-50 hover:bg-blue-100',
        showOn: 'all',
    },
    {
        id: 'outlook',
        name: 'Outlook',
        icon: <OutlookIcon />,
        color: '#0078D4',
        bgColor: 'bg-sky-50 hover:bg-sky-100',
        showOn: 'all',
    },
    {
        id: 'yahoo',
        name: 'Yahoo Calendar',
        icon: <YahooIcon />,
        color: '#6001D2',
        bgColor: 'bg-purple-50 hover:bg-purple-100',
        showOn: 'all',
    },
    {
        id: 'apple',
        name: 'Apple Calendar',
        icon: <AppleIcon />,
        color: '#000000',
        bgColor: 'bg-gray-100 hover:bg-gray-200',
        showOn: 'ios',
    },
    {
        id: 'ics',
        name: 'Scarica file .ics',
        icon: <DownloadIcon />,
        color: '#6B7280',
        bgColor: 'bg-gray-50 hover:bg-gray-100',
        showOn: 'non-ios',
    },
];

export const CalendarPickerModal: React.FC<CalendarPickerModalProps> = ({
    isOpen,
    onClose,
    eventData,
}) => {
    const handleSelectCalendar = (provider: CalendarProvider) => {
        if (!eventData) return;
        openCalendar(provider, eventData);
        onClose();
    };

    const isIOSDevice = isIOS();

    // Filtra le opzioni in base al dispositivo
    const visibleOptions = calendarOptions.filter((option) => {
        if (option.showOn === 'all') return true;
        if (option.showOn === 'ios') return isIOSDevice;
        if (option.showOn === 'non-ios') return !isIOSDevice;
        return true;
    });

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Aggiungi al Calendario" size="small">
            <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-4">
                    Scegli dove salvare l'appuntamento:
                </p>

                {visibleOptions.map((option) => (
                    <button
                        key={option.id}
                        onClick={() => handleSelectCalendar(option.id)}
                        className={`w-full flex items-center space-x-4 p-4 rounded-xl border border-gray-200 transition-all duration-200 ${option.bgColor}`}
                    >
                        <div className="flex-shrink-0" style={{ color: option.color }}>
                            {option.icon}
                        </div>
                        <span className="text-lg font-medium text-gray-900">{option.name}</span>
                    </button>
                ))}

                <div className="pt-4">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="w-full"
                    >
                        <X className="w-4 h-4 mr-2" />
                        Annulla
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
