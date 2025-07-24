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

  // Prepare MagicBento data with green theme
  const bentoData = [
    {
      color: "#001a00", // Dark green
      title: overallStats.totalPetitions.toString(),
      description: "Active Petitions",
      label: "Live",
    },
    {
      color: "#001a00",
      title: overallStats.totalSignatures.toLocaleString(),
      description: "Total Signatures",
      label: "Support",
    },
    {
      color: "#001a00",
      title: `${Math.round(overallStats.averageCompliance)}%`,
      description: "Avg. Compliance",
      label: "Progress",
    },
    {
      color: "#001a00",
      title: "0%",
      description: "Success Rate",
      label: "Achievement",
    },
    {
      color: "#001a00",
      label: "Dashboard",
      title: "Constitutional Compliance",
      description: "Real-time monitoring",
      customContent: (
        <div className="h-full w-full flex flex-col">
          <div className="card__header">
            <div className="card__label">Dashboard</div>
          </div>
          <div className="card__content flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 p-2">
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-green-100">Signature Thresholds</h4>
              <div className="space-y-2">
                {petitions.slice(0, 2).map(petition => {
                  const stats = petitionStats[petition.id];
                  const progress = stats ? (stats.current_signatures / petition.signature_target) * 100 : 0;
                  return (
                    <div key={petition.id} className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full" style={{
                        backgroundColor: progress >= 30 ? '#00cc00' : progress >= 15 ? '#66cc00' : '#cc9900'
                      }}></div>
                      <span className="text-xs flex-1 text-green-100">{petition.mp_name}</span>
                      <span className="text-xs font-mono text-green-100">{Math.round(progress)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-green-100">Ward Distribution</h4>
              <div className="space-y-2">
                {petitions.slice(0, 2).map(petition => {
                  const stats = petitionStats[petition.id];
                  const wardProgress = stats ? (stats.wards_covered / petition.ward_target) * 100 : 0;
                  return (
                    <div key={petition.id} className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full" style={{
                        backgroundColor: wardProgress >= 50 ? '#00cc00' : wardProgress >= 25 ? '#66cc00' : '#cc9900'
                      }}></div>
                      <span className="text-xs flex-1 text-green-100">{petition.constituency}</span>
                      <span className="text-xs font-mono text-green-100">{stats?.wards_covered || 0}/{petition.ward_target}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-green-100">Legal Deadlines</h4>
              <div className="space-y-2">
                {petitions.slice(0, 2).map(petition => {
                  const daysLeft = Math.ceil((new Date(petition.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={petition.id} className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full" style={{
                        backgroundColor: daysLeft > 14 ? '#00cc00' : daysLeft > 7 ? '#66cc00' : '#cc9900'
                      }}></div>
                      <span className="text-xs flex-1 text-green-100">{petition.mp_name}</span>
                      <span className="text-xs font-mono text-green-100">{daysLeft}d</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      color: "#001a00",
      label: "Urgent",
      title: "Deadlines",
      description: "Petitions nearing deadline",
      customContent: (
        <div className="h-full w-full flex flex-col">
          <div className="card__header">
            <div className="card__label">Urgent</div>
          </div>
          <div className="card__content flex-1">
            <h2 className="card__title text-green-100">Deadlines</h2>
            <p className="card__description text-green-200">Petitions nearing deadline</p>
            <div className="mt-4 space-y-3">
              {petitions
                .filter(p => {
                  const daysLeft = Math.ceil((new Date(p.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  return daysLeft <= 7;
                })
                .slice(0, 2)
                .map(petition => {
                  const daysLeft = Math.ceil((new Date(petition.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={petition.id} className="flex items-center">
                      <div className="flex-1">
                        <div className="text-xs font-bold text-green-100">{petition.mp_name}</div>
                        <div className="text-xs text-green-200">{daysLeft} days left</div>
                      </div>
                      <Button 
                        className="text-xs p-1 bg-green-600 hover:bg-green-700 text-white"
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
    <div className="max-w-7xl mx-auto space-y-8">
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
        glowColor="0, 204, 0" // Green glow
      />

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
                <div key={petition.id} className="border-2 border-green-500/30 rounded-lg p-4 bg-green-900/10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-green-200">{petition.mp_name} - {petition.constituency}</h3>
                    <Badge className="bg-green-600 text-white">
                      URGENT
                    </Badge>
                  </div>
                  <p className="text-green-300 mb-4">{petition.description}</p>
                  <Button className="bg-green-600 hover:bg-green-700 text-white">
                    Sign Now - Deadline Approaching
                  </Button>
                </div>
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
                  <div key={petition.id} className="border-2 border-green-500/30 rounded-lg p-4 bg-green-900/10">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-green-200">{petition.mp_name} - {petition.constituency}</h3>
                      <Badge className="bg-green-600 text-white">
                        {Math.round(progress)}% Complete
                      </Badge>
                    </div>
                    <Progress value={progress} className="mb-4 bg-green-800" indicatorClassName="bg-green-500" />
                    <p className="text-green-300 mb-4">
                      This petition is making excellent progress! Help push it over the constitutional threshold.
                    </p>
                    <Button className="bg-green-600 hover:bg-green-700 text-white">
                      Join the Movement
                    </Button>
                  </div>
                );
              })}
          </div>
        </TabsContent>

        <TabsContent value="create" className="mt-8">
          <div className="border-2 border-green-500/30 rounded-lg p-6 bg-green-900/10">
            <h2 className="text-2xl font-bold text-green-200 flex items-center mb-4">
              <CheckCircle className="w-6 h-6 mr-3 text-green-400" />
              Start a New Recall Petition
            </h2>
            <p className="text-green-300 mb-6">
              Initiate a constitutionally compliant MP recall petition with full legal documentation
            </p>
            
            <div className="space-y-6">
              <div className="border border-green-500/50 rounded-lg p-4 bg-green-900/20">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-green-400 mr-3 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-green-200 mb-2">Legal Requirements</h4>
                    <ul className="text-green-300 space-y-1">
                      <li>• Must have substantial grounds (Chapter 6, funds misuse, or electoral crime)</li>
                      <li>• Requires supporting legal documentation</li>
                      <li>• 30-day collection period with constitutional thresholds</li>
                      <li>• Geographic distribution across 50% of wards</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Button className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                onClick={handleCreatePetition}
              >
                <FileText className="w-5 h-5 mr-2" />
                Begin Petition Creation Wizard
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnhancedPetitionDashboard;
