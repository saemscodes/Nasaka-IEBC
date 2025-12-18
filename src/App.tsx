// src/App.tsx
import i18n from "@/i18n";
import React, { useEffect, useState } from 'react';
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

// Import supabase client from existing location
import { supabase } from "@/integrations/supabase/client";

// Import i18n configuration
import '@/i18n';
import { PWAInstallBanner } from "./components/PWAInstallBanner";
import OfflineIndicator from "./components/OfflineIndicator";

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

// ✅ SECURE Admin Login Component - Uses Supabase Auth
const AdminLogin = ({ onLogin }: { onLogin: (success: boolean) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Attempt Supabase authentication
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (authError) {
        console.error('Auth error:', authError);
        setError('Invalid credentials. Please check your email and password.');
        return;
      }

      if (!data.user) {
        setError('Authentication failed. No user returned.');
        return;
      }

      // Check if user is in core_team table and is admin
      const { data: coreTeam, error: coreError } = await supabase
        .from('core_team')
        .select('is_admin')
        .eq('user_id', data.user.id)
        .eq('is_admin', true)
        .single();

      if (coreError || !coreTeam) {
        console.error('Admin check failed:', coreError);
        setError('You do not have admin privileges.');
        
        // Sign out since they're not an admin
        await supabase.auth.signOut();
        return;
      }

      // Successful admin authentication
      onLogin(true);
      
    } catch (err) {
      console.error('Admin login error:', err);
      setError('Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setError('Please enter your email address first.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/admin/reset-password`,
        }
      );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setIsPasswordReset(true);
      setError('');
    } catch (err) {
      setError('Failed to send reset email.');
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
          <p className="text-gray-600">Sign in with your admin account</p>
        </div>
        
        {isPasswordReset ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Check Your Email</h3>
            <p className="text-gray-600 mb-4">
              We've sent a password reset link to <span className="font-medium">{email}</span>
            </p>
            <button
              onClick={() => {
                setIsPasswordReset(false);
                setError('');
              }}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admin Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="admin@example.com"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Enter your password"
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

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={isLoading}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
              >
                Forgot password?
              </button>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-700">
                  <p className="font-medium">Secure Admin Portal</p>
                  <p>This area requires both authentication and admin privileges. All access is logged.</p>
                </div>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>
        )}

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Secure Admin Portal • IEBC Office Verification System v1.1.0
          </p>
        </div>
      </div>
    </div>
  );
};

// ✅ SECURE Admin Route Protection Component
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          setIsAuthenticated(false);
          setIsChecking(false);
          return;
        }

        // Check if user is admin via core_team table
        const { data: coreTeam, error: coreError } = await supabase
          .from('core_team')
          .select('is_admin')
          .eq('user_id', session.user.id)
          .eq('is_admin', true)
          .single();

        if (coreError || !coreTeam) {
          console.error('Admin verification failed:', coreError);
          setIsAuthenticated(false);
          
          // Sign out non-admin users
          await supabase.auth.signOut();
        } else {
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error('Auth check error:', err);
        setIsAuthenticated(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setIsAuthenticated(false);
        } else if (event === 'SIGNED_IN' && session) {
          // Re-check admin status on sign in
          const { data: coreTeam } = await supabase
            .from('core_team')
            .select('is_admin')
            .eq('user_id', session.user.id)
            .eq('is_admin', true)
            .single();
          
          setIsAuthenticated(!!coreTeam);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = (success: boolean) => {
    setIsAuthenticated(success);
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying admin privileges...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return <>{children}</>;
};

// ✅ Contributions Dashboard Component
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
                <ContributionsDashboard counties={KENYAN_COUNTIES} />
              </React.Suspense>
            </AdminRoute>
          } 
        />

        {/* ✅ Admin password reset route */}
        <Route 
          path="/admin/reset-password" 
          element={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Reset Password</h2>
                <p className="text-gray-600 mb-6">
                  Please check your email for the password reset link. If you didn't receive it, contact your administrator.
                </p>
                <button
                  onClick={() => window.location.href = '/admin/contributions'}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Return to Login
                </button>
              </div>
            </div>
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

const App = () => {
  // 🔥 RTL direction switch - this is the core fix
  useEffect(() => {
    const dir = i18n.language === "ar" ? "rtl" : "ltr";
    document.documentElement.dir = dir;
  }, [i18n.language]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <TooltipProvider delayDuration={0}>
            <Toaster />
            <Sonner position="top-right" expand={false} richColors closeButton />
            <AppContent />
            <Analytics />
            <SpeedInsights />
            <PWAInstallBanner />
            <OfflineIndicator />
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
