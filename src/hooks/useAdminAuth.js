import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || 'IEBC2024Admin!';

export const useAdminAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [redirectPath, setRedirectPath] = useState('/admin');
  const navigate = useNavigate();
  const location = useLocation();
  const authChecked = useRef(false);

  useEffect(() => {
    const checkAuth = async () => {
      if (authChecked.current) return;
      authChecked.current = true;

      try {
        const adminSession = localStorage.getItem('iebc_admin_authenticated');
        const sessionTimestamp = localStorage.getItem('iebc_admin_session_timestamp');
        const storedRedirectPath = localStorage.getItem('iebc_admin_redirect_path');
        
        // Session expires after 24 hours
        const isSessionValid = sessionTimestamp && 
          (Date.now() - parseInt(sessionTimestamp)) < (24 * 60 * 60 * 1000);
        
        if (adminSession === 'true' && isSessionValid) {
          setIsAuthenticated(true);
          if (storedRedirectPath && storedRedirectPath !== '/admin/login') {
            setRedirectPath(storedRedirectPath);
            // Clear the stored redirect path after using it
            localStorage.removeItem('iebc_admin_redirect_path');
          }
        } else {
          // Clear invalid session
          localStorage.removeItem('iebc_admin_authenticated');
          localStorage.removeItem('iebc_admin_session_timestamp');
          localStorage.removeItem('iebc_admin_redirect_path');
          
          // Store the intended destination for redirect after login
          if (location.pathname !== '/admin/login' && location.pathname.startsWith('/admin')) {
            localStorage.setItem('iebc_admin_redirect_path', location.pathname);
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
        // Clear potentially corrupted storage
        localStorage.removeItem('iebc_admin_authenticated');
        localStorage.removeItem('iebc_admin_session_timestamp');
        localStorage.removeItem('iebc_admin_redirect_path');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [location.pathname]);

  const login = useCallback(async (password) => {
    setIsLoading(true);
    try {
      if (password === ADMIN_PASSWORD) {
        setIsAuthenticated(true);
        const timestamp = Date.now().toString();
        localStorage.setItem('iebc_admin_authenticated', 'true');
        localStorage.setItem('iebc_admin_session_timestamp', timestamp);
        
        // Get the intended redirect path or default to admin portal
        const intendedPath = localStorage.getItem('iebc_admin_redirect_path') || '/admin';
        setRedirectPath(intendedPath);
        
        // Clear the stored redirect path
        localStorage.removeItem('iebc_admin_redirect_path');
        
        // Navigate to the intended path
        navigate(intendedPath, { replace: true });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    localStorage.removeItem('iebc_admin_authenticated');
    localStorage.removeItem('iebc_admin_session_timestamp');
    localStorage.removeItem('iebc_admin_redirect_path');
    navigate('/admin/login', { replace: true });
  }, [navigate]);

  const requireAuth = useCallback((path) => {
    if (!isAuthenticated && !isLoading) {
      localStorage.setItem('iebc_admin_redirect_path', path);
      navigate('/admin/login', { replace: true });
      return false;
    }
    return true;
  }, [isAuthenticated, isLoading, navigate]);

  return {
    isAuthenticated,
    isLoading,
    login,
    logout,
    redirectPath,
    requireAuth
  };
};
