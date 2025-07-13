
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Users, FileText, Shield, MapPin, TrendingUp, BarChart3, Scale, Search, Moon, Sun } from 'lucide-react';
import ModernHeader from '@/components/ModernHeader';
import ModernFooter from '@/components/ModernFooter';
import WardSearchInterface from '@/components/WardSearchInterface';
import KenyaHeatMap from '@/components/KenyaHeatMap';
import SimplifiedSignatureFlow from '@/components/SimplifiedSignatureFlow';
import EnhancedPetitionDashboard from '@/components/EnhancedPetitionDashboard';
import LegalRepository from '@/components/LegalRepository';
import ConstituencySearch from '@/components/ConstituencySearch';
import PetitionWizard from '@/components/PetitionWizard';
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

  useEffect(() => {
    fetchRealPetitionStats();
    const interval = setInterval(fetchRealPetitionStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchRealPetitionStats = async () => {
    try {
      console.log('Fetching real petition stats...');
      
      // Fetch active petitions count
      const { data: petitions, error: petitionsError } = await supabase
        .from('petitions')
        .select('*')
        .eq('status', 'active');

      if (petitionsError) throw petitionsError;

      // Fetch total signatures count
      const { data: signatures, error: signaturesError } = await supabase
        .from('signatures')
        .select('*');

      if (signaturesError) throw signaturesError;

      // Fetch verified signatures count
      const { data: verifiedSignatures, error: verifiedError } = await supabase
        .from('signatures')
        .select('*')
        .eq('verification_status->verified', true);

      if (verifiedError) throw verifiedError;

      // Fetch unique wards count
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
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const navigationItems = [
    { id: 'dashboard', label: 'Active Petitions', icon: Users },
    { id: 'search', label: 'Search Wards', icon: Search },
    { id: 'sign', label: 'Sign Petition', icon: FileText },
    { id: 'map', label: 'Electoral Map', icon: MapPin },
    { id: 'legal', label: 'Legal Framework', icon: Scale }
  ];

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-gray-900' : 'bg-gradient-to-br from-green-50/30 to-white'}`}>
      <ModernHeader darkMode={darkMode} />

      {/* Hero Section - Minimalistic Centered */}
      <section className={`${darkMode ? 'bg-gray-800' : 'bg-gradient-to-br from-green-50/40 via-white to-green-50/20'} py-20`}>
        <div className="container mx-auto px-4 text-center max-w-4xl">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          
          <h1 className={`text-5xl font-bold ${darkMode ? 'text-white' : 'text-green-900'} mb-3`}>
            Recall254
          </h1>
          <h2 className={`text-2xl font-semibold ${darkMode ? 'text-gray-300' : 'text-green-800'} mb-8`}>
            Not For GenZ, For Kenya
          </h2>
          
          {/* Constituency Search */}
          <div className="max-w-2xl mx-auto mb-8">
            <ConstituencySearch />
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button 
              onClick={() => setActiveTab('wizard')}
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg"
              size="lg"
            >
              Start Petition
            </Button>
            <Button 
              onClick={() => setActiveTab('map')}
              variant="outline" 
              className="border-green-600 text-green-600 hover:bg-green-50 px-8 py-3 text-lg"
              size="lg"
            >
              IEBC Map
            </Button>
          </div>
          
          {/* Dark Mode Toggle */}
          <Button
            onClick={toggleDarkMode}
            variant="ghost"
            size="sm"
            className={`${darkMode ? 'text-gray-300 hover:text-white' : 'text-green-600 hover:text-green-800'}`}
          >
            {darkMode ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </Button>
        </div>
      </section>

      {/* Live Statistics */}
      <section className={`${darkMode ? 'bg-gray-700/50' : 'bg-white/50'} backdrop-blur-sm py-8 border-y ${darkMode ? 'border-gray-600' : 'border-green-100'}`}>
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className={`${darkMode ? 'bg-gray-800 border-gray-600' : 'border-green-200/50 bg-gradient-to-br from-green-50/30 to-white'}`}>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Users className={`w-5 h-5 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
                </div>
                <p className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-green-800'}`}>{petitionStats.totalSignatures.toLocaleString()}</p>
                <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-green-600'}`}>Total Signatures</p>
              </CardContent>
            </Card>

            <Card className={`${darkMode ? 'bg-gray-800 border-gray-600' : 'border-green-200/50 bg-gradient-to-br from-green-50/30 to-white'}`}>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <CheckCircle className={`w-5 h-5 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
                </div>
                <p className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-green-800'}`}>{petitionStats.validSignatures.toLocaleString()}</p>
                <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-green-600'}`}>Verified</p>
              </CardContent>
            </Card>

            <Card className={`${darkMode ? 'bg-gray-800 border-gray-600' : 'border-green-200/50 bg-gradient-to-br from-green-50/30 to-white'}`}>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <MapPin className={`w-5 h-5 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
                </div>
                <p className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-green-800'}`}>{petitionStats.wardsCovered}/{petitionStats.totalWards}</p>
                <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-green-600'}`}>Wards</p>
              </CardContent>
            </Card>

            <Card className={`${darkMode ? 'bg-gray-800 border-gray-600' : 'border-green-200/50 bg-gradient-to-br from-green-50/30 to-white'}`}>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Shield className={`w-5 h-5 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
                </div>
                <p className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-green-800'}`}>{petitionStats.complianceScore}%</p>
                <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-green-600'}`}>Compliant</p>
              </CardContent>
            </Card>

            <Card className={`${darkMode ? 'bg-gray-800 border-gray-600' : 'border-green-200/50 bg-gradient-to-br from-green-50/30 to-white'}`}>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <TrendingUp className={`w-5 h-5 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
                </div>
                <p className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-green-800'}`}>{petitionStats.activePetitions}</p>
                <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-green-600'}`}>Active</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Main Application Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 justify-center">
            {navigationItems.map((item) => (
              <Button
                key={item.id}
                variant={activeTab === item.id ? "default" : "ghost"}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 transition-all ${
                  activeTab === item.id 
                    ? 'bg-green-600 hover:bg-green-700 text-white shadow-md' 
                    : `${darkMode ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-green-700 hover:bg-green-50 hover:text-green-800'}`
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
          {activeTab === 'dashboard' && <EnhancedPetitionDashboard />}
          {activeTab === 'search' && <WardSearchInterface />}
          {activeTab === 'sign' && <SimplifiedSignatureFlow />}
          {activeTab === 'map' && <KenyaHeatMap />}
          {activeTab === 'legal' && <LegalRepository />}
          {activeTab === 'wizard' && <PetitionWizard />}
        </div>
      </div>

      <ModernFooter />
    </div>
  );
};

export default Index;
