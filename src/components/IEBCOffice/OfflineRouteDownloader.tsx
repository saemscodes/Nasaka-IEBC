import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { getTilesForRoute, getStorageEstimate, requestPersistentStorage } from '@/utils/tileUtils';
import type { TileDownloadPlan } from '@/utils/tileUtils';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface OfflineRouteDownloaderProps {
    routeGeometry: any;
    className?: string;
    onGoToDetails?: () => void;
}

export interface OfflineDownloaderHandle {
    startDownload: (mode?: 'minimal' | 'extended') => Promise<void>;
    status: DownloadStatus;
}

type DownloadStatus = 'idle' | 'calculating' | 'ready' | 'downloading' | 'done' | 'error';

const OfflineRouteDownloader = forwardRef<OfflineDownloaderHandle, OfflineRouteDownloaderProps>(({
    routeGeometry,
    className = '',
    onGoToDetails
}, ref) => {
    const { t } = useTranslation('nasaka');
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [status, setStatus] = useState<DownloadStatus>('idle');
    const [downloadMode, setDownloadMode] = useState<'minimal' | 'extended'>('minimal');
    const [plan, setPlan] = useState<TileDownloadPlan | null>(null);
    const [progress, setProgress] = useState(0);
    const [storageUsed, setStorageUsed] = useState<string>('');

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
        // If already downloading or done, don't restart unless error
        if (status === 'downloading' || status === 'done') {
            if (status === 'done') toast.info("Tiles already cached!");
            return;
        }

        if (!plan || plan.tileCount === 0) {
            toast.error("No map data found for this route.");
            return;
        }

        // Request persistent storage
        await requestPersistentStorage();

        setStatus('downloading');
        setProgress(0);

        try {
            const cache = await caches.open('osm-tiles-cache');
            const total = plan.tiles.length;
            let completed = 0;
            const concurrency = 8; // Increased for "HAM" performance

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

            // Refresh storage info
            const est = await getStorageEstimate();
            if (est) setStorageUsed(`${est.usedMB} MB / ${est.quotaMB} MB (${est.percentUsed}%)`);
        } catch (err) {
            console.error('[OfflineDownloader] Failed:', err);
            setStatus('error');
            toast.error('Download failed. Check your connection or storage space.');
        }
    };

    if (!routeGeometry) return null;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`
                rounded-3xl border overflow-hidden transition-all duration-500
                ${isDark
                    ? 'bg-ios-gray-900/40 border-white/10 backdrop-blur-3xl'
                    : 'bg-white/40 border-black/5 backdrop-blur-3xl'
                }
                shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)]
                ${className}
            `}
        >
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

            {/* Header */}
            <div className="px-5 py-4 flex items-center gap-4 relative z-10">
                <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`
                        w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg
                        ${isDark ? 'bg-ios-blue/30 border border-ios-blue/30' : 'bg-ios-blue/10 border border-ios-blue/20'}
                    `}
                >
                    <svg
                        className={`w-6 h-6 ${isDark ? 'text-ios-blue-400' : 'text-ios-blue'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                    </svg>
                </motion.div>

                <div className="flex-1 min-w-0">
                    <h4 className={`text-base font-bold tracking-tight ${isDark ? 'text-white' : 'text-ios-gray-900'}`}>
                        {t('offline.title', 'Offline Trip Protection')}
                    </h4>
                    <p className={`text-xs font-medium mt-0.5 opacity-70 ${isDark ? 'text-ios-gray-300' : 'text-ios-gray-600'}`}>
                        {t('offline.description', 'Save map details for dead zones')}
                    </p>
                </div>

                {onGoToDetails && (
                    <button
                        onClick={onGoToDetails}
                        className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
                    >
                        <svg className="w-5 h-5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Content Area */}
            <AnimatePresence mode="wait">
                {status !== 'downloading' && status !== 'done' ? (
                    <motion.div
                        key="controls"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="px-5 pb-5 space-y-4"
                    >
                        {/* Mode Selector */}
                        <div className={`flex rounded-2xl p-1 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                            {['minimal', 'extended'].map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setDownloadMode(mode as any)}
                                    className={`flex-1 text-xs font-bold py-2.5 rounded-xl transition-all duration-300
                                        ${downloadMode === mode
                                            ? 'bg-white dark:bg-ios-gray-800 text-ios-blue shadow-sm scale-[1.02]'
                                            : 'text-ios-gray-500 hover:text-ios-gray-700 dark:hover:text-ios-gray-300'
                                        }
                                    `}
                                >
                                    {mode === 'minimal' ? t('offline.modeMinimal', 'Route Only') : t('offline.modeExtended', 'Full Area')}
                                </button>
                            ))}
                        </div>

                        {/* Stats & Action */}
                        <div className="flex items-center justify-between">
                            <div className="text-xs font-semibold opacity-60">
                                {plan?.tileCount || 0} {t('offline.tiles', 'tiles')} · ~{plan?.estimatedSizeMB || 0} MB
                            </div>
                            <button
                                onClick={handleDownload}
                                disabled={status === 'calculating'}
                                className={`px-6 py-2.5 rounded-2xl text-sm font-bold shadow-xl transition-all active:scale-95
                                    ${status === 'calculating' ? 'opacity-50 cursor-not-allowed' : ''}
                                    ${isDark ? 'bg-ios-blue text-white' : 'bg-ios-blue text-white'}
                                `}
                            >
                                {status === 'error' ? t('common.retry', 'Retry') : t('offline.downloadRoute', 'Download Now')}
                            </button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="progress"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="px-5 pb-6"
                    >
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-xs font-bold text-ios-blue">
                                {status === 'done' ? t('offline.statusComplete', 'PROTECTION ACTIVE') : t('offline.statusDownloading', 'SECURING TRIP...')}
                            </span>
                            <span className="text-lg font-black italic">{progress}%</span>
                        </div>
                        <div className={`w-full h-3 rounded-full overflow-hidden p-0.5 ${isDark ? 'bg-white/10' : 'bg-black/5'}`}>
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                className="h-full rounded-full bg-gradient-to-r from-ios-blue via-ios-blue-light to-white shadow-[0_0_10px_rgba(0,122,255,0.5)]"
                            />
                        </div>
                        {status === 'done' && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-[10px] text-center mt-2 font-bold uppercase tracking-widest opacity-50"
                            >
                                persistent storage locked ✓
                            </motion.p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Storage Info Footer */}
            {storageUsed && (
                <div className={`px-5 py-2.5 text-[10px] font-bold tracking-tight border-t ${isDark ? 'border-white/5 bg-white/5 text-ios-gray-500' : 'border-black/5 bg-black/5 text-ios-gray-500'}`}>
                    DEVICE CAPACITY: {storageUsed.toUpperCase()}
                </div>
            )}
        </motion.div>
    );
});

export default OfflineRouteDownloader;
