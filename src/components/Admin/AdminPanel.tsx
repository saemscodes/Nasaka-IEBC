// src/components/Admin/AdminPanel.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import ContributionsDashboard from './ContributionsDashboard';
import { useContributeLocation } from '@/hooks/useContributeLocation';

const AdminPanel = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [counties, setCounties] = useState<string[]>([]);
  const [stats, setStats] = useState<any>(null);
  const { updateExistingConstituencyCodes, updateOfficeConstituencyCodes } = useContributeLocation();

  useEffect(() => {
    checkAuth();
    fetchCounties();
    fetchStats();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCounties = async () => {
    try {
      const { data, error } = await supabase
        .from('iebc_office_contributions')
        .select('submitted_county')
        .not('submitted_county', 'is', null);

      if (error) throw error;

      const uniqueCounties = Array.from(new Set(data.map(item => item.submitted_county)))
        .filter(Boolean)
        .sort();

      setCounties(uniqueCounties);
    } catch (error) {
      console.error('Error fetching counties:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_constituency_mapping_stats');
      
      if (error) throw error;
      setStats(data?.[0] || null);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Admin Sign In
            </h2>
          </div>
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <p className="text-center text-gray-600">
              Please sign in with your admin credentials to access the dashboard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ContributionsDashboard 
        onLogout={handleLogout} 
        counties={counties}
      />
    </div>
  );
};

export default AdminPanel;
