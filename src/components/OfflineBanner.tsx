import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi, RefreshCw, Database, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { networkStatus, getCachedOffices } from '@/utils/offlineStorage';

interface OfflineBannerProps {
  className?: string;
  showWhenOnline?: boolean;
  compact?: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  className = '',
  showWhenOnline = false,
  compact = false
}) => {
  const [isOnline, setIsOnline] = useState(networkStatus.isCurrentlyOnline());
  const [cacheInfo, setCacheInfo] = useState<{
    hasCache: boolean;
    count: number;
    age: string;
  }>({ hasCache: false, count: 0, age: '' });
  const [isVisible, setIsVisible] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const removeListener = networkStatus.addListener((online) => {
      if (!online) {
        setWasOffline(true);
      }
      setIsOnline(online);
    });

    // Check cache on mount
    checkCache();

    return removeListener;
  }, []);

  useEffect(() => {
    // Show banner when offline or just came back online
    if (!isOnline) {
      setIsVisible(true);
    } else if (wasOffline) {
      setIsVisible(true);
      // Hide after 3 seconds when back online
      const timer = setTimeout(() => {
        setIsVisible(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    } else if (showWhenOnline) {
      setIsVisible(true);
    }
  }, [isOnline, wasOffline, showWhenOnline]);

  const checkCache = async () => {
    try {
      const cached = await getCachedOffices();
      if (cached?.data) {
        const ageMs = Date.now() - cached.timestamp;
        const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
        const ageMinutes = Math.floor((ageMs % (1000 * 60 * 60)) / (1000 * 60));
        
        let ageString = '';
        if (ageHours > 0) {
          ageString = `${ageHours}h ago`;
        } else if (ageMinutes > 0) {
          ageString = `${ageMinutes}m ago`;
        } else {
          ageString = 'just now';
        }

        setCacheInfo({
          hasCache: true,
          count: cached.data.length,
          age: ageString
        });
      }
    } catch (error) {
      console.error('Error checking cache:', error);
    }
  };

  if (!isVisible && !showWhenOnline) return null;

  if (compact) {
    return (
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full ${className}`}
          >
            <WifiOff className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-medium text-amber-700">Offline</span>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className={`overflow-hidden ${className}`}
        >
          <div className={`flex items-center justify-between px-4 py-2.5 ${
            isOnline 
              ? 'bg-green-50 border-b border-green-100' 
              : 'bg-amber-50 border-b border-amber-100'
          }`}>
            <div className="flex items-center gap-3">
              {isOnline ? (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">Back online</span>
                  </div>
                  <span className="text-xs text-green-600">Syncing latest data...</span>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <WifiOff className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-700">You're offline</span>
                  </div>
                  {cacheInfo.hasCache && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600">
                      <Database className="w-3.5 h-3.5" />
                      <span>{cacheInfo.count} offices cached</span>
                      <span className="text-amber-400">•</span>
                      <span>Updated {cacheInfo.age}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {!isOnline && cacheInfo.hasCache && (
              <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 rounded-full">
                <span className="text-xs font-medium text-amber-700">
                  Using cached data
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineBanner;
