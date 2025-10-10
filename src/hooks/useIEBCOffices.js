import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useIEBCOffices = () => {
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOffices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: supabaseError } = await supabase
        .from('iebc_offices')
        .select('*')
        .eq('verified', true)
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
    } catch (err) {
      console.error('Error fetching IEBC offices:', err);
      setError(err.message || 'Failed to load IEBC offices');
    } finally {
      setLoading(false);
    }
  }, []);

  const searchOffices = useCallback((query) => {
    if (!query.trim()) return offices;
    
    const searchTerm = query.toLowerCase().trim();
    return offices.filter(office => 
      office.constituency_name?.toLowerCase().includes(searchTerm) ||
      office.county?.toLowerCase().includes(searchTerm) ||
      office.office_location?.toLowerCase().includes(searchTerm) ||
      office.constituency?.toLowerCase().includes(searchTerm)
    );
  }, [offices]);

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
