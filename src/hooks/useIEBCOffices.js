// src/hooks/useIEBCOffices.js
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useIEBCOffices = () => {
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadOffices = useCallback(async () => {
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

      setOffices(data || []);
    } catch (err) {
      console.error('Error loading IEBC offices:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchOffices = useCallback((query) => {
    if (!query.trim()) return offices;

    const searchTerm = query.toLowerCase().trim();
    
    return offices.filter(office => 
      office.county?.toLowerCase().includes(searchTerm) ||
      office.constituency_name?.toLowerCase().includes(searchTerm) ||
      office.constituency?.toLowerCase().includes(searchTerm) ||
      office.office_location?.toLowerCase().includes(searchTerm) ||
      office.landmark?.toLowerCase().includes(searchTerm) ||
      office.clean_office_location?.toLowerCase().includes(searchTerm) ||
      office.formatted_address?.toLowerCase().includes(searchTerm)
    );
  }, [offices]);

  useEffect(() => {
    loadOffices();
  }, [loadOffices]);

  return {
    offices,
    loading,
    error,
    searchOffices,
    refetch: loadOffices
  };
};
