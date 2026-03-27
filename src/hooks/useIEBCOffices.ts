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
  getCacheTimestamp,
  verifyInternetPath,
  networkStatus,
  addToSyncQueue
} from '@/utils/offlineStorage';
import { calculateDistance } from '@/utils/geoUtils';

interface Office {
  // Common Fields
  id: number | string;
  type: 'office' | 'diaspora';
  latitude: number | null;
  longitude: number | null;
  formatted_address: string | null;
  verified: boolean | null;
  created_at: string | null;
  updated_at: string | null;

  // Domestic (IEBC) Fields
  county?: string | null;
  constituency?: string | null;
  constituency_name?: string | null;
  constituency_code?: number | null;
  ward?: string | null;
  ward_id?: string | null;
  office_location?: string;
  landmark?: string | null;
  landmark_type?: string | null;
  landmark_subtype?: string | null;
  clean_office_location?: string | null;

  // Geolocation & Verification (Precision Refinements)
  geocode_status?: string | null;
  geocode_method?: string | null;
  geocode_confidence?: number | null;
  geocode_verified?: boolean | null;
  geocode_verified_at?: string | null;
  multi_source_confidence?: number | null;
  confidence_score?: number | null;
  verification_source?: string | null;
  verified_at?: string | null;

  // Physical & GIS data
  elevation_meters?: number | null;
  isochrone_15min?: string | null;
  isochrone_30min?: string | null;
  isochrone_45min?: string | null;
  landmark_normalized?: string | null;
  landmark_source?: string | null;
  walking_effort?: string | null;

  // Diaspora Specific Fields
  mission_name?: string | null;
  mission_type?: 'high_commission' | 'embassy' | 'consulate' | 'liaison' | null;
  city?: string | null;
  country?: string | null;
  country_code?: string | null;
  continent?: 'Africa' | 'Europe' | 'Americas' | 'Asia' | 'Oceania' | 'MiddleEast' | null;
  region?: string | null;
  google_maps_url?: string | null;
  phone?: string | null;
  email?: string | null;
  website_url?: string | null;
  whatsapp?: string | null;
  designation_state?: 'embassy_only' | 'embassy_probable' | 'iebc_confirmed' | null;
  designated_2017?: boolean | null;
  designated_2022?: boolean | null;
  designation_count?: number | null;
  is_iebc_confirmed_2027?: boolean | null;
  confirmed_2027_source_url?: string | null;
  confirmed_2027_gazette_ref?: string | null;
  services_2027?: any | null;
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
  voting_date?: string | null;
  registration_requirements?: any | null;
  inquiry_contact_name?: string | null;
  inquiry_contact_email?: string | null;
  inquiry_notes?: string | null;

  // UI Derived Fields (Internal)
  displayName?: string;
  formattedAddress?: string;
  coordinates?: [number, number];
  isCached?: boolean;
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
  const [offlineWarning, setOfflineWarning] = useState<string | null>(null);
  const [fuse, setFuse] = useState<Fuse<Office> | null>(null);
  const loadingFailsafeRef = useRef<NodeJS.Timeout | null>(null);
  const hasFetchedRef = useRef(false);
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

  /**
   * Fetches only the latest updated_at timestamp to check for freshness
   * Minimal data transfer, maximal insight.
   */
  const fetchRemoteTimestamp = useCallback(async () => {
    try {
      if (!navigator.onLine) return null;
      const isActuallyOnline = await verifyInternetPath();
      if (!isActuallyOnline) return null;

      const { data, error } = await supabase
        .from('iebc_offices')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      const officeData = data as any;
      if (error || !officeData) return null;
      return new Date(officeData.updated_at).getTime();
    } catch {
      return null;
    }
  }, []);

