import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Users, FileText, Shield, MapPin, TrendingUp, UserPlus, UserCheck } from 'lucide-react';
import ModernHeader from '@/components/ModernHeader';
import ModernFooter from '@/components/ModernFooter';
import WardSearchInterface from '@/components/WardSearchInterface';
import KenyaHeatMap from '@/components/KenyaHeatMap';
import EnhancedSignatureFlow from '@/components/EnhancedSignatureFlow';
import EnhancedPetitionDashboard from '@/components/EnhancedPetitionDashboard';
import LegalRepository from '@/components/LegalRepository';
import ConstituencySearch from '@/components/ConstituencySearch';
import PetitionWizard from '@/components/PetitionWizard';
import CountyStatistics from '@/components/CountyStatistics';
import ConstitutionalFlowchart from '@/components/ConstitutionalFlowchart';
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const [petitionStats, setPetitionStats] = useState({
    totalSignatures: 0,
    validSignatures: 0,
    wardsCovered: 0,
    totalWards: 0,
    complianceScore: 0,
    activePetitions: 0
  });

  // Refs for section scrolling
  const mainContentRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<{[key: string]: HTMLDivElement | null}>({});

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    const systemDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialDarkMode = savedDarkMode ? JSON.parse(savedDarkMode) : systemDarkMode;
    
    setDarkMode(initialDarkMode);
    if (initialDarkMode) {
      document.documentElement.classList.add('dark');
    }

    fetchRealPetitionStats();
    const interval = setInterval(fetchRealPetitionStats, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleTabNavigation = (event: CustomEvent) => {
      scrollToTab(event.detail.tabId);
    };

    window.addEventListener('tab-navigation', handleTabNavigation as EventListener);
    return () => {
      window.removeEventListener('tab-navigation', handleTabNavigation as EventListener);
    };
  }, []);

  const fetchRealPetitionStats = async () => {
    try {
      const { data: petitions, error: petitionsError } = await supabase
        .from('petitions')
        .select('*')
        .eq('status', 'active');

      if (petitionsError) throw petitionsError;

      const { data: signatures, error: signaturesError } = await supabase
        .from('signatures')
        .select('*');

      if (signaturesError) throw signaturesError;

      const { data: verifiedSignatures, error: verifiedError } = await supabase
        .from('signatures')
        .select('*')
        .eq('verification_status->>verified', 'true');

      if (verifiedError) throw verifiedError;

      const { data: wards, error: wardsError } = await supabase
        .from('wards')
        .select('*');

      if (wardsError) throw wardsError;

      const uniqueWardsCovered = new Set(signatures?.map(s => s.ward)).size;
      const totalWards = wards?.length || 0;
      const complianceScore = totalWards > 0 ? Math.round((uniqueWardsCovered / totalWards) * 100) : 0;

      setPetitionStats({
        totalSignatures: signatures?.length || 0,
        validSignatures: verifiedSignatures?.length || 0,
        wardsCovered: uniqueWardsCovered,
        totalWards: totalWards,
        complianceScore: complianceScore,
        activePetitions: petitions?.length || 0
      });
    } catch (error) {
      console.error('Failed to fetch petition stats:', error);
    }
  };

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', JSON.stringify(newDarkMode));
    document.documentElement.classList.toggle('dark', newDarkMode);
  };

  const scrollToTab = (tabId: string) => {
    setActiveTab(tabId);
    setTimeout(() => {
      const section = sectionsRef.current[tabId];
      if (section) {
        const header = document.querySelector('header');
        const headerHeight = header?.clientHeight || 64;
        const sectionTop = section.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({ top: sectionTop - headerHeight, behavior: 'smooth' });
      }
    }, 100);
  };

  const navigationItems = [
    { id: 'dashboard', label: 'Active Petitions', icon: Users },
    { id: 'search', label: 'Search Wards', icon: MapPin },
    { id: 'sign', label: 'Sign Petition', icon: FileText },
    { id: 'map', label: 'Electoral Map', icon: MapPin },
    { id: 'legal', label: 'Legal Framework', icon: Shield }
  ];

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode 
        ? 'dark bg-gray-900' 
        : 'bg-gradient-to-br from-green-50/30 to-white'
    }`}>
      <ModernHeader 
        darkMode={darkMode} 
        toggleDarkMode={toggleDarkMode} 
        scrollToTab={scrollToTab} 
      />

      {/* Hero Section - Minimalistic Centered */}
      <section className={`py-16 transition-colors duration-300 ${
        darkMode 
          ? 'bg-gray-800' 
          : 'bg-gradient-to-br from-green-50/40 via-white to-green-50/20'
      }`}>
        <div className="container mx-auto px-4 text-center max-w-4xl">
          {/* Container 1: Search + Buttons */}
          <div className="mb-12">
            <div className="max-w-2xl mx-auto mb-6">
              <ConstituencySearch />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                onClick={() => scrollToTab('wizard')}
                className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white px-6 py-3"
              >
                Start Petition
              </Button>
              <Button 
                onClick={() => scrollToTab('map')}
                variant="outline" 
                className="border-green-600 dark:border-green-500 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 px-6 py-3"
              >
                IEBC Map
              </Button>
            </div>
          </div>
          
          {/* Container 2: Voter Registration - Split Layout */}
          <div className="text-left mb-6">
            <h3 className={`text-xl font-bold mb-4 transition-colors duration-300 ${
              darkMode ? 'text-white' : 'text-green-900'
            }`}>
              Voter Registration Services
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Left Card - Registered Voters */}
            <Card className={`transition-colors duration-300 h-full ${
              darkMode 
                ? 'bg-gradient-to-br from-green-900/80 to-gray-800 border-gray-700' 
                : 'bg-gradient-to-br from-green-50 to-green-100 border-green-200/50'
            }`}>
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex items-center mb-4">
                  <div className={`p-2 rounded-full mr-3 ${
                    darkMode 
                      ? 'bg-green-800/50 text-green-300' 
                      : 'bg-green-100 text-green-700'
                  }`}>
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <h4 className={`text-lg font-bold transition-colors duration-300 ${
                    darkMode ? 'text-white' : 'text-green-900'
                  }`}>
                    Already Registered?
                  </h4>
                </div>
                
                <div className={`flex-grow mb-4 rounded-lg overflow-hidden ${
                  darkMode 
                    ? 'bg-gray-700 border border-gray-600' 
                    : 'bg-white border border-green-200'
                }`}>
                  <div className="aspect-video bg-gradient-to-br from-green-400/20 to-green-600/10 flex items-center justify-center">
                    <div className="text-center p-4">
                      <div className="bg-gray-200 border-2 border-dashed rounded-xl w-16 h-16 mx-auto mb-4" />
                      <p className={`mb-4 transition-colors duration-300 ${
                        darkMode ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        Verify your voter registration status with IEBC
                      </p>
                    </div>
                  </div>
                </div>
                
                <Button 
                  asChild
                  className={`mt-auto ${
                    darkMode 
                      ? 'bg-green-700 hover:bg-green-600' 
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  <a 
                    href="https://verify.iebc.or.ke/" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white"
                  >
                    Verify Registration Status
                  </a>
                </Button>
              </CardContent>
            </Card>
            
            {/* Right Card - New Voters */}
            <Card className={`transition-colors duration-300 h-full ${
              darkMode 
                ? 'bg-gradient-to-br from-emerald-900/80 to-gray-800 border-gray-700' 
                : 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200/50'
            }`}>
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex items-center mb-4">
                  <div className={`p-2 rounded-full mr-3 ${
                    darkMode 
                      ? 'bg-emerald-800/50 text-emerald-300' 
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <h4 className={`text-lg font-bold transition-colors duration-300 ${
                    darkMode ? 'text-white' : 'text-emerald-900'
                  }`}>
                    Become a Voter
                  </h4>
                </div>
                
                <div className={`flex-grow mb-4 rounded-lg overflow-hidden ${
                  darkMode 
                    ? 'bg-gray-700 border border-gray-600' 
                    : 'bg-white border border-emerald-200'
                }`}>
                  <div className="aspect-video bg-gradient-to-br from-emerald-400/20 to-emerald-600/10 flex items-center justify-center">
                    <div className="text-center p-4">
                      <div className="bg-gray-200 border-2 border-dashed rounded-xl w-16 h-16 mx-auto mb-4" />
                      <p className={`mb-4 transition-colors duration-300 ${
                        darkMode ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        Learn how to register as a voter in Kenya
                      </p>
                    </div>
                  </div>
                </div>
                
                <Button 
                  asChild
                  className={`mt-auto ${
                    darkMode 
                      ? 'bg-emerald-700 hover:bg-emerald-600' 
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  <a 
                    href="https://www.iebc.or.ke/registration/?how" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white"
                  >
                    How To Register
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Live Statistics */}
      <section className={`py-6 border-y transition-colors duration-300 ${
        darkMode 
          ? 'bg-gray-700/50 border-gray-600' 
          : 'bg-white/50 border-green-100'
      }`}>
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { icon: Users, value: petitionStats.totalSignatures, label: 'Total Signatures' },
              { icon: CheckCircle, value: petitionStats.validSignatures, label: 'Verified' },
              { icon: MapPin, value: `${petitionStats.wardsCovered}/${petitionStats.totalWards}`, label: 'Wards' },
              { icon: Shield, value: `${petitionStats.complianceScore}%`, label: 'Compliant' },
              { icon: TrendingUp, value: petitionStats.activePetitions, label: 'Active' }
            ].map((stat, index) => (
              <Card key={index} className={`transition-colors duration-300 ${
                darkMode 
                  ? 'bg-gray-800 border-gray-600' 
                  : 'border-green-200/50 bg-gradient-to-br from-green-50/30 to-white'
              }`}>
                <CardContent className="p-3 text-center">
                  <div className="flex items-center justify-center mb-1">
                    <stat.icon className={`w-4 h-4 ${
                      darkMode ? 'text-green-400' : 'text-green-600'
                    }`} />
                  </div>
                  <p className={`text-lg font-bold transition-colors duration-300 ${
                    darkMode ? 'text-white' : 'text-green-800'
                  }`}>
                    {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                  </p>
                  <p className={`text-xs transition-colors duration-300 ${
                    darkMode ? 'text-gray-300' : 'text-green-600'
                  }`}>
                    {stat.label}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Constitutional Framework Section */}
      <section className={`py-12 transition-colors duration-300 ${
        darkMode ? 'bg-gray-800/50' : 'bg-gradient-to-br from-green-50/20 to-white'
      }`}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className={`text-2xl font-bold mb-2 transition-colors duration-300 ${
              darkMode ? 'text-white' : 'text-green-900'
            }`}>
              Constitutional Legal Framework
            </h2>
            <p className={`text-sm transition-colors duration-300 ${
              darkMode ? 'text-gray-400' : 'text-green-700'
            }`}>
              Understanding the legal process for democratic accountability
            </p>
          </div>
          <ConstitutionalFlowchart />
        </div>
      </section>

      {/* County Statistics Section */}
      <section className={`py-8 transition-colors duration-300 ${
        darkMode ? 'bg-gray-900/50' : 'bg-white/50'
      }`}>
        <div className="container mx-auto px-4">
          <CountyStatistics />
        </div>
      </section>

      {/* Main Application Content */}
      <div 
        ref={mainContentRef}
        className="container mx-auto px-4 py-8"
      >
        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 justify-center">
            {navigationItems.map((item) => (
              <Button
                key={item.id}
                variant={activeTab === item.id ? "default" : "ghost"}
                onClick={() => scrollToTab(item.id)}
                className={`flex items-center space-x-2 transition-all duration-300 ${
                  activeTab === item.id 
                    ? 'bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white shadow-md' 
                    : `${
                      darkMode 
                        ? 'text-gray-300 hover:bg-gray-700 hover:text-white' 
                        : 'text-green-700 hover:bg-green-50 hover:text-green-800'
                    }`
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-8">
          {activeTab === 'dashboard' && (
            <div ref={el => sectionsRef.current.dashboard = el}>
              <EnhancedPetitionDashboard />
            </div>
          )}
          {activeTab === 'search' && (
            <div ref={el => sectionsRef.current.search = el}>
              <WardSearchInterface />
            </div>
          )}
          {activeTab === 'sign' && (
            <div ref={el => sectionsRef.current.sign = el}>
              <EnhancedSignatureFlow />
            </div>
          )}
          {activeTab === 'map' && (
            <div ref={el => sectionsRef.current.map = el}>
              <KenyaHeatMap />
            </div>
          )}
          {activeTab === 'legal' && (
            <div ref={el => sectionsRef.current.legal = el}>
              <LegalRepository />
            </div>
          )}
          {activeTab === 'wizard' && (
            <div ref={el => sectionsRef.current.wizard = el}>
              <PetitionWizard />
            </div>
          )}
        </div>
      </div>

      <ModernFooter />
    </div>
  );
};

export default Index;
