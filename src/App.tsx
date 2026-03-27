// src/App.tsx
import i18n from "@/i18n";
import React, { useEffect, useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { useLenis } from "./hooks/useLenis";
// import Index from "./pages/Index";
// import SignPetition from "./pages/SignPetition";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsAndConditions from "./pages/TermsAndConditions";
// import VerifySignature from "./pages/VerifySignature";
// import VoterRegistrationPage from "@/pages/VoterRegistration";
// import { IEBCOfficeSplash, IEBCOfficeMap } from './pages/IEBCOffice';
const IEBCOfficeSplash = React.lazy(() => import('./pages/IEBCOffice/IEBCOfficeSplash'));
const IEBCOfficeMap = React.lazy(() => import('./pages/IEBCOffice/IEBCOfficeMap'));
import Privacy from './pages/IEBCOffice/Privacy';
import Terms from './pages/IEBCOffice/Terms';
import { HelmetProvider } from 'react-helmet-async';
import './styles/iebc-office.css';

// Lazy load the rich office detail page
const OfficeDetail = React.lazy(() => import('./pages/IEBCOffice/OfficeDetail'));
const VoterServices = React.lazy(() => import('./pages/SEO/VoterServices'));
const BoundaryReview = React.lazy(() => import('./pages/SEO/BoundaryReview'));
const ElectionResources = React.lazy(() => import('./pages/SEO/ElectionResources'));
const DataAPI = React.lazy(() => import('./pages/SEO/DataAPI'));
const VoterRegistration = React.lazy(() => import('./pages/SEO/VoterRegistration'));
const Pricing = React.lazy(() => import('./pages/Pricing'));
const Docs = React.lazy(() => import('./pages/Docs'));
const ApiKeysDashboard = React.lazy(() => import('./pages/Dashboard/ApiKeys'));
const Auth = React.lazy(() => import('./pages/Auth'));
const AuthCallback = React.lazy(() => import('./pages/AuthCallback'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'));
import FlatRouteResolver from './components/IEBCOffice/FlatRouteResolver';
import { AuthProvider } from './hooks/useAuth';

// Import supabase client from existing location
import { supabase } from "@/integrations/supabase/client";
import AdminNexus from './pages/Admin/AdminNexus';

// Import i18n configuration
import '@/i18n';
import { PWAInstallBanner } from "./components/PWAInstallBanner";
import { PWARegistration } from "./components/PWARegistration";
import { OfflineBanner } from "./components/OfflineBanner";

// ✅ Internal loading component for Suspense fallbacks
const LoadingState = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="relative w-12 h-12">
      <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
      <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  </div>
);

// ✅ Simple Error Boundary for Admin
class AdminErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  componentDidCatch(error: any, errorInfo: any) { console.error("[AdminErrorBoundary] caught error:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-50 border-4 border-red-500 m-4 rounded-xl text-red-900">
          <h1 className="text-2xl font-bold mb-2">Admin Render Error</h1>
          <p className="font-mono mb-4">{this.state.error?.message || "Unknown error"}</p>
          <button onClick={() => window.location.reload()} className="bg-red-600 text-white px-4 py-2 rounded">Reload Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (authError) {
        setError(authError.message);
        setIsLoading(false);
        return;
      }

      if (!data.user) {
        setError('Authentication failed.');
        setIsLoading(false);
        return;
      }

      // Verify admin status
      const { data: coreTeam, error: coreError } = await supabase
        .from('core_team')
        .select('is_admin, is_active')
        .eq('user_id', data.user.id)
        .single();

      const teamData = coreTeam as { is_admin: boolean; is_active: boolean } | null;

      if (coreError || !teamData?.is_admin || !teamData?.is_active) {
        setError('Access Denied: Admin privileges required.');
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }

      onLogin(true);
    } catch (err) {
      setError('An unexpected error occurred.');
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
    <div className="min-h-screen bg-[#007AFF]/5 flex items-center justify-center p-4">
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

// ✅ Stable global auth state to survive re-mount loops
let _cachedAdminStatus: { authenticated: boolean; checked: boolean } = { authenticated: false, checked: false };

// ✅ SECURE Admin Route Protection Component
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const [isChecking, setIsChecking] = useState(!_cachedAdminStatus.checked);
  const [isAuthenticated, setIsAuthenticated] = useState(_cachedAdminStatus.authenticated);

  useEffect(() => {
    let isMounted = true;

    const performCheck = async () => {
      if (_cachedAdminStatus.checked) {
        if (isMounted) setIsChecking(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          _cachedAdminStatus = { authenticated: false, checked: true };
          if (isMounted) {
            setIsAuthenticated(false);
            setIsChecking(false);
          }
          return;
        }

        const { data: coreTeam } = await supabase
          .from('core_team')
          .select('is_admin, is_active')
          .eq('user_id', session.user.id)
          .single();

        const teamData = coreTeam as { is_admin: boolean; is_active: boolean } | null;
        const isValid = !!(teamData?.is_admin && teamData?.is_active);
        _cachedAdminStatus = { authenticated: isValid, checked: true };

        if (isMounted) {
          setIsAuthenticated(isValid);
          setIsChecking(false);
        }
      } catch (err) {
        if (isMounted) {
          setIsAuthenticated(false);
          setIsChecking(false);
        }
      }
    };

    performCheck();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        _cachedAdminStatus = { authenticated: false, checked: true };
        if (isMounted) {
          setIsAuthenticated(false);
          setIsChecking(false);
        }
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        _cachedAdminStatus.checked = false;
        performCheck();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (isChecking) {
    return <LoadingState />;
  }

  if (!isAuthenticated) {
    return <AdminLogin onLogin={(success) => {
      _cachedAdminStatus = { authenticated: success, checked: true };
      setIsAuthenticated(success);
      setIsChecking(false);
    }} />;
  }

  return <>{children}</>;
};

// ✅ Contributions Dashboard Component (Legacy, preserved but not primarily used)
const ContributionsDashboard = React.lazy(() => import('@/components/Admin/ContributionsDashboard'));

// ✅ Helper for legacy dynamic route redirection
const LegacyDynamicRedirect = () => {
  const { county, area, constituency } = useParams();
  const destArea = area || constituency;
  if (destArea) {
    return <Navigate to={`/${county}/${destArea}`} replace />;
  }
  return <Navigate to={`/${county}`} replace />;
};

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

        {/* ✅ ACTIVE SECURE ADMIN ROUTES */}
        <Route
          path="/admin/contributions/*"
          element={
            <AdminErrorBoundary>
              <AdminRoute>
                <AdminNexus />
              </AdminRoute>
            </AdminErrorBoundary>
          }
        />
        <Route
          path="/admin/*"
          element={
            <AdminErrorBoundary>
              <AdminRoute>
                <AdminNexus />
              </AdminRoute>
            </AdminErrorBoundary>
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
        <Route path="/admin" element={<Navigate to="/admin/" replace />} />
        <Route path="/dashboard" element={<Navigate to="/admin/" replace />} />

        {/* ✅ ACTIVE IEBC OFFICE FINDER ROUTES */}
        <Route path="/" element={<React.Suspense fallback={<LoadingState />}><IEBCOfficeSplash /></React.Suspense>} />
        <Route path="/map" element={<React.Suspense fallback={<LoadingState />}><IEBCOfficeMap /></React.Suspense>} />
        <Route path="/map/:query" element={<React.Suspense fallback={<LoadingState />}><IEBCOfficeMap /></React.Suspense>} />
        <Route path="/map/:countySlug" element={<React.Suspense fallback={<LoadingState />}><IEBCOfficeMap /></React.Suspense>} />
        <Route path="/map/:countySlug/:constituencySlug" element={<React.Suspense fallback={<LoadingState />}><IEBCOfficeMap /></React.Suspense>} />
        <Route path="/map/:countySlug/:constituencySlug/:wardSlug" element={<React.Suspense fallback={<LoadingState />}><IEBCOfficeMap /></React.Suspense>} />

        {/* Legacy Redirects to root counterparts */}
        <Route path="/iebc-office" element={<Navigate to="/" replace />} />
        <Route path="/nasaka-iebc" element={<Navigate to="/" replace />} />
        <Route path="/iebc-office/map" element={<Navigate to="/map" replace />} />
        <Route path="/nasaka-iebc/map" element={<Navigate to="/map" replace />} />

        {/* ✅ SEO PILLAR PAGES (Go Ham) */}
        <Route path="/voter-services" element={<React.Suspense fallback={<LoadingState />}><VoterServices /></React.Suspense>} />
        <Route path="/boundary-review" element={<React.Suspense fallback={<LoadingState />}><BoundaryReview /></React.Suspense>} />
        <Route path="/election-resources" element={<React.Suspense fallback={<LoadingState />}><ElectionResources /></React.Suspense>} />
        <Route path="/data-api" element={<React.Suspense fallback={<LoadingState />}><DataAPI /></React.Suspense>} />
        <Route path="/voter-registration" element={<React.Suspense fallback={<LoadingState />}><VoterRegistration /></React.Suspense>} />

        {/* ✅ B2B BILLING & DASHBOARD ROUTES */}
        <Route path="/pricing" element={<React.Suspense fallback={<LoadingState />}><Pricing /></React.Suspense>} />
        <Route path="/docs" element={<React.Suspense fallback={<LoadingState />}><Docs /></React.Suspense>} />
        <Route path="/dashboard/api-keys" element={<React.Suspense fallback={<LoadingState />}><ApiKeysDashboard /></React.Suspense>} />

        {/* ✅ DEDICATED AUTH ROUTES */}
        <Route path="/auth" element={<React.Suspense fallback={<LoadingState />}><Auth /></React.Suspense>} />
        <Route path="/auth/callback" element={<React.Suspense fallback={<LoadingState />}><AuthCallback /></React.Suspense>} />
        <Route path="/auth/reset-password" element={<React.Suspense fallback={<LoadingState />}><ResetPassword /></React.Suspense>} />

        {/* ✅ LEGAL PAGES (Nasaka Blue Edition as Primary) */}
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />

        {/* Legacy Recall254 Legal Pages (Preserved) */}
        <Route path="/legal/privacy" element={<PrivacyPolicy />} />
        <Route path="/legal/terms" element={<TermsAndConditions />} />

        {/* Redirect legacy prefixed legal paths */}
        <Route path="/iebc-office/privacy" element={<Navigate to="/privacy" replace />} />
        <Route path="/iebc-office/terms" element={<Navigate to="/terms" replace />} />
        <Route path="/nasaka-iebc/privacy" element={<Navigate to="/privacy" replace />} />
        <Route path="/nasaka-iebc/terms" element={<Navigate to="/terms" replace />} />

        {/* ✅ CANONICAL HIERARCHICAL ROUTES (Full Ham) */}
        <Route
          path="/:county/:constituency/:ward/:index"
          element={
            <React.Suspense fallback={<LoadingState />}>
              <OfficeDetail />
            </React.Suspense>
          }
        />
        <Route
          path="/:county/:constituency/:ward"
          element={
            <React.Suspense fallback={<LoadingState />}>
              <OfficeDetail />
            </React.Suspense>
          }
        />
        <Route
          path="/:county/:constituency"
          element={
            <React.Suspense fallback={<LoadingState />}>
              <OfficeDetail />
            </React.Suspense>
          }
        />
        {/* ✅ FLAT ROUTE RESOLVER handles /:county paths too — see FlatRouteResolver.tsx */}

        {/* ✅ DYNAMIC IEBC OFFICE ROUTES (Legacy Support Redirects) */}
        <Route path="/iebc-office/:county/:constituency" element={<LegacyDynamicRedirect />} />
        <Route path="/iebc-office/:county" element={<LegacyDynamicRedirect />} />

        {/* ✅ FLAT ROUTE RESOLVER (Go Ham) */}
        <Route path="/:slug" element={<FlatRouteResolver />} />

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

  // 🗺️ Request persistent storage for offline map tiles and route data
  useEffect(() => {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then((granted) => {
        if (granted) {
          console.info('[Nasaka] Persistent storage granted — tiles will survive storage pressure');
        }
      });
    }
  }, []);

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LanguageProvider>
            <TooltipProvider delayDuration={0}>
              <Toaster />
              <Sonner position="top-right" expand={false} richColors closeButton />
              <PWARegistration />
              <AuthProvider>
                <AppContent />
              </AuthProvider>
              <PWAInstallBanner />
            </TooltipProvider>
          </LanguageProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;