  const fetchOffices = useCallback(async (forceRefresh = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    // FAILSAFE: Absolutely guarantee loading resolves within 20s no matter what
    if (loadingFailsafeRef.current) clearTimeout(loadingFailsafeRef.current);
    loadingFailsafeRef.current = setTimeout(() => {
      setLoading(prev => {
        if (prev) console.warn('[useIEBCOffices] FAILSAFE: Force-clearing stuck loading state after 20s');
        return false;
      });
    }, 20000);

    try {
      setLoading(true);
      setError(null);
      setOfflineWarning(null);

      if (enableOfflineCache && !forceRefresh) {
        const cached = await getCachedOffices();
        if (cached?.data?.length > 0) {
          const cacheAge = Date.now() - cached.timestamp;

          // PHASE 2: Check for remote updates if we are online
          let isStaleByRemote = false;
          if (!isOffline) {
            const remoteTS = await fetchRemoteTimestamp();
            if (remoteTS && remoteTS > cached.timestamp) {
              console.log('[useIEBCOffices] Remote data is newer than cache. Triggering fresh fetch.');
              isStaleByRemote = true;
            }
          }

          const isCacheValid = !isStaleByRemote && cacheAge < cacheDuration;

          if (isCacheValid) {
            setOffices(cached.data);
            setLastSyncTime(new Date(cached.timestamp));
            setLoading(false);
            if (loadingFailsafeRef.current) clearTimeout(loadingFailsafeRef.current);
            await updateCacheStatus();

            // Background refresh only if cache is aged and we are CERTAINLY online
            if (!isOffline && cacheAge > (cacheDuration / 2)) {
              // Verify real internet path before background fetch to avoid "ghost" online states
              verifyInternetPath().then(isReallyOnline => {
                if (isReallyOnline) {
                  fetchFreshData().catch(bgErr => {
                    console.warn('[useIEBCOffices] Background refresh failed:', bgErr?.message);
                  });
                }
              });
            }
            return cached.data;
          }
        }
      }

      const freshData = await fetchFreshData();
      return freshData;

    } catch (err: any) {
      console.error('Error fetching offices:', err);

      const cached = await getCachedOffices();
      if (!cached?.data?.length) {
        // If NO cache and network failed, we MUST show an error
        setError('Your internet appears to be down. Please check your connection to load the latest IEBC offices.');
      } else {
        // If we have cache, use it and don't show a blocking error
        setOffices(cached.data);
        setLastSyncTime(new Date(cached.timestamp));
        setError(null);
        setOfflineWarning('Offline Mode: Using cached data from ' + new Date(cached.timestamp).toLocaleTimeString());
      }

      return [];
    } finally {
      setLoading(false);
      if (loadingFailsafeRef.current) clearTimeout(loadingFailsafeRef.current);
      await updateCacheStatus();
    }
  }, [enableOfflineCache, cacheDuration, isOffline, updateCacheStatus]);

  const fetchFreshData = async () => {
    // SECONDARY GUARD: If we are offline, don't even try and don't throw an aggressive error
    if (isOffline) {
      return null;
    }

    try {
      const isReallyOnline = await verifyInternetPath();
      if (!isReallyOnline) return null;
    } catch {
      return null;
    }

    const client = window.location.pathname.includes('/admin') ? supabaseCustom : supabase;

    // Parallel fetch with a 15-second safety timeout
    const fetchWithTimeout = async () => {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Data fetch timed out after 15s')), 15000)
      );

      return Promise.race([
        Promise.all([
          client
            .from('iebc_offices')
            .select('id, county, constituency, constituency_name, ward_name:ward, office_location, latitude, longitude, verified, formatted_address, landmark, landmark_normalized, landmark_source, walking_effort, elevation_meters, geocode_verified, geocode_verified_at, multi_source_confidence, created_at, updated_at')
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .eq('verified', true)
            .order('county')
            .order('constituency_name'),
          client
            .from('diaspora_registration_centres')
            .select('id, mission_name, mission_type, city, country, country_code, continent, region, latitude, longitude, address, google_maps_url, phone, email, website_url, whatsapp, designation_state, designated_2017, designated_2022, designation_count, is_iebc_confirmed_2027, confirmed_2027_source_url, confirmed_2027_gazette_ref, services_2027, registration_opens_at, registration_closes_at, voting_date, registration_requirements, inquiry_contact_name, inquiry_contact_email, inquiry_notes, verified_at, verification_source, last_checked_at, is_active, created_at, updated_at, geocode_status, geocode_method, geocode_confidence, formatted_address')
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .order('country')
            .order('mission_name')
        ]),
        timeoutPromise
      ]) as Promise<[any, any]>;
    };

