import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useLenis } from "./hooks/useLenis";
import Index from "./pages/Index";
import SignPetition from "./pages/SignPetition";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsAndConditions from "./pages/TermsAndConditions";
import VerifySignature from "./pages/VerifySignature";
import VoterRegistrationPage from "@/pages/VoterRegistration";
import { IEBCOfficeSplash, IEBCOfficeMap } from './pages/IEBCOffice';
import './styles/iebc-office.css'

// ✅ ENHANCED QUERY CLIENT FOR IEBC DATA
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
  // Initialize Lenis smooth scrolling
  const { lenis } = useLenis();

  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
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

        <Route path="/iebc-office" element={<IEBCOfficeSplash />} />
        <Route path="/iebc-office/map" element={<IEBCOfficeMap />} />
        
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
