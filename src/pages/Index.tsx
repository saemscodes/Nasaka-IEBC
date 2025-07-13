import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Users, FileText, Shield, MapPin, TrendingUp } from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState(true);

  // Initialize dark mode
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

  // Toggle dark mode
  const toggleDarkMode = useCallback(() => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', JSON.stringify(newDarkMode));
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Fetch petition stats
  const fetchRealPetitionStats = async () => {
    try {
      setIsLoading(true);
      
      const [
        { data: petitions, error: petitionsError },
        { data: signatures, error: signaturesError },
        { data: verifiedSignatures, error: verifiedError },
        { data: wards, error: wardsError }
      ] = await Promise.all([
        supabase.from('petitions').select('*').eq('status', 'active'),
        supabase.from('signatures').select('*'),
        supabase.from('signatures').select('*').eq('verification_status->>verified', 'true'),
        supabase.from('wards').select('*')
      ]);

      if (petitionsError || signaturesError || verifiedError || wardsError) {
        throw new Error('Failed to fetch data');
      }

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
    } finally {
      setIsLoading(false);
    }
  };

  // Scroll to section
  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      const headerOffset = 100;
      const elementPosition = section.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      
      // Update active tab if needed
      const tabId = sectionId.replace('-section', '');
      if (tabId !== activeTab) {
        setActiveTab(tabId);
      }
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode 
        ? 'dark bg-gray-900' 
        : 'bg-gradient-to-br from-green-50/30 to-white'
    }`}>
      <ModernHeader 
        darkMode={darkMode} 
        toggleDarkMode={toggleDarkMode} 
        onNavigate={scrollToSection}
      />

      {/* Hero Section */}
      <section className={`py-16 transition-colors duration-300 ${
        darkMode 
          ? 'bg-gray-800' 
          : 'bg-gradient-to-br from-green-50/40 via-white to-green-50/20'
      }`}>
        <div className="container mx-auto px-4 text-center max-w-4xl">
          {/* Container 1: Search + Buttons */}
          <div className="mb-12">
            <h1 className={`text-4xl font-bold mb-2 transition-colors duration-300 ${
              darkMode ? 'text-white' : 'text-green-900'
            }`}>
              Recall254
            </h1>
            <p className={`text-lg mb-8 transition-colors duration-300 ${
              darkMode ? 'text-gray-300' : 'text-green-700'
            }`}>
              Citizen-powered democratic accountability
            </p>
            
            <div className="max-w-2xl mx-auto mb-6">
              <ConstituencySearch />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                onClick={() => scrollToSection('wizard-section')}
                className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white px-6 py-3"
              >
                Start Petition
              </Button>
              <Button 
                onClick={() => scrollToSection('map-section')}
                variant="outline" 
                className="border-green-600 dark:border-green-500 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 px-6 py-3"
              >
                View Electoral Map
              </Button>
            </div>
          </div>

          {/* Container 2: Voter Verification */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            <div className={`p-4 ${darkMode ? 'bg-gray-700' : 'bg-green-50'}`}>
              <h3 className={`font-bold flex items-center justify-center gap-2 ${darkMode ? 'text-white' : 'text-green-800'}`}>
                <Shield className="w-5 h-5" />
                Verify Voter Registration Status
              </h3>
            </div>
            
            <div className="relative h-96 w-full">
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800">
                  <div className="animate-pulse flex flex-col items-center">
                    <div className="w-16 h-16 bg-gray-200 dark:bg-gray-600 rounded-full mb-4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-32 mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-48"></div>
                  </div>
                </div>
              ) : (
                <iframe 
                  src="https://verify.iebc.or.ke/" 
                  title="IEBC Voter Verification"
                  className="absolute top-0 left-0 w-full h-full border-0"
                  sandbox="allow-same-origin allow-scripts allow-forms"
                  onLoad={() => setIsLoading(false)}
                />
              )}
            </div>
            
            <div className="p-3 text-xs text-gray-500 dark:text-gray-400">
              Official IEBC voter verification portal
            </div>
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

      {/* Constitutional Framework */}
      <section id="legal-section" className={`py-12 transition-colors duration-300 ${
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

      {/* County Statistics */}
      <section id="map-section" className={`py-8 transition-colors duration-300 ${
        darkMode ? 'bg-gray-900/50' : 'bg-white/50'
      }`}>
        <div className="container mx-auto px-4">
          <CountyStatistics />
        </div>
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              { id: 'dashboard', label: 'Active Petitions', icon: Users },
              { id: 'search', label: 'Search Wards', icon: MapPin },
              { id: 'sign', label: 'Sign Petition', icon: FileText },
              { id: 'map', label: 'Electoral Map', icon: MapPin },
              { id: 'legal', label: 'Legal Framework', icon: Shield }
            ].map((item) => (
              <Button
                key={item.id}
                variant={activeTab === item.id ? "default" : "ghost"}
                onClick={() => scrollToSection(`${item.id}-section`)}
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
          <div id="dashboard-section">
            <EnhancedPetitionDashboard />
          </div>
          <div id="search-section">
            <WardSearchInterface />
          </div>
          <div id="sign-section">
            <EnhancedSignatureFlow />
          </div>
          <div id="map-section">
            <KenyaHeatMap />
          </div>
          <div id="legal-section">
            <LegalRepository />
          </div>
          <div id="wizard-section">
            <PetitionWizard />
          </div>
        </div>
      </div>

      <ModernFooter />
    </div>
  );
};

export default Index;
