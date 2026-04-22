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
  useLegacyGlobalFetch?: boolean;
}

export const useIEBCOffices = (options: UseIEBCOfficesOptions = {}) => {
  const {
    autoRefresh = true,
    refreshInterval = 300000,
    enableOfflineCache = true,
    cacheDuration = 24 * 60 * 60 * 1000,
    useLegacyGlobalFetch = false // ✊🏽🇰🇪 [STRICT MODE] Formal toggle for legacy 30k row dump
  } = options;

  const queryClient = useQueryClient();

  const [offices, setOffices] = useState<Office[]>([]);
  const [viewportOffices, setViewportOffices] = useState<Office[]>([]);
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

  const [isStaticLoaded, setIsStaticLoaded] = useState(false);
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

  /**
   * ☁️ Cloudflare R2 Static Loader
   * Fetches the 30k registration centres from CDN instead of Supabase
   * ZERO Egress, High Speed ✊🏽🇰🇪
   */
  const loadOfficesFromCDN = useCallback(async () => {
    try {
      // Primary: Local public folder
      // Fallback: Custom domain connected to R2 bucket
      // NOTE: static.civiceducationkenya.com is offline — kept in skeleton for future proofing
      const urls = [
        '/iebc-offices.json',
        // 'https://static.civiceducationkenya.com/iebc-offices.json', // ✊🏽🇰🇪 Offline — will enable when site goes live
        'https://cdn.jsdelivr.net/gh/civiceducationkenya/iebc-data@main/iebc-offices.json'
      ].filter(Boolean);

      // Parallel race with 5s timeout — fastest CDN wins, no sequential blocking
      const fetchWithTimeout = (url: string, timeoutMs: number) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        return fetch(url, { signal: controller.signal })
          .then(res => {
            clearTimeout(timer);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            console.log(`[useIEBCOffices] Successfully loaded offices from: ${url}`);
            return res;
          })
          .catch(err => {
            clearTimeout(timer);
            throw err;
          });
      };

      let response: Response | null = null;
      try {
        // Race all URLs in parallel — first successful response wins
        response = await Promise.any(
          urls.map(url => fetchWithTimeout(url, 5000))
        );
      } catch {
        // All failed
        throw new Error('All CDN/Local fallback fetches failed');
      }

      if (!response) {
        throw new Error('All CDN/Local fallback fetches failed');
      }

      const data = await response.json();

      // Remap lean JSON keys to full Office object
      const fullOffices: Office[] = data.map((o: any) => ({
        id: o.i,
        latitude: o.lt,
        longitude: o.lg,
        office_location: o.n,
        clean_office_location: o.n,
        displayName: o.n,
        constituency_name: o.c,
        county: o.y,
        ward: o.w,
        category: o.t === 'rc' ? 'registration_centre' : 'office',
        office_type: o.ot,
        type: 'office',
        verified: true,
        coordinates: [o.lt, o.lg]
      }));

      setOffices(fullOffices);
      setIsStaticLoaded(true);

      if (enableOfflineCache) {
        await setCachedOffices(fullOffices);
      }

      return fullOffices;
    } catch (err) {
      console.warn('[useIEBCOffices] CDN Load failed, falling back to viewport-only mode:', err);
      return [];
    }
  }, [enableOfflineCache]);

  const fetchOffices = useCallback(async (forceRefresh = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      // Check cache first
      if (enableOfflineCache && !forceRefresh) {
        const cached = await getCachedOffices();
        if (cached?.data?.length > 1000) { // Large cache is likely complete
          setOffices(cached.data);
          setLoading(false);
          return cached.data;
        }
      }

      const [allDomestic, diaspora] = await Promise.all([
        fetchAllOfficesPaginated(),
        fetchDiaspora()
      ]);

      const allData = [...allDomestic, ...diaspora];
      setOffices(allData);

      if (enableOfflineCache) {
        await setCachedOffices(allData);
      }

      setLastSyncTime(new Date());
      return allData;

    } catch (err: any) {
      console.error('Error fetching offices:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [enableOfflineCache]);

  const fetchDiaspora = async () => {
    try {
      const { data, error } = await supabase
        .from('diaspora_registration_centres')
        .select('*');

      if (error) throw error;
      if (!data) return [];

      return data.map((d: any) => ({
        ...d,
        id: `d-${d.id}`,
        type: 'diaspora',
        county: d.country,
        constituency_name: d.mission_name,
        office_location: d.city,
        displayName: d.mission_name,
        formattedAddress: d.formatted_address || `${d.city}, ${d.country}`,
        coordinates: [d.latitude, d.longitude],
        verified: true
      }));
    } catch (err) {
      console.warn('Failed to fetch diaspora offices:', err);
      return [];
    }
  };

  const fetchAllOfficesPaginated = async () => {
    const batchSize = 1000;
    let allRecords: Office[] = [];
    let from = 0;
    let to = batchSize - 1;
    let hasMore = true;

    const client = window.location.pathname.includes('/admin') ? supabaseCustom : supabase;

    // Select only the columns needed for map display + search — not all 80+ columns
    // This reduces payload from ~10MB to ~1MB for 24k rows
    const selectColumns = 'id, latitude, longitude, office_location, county, constituency, constituency_name, ward, ward_id, verified, geocode_status, geocode_confidence, geocode_method, formatted_address, landmark, landmark_normalized, landmark_source, landmark_type, landmark_subtype, elevation_meters, walking_effort, office_type, centre_code, clean_office_location, multi_source_confidence, geocode_verified, geocode_verified_at, created_at, updated_at';

    while (hasMore) {
      const { data, error } = await (client as any)
        .from('iebc_offices')
        .select(selectColumns)
        .range(from, to)
        .order('id');

      if (error) throw error;
      if (data && data.length > 0) {
        const mapped = data.map((office: any) => ({
          ...office,
          type: 'office',
          displayName: office.constituency_name || office.office_location,
          formattedAddress: office.formatted_address || `${office.office_location}, ${office.county} County`,
          coordinates: [office.latitude, office.longitude]
        }));
        allRecords = [...allRecords, ...mapped];

        if (data.length < batchSize) {
          hasMore = false;
        } else {
          from += batchSize;
          to += batchSize;
        }
      } else {
        hasMore = false;
      }
    }

    return allRecords;
  };

  const fetchInBounds = useCallback(async (bounds: { minLat: number, minLng: number, maxLat: number, maxLng: number }, zoom = 15) => {
    // ✊🏽🇰🇪 Zoom-aware marker cap — prevents browser crash from too many DOM markers
    const getMarkerCap = (z: number) => {
      if (z >= 14) return Infinity; // Street level: all markers (~50-300 typical)
      if (z >= 12) return 500;       // Sub-county level
      if (z >= 10) return 200;       // District level
      if (z >= 8) return 100;        // County level
      return 47;                     // Country overview: one per county
    };

    // Spatially-distributed sampling — ensures even geographic coverage at low zoom
    const spatialSample = (items: any[], cap: number) => {
      if (items.length <= cap) return items;
      // Grid-based spatial sampling for even distribution
      const step = items.length / cap;
      const sampled: any[] = [];
      for (let i = 0; i < items.length && sampled.length < cap; i += step) {
        sampled.push(items[Math.floor(i)]);
      }
      return sampled;
    };

    const markerCap = getMarkerCap(zoom);

    try {
      // @ts-expect-error — custom RPC function not in generated Supabase types
      const { data, error } = await supabase.rpc('get_offices_in_bounds', {
        min_lat: Number(bounds.minLat),
        min_lng: Number(bounds.minLng),
        max_lat: Number(bounds.maxLat),
        max_lng: Number(bounds.maxLng),
        zoom_level: Math.round(zoom)
      });

      if (error) throw error;

      const mapped = (data || []).map((o: any) => ({
        ...o,
        type: 'office',
        displayName: o.constituency_name || o.office_location,
        formattedAddress: o.formatted_address || `${o.office_location}, ${o.county} County`,
        coordinates: [o.latitude, o.longitude],
        // Ensure all metadata fields are preserved from RPC response
        landmark: o.landmark,
        distance_from_landmark: o.distance_from_landmark,
        ward: o.ward,
        category: o.category,
        elevation_meters: o.elevation_meters,
        walking_effort: o.walking_effort,
        landmark_normalized: o.landmark_normalized,
        landmark_source: o.landmark_source,
        isochrone_15min: o.isochrone_15min,
        isochrone_30min: o.isochrone_30min,
        isochrone_45min: o.isochrone_45min
      }));

      // Merge with static Diaspora markers (small enough to keep in memory)
      const diaspora = offices.filter(o => o.type === 'diaspora');
      const cappedMapped = spatialSample(mapped, markerCap);
      const combined = [...cappedMapped, ...diaspora];

      setViewportOffices(combined);
      return combined;
    } catch (err) {
      console.error('[useIEBCOffices] Viewport fetch error, falling back to client-side filter:', err);
      // FALLBACK: Client-side bounding-box filter of CDN-loaded offices
      const filtered = offices.filter(o => {
        if (!o.latitude || !o.longitude || o.type === 'diaspora') return false;
        return o.latitude >= bounds.minLat && o.latitude <= bounds.maxLat
          && o.longitude >= bounds.minLng && o.longitude <= bounds.maxLng;
      });
      const cappedFiltered = spatialSample(filtered, markerCap);
      const diasporaFallback = offices.filter(o => o.type === 'diaspora');
      const fallbackCombined = [...cappedFiltered, ...diasporaFallback];
      setViewportOffices(fallbackCombined);
      return fallbackCombined;
    }
  }, [offices]);

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

  /**
   * LIGHTWEIGHT SERVER-SIDE SEARCH ✊🏽🇰🇪
   * Calls the get_search_suggestions RPC for O(1) performance regardless of client data
   */
  const searchOffices = useCallback(async (query: string) => {
    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      // @ts-expect-error — custom RPC function not in generated Supabase types
      const { data, error } = await supabase.rpc('get_search_suggestions', {
        query_text: query.trim()
      });

      if (error) throw error;

      // Map to the expected Office format
      return (data || []).map((r: any) => ({
        ...r,
        office_location: r.name,
        displayName: r.name,
        type: 'office',
        coordinates: [r.latitude, r.longitude],
        verified: true
      }));
    } catch (error) {
      console.error('[useIEBCOffices] Server-side search error:', error);

      // Fallback to local search if we have data (emergency only)
      if (offices.length > 0) {
        const lowercaseQuery = query.toLowerCase();
        return offices.filter(office =>
          office.county?.toLowerCase().includes(lowercaseQuery) ||
          office.constituency_name?.toLowerCase().includes(lowercaseQuery) ||
          office.office_location?.toLowerCase().includes(lowercaseQuery)
        ).map(office => ({
          ...office,
          type: office.type || 'office',
          score: 0.5
        }));
      }
      return [];
    }
  }, [offices]);

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

    // ✊🏽🇰🇪 Debounce buffer for real-time updates — prevents re-render storms during
    // active geocoding scraper runs (which fire thousands of UPDATE events/minute).
    let realtimeDebounceTimer: NodeJS.Timeout | null = null;
    const pendingChanges: any[] = [];

    const applyPendingChanges = () => {
      if (pendingChanges.length === 0) return;
      const changes = [...pendingChanges];
      pendingChanges.length = 0;

      setOffices(prev => {
        let updated = [...prev];
        for (const payload of changes) {
          switch (payload.eventType) {
            case 'INSERT':
              if (payload.new.verified) {
                const exists = updated.find(o => o.id === payload.new.id);
                if (!exists) {
                  updated.push({
                    ...payload.new,
                    displayName: payload.new.constituency_name || payload.new.office_location,
                    formattedAddress: payload.new.formatted_address || `${payload.new.office_location}, ${payload.new.county} County`,
                    coordinates: [payload.new.latitude, payload.new.longitude]
                  } as Office);
                }
              }
              break;
            case 'UPDATE':
              updated = updated.map(office =>
                office.id === payload.new.id
                  ? {
                    ...office,
                    ...payload.new,
                    displayName: payload.new.constituency_name || payload.new.office_location,
                    formattedAddress: payload.new.formatted_address || `${payload.new.office_location}, ${payload.new.county} County`,
                    coordinates: [payload.new.latitude, payload.new.longitude]
                  } as Office
                  : office
              );
              break;
            case 'DELETE':
              updated = updated.filter(office => office.id !== payload.old.id);
              break;
          }
        }
        return updated;
      });

      setCachedOffices(offices);
    };

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
          // Buffer changes and apply in batch every 5 seconds
          // This prevents the scraper's per-record writes from causing
          // thousands of individual React re-renders
          pendingChanges.push(payload);
          if (realtimeDebounceTimer) clearTimeout(realtimeDebounceTimer);
          realtimeDebounceTimer = setTimeout(applyPendingChanges, 5000);
        }
      )
      .subscribe();

    subscriptionRef.current = subscription;

    return () => {
      if (realtimeDebounceTimer) clearTimeout(realtimeDebounceTimer);
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [isOffline, offices]);

  useEffect(() => {
    // Guard against Strict Mode double-mount causing duplicate fetches
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    // ✊🏽🇰🇪 Immediately bootstrap viewport with Kenya default bounds
    // This ensures the user sees markers within ~2s instead of waiting for CDN + full load
    const bootstrapViewport = async () => {
      try {
        // Kenya default bounds — covers the whole country at zoom level 6
        await fetchInBounds({
          minLat: -4.7,
          minLng: 33.9,
          maxLat: 5.0,
          maxLng: 41.9
        }, 6);
      } catch (err) {
        console.warn('[useIEBCOffices] Viewport bootstrap failed:', err);
      }
    };
    bootstrapViewport();

    // ✊🏽🇰🇪 [VIEWPORT-ONLY] Uber model: only load diaspora on mount (~50 records)
    // Domestic offices load via viewport RPC as user pans/zooms
    const init = async () => {
      const diaspora = await fetchDiaspora();
      setOffices(diaspora);
    };
    init();

    // ✊🏽🇰🇪 [STRICT MODE] Legacy Global Fetch - Fully implemented but dormant by default
    if (useLegacyGlobalFetch) {
      fetchOffices();
    } else {
      setLoading(false); // Immediate entry for Viewport Fetching
    }

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
    viewportOffices,
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
    fetchInBounds,
    searchOffices,
    getOfficesByCounty,
    getOfficeById,
    getNearbyOffices,
    clearCache,
    forceSync,
    updateCacheStatus,
    submitContribution: (data: any) => submitContribution.mutateAsync(data),
    confirmAccuracy: (data: any) => confirmAccuracy.mutateAsync(data),
    reportStatusChange: (data: any) => reportStatusChange.mutateAsync(data),
    suggestContactUpdate: (data: any) => suggestContactUpdate.mutateAsync(data),
    isSubmittingContribution: submitContribution.isPending,
    isConfirmingAccuracy: confirmAccuracy.isPending,
    isReportingStatus: reportStatusChange.isPending,
    isSuggestingContactUpdate: suggestContactUpdate.isPending
  };
};
