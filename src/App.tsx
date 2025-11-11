// src/App.tsx
import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { useLenis } from "./hooks/useLenis";
// import Index from "./pages/Index";
// import SignPetition from "./pages/SignPetition";
import NotFound from "./pages/NotFound";
// import PrivacyPolicy from "./pages/PrivacyPolicy";
// import TermsAndConditions from "./pages/TermsAndConditions";
// import VerifySignature from "./pages/VerifySignature";
// import VoterRegistrationPage from "@/pages/VoterRegistration";
import { IEBCOfficeSplash, IEBCOfficeMap } from './pages/IEBCOffice';
import './styles/iebc-office.css';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

// Import i18n configuration
import '@/i18n';

// ✅ Enhanced Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// ✅ Complete list of 47 Kenyan counties
const KENYAN_COUNTIES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet",
  "Embu", "Garissa", "Homa Bay", "Isiolo", "Kajiado",
  "Kakamega", "Kericho", "Kiambu", "Kilifi", "Kirinyaga",
  "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia",
  "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit",
  "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi",
  "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua",
  "Nyeri", "Samburu", "Siaya", "Taita-Taveta", "Tana River",
  "Tharaka-Nithi", "Trans Nzoia", "Turkana", "Uasin Gishu",
  "Vihiga", "Wajir", "West Pokot"
];

// ✅ Simple Admin Login Component
const AdminLogin = ({ onLogin }: { onLogin: (success: boolean) => void }) => {
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Simulate API call delay for security
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      // Check against environment variable or fallback
      const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'IEBC2024Admin!';
      
      if (password === adminPassword) {
        onLogin(true);
      } else {
        setError('Invalid admin password');
        console.warn('Failed admin login attempt');
      }
    } catch (err) {
      setError('Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Access</h1>
          <p className="text-gray-600">Enter admin credentials to continue</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Admin Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="Enter admin password"
              required
              disabled={isLoading}
            />
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-sm font-medium text-red-700">{error}</span>
              </div>
            </div>
          )}

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-700">
                <p className="font-medium">Security Notice</p>
                <p>This area is restricted to authorized personnel only. Unauthorized access is prohibited.</p>
              </div>
            </div>
          </div>
          
          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Verifying...</span>
              </>
            ) : (
              <span>Access Dashboard</span>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Secure Admin Portal • IEBC Office Verification System
          </p>
        </div>
      </div>
    </div>
  );
};

// ✅ Admin Route Protection Component
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isChecking, setIsChecking] = React.useState(true);

  React.useEffect(() => {
    const checkAuth = () => {
      const adminAuth = sessionStorage.getItem('admin_authenticated');
      const authTimestamp = sessionStorage.getItem('admin_auth_timestamp');
      
      if (adminAuth === 'true' && authTimestamp) {
        const timestamp = parseInt(authTimestamp);
        const now = Date.now();
        const sessionDuration = 2 * 60 * 60 * 1000; // 2 hours
        
        if (now - timestamp < sessionDuration) {
          setIsAuthenticated(true);
        } else {
          sessionStorage.removeItem('admin_authenticated');
          sessionStorage.removeItem('admin_auth_timestamp');
        }
      }
      setIsChecking(false);
    };

    checkAuth();
  }, []);

  const handleLogin = (success: boolean) => {
    if (success) {
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_authenticated', 'true');
      sessionStorage.setItem('admin_auth_timestamp', Date.now().toString());
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  // Pass counties as props to the child component
  return (
    <>
      {React.Children.map(children, child =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<any>, {
              counties: KENYAN_COUNTIES
            })
          : child
      )}
    </>
  );
};

// ✅ Contributions Dashboard Component (Now directly included to avoid lazy loading issues)
const ContributionsDashboard = React.lazy(() => import('@/components/Admin/ContributionsDashboard'));

const AppContent = () => {
  const { lenis } = useLenis();

  return (
    <BrowserRouter>
      <Routes>
        {/* 
        COMMENTED OUT ROUTES - PRESERVED FOR FUTURE USE
        
        <Route path="/" element={<Index />} />
        <Route path="/sign/:id" element={<SignPetition />} />
        <Route path="/verify" element={<VerifySignature />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsAndConditions />} />

        
        COMMENTED OUT IEBC VOTER REGISTRATION ROUTES
        
        <Route path="/voter-registration" element={<VoterRegistrationPage />} />
        <Route path="/iebc-offices" element={<VoterRegistrationPage />} />
        <Route path="/register-to-vote" element={<VoterRegistrationPage />} />
        */}

        {/* ✅ ACTIVE IEBC OFFICE FINDER ROUTES */}
        <Route path="/iebc-office" element={<IEBCOfficeSplash />} />
        <Route path="/nasaka-iebc" element={<IEBCOfficeSplash />} />
        <Route path="/iebc-office/map" element={<IEBCOfficeMap />} />

        {/* ✅ ACTIVE SECURE ADMIN ROUTES */}
        <Route 
          path="/admin/contributions" 
          element={
            <AdminRoute>
              <React.Suspense fallback={
                <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading Admin Dashboard...</p>
                  </div>
                </div>
              }>
                <ContributionsDashboard onLogout={() => {
                  sessionStorage.removeItem('admin_authenticated');
                  sessionStorage.removeItem('admin_auth_timestamp');
                  window.location.href = '/';
                }} counties={KENYAN_COUNTIES} />
              </React.Suspense>
            </AdminRoute>
          } 
        />

        {/* ✅ ACTIVE Redirect old admin paths to secure route */}
        <Route path="/admin" element={<Navigate to="/admin/contributions" replace />} />
        <Route path="/dashboard" element={<Navigate to="/admin/contributions" replace />} />

        {/* ✅ Root path redirects to IEBC Office splash page */}
        <Route path="/" element={<Navigate to="/iebc-office" replace />} />

        {/* ✅ Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <TooltipProvider delayDuration={0}>
          <Toaster />
          <Sonner position="top-right" expand={false} richColors closeButton />
          <AppContent />
          <Analytics />
          <SpeedInsights />
        </TooltipProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
