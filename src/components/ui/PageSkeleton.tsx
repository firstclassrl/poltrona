import React from 'react';

/**
 * PageSkeleton - Componente skeleton per loading states durante lazy loading
 * Mostra un placeholder animato mentre il componente reale viene caricato
 */
export const PageSkeleton: React.FC = () => {
    return (
        <div className="p-4 md:p-6 animate-pulse">
            {/* Header skeleton */}
            <div className="mb-6">
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            </div>

            {/* Cards skeleton - griglia KPI */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {[1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className="bg-white/60 backdrop-blur-xl border border-white/30 rounded-xl p-4 shadow-lg"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                            </div>
                            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Content skeleton - lista appuntamenti */}
            <div className="bg-white/60 backdrop-blur-xl border border-white/30 rounded-xl p-4 shadow-lg">
                <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className="flex items-center space-x-4 p-3 bg-white/50 rounded-lg"
                        >
                            <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                            <div className="flex-1">
                                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                            </div>
                            <div className="w-20 h-6 bg-gray-200 rounded-full"></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PageSkeleton;
