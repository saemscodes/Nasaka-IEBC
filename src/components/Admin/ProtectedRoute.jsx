import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import LoadingSpinner from '@/components/IEBCOffice/LoadingSpinner';

const ProtectedRoute = ({ children, fallbackPath = '/admin/login' }) => {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="text-muted-foreground mt-4">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Store the attempted URL for redirect after login
    const currentPath = location.pathname + location.search;
    if (currentPath !== fallbackPath) {
      localStorage.setItem('iebc_admin_redirect_path', currentPath);
    }
    return <Navigate to={fallbackPath} replace />;
  }

  return children;
};

export default ProtectedRoute;
