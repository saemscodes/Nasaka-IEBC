// src/hooks/useIEBCOffices.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Fuse from 'fuse.js';
import { debounce } from '@/lib/searchUtils';

export const useIEBCOffices = () => {
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fuse, setFuse] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const searchControllerRef = useRef(null);

  const fetchOffices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: supabaseError } = await supabase
        .from('iebc_offices')
        .select('*')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
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
          coordinates: [office.latitude, office.longitude]
        }));

      setOffices(validOffices);

      // Initialize Fuse.js for fuzzy search
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
        findAllMatches: true
      };
      
      setFuse(new Fuse(validOffices, fuseOptions));

    } catch (err) {
      console.error('Error fetching IEBC offices:', err);
      setError(err.message || 'Failed to load IEBC offices');
    } finally {
      setLoading(false);
    }
  }, []);

  // Enhanced search function with abort controller
  const performSearch = useCallback(async (query, options = {}) => {
    const { source = 'ui', autoSelectFirst = false } = options;
    
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
      
      if (fuse) {
        const fuseResults = fuse.search(query.trim());
        results = fuseResults.map(result => ({
          ...result.item,
          matches: result.matches,
          score: result.score,
          type: 'office'
        }));
      }

      // Add search query suggestion
      if (query.length > 2) {
        results.push({
          id: `search-${query}`,
          name: `Search for "${query}"`,
          subtitle: 'Find all matching IEBC offices',
          type: 'search_query',
          query: query,
          searchSource: source
        });
      }

      setSearchResults(results.slice(0, 20));
      setSearchSuggestions(results.slice(0, 8));
      
      // Analytics event (optional)
      if (window.gtag && source !== 'url') {
        window.gtag('event', 'search', {
          search_term: query,
          search_source: source
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
  }, [fuse]);

  // ADD THIS MISSING FUNCTION - Simple search function that returns results
  const searchOffices = useCallback((query) => {
    if (!query.trim() || !fuse) {
      return [];
    }

    try {
      const fuseResults = fuse.search(query.trim());
      return fuseResults.map(result => ({
        ...result.item,
        matches: result.matches,
        score: result.score,
        type: 'office'
      }));
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }, [fuse]);

  // Debounced search for typing
  const debouncedSearch = useCallback(
    debounce((query, options) => {
      performSearch(query, options);
    }, 300),
    [performSearch]
  );

  // Search handler that can be called from anywhere
  const handleSearch = useCallback((query, options = {}) => {
    setSearchQuery(query);
    
    if (query.trim()) {
      debouncedSearch(query, options);
    } else {
      setSearchResults([]);
      setSearchSuggestions([]);
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

  // Real-time subscription for database changes
  useEffect(() => {
    const subscription = supabase
      .channel('iebc-offices-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'iebc_offices'
        },
        (payload) => {
          console.log('Database change detected:', payload);
          // Refresh offices when database changes
          fetchOffices();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchOffices]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchControllerRef.current) {
        searchControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    fetchOffices();
  }, [fetchOffices]);

  return { 
    offices, 
    loading, 
    error, 
    refetch: fetchOffices,
    searchQuery,
    searchResults,
    searchSuggestions,
    isSearching,
    handleSearch,
    clearSearch,
    performSearch,
    searchOffices, // ADD THIS TO RETURN
    getOfficesByCounty
  };
};
