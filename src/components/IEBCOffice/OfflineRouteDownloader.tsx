// src/components/IEBCOffice/OfflineRouteDownloader.tsx
import React, { useState, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import { getTilesForRoute, getStorageEstimate, requestPersistentStorage } from '@/utils/tileUtils';
import type { TileDownloadPlan } from '@/utils/tileUtils';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// === INTERNAL SVG COMPONENTS ===
const IconSun = ({ className = "w-4 h-4" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17C14.7614 17 17 14.7614 17 12C17 9.23858 14.7614 7 12 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 1V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 21V23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4.22 4.22L5.64 5.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18.36 18.36L19.78 19.78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M1 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 12H23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4.22 19.78L5.64 18.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18.36 5.64L19.78 4.22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const IconCar = ({ className = "w-4 h-4" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18.1565 17.5878L19.2335 19.9572C19.4673 20.4716 19.1219 21.0581 18.572 21.1118C16.1438 21.3489 11.2334 21.6667 9.4 21.6667C7.56667 21.6667 2.65623 21.3489 0.228023 21.1118C-0.32185 21.0581 -0.667253 20.4716 -0.433519 19.9572L0.643492 17.5878" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M17.3333 13V17.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M1.46667 13V17.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M3.73333 19C4.65381 19 5.4 18.2538 5.4 17.3333C5.4 16.4129 4.65381 15.6667 3.73333 15.6667C2.81286 15.6667 2.06667 16.4129 2.06667 17.3333C2.06667 18.2538 2.81286 19 3.73333 19Z" fill="currentColor" />
        <path d="M15.0667 19C15.9871 19 16.7333 18.2538 16.7333 17.3333C16.7333 16.4129 15.9871 15.6667 15.0667 15.6667C14.1462 15.6667 13.4 16.4129 13.4 17.3333C13.4 18.2538 14.1462 19 15.0667 19Z" fill="currentColor" />
        <path d="M16.5 9.77197L15.9189 6.86616C15.5492 5.01777 13.9181 3.66663 12.0287 3.66663H6.7712C4.88179 3.66663 3.25071 5.01777 2.88102 6.86616L2.29995 9.77197C2.0834 10.8547 2.50341 11.9701 3.38531 12.6559L4.44521 13.4795C5.02102 13.9271 5.73199 14.1666 6.46332 14.1666H12.3366C13.0679 14.1666 13.7789 13.9271 14.3547 13.4795L15.4146 12.6559C16.2965 11.9701 16.7165 10.8547 16.5 9.77197Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

interface OfflineRouteDownloaderProps {
    office: any;
    userLocation: any;
    currentRoute: any;
    routingError: any;
    travelInsights: any;
    trafficInfo: any;
    className?: string;
    onClose: () => void;
}

export interface OfflineDownloaderHandle {
    startDownload: (mode?: 'minimal' | 'extended') => Promise<void>;
    status: DownloadStatus;
}

type DownloadStatus = 'idle' | 'calculating' | 'ready' | 'downloading' | 'done' | 'error';

const OfflineRouteDownloader = forwardRef<OfflineDownloaderHandle, OfflineRouteDownloaderProps>(({
    office,
    userLocation,
    currentRoute,
    routingError,
    travelInsights,
    trafficInfo,
    className = '',
    onClose
}, ref) => {
    const { t } = useTranslation('nasaka');
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [status, setStatus] = useState<DownloadStatus>('idle');
    const [downloadMode, setDownloadMode] = useState<'minimal' | 'extended'>('minimal');
    const [plan, setPlan] = useState<TileDownloadPlan | null>(null);
    const [progress, setProgress] = useState(0);
    const [storageUsed, setStorageUsed] = useState<string>('');

    // Extract geometry from currentRoute if available
    const routeGeometry = useMemo(() => {
        if (!currentRoute || !currentRoute[0]) return null;
        return currentRoute[0].coordinates || currentRoute[0]._coordinates || null;
    }, [currentRoute]);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        startDownload: async (mode) => {
            if (mode) setDownloadMode(mode);
            await handleDownload();
        },
        status
    }));

    // Check storage on mount
    useEffect(() => {
        getStorageEstimate().then((est) => {
            if (est) {
                setStorageUsed(`${est.usedMB} MB / ${est.quotaMB} MB (${est.percentUsed}%)`);
            }
        });
    }, []);

    // Calculate tile plan when geometry or mode changes
    useEffect(() => {
        if (!routeGeometry) {
            setPlan(null);
            setStatus('idle');
            return;
        }

        setStatus('calculating');
        const bufferKm = downloadMode === 'extended' ? 1.5 : 0.5;
        const zoomLevels = downloadMode === 'extended' ? [13, 14, 15, 16] : [14, 15, 16];
        const tilePlan = getTilesForRoute(routeGeometry, zoomLevels, bufferKm);
        setPlan(tilePlan);
        setStatus(tilePlan.tileCount > 0 ? 'ready' : 'idle');
    }, [routeGeometry, downloadMode]);

    const handleDownload = async () => {
        if (status === 'downloading' || status === 'done') {
            if (status === 'done') toast.info("Tiles already cached!");
            return;
        }

        if (!plan || plan.tileCount === 0) {
            toast.error("No map data found for this route.");
            return;
        }

        await requestPersistentStorage();

        setStatus('downloading');
        setProgress(0);

        try {
            const cache = await caches.open('osm-tiles-cache');
            const total = plan.tiles.length;
            let completed = 0;
            const concurrency = 8;

            for (let i = 0; i < total; i += concurrency) {
                const batch = plan.tiles.slice(i, i + concurrency);
                const requests = batch.map(async (url) => {
                    try {
                        const existing = await cache.match(url);
                        if (existing) return;
                        await cache.add(url);
                    } catch {
                        // Individual tile failure is non-fatal
                    }
                });

                await Promise.all(requests);
                completed += batch.length;
                setProgress(Math.round((completed / total) * 100));
            }

            setStatus('done');
            toast.success(`Trip Protected! ${total} tiles cached for offline use.`, {
                description: "Map tiles are now stored in persistent browser storage.",
                duration: 5000
            });

            const est = await getStorageEstimate();
            if (est) setStorageUsed(`${est.usedMB} MB / ${est.quotaMB} MB (${est.percentUsed}%)`);
        } catch (err) {
            console.error('[OfflineDownloader] Failed:', err);
            setStatus('error');
            toast.error('Download failed. Check your connection or storage space.');
        }
    };

    return (
        <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`office-list-panel open fixed right-0 top-0 h-full w-[400px] z-[100] bg-background border-l border-border shadow-2xl ${className}`}
        >
            {/* Header */}
            <div className="sticky top-0 bg-background/95 dark:bg-card/95 backdrop-blur-xl border-b border-border z-10 px-5 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">
                            {t('offline.sidebarTitle', 'Offline Maps')}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            {office?.constituency_name ? `Route to ${office.constituency_name}` : 'Trip Protection'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-accent hover:bg-accent/80 transition-colors"
                        aria-label="Close panel"
                    >
                        <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto h-full green-scrollbar p-5 space-y-6">
                {/* Intro Card */}
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-ios-gray-800/50 border-white/5' : 'bg-ios-gray-100 border-black/5'}`}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-ios-blue/20 text-ios-blue-400' : 'bg-ios-blue/10 text-ios-blue'}`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-bold">{t('offline.protectionTitle', 'Trip Protection')}</h3>
                            <p className="text-[10px] uppercase tracking-wider opacity-50 font-bold">Persistent Storage Mode</p>
                        </div>
                    </div>
                    <p className="text-sm opacity-70 leading-relaxed">
                        {t('offline.sidebarDesc', 'Download map tiles along your route to ensure navigation continues even when you lose internet connection in "dead zones".')}
                    </p>

                    {/* RESTORED WEATHER & TRAFFIC DETAILS - PREMIUM FLEX LAYOUT */}
                    {(travelInsights || trafficInfo) && (
                        <div className={`mt-4 space-y-3 p-4 rounded-2xl ${isDark ? 'bg-black/30 border border-white/5' : 'bg-white/50 border border-black/5'}`}>
                            {travelInsights && (
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${isDark ? 'bg-ios-blue/20' : 'bg-ios-blue/10'}`}>
                                        <IconSun className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center">
                                            <p className="text-[10px] font-bold opacity-50 uppercase tracking-tighter">{t('offline.weather', 'Weather')}</p>
                                            <span className="text-[10px] font-bold text-ios-blue">{travelInsights.temperature}°C</span>
                                        </div>
                                        <p className="text-sm font-bold truncate leading-tight">{travelInsights.weatherDesc}</p>
                                        <p className="text-[9px] opacity-60 font-medium">{travelInsights.precipProb}% {t('offline.precipChance', 'Precipitation Chance')}</p>
                                    </div>
                                </div>
                            )}

                            {trafficInfo && (
                                <div className="flex items-center gap-3 border-t pt-3 border-border/20">
                                    <div className={`p-2 rounded-xl ${isDark ? 'bg-orange-500/20' : 'bg-orange-500/10'}`}>
                                        <IconCar className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold opacity-50 uppercase tracking-tighter">{t('offline.traffic', 'Traffic')}</p>
                                        <div className="flex items-center justify-between">
                                            <p className={`text-sm font-bold truncate ${trafficInfo.color || ''}`}>{trafficInfo.description}</p>
                                            <span className="text-[9px] font-bold opacity-40 uppercase">{t('offline.realTime', 'Live')}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Configuration Section */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold px-1 uppercase tracking-widest opacity-40">{t('offline.config', 'Configuration')}</h3>

                    <div className={`rounded-2xl border p-4 ${isDark ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'}`}>
                        <p className="text-xs font-bold mb-3 opacity-60">{t('offline.coverage', 'Coverage Area')}</p>
                        <div className="grid grid-cols-2 gap-2">
                            {['minimal', 'extended'].map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setDownloadMode(mode as any)}
                                    className={`py-3 px-2 rounded-xl text-[11px] font-bold transition-all border
                                        ${downloadMode === mode
                                            ? 'bg-ios-blue border-ios-blue text-white shadow-lg shadow-ios-blue/20'
                                            : isDark
                                                ? 'bg-ios-gray-800 border-white/5 text-ios-gray-400'
                                                : 'bg-white border-black/5 text-ios-gray-600'
                                        }
                                    `}
                                >
                                    {mode === 'minimal' ? 'Route Only' : 'Full Corridor'}
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] mt-3 opacity-50 italic">
                            {downloadMode === 'minimal'
                                ? 'Caches 500m around the route path.'
                                : 'Caches 1.5km around the route for more context.'}
                        </p>
                    </div>

                    {/* Stats */}
                    <div className={`rounded-2xl border p-4 ${isDark ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold opacity-60 underline decoration-ios-blue/30 underline-offset-4">{t('offline.estSize', 'Estimated Payload')}</span>
                            <span className="text-xs font-black">{plan?.estimatedSizeMB || 0} MB</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold opacity-60 underline decoration-ios-blue/30 underline-offset-4">{t('offline.tileCount', 'Tile Count')}</span>
                            <span className="text-xs font-black">{plan?.tileCount || 0} items</span>
                        </div>
                    </div>
                </div>

                {/* Download Status Area */}
                <div className="pt-2">
                    <AnimatePresence mode="wait">
                        {status !== 'downloading' && status !== 'done' ? (
                            <motion.button
                                key="btn-down"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                onClick={handleDownload}
                                disabled={status === 'calculating' || !routeGeometry}
                                className={`w-full py-4 rounded-2xl font-black text-sm tracking-widest uppercase transition-all active:scale-[0.98] shadow-2xl
                                    ${!routeGeometry ? 'bg-ios-gray-500 opacity-50 cursor-not-allowed' : 'bg-ios-blue text-white shadow-ios-blue/30 hover:bg-ios-blue-600'}
                                `}
                            >
                                {!routeGeometry ? 'Select a Route First' : status === 'calculating' ? 'Calculating...' : t('offline.startSecure', 'Protect Trip')}
                            </motion.button>
                        ) : (
                            <motion.div
                                key="progress-area"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={`p-5 rounded-2xl border-2 ${status === 'done' ? 'border-green-500/50 bg-green-500/10' : 'border-ios-blue/50 bg-ios-blue/10'}`}
                            >
                                <div className="flex justify-between items-end mb-3">
                                    <span className={`text-[11px] font-black tracking-widest ${status === 'done' ? 'text-green-500' : 'text-ios-blue'}`}>
                                        {status === 'done' ? 'TRIP SECURED ✓' : 'PROTECTING ROUTE...'}
                                    </span>
                                    <span className="text-2xl font-black">{progress}%</span>
                                </div>
                                <div className={`w-full h-4 rounded-full overflow-hidden p-1 ${isDark ? 'bg-black/40' : 'bg-white/40'}`}>
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress}%` }}
                                        className={`h-full rounded-full ${status === 'done' ? 'bg-green-500' : 'bg-ios-blue shadow-[0_0_15px_rgba(0,122,255,0.6)]'}`}
                                    />
                                </div>
                                {status === 'done' && (
                                    <p className="text-[10px] mt-4 font-bold text-center opacity-70">
                                        MAP DATA STORED IN PERSISTENT CACHE
                                    </p>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Device Info */}
                {storageUsed && (
                    <div className="pt-4 border-t border-border mt-4">
                        <div className="flex items-center gap-2 mb-2 opacity-40">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <span className="text-[10px] font-black uppercase tracking-widest">{t('offline.storageStatus', 'Device Storage Status')}</span>
                        </div>
                        <p className="text-[10px] font-bold opacity-60 ml-5">{storageUsed.toUpperCase()}</p>
                    </div>
                )}

                {/* Bottom Padding */}
                <div className="h-10" />
            </div>
        </motion.div>
    );
});

export default OfflineRouteDownloader;

