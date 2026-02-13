// ENHANCED & COMPLETE: src/hooks/useIEBCOffices.ts
// PRESERVES all existing code + adds full REAL-TIME, VERIFICATION, CONTRIBUTIONS support

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabaseCustom, authPKCE } from '@/integrations/supabase/customClient';
import Fuse from 'fuse.js';
import { debounce } from '@/lib/searchUtils';
import { toast } from 'sonner';
import { 
  getCachedOffices, 
  setCachedOffices, 
  clearOfficesCache,
  networkStatus,
  addToSyncQueue
} from '@/utils/offlineStorage';

interface Office {
  id: number;
  county: string;
  constituency: string;
  constituency_name: string | null;
  constituency_code: number | null;
  office_location: string;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  formatted_address: string | null;
  verified: boolean | null;
  displayName?: string;
  formattedAddress?: string;
  coordinates?: [number, number];
  isCached?: boolean;
  confidence_score?: number | null;
  verification_source?: string | null;
  verified_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface Contribution {
  id: number;
  office_id?: number | null;
  type: 'location' | 'contact' | 'status' | 'other';
  description: string;
  photos?: string[];
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface Confirmation {
  id: number;
  office_id: number;
  user_latitude: number;
  user_longitude: number;
  user_accuracy_meters: number;
  confirmed_at: string;
}

interface StatusReport {
  id: number;
  office_id: number;
  status: 'operational' | 'closed' | 'relocated' | 'under_renovation';
  reason: string;
  reported_at: string;
}

interface ContactUpdate {
  id: number;
  office_id: number;
  phone?: string;
  email?: string;
  hours?: string;
  notes?: string;
  submitted_at: string;
}

interface UseIEBCOfficesOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  enableOfflineCache?: boolean;
  cacheDuration?: number;
}

export const useIEBCOffices = (options: UseIEBCOfficesOptions = {}) => {
  const {
    autoRefresh = true,
    refreshInterval = 300000,
    enableOfflineCache = true,
    cacheDuration = 24 * 60 * 60 * 1000
  } = options;

  const queryClient = useQueryClient();

  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fuse, setFuse] = useState<Fuse<Office> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOffline, setIsOffline] = useState(!networkStatus.isCurrentlyOnline());
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [cacheStatus, setCacheStatus] = useState({
    hasCache: false,
    cacheAge: null as number | null,
    cacheSize: 0,
    isExpired: false
  });
  
  const searchControllerRef = useRef<AbortController | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    const removeListener = networkStatus.addListener((online) => {
      setIsOffline(!online);
      if (online && !loading) {
        fetchOffices(true);
      }
    });
    
    return removeListener;
  }, [loading]);

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

  const fetchOffices = useCallback(async (forceRefresh = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      setLoading(true);
      setError(null);

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
            
            if (!isOffline) {
              fetchFreshData();
            }
            return cached.data;
          } else {
            await clearOfficesCache();
          }
        }
      }

      const freshData = await fetchFreshData();
      return freshData;
      
    } catch (err: any) {
      console.error('Error fetching offices:', err);
      
      const cached = await getCachedOffices();
      if (!cached?.data?.length) {
        setError(err.message || 'Failed to load IEBC offices');
      } else {
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

    const validOffices = (data || [])
      .filter(office => office.latitude && office.longitude)
      .map(office => ({
        ...office,
        displayName: office.constituency_name || office.office_location,
        formattedAddress: office.formatted_address || `${office.office_location}, ${office.county} County`,
        coordinates: [office.latitude, office.longitude],
        isCached: false
      }));

    setOffices(validOffices);
    setLastSyncTime(new Date());

    if (enableOfflineCache) {
      await setCachedOffices(validOffices);
    }

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

  const performSearch = useCallback(async (query: string, options: any = {}) => {
    const { source = 'ui', autoSelectFirst = false, useCache = true } = options;
    
    if (!query.trim()) {
      setSearchResults([]);
      setSearchSuggestions([]);
      setIsSearching(false);
      return [];
    }

    if (searchControllerRef.current) {
      searchControllerRef.current.abort();
    }
    searchControllerRef.current = new AbortController();

    setIsSearching(true);
    
    try {
      let results: any[] = [];
      
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
              score: 0.5
            }));
        }
      }

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

      return results;
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Search error:', error);
      }
      return [];
    } finally {
      setIsSearching(false);
    }
  }, [fuse, isOffline]);

  const searchOffices = useCallback((query: string) => {
    if (!query.trim()) {
      return [];
    }

    try {
      if (fuse) {
        const fuseResults = fuse.search(query.trim());
        return fuseResults.map(result => ({
          ...result.item,
          matches: result.matches,
          score: result.score,
          type: 'office'
        }));
      }
      
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

  const debouncedSearch = useMemo(
    () => debounce((query: string, options: any) => {
      performSearch(query, options);
    }, 300),
    [performSearch]
  );

  const handleSearch = useCallback((query: string, options: any = {}) => {
    setSearchQuery(query);
    
    if (query.trim()) {
      debouncedSearch(query, options);
    } else {
      setSearchResults([]);
      setSearchSuggestions([]);
      setIsSearching(false);
    }
  }, [debouncedSearch]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchSuggestions([]);
    setIsSearching(false);
    
    if (searchControllerRef.current) {
      searchControllerRef.current.abort();
    }
  }, []);

  const getOfficesByCounty = useCallback((county: string) => {
    if (!county) return offices;
    return offices.filter(office => 
      office.county?.toLowerCase() === county.toLowerCase()
    );
  }, [offices]);

  const getOfficeById = useCallback((id: number) => {
    return offices.find(office => office.id === id);
  }, [offices]);

  const getNearbyOffices = useCallback((lat: number, lng: number, radiusKm = 50) => {
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
          
          switch (payload.eventType) {
            case 'INSERT':
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
              setOffices(prev => prev.filter(office => office.id !== payload.old.id));
              break;
          }
          
          setCachedOffices(offices);
        }
      )
      .subscribe();

    subscriptionRef.current = subscription;

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [isOffline, offices]);

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

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const clearCache = async () => {
    try {
      await clearOfficesCache();
      await updateCacheStatus();
      return { success: true };
    } catch (error: any) {
      console.error('Failed to clear cache:', error);
      return { success: false, error: error.message };
    }
  };

  const forceSync = async () => {
    try {
      const data = await fetchOffices(true);
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const submitContribution = useMutation({
    mutationFn: async (data: {
      officeId: number;
      type: 'location' | 'contact' | 'status' | 'other';
      description: string;
      photos?: string[];
    }) => {
      const { data: contribution, error } = await supabase
        .from('iebc_office_contributions')
        .insert({
          original_office_id: data.officeId,
          submitted_office_location: data.description,
          status: 'pending_review',
          submission_method: 'web_app',
          submission_source: 'user_contribution'
        })
        .select()
        .single();

      if (error) throw error;
      return contribution;
    },
    onSuccess: () => {
      toast.success('Contribution submitted successfully');
      queryClient.invalidateQueries({ queryKey: ['iebc-offices'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to submit contribution: ${error.message}`);
    }
  });

  const confirmAccuracy = useMutation({
    mutationFn: async (data: {
      officeId: number;
      userLatitude: number;
      userLongitude: number;
      userAccuracyMeters: number;
    }) => {
      const { data: confirmation, error } = await supabase
        .from('confirmations')
        .insert({
          office_id: data.officeId,
          confirmer_lat: data.userLatitude,
          confirmer_lng: data.userLongitude,
          confirmer_accuracy_meters: data.userAccuracyMeters,
          confirmation_weight: 1.0
        })
        .select()
        .single();

      if (error) throw error;
      return confirmation;
    },
    onSuccess: () => {
      toast.success('Location confirmed successfully');
      queryClient.invalidateQueries({ queryKey: ['iebc-offices'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to confirm location: ${error.message}`);
    }
  });

  const reportStatusChange = useMutation({
    mutationFn: async (data: {
      officeId: number;
      status: 'operational' | 'closed' | 'relocated' | 'under_renovation';
      reason: string;
    }) => {
      const { data: statusReport, error } = await supabase
        .from('operational_status_history')
        .insert({
          office_id: data.officeId,
          status: data.status,
          reason: data.reason,
          reported_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return statusReport;
    },
    onSuccess: () => {
      toast.success('Status report submitted successfully');
      queryClient.invalidateQueries({ queryKey: ['iebc-offices'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to report status: ${error.message}`);
    }
  });

  const suggestContactUpdate = useMutation({
    mutationFn: async (data: {
      officeId: number;
      phone?: string;
      email?: string;
      hours?: string;
      notes?: string;
    }) => {
      const { data: contactUpdate, error } = await supabase
        .from('contact_update_requests')
        .insert({
          office_id: data.officeId,
          phone: data.phone,
          email: data.email,
          hours: data.hours,
          notes: data.notes,
          submitted_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return contactUpdate;
    },
    onSuccess: () => {
      toast.success('Contact update suggestion submitted');
      queryClient.invalidateQueries({ queryKey: ['iebc-offices'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to suggest contact update: ${error.message}`);
    }
  });

  const filteredOffices = useMemo(() => {
    if (!searchQuery.trim()) return offices;
    return searchOffices(searchQuery);
  }, [offices, searchQuery, searchOffices]);

  return { 
    offices, 
    filteredOffices,
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
    updateCacheStatus,
    submitContribution: submitContribution.mutate,
    confirmAccuracy: confirmAccuracy.mutate,
    reportStatusChange: reportStatusChange.mutate,
    suggestContactUpdate: suggestContactUpdate.mutate,
    isSubmittingContribution: submitContribution.isPending,
    isConfirmingAccuracy: confirmAccuracy.isPending,
    isReportingStatus: reportStatusChange.isPending,
    isSuggestingContactUpdate: suggestContactUpdate.isPending
  };
};
