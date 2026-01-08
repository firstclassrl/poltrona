import { useState, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export const usePWAUpdate = () => {
    const [isUpdating, setIsUpdating] = useState(false);

    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('[PWA] SW Registered:', r);
        },
        onRegisterError(error) {
            console.log('[PWA] SW registration error', error);
        },
    });

    const forceUpdate = useCallback(async () => {
        if (isUpdating) return;
        setIsUpdating(true);
        console.log('[PWA] Starting nuclear update...');

        try {
            // 1. Unregister all Service Workers
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                console.log('[PWA] Unregistering SWs:', registrations.length);
                await Promise.all(registrations.map(r => r.unregister()));
            }

            // 2. Clear all caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                console.log('[PWA] Deleting caches:', cacheNames);
                await Promise.all(cacheNames.map(name => caches.delete(name)));
            }

            // 3. Force hard reload with timestamp to bypass memory cache
            console.log('[PWA] Forcing hard reload...');
            window.location.replace(window.location.origin + window.location.pathname + '?v=' + Date.now());

        } catch (error) {
            console.error('[PWA] Error during update:', error);
            // Fallback
            window.location.reload();
        }
    }, [isUpdating]);

    return {
        needRefresh,
        isUpdating,
        forceUpdate,
        setNeedRefresh
    };
};
