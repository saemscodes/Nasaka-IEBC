// src/hooks/useIEBCOffices.js
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Fuse from 'fuse.js';

export const useIEBCOffices = () => {
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fuse, setFuse] = useState(null);

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
          fetchOffices();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchOffices]);

  const searchOffices = useCallback((query, signal) => {
    if (signal && signal.aborted) {
      return Promise.reject(new Error('Search aborted'));
    }
    
    if (!query.trim() || !fuse) return Promise.resolve(offices);
    
    try {
      const results = fuse.search(query.trim());
      return Promise.resolve(results.map(result => result.item));
    } catch (error) {
      return Promise.reject(error);
    }
  }, [offices, fuse]);

  const getOfficesByCounty = useCallback((county) => {
    if (!county) return offices;
    return offices.filter(office => 
      office.county?.toLowerCase() === county.toLowerCase()
    );
  }, [offices]);

  useEffect(() => {
    fetchOffices();
  }, [fetchOffices]);

  return { 
    offices, 
    loading, 
    error, 
    refetch: fetchOffices,
    searchOffices,
    getOfficesByCounty
  };
};
