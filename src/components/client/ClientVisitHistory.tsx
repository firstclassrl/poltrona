import React from 'react';
import { Calendar, Clock, User, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useClientVisitHistory, VisitHistoryItem } from '@/hooks/useClientVisitHistory';
import { useTerminology } from '@/contexts/TerminologyContext';

interface ClientVisitHistoryProps {
    clientId: string;
    shopId: string;
    limit?: number;
}

/**
 * Componente per mostrare lo storico visite
 */
export function ClientVisitHistory({ clientId, shopId, limit = 3 }: ClientVisitHistoryProps) {
    const { history, loading, error, isEmpty } = useClientVisitHistory(clientId, shopId, limit);
    const terminology = useTerminology();

    // Formatta data
    const formatDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('it-IT', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    // Formatta ora
    const formatTime = (dateStr: string): string => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Formatta durata
    const formatDuration = (minutes: number): string => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours === 0) return `${mins} min`;
        if (mins === 0) return `${hours}h`;
        return `${hours}h ${mins}min`;
    };

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                <span className="ml-2 text-gray-500">Caricamento storico...</span>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="p-4 bg-red-50 rounded-lg text-red-600 text-sm">
                Errore nel caricamento dello storico: {error}
            </div>
        );
    }

    // Empty state
    if (isEmpty) {
        return (
            <div className="p-6 text-center text-gray-500 bg-gray-50 rounded-lg">
                <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="font-medium">Nessuna visita precedente</p>
                <p className="text-sm">Questo cliente non ha ancora appuntamenti completati</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {history.map((visit) => (
                <VisitCard
                    key={visit.id}
                    visit={visit}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    formatDuration={formatDuration}
                    staffLabel={terminology.professional(visit.staff_gender)}
                />
            ))}
        </div>
    );
}

interface VisitCardProps {
    visit: VisitHistoryItem;
    formatDate: (date: string) => string;
    formatTime: (date: string) => string;
    formatDuration: (minutes: number) => string;
    staffLabel: string;
}

function VisitCard({ visit, formatDate, formatTime, formatDuration, staffLabel }: VisitCardProps) {
    const isCompleted = visit.status === 'completed';

    return (
        <div className={`p-4 rounded-xl border ${isCompleted
            ? 'border-green-100 bg-green-50/50'
            : 'border-red-100 bg-red-50/50'
            }`}>
            {/* Header with date and status */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-gray-400" />
                    <span className="font-medium text-gray-900">{formatDate(visit.date)}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-600">{formatTime(visit.date)}</span>
                </div>
                {isCompleted ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">
                        <CheckCircle size={12} />
                        Completato
                    </span>
                ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-100 px-2 py-1 rounded-full">
                        <XCircle size={12} />
                        No-show
                    </span>
                )}
            </div>

            {/* Services */}
            <div className="mb-2">
                {visit.services.map((service, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-gray-800">{service.name}</span>
                        <span className="text-gray-500">{service.price > 0 ? `€${service.price.toFixed(2)}` : ''}</span>
                    </div>
                ))}
            </div>

            {/* Staff and duration */}
            <div className="flex items-center gap-4 text-sm text-gray-500 pt-2 border-t border-gray-200/50">
                <div className="flex items-center gap-1">
                    <User size={14} />
                    <span>{staffLabel}: {visit.staff_name}</span>
                </div>
                <div className="flex items-center gap-1">
                    <Clock size={14} />
                    <span>{formatDuration(visit.total_duration_minutes)}</span>
                </div>
            </div>

            {/* Notes (if any) */}
            {visit.notes && (
                <div className="mt-2 pt-2 border-t border-gray-200/50 text-sm text-gray-600 italic">
                    "{visit.notes}"
                </div>
            )}
        </div>
    );
}
