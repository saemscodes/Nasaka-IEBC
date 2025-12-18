// src/hooks/useIEBCOffices.js - COMPLETE WITH OFFLINE SUPPORT
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { supabaseCustom, authPKCE } from '@/integrations/supabase/customClient';
import Fuse from 'fuse.js';
import { debounce } from '@/lib/searchUtils';
import { 
  getCachedOffices, 
  setCachedOffices, 
  clearOfficesCache,
  networkStatus,
  addToSyncQueue
} from '@/utils/offlineStorage';

export const useIEBCOffices = (options = {}) => {
  const {
    autoRefresh = true,
    refreshInterval = 300000, // 5 minutes
    enableOfflineCache = true,
    cacheDuration = 24 * 60 * 60 * 1000 // 24 hours
  } = options;

  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fuse, setFuse] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOffline, setIsOffline] = useState(!networkStatus.isCurrentlyOnline());
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [cacheStatus, setCacheStatus] = useState({
    hasCache: false,
    cacheAge: null,
    cacheSize: 0
  });
  
  const searchControllerRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Listen to network status changes
  useEffect(() => {
    const removeListener = networkStatus.addListener((online) => {
      setIsOffline(!online);
      if (online && !loading) {
        // Auto-refresh when coming back online
        fetchOffices(true);
      }
    });
    
    return removeListener;
  }, [loading]);

  // Check cache status
  const updateCacheStatus = useCallback(async () => {
    try {
      const cached = await getCachedOffices();
      if (cached) {
        const age = Date.now() - cached.timestamp;
        setCacheStatus({
          hasCache: true,
          cacheAge: age,
          cacheSize: cached.data?.length || 0,
          isExpired: age > cacheDuration
        });
      } else {
        setCacheStatus({
          hasCache: false,
          cacheAge: null,
          cacheSize: 0,
          isExpired: false
        });
      }
    } catch (err) {
      console.warn('Failed to check cache status:', err);
    }
  }, [cacheDuration]);

  // Main fetch function with offline support
  const fetchOffices = useCallback(async (forceRefresh = false) => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      setLoading(true);
      setError(null);

      // Check cache first (unless force refresh or offline)
      if (enableOfflineCache && !forceRefresh && !isOffline) {
        const cached = await getCachedOffices();
        if (cached?.data?.length > 0) {
          const cacheAge = Date.now() - cached.timestamp;
          const isCacheValid = cacheAge < cacheDuration;
          
          if (isCacheValid) {
            setOffices(cached.data);
            setLastSyncTime(new Date(cached.timestamp));
            setLoading(false);
            await updateCacheStatus();
            
            // Fetch fresh data in background if online
            if (!isOffline) {
              fetchFreshData();
            }
            return cached.data;
          } else {
            // Clear expired cache
            await clearOfficesCache();
          }
        }
      }

      // Fetch fresh data
      const freshData = await fetchFreshData();
      return freshData;
      
    } catch (err) {
      console.error('Error fetching offices:', err);
      
      // Only set error if we don't have cached data
      const cached = await getCachedOffices();
      if (!cached?.data?.length) {
        setError(err.message || 'Failed to load IEBC offices');
      } else {
        // Use cached data as fallback
        setOffices(cached.data);
        setLastSyncTime(new Date(cached.timestamp));
        setError('Using cached data - ' + (err.message || 'Network error'));
      }
      
      return [];
    } finally {
      setLoading(false);
      await updateCacheStatus();
    }
  }, [enableOfflineCache, cacheDuration, isOffline, updateCacheStatus]);

  const fetchFreshData = async () => {
    if (isOffline) {
      throw new Error('Device is offline - using cached data');
    }

    // Use appropriate client based on context
    const client = window.location.pathname.includes('/admin') ? supabaseCustom : supabase;
    
    const { data, error: supabaseError } = await client
      .from('iebc_offices')
      .select('*')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .eq('verified', true)
      .order('county')
      .order('constituency_name');

    if (supabaseError) throw supabaseError;

    // Filter out offices without coordinates and add formatted data
    const validOffices = (data || [])
      .filter(office => office.latitude && office.longitude)
      .map(office => ({
        ...office,
        displayName: office.constituency_name || office.office_location,
        formattedAddress: office.formatted_address || `${office.office_location}, ${office.county} County`,
        coordinates: [office.latitude, office.longitude],
        isCached: false
      }));

    // Update state
    setOffices(validOffices);
    setLastSyncTime(new Date());

    // Cache the data
    if (enableOfflineCache) {
      await setCachedOffices(validOffices);
    }

    // Initialize/update Fuse.js for search
    const fuseOptions = {
      keys: [
        'county',
        'constituency_name',
        'constituency',
        'office_location',
        'landmark',
        'clean_office_location',
        'formatted_address',
        'displayName'
      ],
      threshold: 0.3,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2,
      shouldSort: true,
      findAllMatches: true,
      useExtendedSearch: true,
      ignoreLocation: true,
      distance: 100
    };
    
    setFuse(new Fuse(validOffices, fuseOptions));

    return validOffices;
  };

  // Enhanced search function with offline support
  const performSearch = useCallback(async (query, options = {}) => {
    const { source = 'ui', autoSelectFirst = false, useCache = true } = options;
    
    if (!query.trim()) {
      setSearchResults([]);
      setSearchSuggestions([]);
      setIsSearching(false);
      return [];
    }

    // Cancel previous search
    if (searchControllerRef.current) {
      searchControllerRef.current.abort();
    }
    searchControllerRef.current = new AbortController();

    setIsSearching(true);
    
    try {
      let results = [];
      
      // Try to use Fuse search first
      if (fuse) {
        const fuseResults = fuse.search(query.trim());
        results = fuseResults.map(result => ({
          ...result.item,
          matches: result.matches,
          score: result.score,
          type: 'office',
          isCached: result.item.isCached || false
        }));
      } else if (useCache) {
        // Fallback to cached data search
        const cached = await getCachedOffices();
        if (cached?.data?.length) {
          const lowercaseQuery = query.toLowerCase();
          results = cached.data
            .filter(office => 
              office.county?.toLowerCase().includes(lowercaseQuery) ||
              office.constituency_name?.toLowerCase().includes(lowercaseQuery) ||
              office.office_location?.toLowerCase().includes(lowercaseQuery)
            )
            .map(office => ({
              ...office,
              type: 'office',
              isCached: true,
              score: 0.5 // Default score for cache results
            }));
        }
      }

      // Add search query suggestion
      if (query.length > 2 && results.length === 0) {
        results.push({
          id: `search-${Date.now()}`,
          name: `Search for "${query}"`,
          subtitle: 'No exact matches found',
          type: 'search_query',
          query: query,
          searchSource: source,
          action: 'search'
        });
      }

      // Add offline indicator if searching offline
      if (isOffline) {
        results.unshift({
          id: 'offline-indicator',
          name: 'Working Offline',
          subtitle: 'Showing cached results only',
          type: 'status',
          icon: 'wifi-off'
        });
      }

      setSearchResults(results.slice(0, 20));
      setSearchSuggestions(results.slice(0, 8));
      
      // Analytics event (optional)
      if (window.gtag && source !== 'url' && !isOffline) {
        window.gtag('event', 'search', {
          search_term: query,
          search_source: source,
          result_count: results.length,
          is_offline: isOffline
        });
      }

      return results;
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Search error:', error);
      }
      return [];
    } finally {
      setIsSearching(false);
    }
  }, [fuse, isOffline]);

  // Simple search function
  const searchOffices = useCallback((query) => {
    if (!query.trim()) {
      return [];
    }

    try {
      // First try Fuse search
      if (fuse) {
        const fuseResults = fuse.search(query.trim());
        return fuseResults.map(result => ({
          ...result.item,
          matches: result.matches,
          score: result.score,
          type: 'office'
        }));
      }
      
      // Fallback to basic array search
      const lowercaseQuery = query.toLowerCase();
      return offices.filter(office => 
        office.county?.toLowerCase().includes(lowercaseQuery) ||
        office.constituency_name?.toLowerCase().includes(lowercaseQuery) ||
        office.office_location?.toLowerCase().includes(lowercaseQuery)
      ).map(office => ({
        ...office,
        type: 'office',
        score: 0.5
      }));
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }, [fuse, offices]);

  // Debounced search for typing
  const debouncedSearch = useMemo(
    () => debounce((query, options) => {
      performSearch(query, options);
    }, 300),
    [performSearch]
  );

  // Search handler
  const handleSearch = useCallback((query, options = {}) => {
    setSearchQuery(query);
    
    if (query.trim()) {
      debouncedSearch(query, options);
    } else {
      setSearchResults([]);
      setSearchSuggestions([]);
      setIsSearching(false);
    }
  }, [debouncedSearch]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchSuggestions([]);
    setIsSearching(false);
    
    if (searchControllerRef.current) {
      searchControllerRef.current.abort();
    }
  }, []);

  // Get offices by county
  const getOfficesByCounty = useCallback((county) => {
    if (!county) return offices;
    return offices.filter(office => 
      office.county?.toLowerCase() === county.toLowerCase()
    );
  }, [offices]);

  // Get office by ID
  const getOfficeById = useCallback((id) => {
    return offices.find(office => office.id === id);
  }, [offices]);

  // Get nearby offices
  const getNearbyOffices = useCallback((lat, lng, radiusKm = 50) => {
    if (!lat || !lng) return [];
    
    return offices.filter(office => {
      if (!office.latitude || !office.longitude) return false;
      
      const distance = calculateDistance(
        lat, lng,
        office.latitude, office.longitude
      );
      
      return distance <= radiusKm;
    });
  }, [offices]);

  // Auto-refresh mechanism
  useEffect(() => {
    if (autoRefresh && !isOffline) {
      refreshTimerRef.current = setInterval(() => {
        fetchOffices(true);
      }, refreshInterval);
    }
    
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, fetchOffices, isOffline]);

  // Real-time subscription for database changes
  useEffect(() => {
    if (isOffline) return;
    
    const subscription = supabase
      .channel('iebc-offices-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'iebc_offices',
          filter: 'verified=eq.true'
        },
        (payload) => {
          console.log('Database change detected:', payload.eventType);
          
          // Handle different event types
          switch (payload.eventType) {
            case 'INSERT':
              // Add new office if verified
              if (payload.new.verified) {
                setOffices(prev => {
                  const exists = prev.find(o => o.id === payload.new.id);
                  if (exists) return prev;
                  return [...prev, {
                    ...payload.new,
                    displayName: payload.new.constituency_name || payload.new.office_location,
                    formattedAddress: payload.new.formatted_address || `${payload.new.office_location}, ${payload.new.county} County`,
                    coordinates: [payload.new.latitude, payload.new.longitude]
                  }];
                });
              }
              break;
              
            case 'UPDATE':
              // Update existing office
              setOffices(prev => 
                prev.map(office => 
                  office.id === payload.new.id 
                    ? {
                        ...office,
                        ...payload.new,
                        displayName: payload.new.constituency_name || payload.new.office_location,
                        formattedAddress: payload.new.formatted_address || `${payload.new.office_location}, ${payload.new.county} County`,
                        coordinates: [payload.new.latitude, payload.new.longitude]
                      }
                    : office
                )
              );
              break;
              
            case 'DELETE':
              // Remove deleted office
              setOffices(prev => prev.filter(office => office.id !== payload.old.id));
              break;
          }
          
          // Update cache
          setCachedOffices(offices);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [isOffline, offices]);

  // Initial fetch
  useEffect(() => {
    fetchOffices();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, []);

  // Helper function to calculate distance
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Clear cache
  const clearCache = async () => {
    try {
      await clearOfficesCache();
      await updateCacheStatus();
      return { success: true };
    } catch (error) {
      console.error('Failed to clear cache:', error);
      return { success: false, error: error.message };
    }
  };

  // Force sync
  const forceSync = async () => {
    try {
      const data = await fetchOffices(true);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  return { 
    offices, 
    loading, 
    error, 
    refetch: () => fetchOffices(true),
    searchQuery,
    searchResults,
    searchSuggestions,
    isSearching,
    isOffline,
    lastSyncTime,
    cacheStatus,
    handleSearch,
    clearSearch,
    performSearch,
    searchOffices,
    getOfficesByCounty,
    getOfficeById,
    getNearbyOffices,
    clearCache,
    forceSync,
    updateCacheStatus
  };
};