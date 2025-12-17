import { get, set, del, keys, clear } from 'idb-keyval';

// Cache configuration
const CACHE_CONFIG = {
  IEBC_OFFICES: 'iebc_offices_cache',
  IEBC_OFFICES_TIMESTAMP: 'iebc_offices_timestamp',
  USER_LOCATION: 'user_location_cache',
  MAP_TILES: 'map_tiles_cache',
  CACHE_MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
  MAX_OFFICES: 500,
  VERSION: '1.1.0'
} as const;

// Types
export interface CachedOffices {
  data: any[];
  timestamp: number;
  version: string;
  metadata: {
    count: number;
    lastUpdated: string;
  };
}

export interface OfflineSyncQueue {
  id: string;
  action: 'create' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: number;
  retries: number;
}

// Office caching
export async function getCachedOffices(): Promise<CachedOffices | null> {
  try {
    const cached = await get(CACHE_CONFIG.IEBC_OFFICES);
    const timestamp = await get(CACHE_CONFIG.IEBC_OFFICES_TIMESTAMP);
    
    if (!cached || !timestamp) return null;
    
    // Check if cache is expired
    if (Date.now() - timestamp > CACHE_CONFIG.CACHE_MAX_AGE) {
      await clearOfficesCache();
      return null;
    }
    
    return cached;
  } catch (error) {
    console.error('Error reading cached offices:', error);
    return null;
  }
}

export async function setCachedOffices(offices: any[]): Promise<void> {
  try {
    const cacheData: CachedOffices = {
      data: offices.slice(0, CACHE_CONFIG.MAX_OFFICES),
      timestamp: Date.now(),
      version: CACHE_CONFIG.VERSION,
      metadata: {
        count: offices.length,
        lastUpdated: new Date().toISOString()
      }
    };
    
    await set(CACHE_CONFIG.IEBC_OFFICES, cacheData);
    await set(CACHE_CONFIG.IEBC_OFFICES_TIMESTAMP, Date.now());
    
    // Update storage estimate
    await updateStorageEstimate();
  } catch (error) {
    console.error('Error caching offices:', error);
  }
}

export async function clearOfficesCache(): Promise<void> {
  try {
    await del(CACHE_CONFIG.IEBC_OFFICES);
    await del(CACHE_CONFIG.IEBC_OFFICES_TIMESTAMP);
  } catch (error) {
    console.error('Error clearing office cache:', error);
  }
}

// Offline sync queue
export async function addToSyncQueue(item: Omit<OfflineSyncQueue, 'id' | 'timestamp' | 'retries'>): Promise<string> {
  try {
    const id = crypto.randomUUID();
    const queueItem: OfflineSyncQueue = {
      ...item,
      id,
      timestamp: Date.now(),
      retries: 0
    };
    
    await set(`sync_queue_${id}`, queueItem);
    return id;
  } catch (error) {
    console.error('Error adding to sync queue:', error);
    throw error;
  }
}

export async function getSyncQueue(): Promise<OfflineSyncQueue[]> {
  try {
    const allKeys = await keys();
    const queueKeys = allKeys.filter(key => 
      typeof key === 'string' && key.startsWith('sync_queue_')
    ) as string[];
    
    const queueItems = await Promise.all(
      queueKeys.map(key => get(key))
    );
    
    return queueItems.filter(Boolean) as OfflineSyncQueue[];
  } catch (error) {
    console.error('Error getting sync queue:', error);
    return [];
  }
}

export async function removeFromSyncQueue(id: string): Promise<void> {
  try {
    await del(`sync_queue_${id}`);
  } catch (error) {
    console.error('Error removing from sync queue:', error);
  }
}

// Storage management
export async function getStorageEstimate(): Promise<{
  usage: number;
  quota: number;
  percentage: number;
}> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
        percentage: estimate.usage && estimate.quota 
          ? (estimate.usage / estimate.quota) * 100 
          : 0
      };
    } catch (error) {
      console.error('Error estimating storage:', error);
    }
  }
  
  return { usage: 0, quota: 0, percentage: 0 };
}

async function updateStorageEstimate(): Promise<void> {
  try {
    const estimate = await getStorageEstimate();
    
    // Warn if storage is getting full (>80%)
    if (estimate.percentage > 80) {
      console.warn(`Storage usage is high: ${estimate.percentage.toFixed(1)}%`);
      
      // Auto-clean old cache if >90%
      if (estimate.percentage > 90) {
        await clearOfficesCache();
      }
    }
  } catch (error) {
    // Silent fail
  }
}

// Network status
export class NetworkStatus {
  private static instance: NetworkStatus;
  private isOnline = navigator.onLine;
  private listeners: Array<(online: boolean) => void> = [];

  private constructor() {
    window.addEventListener('online', () => this.updateStatus(true));
    window.addEventListener('offline', () => this.updateStatus(false));
  }

  static getInstance(): NetworkStatus {
    if (!NetworkStatus.instance) {
      NetworkStatus.instance = new NetworkStatus();
    }
    return NetworkStatus.instance;
  }

  private updateStatus(online: boolean): void {
    this.isOnline = online;
    this.listeners.forEach(listener => listener(online));
    
    if (online) {
      this.triggerSync();
    }
  }

  addListener(listener: (online: boolean) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  isCurrentlyOnline(): boolean {
    return this.isOnline;
  }

  async triggerSync(): Promise<void> {
    if (!this.isOnline) return;
    
    const queue = await getSyncQueue();
    for (const item of queue) {
      try {
        // Implement sync logic based on item.action and item.table
        console.log(`Syncing ${item.action} for ${item.table}`, item.data);
        await removeFromSyncQueue(item.id);
      } catch (error) {
        console.error(`Sync failed for item ${item.id}:`, error);
        item.retries++;
        
        // Remove after too many retries
        if (item.retries > 3) {
          await removeFromSyncQueue(item.id);
        }
      }
    }
  }
}

// Export singleton
export const networkStatus = NetworkStatus.getInstance();