import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// In a real application, this would be stored securely and validated server-side
// For this demo, we're using a simple hardcoded password that should be changed in production
const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || 'IEBC2024Admin!';

export const useAdminAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if admin is already authenticated
    const adminSession = localStorage.getItem('iebc_admin_authenticated');
    const sessionTimestamp = localStorage.getItem('iebc_admin_session_timestamp');
    
    // Session expires after 24 hours
    const isSessionValid = sessionTimestamp && 
      (Date.now() - parseInt(sessionTimestamp)) < (24 * 60 * 60 * 1000);
    
    if (adminSession === 'true' && isSessionValid) {
      setIsAuthenticated(true);
    } else {
      // Clear invalid session
      localStorage.removeItem('iebc_admin_authenticated');
      localStorage.removeItem('iebc_admin_session_timestamp');
    }
    
    setIsLoading(false);
  }, []);

  const login = useCallback(async (password) => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem('iebc_admin_authenticated', 'true');
      localStorage.setItem('iebc_admin_session_timestamp', Date.now().toString());
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    localStorage.removeItem('iebc_admin_authenticated');
    localStorage.removeItem('iebc_admin_session_timestamp');
  }, []);

  return {
    isAuthenticated,
    isLoading,
    login,
    logout
  };
};
