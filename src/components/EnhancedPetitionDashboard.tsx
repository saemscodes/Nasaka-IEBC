
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, MapPin, Clock, FileText, AlertTriangle, CheckCircle, TrendingUp, BarChart3 } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import PetitionCard from './PetitionCard';
import { useToast } from "@/hooks/use-toast";

interface Petition {
  id: string;
  mp_name: string;
  constituency: string;
  county: string;
  grounds: string[];
  description: string;
  signature_target: number;
  ward_target: number;
  deadline: string;
  status: string;
  created_at: string;
}

interface PetitionStats {
  current_signatures: number;
  wards_covered: number;
  compliance_score: number;
  verification_rate: number;
}

const EnhancedPetitionDashboard = () => {
  const [petitions, setPetitions] = useState<Petition[]>([]);
  const [petitionStats, setPetitionStats] = useState<{ [key: string]: PetitionStats }>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');
  const { toast } = useToast();

  useEffect(() => {
    fetchPetitions();
    fetchPetitionStats();
  }, []);

  const fetchPetitions = async () => {
    try {
      const { data, error } = await supabase
        .from('petitions')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPetitions(data || []);
    } catch (error) {
      console.error('Error fetching petitions:', error);
      toast({
        title: "Error",
        description: "Failed to load petitions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPetitionStats = async () => {
    try {
      // Fetch signature counts and ward coverage for each petition
      const { data: signatures, error } = await supabase
        .from('signatures')
        .select('petition_id, ward, verification_status');

      if (error) throw error;

      // Calculate stats for each petition
      const stats: { [key: string]: PetitionStats } = {};
      
      signatures?.forEach(sig => {
        if (!stats[sig.petition_id]) {
          stats[sig.petition_id] = {
            current_signatures: 0,
            wards_covered: 0,
            compliance_score: 0,
            verification_rate: 0
          };
        }
        stats[sig.petition_id].current_signatures++;
      });

      // Count unique wards per petition
      signatures?.forEach(sig => {
        const wardSet = new Set();
        signatures.filter(s => s.petition_id === sig.petition_id)
          .forEach(s => wardSet.add(s.ward));
        if (stats[sig.petition_id]) {
          stats[sig.petition_id].wards_covered = wardSet.size;
        }
      });

      setPetitionStats(stats);
    } catch (error) {
      console.error('Error fetching petition stats:', error);
    }
  };

  // Inside EnhancedPetitionDashboard component
const handleCreatePetition = () => {
  // Dispatch custom event to navigate to wizard tab
  const event = new CustomEvent('tab-navigation', { 
    detail: { 
      tabId: 'wizard'
    } 
  });
  window.dispatchEvent(event);
};

  const handleJoinPetition = (petitionId: string) => {
    // Navigate to signature collection
    window.location.href = `/sign/${petitionId}`;
  };

  const calculateOverallStats = () => {
    const totalPetitions = petitions.length;
    const totalSignatures = Object.values(petitionStats)
      .reduce((sum, stats) => sum + stats.current_signatures, 0);
    const averageCompliance = Object.values(petitionStats)
      .reduce((sum, stats) => sum + stats.compliance_score, 0) / totalPetitions || 0;
    
    return { totalPetitions, totalSignatures, averageCompliance };
  };

  const overallStats = calculateOverallStats();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-kenya-green"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Overall Statistics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-kenya-green/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Petitions</p>
                <p className="text-3xl font-bold text-kenya-green dark:text-green-500">{overallStats.totalPetitions}</p>
              </div>
              <FileText className="w-8 h-8 text-kenya-green dark:text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-kenya-green/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Signatures</p>
                <p className="text-3xl font-bold text-kenya-red dark:text-green-500">{overallStats.totalSignatures.toLocaleString()}</p>
              </div>
              <Users className="w-8 h-8 text-kenya-red dark:text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-kenya-black/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg. Compliance</p>
                <p className="text-3xl font-bold text-kenya-black dark:text-green-500">{Math.round(overallStats.averageCompliance)}%</p>
              </div>
              <BarChart3 className="w-8 h-8 text-kenya-black dark:text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className="text-3xl font-bold text-green-500">23%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500 dark:text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Constitutional Compliance Overview */}
      <Card className="border-2 border-kenya-green/30 bg-gradient-to-r from-kenya-green/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center text-kenya-green text-xl">
            <CheckCircle className="w-6 h-6 mr-3" />
            Constitutional Compliance Dashboard
          </CardTitle>
          <CardDescription className="text-base">
            Real-time monitoring of Article 104 requirements across all active petitions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold text-kenya-black">Signature Thresholds</h4>
              <div className="space-y-2">
                {petitions.slice(0, 3).map(petition => {
                  const stats = petitionStats[petition.id];
                  const progress = stats ? (stats.current_signatures / petition.signature_target) * 100 : 0;
                  return (
                    <div key={petition.id} className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full" style={{
                        backgroundColor: progress >= 30 ? '#006600' : progress >= 15 ? '#CCCC00' : '#CC0000'
                      }}></div>
                      <span className="text-sm flex-1">{petition.mp_name}</span>
                      <span className="text-sm font-mono">{Math.round(progress)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-kenya-black">Ward Distribution</h4>
              <div className="space-y-2">
                {petitions.slice(0, 3).map(petition => {
                  const stats = petitionStats[petition.id];
                  const wardProgress = stats ? (stats.wards_covered / petition.ward_target) * 100 : 0;
                  return (
                    <div key={petition.id} className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full" style={{
                        backgroundColor: wardProgress >= 50 ? '#006600' : wardProgress >= 25 ? '#CCCC00' : '#CC0000'
                      }}></div>
                      <span className="text-sm flex-1">{petition.constituency}</span>
                      <span className="text-sm font-mono">{stats?.wards_covered || 0}/{petition.ward_target}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-kenya-black">Legal Deadlines</h4>
              <div className="space-y-2">
                {petitions.slice(0, 3).map(petition => {
                  const daysLeft = Math.ceil((new Date(petition.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={petition.id} className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full" style={{
                        backgroundColor: daysLeft > 14 ? '#006600' : daysLeft > 7 ? '#CCCC00' : '#CC0000'
                      }}></div>
                      <span className="text-sm flex-1">{petition.mp_name}</span>
                      <span className="text-sm font-mono">{daysLeft}d</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

     {/* Petition Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 gap-1 h-auto p-1">
          <TabsTrigger 
            value="active" 
            className="text-base sm:text-sm px-2 py-2 sm:px-4 sm:py-2 whitespace-nowrap"
          >
            <span className="hidden sm:inline">Active Petitions</span>
            <span className="sm:hidden">Active</span>
          </TabsTrigger>
          <TabsTrigger 
            value="urgent" 
            className="text-base sm:text-sm px-2 py-2 sm:px-4 sm:py-2 whitespace-nowrap"
          >
            <span className="hidden sm:inline">Urgent Deadlines</span>
            <span className="sm:hidden">Urgent</span>
          </TabsTrigger>
          <TabsTrigger 
            value="successful" 
            className="text-base sm:text-sm px-2 py-2 sm:px-4 sm:py-2 whitespace-nowrap"
          >
            <span className="hidden sm:inline">Near Success</span>
            <span className="sm:hidden">Incomplete</span>
          </TabsTrigger>
          <TabsTrigger 
            value="create" 
            className="text-base sm:text-sm px-2 py-2 sm:px-4 sm:py-2 whitespace-nowrap"
          >
            <span className="hidden sm:inline">Start New Petition</span>
            <span className="sm:hidden">New</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {petitions.map(petition => (
              <PetitionCard 
                key={petition.id} 
                petition={{
                  ...petition,
                  current_signatures: petitionStats[petition.id]?.current_signatures || 0,
                  wards_covered: petitionStats[petition.id]?.wards_covered || 0
                }}
                onJoinPetition={handleJoinPetition}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="urgent" className="mt-8">
          <div className="space-y-4">
            {petitions
              .filter(p => {
                const daysLeft = Math.ceil((new Date(p.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                return daysLeft <= 7;
              })
              .map(petition => (
                <Card key={petition.id} className="border-red-200 bg-red-50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-red-800">{petition.mp_name} - {petition.constituency}</CardTitle>
                      <Badge className="bg-red-600 text-white">
                        URGENT
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-red-700 mb-4">{petition.description}</p>
                    <Button className="bg-red-600 hover:bg-red-700 text-white">
                      Sign Now - Deadline Approaching
                    </Button>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="successful" className="mt-8">
          <div className="space-y-4">
            {petitions
              .filter(p => {
                const stats = petitionStats[p.id];
                const signatureProgress = stats ? (stats.current_signatures / p.signature_target) * 100 : 0;
                return signatureProgress >= 20;
              })
              .map(petition => {
                const stats = petitionStats[petition.id];
                const progress = stats ? (stats.current_signatures / petition.signature_target) * 100 : 0;
                return (
                  <Card key={petition.id} className="border-green-200 bg-green-50">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-green-800">{petition.mp_name} - {petition.constituency}</CardTitle>
                        <Badge className="bg-green-600 text-white">
                          {Math.round(progress)}% Complete
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Progress value={progress} className="mb-4" />
                      <p className="text-green-700 mb-4">
                        This petition is making excellent progress! Help push it over the constitutional threshold.
                      </p>
                      <Button className="bg-green-600 hover:bg-green-700 text-white">
                        Join the Movement
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </TabsContent>

        <TabsContent value="create" className="mt-8">
          <Card className="border-kenya-green/30">
            <CardHeader>
              <CardTitle className="text-kenya-green">Start a New Recall Petition</CardTitle>
              <CardDescription>
                Initiate a constitutionally compliant MP recall petition with full legal documentation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-yellow-800 mb-2">Legal Requirements</h4>
                      <ul className="text-sm text-yellow-700 space-y-1">
                        <li>• Must have substantial grounds (Chapter 6, funds misuse, or electoral crime)</li>
                        <li>• Requires supporting legal documentation</li>
                        <li>• 30-day collection period with constitutional thresholds</li>
                        <li>• Geographic distribution across 50% of wards</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <Button className="w-full bg-kenya-green hover:bg-kenya-green/90 text-white py-3"
                  onClick={handleCreatePetition} // Add this handler
                >
                  <FileText className="w-5 h-5 mr-2" />
                  Begin Petition Creation Wizard
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnhancedPetitionDashboard;
