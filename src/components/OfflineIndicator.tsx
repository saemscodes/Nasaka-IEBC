import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, Cloud, Download } from 'lucide-react';
import { networkStatus } from '@/utils/offlineStorage';
import { supabase } from '@/integrations/supabase/client';

interface OfflineIndicatorProps {
  showSyncButton?: boolean;
  className?: string;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ 
  showSyncButton = true,
  className = ''
}) => {
  const [isOnline, setIsOnline] = useState(networkStatus.isCurrentlyOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [storageInfo, setStorageInfo] = useState<{
    usage: number;
    quota: number;
    percentage: number;
  } | null>(null);

  useEffect(() => {
    const removeListener = networkStatus.addListener((online) => {
      setIsOnline(online);
      if (online) {
        handleSync();
      }
    });
    
    // Initial storage check
    checkStorage();
    
    return removeListener;
  }, []);

  const checkStorage = async () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        setStorageInfo({
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
          percentage: estimate.usage && estimate.quota 
            ? (estimate.usage / estimate.quota) * 100 
            : 0
        });
      } catch (error) {
        console.error('Storage estimate error:', error);
      }
    }
  };

  const handleSync = async () => {
    if (!isOnline || isSyncing) return;
    
    setIsSyncing(true);
    try {
      // Refresh session if needed
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }
      
      // Trigger sync from network status
      await networkStatus.triggerSync();
      
      setLastSyncTime(new Date());
      
      // Update storage info
      await checkStorage();
      
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isOnline && !showSyncButton) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {!isOnline ? (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
          <WifiOff className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-700">Working offline</span>
          <span className="text-xs text-amber-600">• Using cached data</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
            <Wifi className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">Online</span>
          </div>
          
          {showSyncButton && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                  <span className="text-sm font-medium text-blue-700">Syncing...</span>
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">Sync Now</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
      
      {storageInfo && storageInfo.quota > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
          <Download className="w-4 h-4 text-gray-600" />
          <div className="flex flex-col">
            <span className="text-xs font-medium text-gray-700">
              {formatBytes(storageInfo.usage)} / {formatBytes(storageInfo.quota)}
            </span>
            <div className="w-24 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${Math.min(storageInfo.percentage, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}
      
      {lastSyncTime && (
        <div className="text-xs text-gray-500">
          Last sync: {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  );
};

export default OfflineIndicator;