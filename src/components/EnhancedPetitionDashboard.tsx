// components/EnhancedPetitionDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, MapPin, Clock, FileText, AlertTriangle, CheckCircle, TrendingUp, BarChart3 } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import PetitionCard from './PetitionCard';
import { useToast } from "@/hooks/use-toast";
import MagicBento from "@/components/MagicBento";

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
      const { data: signatures, error } = await supabase
        .from('signatures')
        .select('petition_id, ward, verification_status');

      if (error) throw error;

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

      const wardSet = new Set();
      signatures?.forEach(sig => {
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

  const handleCreatePetition = () => {
    const event = new CustomEvent('tab-navigation', { 
      detail: { 
        tabId: 'wizard'
      } 
    });
    window.dispatchEvent(event);
  };

  const handleJoinPetition = (petitionId: string) => {
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

  // Prepare MagicBento data with theme support
  const bentoData = [
    // Square 1: Active Petitions
    {
      color: "#001a00",
      title: overallStats.totalPetitions.toString(),
      description: "Active Petitions",
      label: "Live",
      customContent: (
        <div className="h-full w-full flex flex-col items-center justify-center p-4">
          <div className="text-4xl font-bold dark:text-green-300 text-green-300">{overallStats.totalPetitions}</div>
          <div className="text-lg dark:text-green-300 text-green-300 mt-2">Active Petitions</div>
        </div>
      )
    },
    // Square 2: Total Signatures
    {
      color: "#001a00",
      title: overallStats.totalSignatures.toLocaleString(),
      description: "Total Signatures",
      label: "Support",
      customContent: (
        <div className="h-full w-full flex flex-col items-center justify-center p-4">
          <div className="text-4xl font-bold dark:text-green-300 text-green-300">{overallStats.totalSignatures.toLocaleString()}</div>
          <div className="text-lg dark:text-green-300 text-green-300 mt-2">Total Signatures</div>
        </div>
      )
    },
    // Square 3: Urgent Deadlines
    {
      color: "#001a00",
      label: "Urgent",
      title: "Deadlines",
      description: "Petitions nearing deadline",
      customContent: (
        <div className="h-full w-full flex flex-col">
          <div className="card__header p-4">
            <div className="card__label dark:text-green-300 text-green-300">Urgent</div>
            <h2 className="card__title text-xl dark:text-green-100 text-green-100 mt-2">Deadlines</h2>
            <p className="card__description dark:text-green-200 text-green-200">Petitions nearing deadline</p>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pt-0">
            <div className="mt-4 space-y-4">
              {petitions
                .filter(p => {
                  const daysLeft = Math.ceil((new Date(p.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  return daysLeft <= 7;
                })
                .slice(0, 3) // Show up to 3 petitions
                .map(petition => {
                  const daysLeft = Math.ceil((new Date(petition.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={petition.id} className="flex items-center p-3 dark:bg-green-900/30 bg-gray-100 rounded-lg">
                      <div className="flex-1">
                        <div className="text-base font-bold dark:text-green-100 text-green-100">{petition.mp_name}</div>
                        <div className="text-sm dark:text-green-200 text-green-200">{daysLeft} days left</div>
                      </div>
                      <Button 
                        className="text-sm px-4 py-2 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleJoinPetition(petition.id)}
                      >
                        Sign Now
                      </Button>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )
    },
    // Square 4: Dashboard (swapped to this position - larger square)
    {
      color: "#001a00",
      label: "Dashboard",
      title: "Constitutional Compliance",
      description: "Real-time monitoring",
      customContent: (
        <div className="h-full w-full flex flex-col">
          <div className="card__header p-4">
            <div className="card__label dark:text-green-300 text-green-300">Dashboard</div>
            <h2 className="card__title text-xl dark:text-green-100 text-green-100 mt-2">Constitutional Compliance</h2>
            <p className="card__description dark:text-green-200 text-green-200">Real-time monitoring</p>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pt-0">
            <div className="grid grid-cols-1 gap-4">
              {petitions.slice(0, 3).map(petition => { // Show up to 3 petitions
                const stats = petitionStats[petition.id];
                const signatureProgress = stats ? (stats.current_signatures / petition.signature_target) * 100 : 0;
                const wardProgress = stats ? (stats.wards_covered / petition.ward_target) * 100 : 0;
                const daysLeft = Math.ceil((new Date(petition.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                
                return (
                  <div key={petition.id} className="space-y-4 p-4 dark:bg-green-900/20 bg-green-900/20 rounded-xl">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-base dark:text-green-100 text-green-100">{petition.mp_name}</h3>
                      <Badge variant="outline" className="dark:border-green-500 border-green-500 dark:text-green-300 text-green-300">
                        {petition.constituency}
                      </Badge>
                    </div>
                    
                    {/* Signature Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm dark:text-green-200 text-green-200">Signatures</span>
                        <span className="text-sm font-bold dark:text-green-100 text-green-100">
                          {Math.round(signatureProgress)}%
                        </span>
                      </div>
                      <div className="relative pt-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-semibold inline-block dark:text-green-200 text-green-200">
                              {stats?.current_signatures || 0} / {petition.signature_target}
                            </span>
                          </div>
                        </div>
                        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-green-800 dark:bg-white">
                          <div 
                            style={{ width: `${signatureProgress}%` }}
                            className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500"
                          ></div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Ward Distribution */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm dark:text-green-200 text-green-200">Ward Coverage</span>
                        <span className="text-sm font-bold dark:text-green-100 text-gray-800">
                          {stats?.wards_covered || 0}/{petition.ward_target}
                        </span>
                      </div>
                      <div className="relative pt-1">
                        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200 dark:bg-green-800">
                          <div 
                            style={{ width: `${wardProgress}%` }}
                            className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500"
                          ></div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Deadline */}
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 dark:text-green-300 text-green-300" />
                      <span className="text-sm dark:text-green-200 text-green-200">
                        {daysLeft} days remaining
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )
    },
    // Square 5: Success Rate (swapped to this position)
    {
      color: "#001a00",
      title: "0%",
      description: "Success Rate",
      label: "Achievement",
      customContent: (
        <div className="h-full w-full flex flex-col items-center justify-center p-4">
          <div className="text-4xl font-bold dark:text-green-300 text-green-300">0%</div>
          <div className="text-lg dark:text-green-300 text-green-300 mt-2">Success Rate</div>
        </div>
      )
    },
    // Square 6: Avg. Compliance
    {
      color: "#001a00",
      title: `${Math.round(overallStats.averageCompliance)}%`,
      description: "Avg. Compliance",
      label: "Progress",
      customContent: (
        <div className="h-full w-full flex flex-col items-center justify-center p-4">
          <div className="text-4xl font-bold dark:text-green-300 text-green-300">{Math.round(overallStats.averageCompliance)}%</div>
          <div className="text-lg dark:text-green-200 text-green-200 mt-2">Avg. Compliance</div>
        </div>
      )
    }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 px-4">
      <style jsx>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #4ade80 transparent;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #4ade80;
          border-radius: 3px;
        }
      `}</style>
      
      {/* MagicBento Dashboard */}
      <MagicBento 
        cardData={bentoData}
        textAutoHide={true}
        enableStars={true}
        enableSpotlight={true}
        enableBorderGlow={true}
        enableTilt={true}
        enableMagnetism={true}
        clickEffect={true}
        spotlightRadius={300}
        particleCount={12}
        glowColor="0, 100, 0" // Darker green glow
        borderColor="#003300" // Very dark green border
        borderWidth={2}
        className="border-[#003300] dark:border-[#002200]" // Added border styling
      />

      {/* Petition Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-12">
        <TabsList className="grid w-full grid-cols-4 gap-2 h-auto p-1 bg-green-900/20 rounded-xl">
          <TabsTrigger 
            value="active" 
            className="text-base px-4 py-3 data-[state=active]:bg-green-600 data-[state=active]:text-white rounded-lg"
          >
            <span className="hidden sm:inline text-green-900/80">Active Petitions</span>
            <span className="sm:hidden">Active</span>
          </TabsTrigger>
          <TabsTrigger 
            value="urgent" 
            className="text-base px-4 py-3 data-[state=active]:bg-green-600 data-[state=active]:text-white rounded-lg"
          >
            <span className="hidden sm:inline">Urgent Deadlines</span>
            <span className="sm:hidden">Urgent</span>
          </TabsTrigger>
          <TabsTrigger 
            value="successful" 
            className="text-base px-4 py-3 data-[state=active]:bg-green-600 data-[state=active]:text-white rounded-lg"
          >
            <span className="hidden sm:inline">Near Success</span>
            <span className="sm:hidden">Incomplete</span>
          </TabsTrigger>
          <TabsTrigger 
            value="create" 
            className="text-base px-4 py-3 data-[state=active]:bg-green-600 data-[state=active]:text-white rounded-lg"
          >
            <span className="hidden sm:inline">Start New</span>
            <span className="sm:hidden">New</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
          <div className="space-y-6">
            {petitions
              .filter(p => {
                const daysLeft = Math.ceil((new Date(p.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                return daysLeft <= 7;
              })
              .map(petition => (
                <div key={petition.id} className="border-2 border-green-500/30 rounded-xl p-6 bg-green-900/10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-green-200">{petition.mp_name} - {petition.constituency}</h3>
                    <Badge className="bg-red-600 text-white px-3 py-1 text-sm">
                      URGENT • {Math.ceil((new Date(petition.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} DAYS LEFT
                    </Badge>
                  </div>
                  <p className="text-green-300 mb-6 text-lg">{petition.description}</p>
                  <div className="flex justify-center">
                    <Button className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 text-base">
                      Sign Now - Deadline Approaching
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="successful" className="mt-8">
          <div className="space-y-6">
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
                  <div key={petition.id} className="border-2 border-green-500/30 rounded-xl p-6 bg-green-900/10">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-green-200">{petition.mp_name} - {petition.constituency}</h3>
                      <Badge className="bg-green-600 text-white px-3 py-1 text-sm">
                        {Math.round(progress)}% COMPLETE
                      </Badge>
                    </div>
                    <div className="mb-6">
                      <div className="flex justify-between text-green-300 mb-1">
                        <span>Progress</span>
                        <span>{stats?.current_signatures || 0}/{petition.signature_target} signatures</span>
                      </div>
                      <Progress value={progress} className="h-3 bg-green-800" indicatorClassName="bg-green-500" />
                    </div>
                    <p className="text-green-300 mb-6 text-lg">
                      This petition is making excellent progress! Help push it over the constitutional threshold.
                    </p>
                    <div className="flex justify-center">
                      <Button className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 text-base">
                        Join the Movement
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        </TabsContent>

        <TabsContent value="create" className="mt-8">
          <div className="border-2 border-green-500/30 rounded-xl p-8 bg-green-900/10">
            <h2 className="text-2xl font-bold text-green-200 flex items-center mb-6 justify-center">
              <CheckCircle className="w-6 h-6 mr-3 text-green-400" />
              Start a New Recall Petition
            </h2>
            <p className="text-green-300 mb-8 text-lg text-center">
              Initiate a constitutionally compliant MP recall petition with full legal documentation
            </p>
            
            <div className="space-y-8 max-w-3xl mx-auto">
              <div className="border border-green-500/50 rounded-xl p-6 bg-green-900/20">
                <div className="flex items-start">
                  <AlertTriangle className="w-6 h-6 text-green-400 mr-4 mt-1" />
                  <div>
                    <h4 className="font-bold text-green-200 mb-3 text-lg">Legal Requirements</h4>
                    <ul className="text-green-300 space-y-2 text-base">
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        Must have substantial grounds (Chapter 6, funds misuse, or electoral crime)
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        Requires supporting legal documentation
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        30-day collection period with constitutional thresholds
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        Geographic distribution across 50% of wards
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <Button className="w-full max-w-md bg-green-600 hover:bg-green-700 text-white py-4 text-lg"
                  onClick={handleCreatePetition}
                >
                  <FileText className="w-5 h-5 mr-2" />
                  Begin Petition Creation Wizard
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnhancedPetitionDashboard;
