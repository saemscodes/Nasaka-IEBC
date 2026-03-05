// src/components/IEBCOffice/OfflineRouteDownloader.tsx
// Offline Trip Protection — download map tiles along a route for dead zones
import React, { useState, useEffect } from 'react';
import { getTilesForRoute, getStorageEstimate, requestPersistentStorage } from '@/utils/tileUtils';
import type { TileDownloadPlan } from '@/utils/tileUtils';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from 'sonner';

interface OfflineRouteDownloaderProps {
    routeGeometry: any;
    className?: string;
}

type DownloadStatus = 'idle' | 'calculating' | 'ready' | 'downloading' | 'done' | 'error';

const OfflineRouteDownloader: React.FC<OfflineRouteDownloaderProps> = ({
    routeGeometry,
    className = ''
}) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [status, setStatus] = useState<DownloadStatus>('idle');
    const [downloadMode, setDownloadMode] = useState<'minimal' | 'extended'>('minimal');
    const [plan, setPlan] = useState<TileDownloadPlan | null>(null);
    const [progress, setProgress] = useState(0);
    const [storageUsed, setStorageUsed] = useState<string>('');

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
        if (!plan || plan.tileCount === 0) return;

        // Request persistent storage
        await requestPersistentStorage();

        setStatus('downloading');
        setProgress(0);

        try {
            const cache = await caches.open('osm-tiles-cache');
            const total = plan.tiles.length;
            let completed = 0;
            const concurrency = 5;

            for (let i = 0; i < total; i += concurrency) {
                const batch = plan.tiles.slice(i, i + concurrency);
                const requests = batch.map(async (url) => {
                    try {
                        // Skip if already cached
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
            toast.success(`Route tiles saved! ${total} tiles cached for offline use.`);

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
        <div
            className={`
        rounded-2xl border overflow-hidden transition-all duration-300
        ${isDark
                    ? 'bg-card/80 border-border backdrop-blur-xl'
                    : 'bg-white/90 border-ios-gray-200 backdrop-blur-xl'
                }
        shadow-lg
        ${className}
      `}
        >
            {/* Header */}
            <div className="px-4 py-3 flex items-center gap-3">
                <div
                    className={`
            w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
            ${isDark ? 'bg-ios-blue/20' : 'bg-primary/10'}
          `}
                >
                    <svg
                        className={`w-5 h-5 ${isDark ? 'text-ios-blue-400' : 'text-primary'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <h4
                        className={`text-sm font-semibold leading-tight transition-colors duration-300
              ${isDark ? 'text-white' : 'text-foreground'}
            `}
                    >
                        Offline Trip Protection
                    </h4>
                    <p
                        className={`text-xs leading-tight mt-0.5 transition-colors duration-300
              ${isDark ? 'text-ios-gray-400' : 'text-muted-foreground'}
            `}
                    >
                        Save map tiles for navigation in dead zones
                    </p>
                </div>

                {/* Status badge */}
                {status === 'done' && (
                    <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium
              ${isDark ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-700'}
            `}
                    >
                        ✓ Saved
                    </span>
                )}
            </div>

            {/* Mode Toggle */}
            {status !== 'done' && status !== 'downloading' && (
                <div className="px-4 pb-2">
                    <div
                        className={`flex rounded-xl p-0.5 transition-colors duration-300
              ${isDark ? 'bg-ios-gray-700/50' : 'bg-secondary/50'}
            `}
                    >
                        <button
                            onClick={() => setDownloadMode('minimal')}
                            className={`flex-1 text-xs font-medium py-2 rounded-lg transition-all duration-200
                ${downloadMode === 'minimal'
                                    ? isDark
                                        ? 'bg-card text-white shadow-sm'
                                        : 'bg-white text-foreground shadow-sm'
                                    : isDark
                                        ? 'text-ios-gray-400'
                                        : 'text-muted-foreground'
                                }
              `}
                        >
                            Route Only
                        </button>
                        <button
                            onClick={() => setDownloadMode('extended')}
                            className={`flex-1 text-xs font-medium py-2 rounded-lg transition-all duration-200
                ${downloadMode === 'extended'
                                    ? isDark
                                        ? 'bg-card text-white shadow-sm'
                                        : 'bg-white text-foreground shadow-sm'
                                    : isDark
                                        ? 'text-ios-gray-400'
                                        : 'text-muted-foreground'
                                }
              `}
                        >
                            Extended Area
                        </button>
                    </div>
                </div>
            )}

            {/* Tile Info */}
            {plan && status !== 'done' && (
                <div className="px-4 pb-2">
                    <div
                        className={`flex items-center justify-between text-xs transition-colors duration-300
              ${isDark ? 'text-ios-gray-400' : 'text-muted-foreground'}
            `}
                    >
                        <span>{plan.tileCount} tiles · ~{plan.estimatedSizeMB} MB</span>
                        <span>Buffer: {plan.bufferKm} km</span>
                    </div>
                </div>
            )}

            {/* Progress Bar */}
            {status === 'downloading' && (
                <div className="px-4 pb-2">
                    <div
                        className={`w-full h-1.5 rounded-full overflow-hidden
              ${isDark ? 'bg-ios-gray-700' : 'bg-secondary'}
            `}
                    >
                        <div
                            className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-ios-blue to-ios-blue-light"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p
                        className={`text-xs text-center mt-1 transition-colors duration-300
              ${isDark ? 'text-ios-gray-400' : 'text-muted-foreground'}
            `}
                    >
                        Downloading tiles... {progress}%
                    </p>
                </div>
            )}

            {/* Download Button */}
            {(status === 'ready' || status === 'error') && (
                <div className="px-4 pb-3">
                    <button
                        onClick={handleDownload}
                        className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 active:scale-95
              ${isDark
                                ? 'bg-ios-blue/90 text-white hover:bg-ios-blue'
                                : 'bg-primary text-primary-foreground hover:bg-primary/90'
                            }
            `}
                    >
                        {status === 'error' ? 'Retry Download' : 'Save for Offline'}
                    </button>
                </div>
            )}

            {/* Storage Footer */}
            {storageUsed && (
                <div
                    className={`px-4 py-2 text-xs border-t transition-colors duration-300
            ${isDark ? 'border-border/50 text-ios-gray-500' : 'border-border/30 text-muted-foreground/70'}
          `}
                >
                    Storage: {storageUsed}
                </div>
            )}
        </div>
    );
};

export default OfflineRouteDownloader;
