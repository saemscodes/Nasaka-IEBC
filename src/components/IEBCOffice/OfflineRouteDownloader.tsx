// src/components/IEBCOffice/OfflineRouteDownloader.tsx
import React, { useState, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import { getTilesForRoute, getStorageEstimate, requestPersistentStorage } from '@/utils/tileUtils';
import type { TileDownloadPlan } from '@/utils/tileUtils';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { getWardCentroid } from '@/services/centroidService';

// === INTERNAL SVG COMPONENTS ===
const IconSun = ({ className = "w-4 h-4" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 17C14.7614 17 17 14.7614 17 12C17 9.23858 14.7614 7 12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17Z" fill="currentColor" />
        <path d="M12 2V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 20V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M4.92999 4.92999L6.33999 6.33999" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M17.66 17.66L19.07 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M2 12H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 12H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M6.33999 17.66L4.92999 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M19.07 4.92999L17.66 6.33999" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const IconCar = ({ className = "w-4 h-4" }) => (
    <svg className={className} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <path fill="currentColor" d="M466.963,233.298c-0.194-0.647-0.26-1.295-0.455-1.942c-5.633-22.539-19.234-43.007-38.406-59.652 c-19.82-17.294-45.727-30.507-75.197-37.761c-16.774-4.209-34.715-6.476-53.369-6.476c-18.652,0-36.594,2.268-53.369,6.476 c-38.018,9.392-70.08,28.628-90.871,53.757c-10.881,13.084-18.652,27.786-22.668,43.396h-3.238 c-4.34,0-151.428,11.464-126.559,119.822h68.59c-0.064-1.167-0.129-2.332-0.129-3.497c0-3.433,0.324-6.866,0.842-9.845 c4.793-27.073,28.238-46.763,55.766-46.763s50.973,19.69,55.701,46.568c0.584,3.173,0.906,6.606,0.906,10.04 c0,1.049-0.059,2.098-0.115,3.149c-0.012,0.032-0.004,0.078-0.014,0.11h0.008c-0.004,0.08-0.004,0.159-0.008,0.238h144.045 c-0.064-1.167-0.129-2.332-0.129-3.497c0-3.433,0.324-6.866,0.842-9.845c4.793-27.073,28.24-46.763,55.766-46.763 c27.527,0,50.972,19.69,55.701,46.503c0.584,3.238,0.906,6.672,0.906,10.105c0,1.045-0.058,2.09-0.115,3.137 c-0.01,0.035-0.002,0.087-0.014,0.122h0.01c-0.006,0.08-0.006,0.159-0.01,0.238h56.719c7.629,0,13.816-6.203,13.844-13.831 C512.213,263.339,513.328,250.078,466.963,233.298z" />
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
    const [downloadMode, setDownloadMode] = useState<'minimal' | 'extended' | 'area'>('minimal');
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
        if (downloadMode === 'area') {
            // Area mode: calculate tiles around the office ward centroid
            const calculateAreaTiles = async () => {
                if (!office?.ward_name && !office?.constituency_name) {
                    setPlan(null);
                    setStatus('idle');
                    return;
                }
                setStatus('calculating');
                try {
                    const centroid = await getWardCentroid(
                        office.ward_name || office.constituency_name,
                        office.constituency_name
                    );
                    if (centroid) {
                        // Generate a circular grid of coordinates around the centroid
                        const radiusKm = 3;
                        const numPoints = 36;
                        const circleCoords: [number, number][] = [];
                        for (let i = 0; i < numPoints; i++) {
                            const angle = (2 * Math.PI * i) / numPoints;
                            const dLat = (radiusKm / 111) * Math.cos(angle);
                            const dLng = (radiusKm / (111 * Math.cos(centroid.lat * Math.PI / 180))) * Math.sin(angle);
                            circleCoords.push([centroid.lng + dLng, centroid.lat + dLat]);
                        }
                        circleCoords.push(circleCoords[0]); // Close the loop
                        const tilePlan = getTilesForRoute(circleCoords, [13, 14, 15], radiusKm);
                        setPlan(tilePlan);
                        setStatus(tilePlan.tileCount > 0 ? 'ready' : 'idle');
                    } else {
                        setPlan(null);
                        setStatus('idle');
                        toast.info('Ward centroid data not available yet.');
                    }
                } catch {
                    setPlan(null);
                    setStatus('idle');
                }
            };
            calculateAreaTiles();
            return;
        }

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
    }, [routeGeometry, downloadMode, office]);

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
            className={`office-list-panel open fixed right-0 top-0 h-full w-[400px] z-[100] bg-background border-l border-border shadow-2xl offline-sidebar-enhanced ${className}`}
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
                            <h3 className={`font-bold ${isDark ? 'text-white' : 'text-ios-gray-900'}`}>{t('offline.protectionTitle', 'Trip Protection')}</h3>
                            <p className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? 'text-ios-gray-400' : 'text-ios-gray-500'}`}>Persistent Storage Mode</p>
                        </div>
                    </div>
                    <p className={`text-sm leading-relaxed ${isDark ? 'text-ios-gray-300' : 'text-ios-gray-600'}`}>
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
                                            <p className="stat-label">{t('offline.weather', 'Current Weather')}</p>
                                            <span className="text-[10px] font-bold text-green-500">{travelInsights.temperature}°C</span>
                                        </div>
                                        <p className="stat-value truncate leading-tight">{travelInsights.weatherDesc}</p>
                                        <p className={`text-[9px] font-medium ${isDark ? 'text-ios-gray-400' : 'text-ios-gray-500'}`}>{travelInsights.precipProb}% {t('offline.precipChance', 'Precipitation Chance')}</p>
                                    </div>
                                </div>
                            )}

                            {trafficInfo && (
                                <div className="flex items-center gap-3 border-t pt-3 border-border/20">
                                    <div className={`p-2 rounded-xl ${isDark ? 'bg-orange-500/20' : 'bg-orange-500/10'}`}>
                                        <IconCar className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="stat-label">{t('offline.traffic', 'Traffic Conditions')}</p>
                                        <div className="flex items-center justify-between">
                                            <p className={`stat-value truncate ${trafficInfo.color || (isDark ? 'text-white' : 'text-ios-gray-900')}`}>{trafficInfo.description}</p>
                                            <span className={`text-[9px] font-bold uppercase ${isDark ? 'text-ios-gray-500' : 'text-ios-gray-400'}`}>{t('offline.realTime', 'Live')}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Configuration Section */}
                <div className="space-y-4">
                    <h3 className={`text-sm font-bold px-1 uppercase tracking-widest ${isDark ? 'text-ios-gray-400' : 'text-ios-gray-500'}`}>{t('offline.config', 'Download Settings')}</h3>

                    <div className={`rounded-2xl border p-4 ${isDark ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'}`}>
                        <p className={`text-xs font-bold mb-3 ${isDark ? 'text-ios-gray-300' : 'text-ios-gray-600'}`}>{t('offline.coverage', 'Coverage Area')}</p>
                        <div className="grid grid-cols-3 gap-2">
                            {(['minimal', 'extended', 'area'] as const).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setDownloadMode(mode)}
                                    className={`py-3 px-2 rounded-xl text-[11px] font-bold transition-all border
                                        ${downloadMode === mode
                                            ? 'bg-ios-blue border-ios-blue text-white shadow-lg shadow-ios-blue/20'
                                            : isDark
                                                ? 'bg-ios-gray-800 border-white/5 text-ios-gray-400'
                                                : 'bg-white border-black/5 text-ios-gray-600'
                                        }
                                    `}
                                >
                                    {mode === 'minimal' ? 'Route Only' : mode === 'extended' ? 'Full Corridor' : 'Whole Area'}
                                </button>
                            ))}
                        </div>
                        <p className={`text-[10px] mt-3 italic ${isDark ? 'text-ios-gray-400' : 'text-ios-gray-500'}`}>
                            {downloadMode === 'minimal'
                                ? 'Caches 500m around the route path for lightweight offline navigation.'
                                : downloadMode === 'extended'
                                    ? 'Caches 1.5km around the route for broader area coverage.'
                                    : 'Caches the entire ward area (3km radius) for full offline access.'}
                        </p>
                    </div>

                    {/* Stats */}
                    <div className={`rounded-2xl border p-4 ${isDark ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <span className={`text-xs font-bold underline decoration-ios-blue/30 underline-offset-4 ${isDark ? 'text-ios-gray-300' : 'text-ios-gray-600'}`}>{t('offline.estSize', 'Estimated Download Size')}</span>
                            <span className={`text-xs font-black ${isDark ? 'text-white' : 'text-ios-gray-900'}`}>{plan?.estimatedSizeMB || 0} MB</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className={`text-xs font-bold underline decoration-ios-blue/30 underline-offset-4 ${isDark ? 'text-ios-gray-300' : 'text-ios-gray-600'}`}>{t('offline.tileCount', 'Map Tiles')}</span>
                            <span className={`text-xs font-black ${isDark ? 'text-white' : 'text-ios-gray-900'}`}>{plan?.tileCount || 0} items</span>
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
                                disabled={status === 'calculating' || (!routeGeometry && downloadMode !== 'area')}
                                className={`w-full py-4 rounded-2xl font-black text-sm tracking-widest uppercase transition-all active:scale-[0.98] shadow-2xl
                                    ${(!routeGeometry && downloadMode !== 'area') ? 'bg-ios-gray-500 opacity-50 cursor-not-allowed' : 'bg-ios-blue text-white shadow-ios-blue/30 hover:bg-ios-blue-600'}
                                `}
                            >
                                {(!routeGeometry && downloadMode !== 'area') ? 'Select a Route First' : status === 'calculating' ? 'Calculating...' : downloadMode === 'area' ? t('offline.startArea', 'Cache Area') : t('offline.startSecure', 'Protect Trip')}
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
                                    <span className={`text-2xl font-black ${isDark ? 'text-white' : 'text-ios-gray-900'}`}>{progress}%</span>
                                </div>
                                <div className="progress-track">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress}%` }}
                                        className={`progress-fill ${status === 'done' ? 'bg-green-500' : ''}`}
                                    />
                                </div>
                                {status === 'done' && (
                                    <p className={`text-[10px] mt-4 font-bold text-center ${isDark ? 'text-ios-gray-300' : 'text-ios-gray-600'}`}>
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
                        <div className={`flex items-center gap-2 mb-2 ${isDark ? 'text-ios-gray-400' : 'text-ios-gray-500'}`}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <span className="text-[10px] font-black uppercase tracking-widest">{t('offline.storageStatus', 'Device Storage')}</span>
                        </div>
                        <p className={`text-[10px] font-bold ml-5 ${isDark ? 'text-ios-gray-300' : 'text-ios-gray-600'}`}>
                            {storageUsed.toUpperCase().replace(/\(([\d.]+)%\)/, (match, p1) => {
                                const val = parseFloat(p1);
                                return `(${val > 100 ? '100%+' : `${val}%`})`;
                            })}
                        </p>
                    </div>
                )}

                {/* Bottom Padding */}
                <div className="h-10" />
            </div>
        </motion.div>
    );
});

export default OfflineRouteDownloader;