    const [officesRes, diasporaRes] = await fetchWithTimeout();

    if (officesRes.error) throw officesRes.error;
    if (diasporaRes.error) console.warn('Diaspora fetch failed:', diasporaRes.error);

    const validOffices = ((officesRes.data as any[]) || [])
      .filter(office => office.latitude && office.longitude)
      .map(office => ({
        ...office,
        type: 'office',
        displayName: office.constituency_name || office.office_location,
        formattedAddress: office.formatted_address || `${office.office_location}, ${office.county} County`,
        coordinates: [office.latitude, office.longitude],
        isCached: false
      })) as Office[];

    const validDiaspora = ((diasporaRes.data as any[]) || [])
      .filter(center => center.latitude && center.longitude)
      .map(center => ({
        ...center,
        id: `d-${center.id}`,
        type: 'diaspora',
        country: center.country,
        county: null, // Explictly null for Diaspora
        constituency_name: center.mission_name,
        office_location: center.city,
        displayName: center.mission_name,
        formattedAddress: center.formatted_address || `${center.mission_name}, ${center.city}, ${center.country}`,
        coordinates: [center.latitude, center.longitude],
        isCached: false,
        verified: true // Diaspora centers are official
      })) as Office[];

    const allLocations = [...validOffices, ...validDiaspora];

    setOffices(allLocations);
    setLastSyncTime(new Date());

    if (enableOfflineCache) {
      await setCachedOffices(allLocations);
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
        'displayName',
        'mission_name',
        'city',
        'country'
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

    setFuse(new Fuse(allLocations, fuseOptions));

    return allLocations;
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
          type: result.item.type || 'office',
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
              office.office_location?.toLowerCase().includes(lowercaseQuery) ||
              office.mission_name?.toLowerCase().includes(lowercaseQuery) ||
              office.city?.toLowerCase().includes(lowercaseQuery) ||
              office.country?.toLowerCase().includes(lowercaseQuery)
            )
            .map(office => ({
              ...office,
              type: office.type || 'office',
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

      const resultsWithDisplay = results.map(r => {
        if (r.type === 'diaspora' || (!r.constituency_name && r.mission_name)) {
          return {
            ...r,
            name: r.mission_name || 'Diaspora Centre',
            subtitle: `${r.city}, ${r.country}`,
            type: 'diaspora'
          };
        }
        return r;
      });

      setSearchResults(resultsWithDisplay.slice(0, 20));
      setSearchSuggestions(resultsWithDisplay.slice(0, 8));

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
          type: result.item.type || 'office'
        }));
      }

      const lowercaseQuery = query.toLowerCase();
      return offices.filter(office =>
        office.county?.toLowerCase().includes(lowercaseQuery) ||
        office.constituency_name?.toLowerCase().includes(lowercaseQuery) ||
        office.office_location?.toLowerCase().includes(lowercaseQuery) ||
        office.mission_name?.toLowerCase().includes(lowercaseQuery) ||
        office.city?.toLowerCase().includes(lowercaseQuery) ||
        office.country?.toLowerCase().includes(lowercaseQuery)
      ).map(office => ({
        ...office,
        type: office.type || 'office',
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
                  } as Office];
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
                    } as Office
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
    // Guard against Strict Mode double-mount causing duplicate fetches
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    fetchOffices();

    return () => {
      hasFetchedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
      if (loadingFailsafeRef.current) {
        clearTimeout(loadingFailsafeRef.current);
      }
    };
  }, []);

  // calculateDistance is now imported from @/utils/geoUtils — single source of truth

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
      const { data: contribution, error } = await (supabase as any)
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
      const { data: confirmation, error } = await (supabase as any)
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
      const { data: statusReport, error } = await (supabase as any)
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
      const { data: contactUpdate, error } = await (supabase as any)
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
    offlineWarning,
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
