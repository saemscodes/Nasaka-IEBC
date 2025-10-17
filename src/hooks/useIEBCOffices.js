// src/hooks/useIEBCOffices.js
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Fuse from 'fuse.js';

export const useIEBCOffices = () => {
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fuse, setFuse] = useState(null);
  const [subscription, setSubscription] = useState(null);

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

  // Set up real-time subscriptions for instant updates
  const setupRealtimeSubscription = useCallback(() => {
    const sub = supabase
      .channel('iebc-offices-real-time')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'iebc_offices'
        },
        (payload) => {
          console.log('Real-time database change detected:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newOffice = payload.new;
            if (newOffice.latitude && newOffice.longitude) {
              const formattedOffice = {
                ...newOffice,
                displayName: newOffice.constituency_name || newOffice.office_location,
                formattedAddress: newOffice.formatted_address || `${newOffice.office_location}, ${newOffice.county} County`,
                coordinates: [newOffice.latitude, newOffice.longitude]
              };
              
              setOffices(prev => {
                // Check if office already exists to avoid duplicates
                const exists = prev.find(office => office.id === newOffice.id);
                if (exists) return prev;
                
                const updatedOffices = [...prev, formattedOffice];
                
                // Update Fuse.js search index with new data
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
                setFuse(new Fuse(updatedOffices, fuseOptions));
                
                console.log('New office added to state:', formattedOffice);
                return updatedOffices;
              });
            }
          }
          else if (payload.eventType === 'UPDATE') {
            const updatedOffice = payload.new;
            if (updatedOffice.latitude && updatedOffice.longitude) {
              const formattedOffice = {
                ...updatedOffice,
                displayName: updatedOffice.constituency_name || updatedOffice.office_location,
                formattedAddress: updatedOffice.formatted_address || `${updatedOffice.office_location}, ${updatedOffice.county} County`,
                coordinates: [updatedOffice.latitude, updatedOffice.longitude]
              };
              
              setOffices(prev => {
                const updatedOffices = prev.map(office => 
                  office.id === updatedOffice.id ? formattedOffice : office
                );
                
                // Update Fuse.js search index
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
                setFuse(new Fuse(updatedOffices, fuseOptions));
                
                console.log('Office updated in state:', formattedOffice);
                return updatedOffices;
              });
            }
          }
          else if (payload.eventType === 'DELETE') {
            const deletedOffice = payload.old;
            setOffices(prev => {
              const updatedOffices = prev.filter(office => office.id !== deletedOffice.id);
              
              // Update Fuse.js search index
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
              setFuse(new Fuse(updatedOffices, fuseOptions));
              
              console.log('Office removed from state:', deletedOffice);
              return updatedOffices;
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('Real-time subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to IEBC offices real-time updates');
        }
      });

    setSubscription(sub);
    return sub;
  }, []);

  const searchOffices = useCallback((query) => {
    if (!query.trim() || !fuse) return offices;
    
    const results = fuse.search(query.trim());
    return results.map(result => result.item);
  }, [offices, fuse]);

  const getOfficesByCounty = useCallback((county) => {
    if (!county) return offices;
    return offices.filter(office => 
      office.county?.toLowerCase() === county.toLowerCase()
    );
  }, [offices]);

  // Initial fetch and real-time setup
  useEffect(() => {
    fetchOffices();
    const sub = setupRealtimeSubscription();

    // Cleanup subscription on unmount
    return () => {
      if (sub) {
        supabase.removeChannel(sub);
      }
    };
  }, [fetchOffices, setupRealtimeSubscription]);

  return { 
    offices, 
    loading, 
    error, 
    refetch: fetchOffices,
    searchOffices,
    getOfficesByCounty
  };
};
