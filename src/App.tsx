import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useLenis } from "./hooks/useLenis";
import Index from "./pages/Index";
import SignPetition from "./pages/SignPetition";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsAndConditions from "./pages/TermsAndConditions";
import VerifySignature from "./pages/VerifySignature";
import VoterRegistrationPage from "@/pages/VoterRegistration";
import { IEBCOfficeSplash, IEBCOfficeMap } from './pages/IEBCOffice';
import AdminPortal from './pages/Admin/AdminPortal';
import ContributionModeration from './pages/Admin/ContributionModeration';
import UserManagement from './pages/Admin/UserManagement';
import AnalyticsDashboard from './pages/Admin/AnalyticsDashboard';
import { useAdminAuth } from './hooks/useAdminAuth';
import './styles/iebc-office.css';

// ✅ ENHANCED QUERY CLIENT FOR IEBC DATA
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// ✅ PROTECTED ROUTE COMPONENT
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
};

// ✅ ADMIN LOGIN COMPONENT
const AdminLogin = () => {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAdminAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const success = await login(password);
      if (!success) {
        setError('Invalid admin password');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">IEBC Admin Portal</h1>
          <p className="text-gray-600">Enter admin password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Admin Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="Enter admin password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Signing In...' : 'Sign In to Admin Portal'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-sm text-yellow-700 text-center">
            <strong>Note:</strong> This portal is for IEBC administrators only. Unauthorized access is prohibited.
          </p>
        </div>
      </div>
    </div>
  );
};

const AppContent = () => {
  // Initialize Lenis smooth scrolling
  const { lenis } = useLenis();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/sign/:id" element={<SignPetition />} />
        <Route path="/verify" element={<VerifySignature />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsAndConditions />} />
        
        {/* ✅ IEBC VOTER REGISTRATION ROUTES */}
        <Route path="/voter-registration" element={<VoterRegistrationPage />} />
        <Route path="/iebc-offices" element={<VoterRegistrationPage />} />
        <Route path="/register-to-vote" element={<VoterRegistrationPage />} />

        {/* ✅ IEBC OFFICE FINDER ROUTES */}
        <Route path="/iebc-office" element={<IEBCOfficeSplash />} />
        <Route path="/nasaka-iebc" element={<IEBCOfficeSplash />} />
        <Route path="/iebc-office/map" element={<IEBCOfficeMap />} />
        
        {/* ✅ ADMIN ROUTES */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute>
              <AdminPortal />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/contributions" 
          element={
            <ProtectedRoute>
              <ContributionModeration />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/users" 
          element={
            <ProtectedRoute>
              <UserManagement />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/analytics" 
          element={
            <ProtectedRoute>
              <AnalyticsDashboard />
            </ProtectedRoute>
          } 
        />
        
        {/* ✅ ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider delayDuration={0}>
      <Toaster />
      <Sonner
        position="top-right"
        expand={false}
        richColors
        closeButton
      />
      <AppContent />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
