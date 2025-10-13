import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useLenis } from "./hooks/useLenis";
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Index from "./pages/Index";
import SignPetition from "./pages/SignPetition";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsAndConditions from "./pages/TermsAndConditions";
import VerifySignature from "./pages/VerifySignature";
import VoterRegistrationPage from "@/pages/VoterRegistration";
import { IEBCOfficeSplash, IEBCOfficeMap } from './pages/IEBCOffice';
import ContributionModeration from './pages/Admin/ContributionModeration';
import AdminDashboard from './pages/Admin/AdminDashboard';
import AdminLogin from './pages/Admin/AdminLogin';
import Unauthorized from './pages/Unauthorized';
import './styles/iebc-office.css';

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

const AppContent = () => {
  const { lenis } = useLenis();

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Index />} />
        <Route path="/sign/:id" element={<SignPetition />} />
        <Route path="/verify" element={<VerifySignature />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsAndConditions />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        
        {/* IEBC Voter Registration Routes */}
        <Route path="/voter-registration" element={<VoterRegistrationPage />} />
        <Route path="/iebc-offices" element={<VoterRegistrationPage />} />
        <Route path="/register-to-vote" element={<VoterRegistrationPage />} />

        {/* IEBC Office Finder Routes */}
        <Route path="/iebc-office" element={<IEBCOfficeSplash />} />
        <Route path="/nasaka-iebc" element={<IEBCOfficeSplash />} />
        <Route path="/iebc-office/map" element={<IEBCOfficeMap />} />
        
        {/* Admin Authentication */}
        <Route path="/admin/login" element={<AdminLogin />} />
        
        {/* Protected Admin Routes */}
        <Route 
          path="/admin/dashboard" 
          element={
            <ProtectedRoute requireAdmin={true}>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/contributions" 
          element={
            <ProtectedRoute requireAdmin={true}>
              <ContributionModeration />
            </ProtectedRoute>
          } 
        />
        
        {/* Catch-all Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider delayDuration={0}>
      <AuthProvider>
        <Toaster />
        <Sonner position="top-right" expand={false} richColors closeButton />
        <AppContent />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
