
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Building2, X, Search, AlertCircle, CheckCircle, FileText, Clock, Database, Zap, ArrowRight, Star } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

interface LocationData {
  id: number;
  name: string;
  type: 'county' | 'constituency' | 'ward';
  member_of_parliament?: string;
  registration_target?: number;
  total_voters?: number;
  governor?: string;
  senator?: string;
  county?: string;
  constituency?: string;
}

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

interface SearchStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  icon: React.ReactNode;
  duration?: number;
}

interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  description: string;
  duration: number;
  progress: number;
}

interface LocationDetailViewerProps {
  location: LocationData | null;
  isOpen: boolean;
  onClose: () => void;
}

const LocationDetailViewer: React.FC<LocationDetailViewerProps> = ({
  location,
  isOpen,
  onClose
}) => {
  const [searchSteps, setSearchSteps] = useState<SearchStep[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Petition[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (toast: {
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    description: string;
    duration?: number;
  }) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = {
      ...toast,
      id,
      duration: toast.duration || 3000,
      progress: 100
    };
    
    setToasts(prev => [...prev, newToast]);
    
    // Animate progress bar
    const interval = setInterval(() => {
      setToasts(prev => prev.map(t => 
        t.id === id ? { ...t, progress: Math.max(0, t.progress - 2) } : t
      ));
    }, newToast.duration / 50);
    
    // Remove toast after duration
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      clearInterval(interval);
    }, newToast.duration);
  };

  const updateSearchStep = (stepId: string, status: SearchStep['status'], duration?: number) => {
    setSearchSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, duration } : step
    ));
  };

  const initializeSearchSteps = (): SearchStep[] => [
    {
      id: 'connect',
      title: 'Database Connection',
      description: 'Establishing secure connection to petitions database',
      status: 'pending',
      icon: <Database className="w-4 h-4" />
    },
    {
      id: 'exact-match',
      title: 'Exact MP Match',
      description: `Searching for exact match: "${location?.member_of_parliament}"`,
      status: 'pending',
      icon: <Search className="w-4 h-4" />
    },
    {
      id: 'constituency-match',
      title: 'Constituency Search',
      description: `Searching constituency: "${location?.constituency || location?.name}"`,
      status: 'pending',
      icon: <Building2 className="w-4 h-4" />
    },
    {
      id: 'county-match',
      title: 'County Search',
      description: `Searching county: "${location?.county}"`,
      status: 'pending',
      icon: <MapPin className="w-4 h-4" />
    },
    {
      id: 'partial-match',
      title: 'Partial Match Analysis',
      description: 'Analyzing potential matches with similarity scoring',
      status: 'pending',
      icon: <Zap className="w-4 h-4" />
    },
    {
      id: 'results',
      title: 'Results Processing',
      description: 'Compiling and ranking search results',
      status: 'pending',
      icon: <CheckCircle className="w-4 h-4" />
    }
  ];

  const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const calculateSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    const editDistance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
    return (longer.length - editDistance) / longer.length;
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  };

  const searchPetitions = async () => {
    if (!location?.member_of_parliament && !location?.constituency && !location?.county) {
      addToast({
        type: 'warning',
        title: 'Insufficient Information',
        description: 'Cannot search for petitions without MP, constituency, or county information',
        duration: 4000
      });
      return;
    }

    setIsSearching(true);
    setSearchResults([]);
    setShowResults(false);
    
    const steps = initializeSearchSteps();
    setSearchSteps(steps);

    addToast({
      type: 'info',
      title: 'Petition Search Initiated',
      description: 'Analyzing location data and searching for related petitions...',
      duration: 2500
    });

    try {
      // Step 1: Database Connection
      updateSearchStep('connect', 'active');
      await simulateDelay(800);
      updateSearchStep('connect', 'completed', 800);
      
      let allResults: Petition[] = [];
      let exactMatches: Petition[] = [];
      let constituencyMatches: Petition[] = [];
      let countyMatches: Petition[] = [];
      let partialMatches: Petition[] = [];

      // Step 2: Exact MP Name Match
      if (location.member_of_parliament) {
        updateSearchStep('exact-match', 'active');
        await simulateDelay(1200);
        
        try {
          const { data: exactMPMatches, error } = await supabase
            .from('petitions')
            .select('*')
            .eq('status', 'active')
            .ilike('mp_name', `%${location.member_of_parliament}%`);
          
          if (error) throw error;
          
          if (exactMPMatches && exactMPMatches.length > 0) {
            exactMatches = exactMPMatches;
            allResults = [...allResults, ...exactMatches];
            updateSearchStep('exact-match', 'completed', 1200);
            
            addToast({
              type: 'success',
              title: 'Exact MP Match Found!',
              description: `Found ${exactMatches.length} petition(s) for ${location.member_of_parliament}`,
              duration: 3500
            });
          } else {
            updateSearchStep('exact-match', 'failed', 1200);
            
            addToast({
              type: 'info',
              title: 'No Exact MP Match',
              description: 'Proceeding to search by constituency and county...',
              duration: 2500
            });
          }
        } catch (error) {
          console.error('Exact match search error:', error);
          updateSearchStep('exact-match', 'failed', 1200);
        }
      } else {
        updateSearchStep('exact-match', 'completed', 0);
      }

      // Step 3: Constituency Match
      if (location.constituency || location.name) {
        updateSearchStep('constituency-match', 'active');
        await simulateDelay(1000);
        
        try {
          const constituencyName = location.constituency || location.name;
          const { data: constituencyData, error } = await supabase
            .from('petitions')
            .select('*')
            .eq('status', 'active')
            .ilike('constituency', `%${constituencyName}%`);
          
          if (error) throw error;
          
          if (constituencyData && constituencyData.length > 0) {
            // Filter out already found exact matches
            constituencyMatches = constituencyData.filter(petition => 
              !exactMatches.some(exact => exact.id === petition.id)
            );
            
            if (constituencyMatches.length > 0) {
              allResults = [...allResults, ...constituencyMatches];
              updateSearchStep('constituency-match', 'completed', 1000);
              
              addToast({
                type: 'success',
                title: 'Constituency Match Found!',
                description: `Found ${constituencyMatches.length} additional petition(s) in ${constituencyName}`,
                duration: 3200
              });
            } else {
              updateSearchStep('constituency-match', 'completed', 1000);
            }
          } else {
            updateSearchStep('constituency-match', 'failed', 1000);
          }
        } catch (error) {
          console.error('Constituency search error:', error);
          updateSearchStep('constituency-match', 'failed', 1000);
        }
      } else {
        updateSearchStep('constituency-match', 'completed', 0);
      }

      // Step 4: County Match
      if (location.county) {
        updateSearchStep('county-match', 'active');
        await simulateDelay(900);
        
        try {
          const { data: countyData, error } = await supabase
            .from('petitions')
            .select('*')
            .eq('status', 'active')
            .ilike('county', `%${location.county}%`);
          
          if (error) throw error;
          
          if (countyData && countyData.length > 0) {
            // Filter out already found matches
            countyMatches = countyData.filter(petition => 
              !allResults.some(existing => existing.id === petition.id)
            );
            
            if (countyMatches.length > 0) {
              allResults = [...allResults, ...countyMatches];
              updateSearchStep('county-match', 'completed', 900);
              
              addToast({
                type: 'success',
                title: 'County Match Found!',
                description: `Found ${countyMatches.length} additional petition(s) in ${location.county}`,
                duration: 3000
              });
            } else {
              updateSearchStep('county-match', 'completed', 900);
            }
          } else {
            updateSearchStep('county-match', 'failed', 900);
          }
        } catch (error) {
          console.error('County search error:', error);
          updateSearchStep('county-match', 'failed', 900);
        }
      } else {
        updateSearchStep('county-match', 'completed', 0);
      }

      // Step 5: Partial Match Analysis
      updateSearchStep('partial-match', 'active');
      await simulateDelay(1400);
      
      if (allResults.length === 0 && location.member_of_parliament) {
        try {
          // Search for partial matches using similarity scoring
          const { data: allPetitions, error } = await supabase
            .from('petitions')
            .select('*')
            .eq('status', 'active')
            .limit(50);
          
          if (error) throw error;
          
          if (allPetitions) {
            const potentialMatches = allPetitions
              .map(petition => ({
                ...petition,
                similarity: Math.max(
                  calculateSimilarity(petition.mp_name, location.member_of_parliament || ''),
                  calculateSimilarity(petition.constituency, location.constituency || ''),
                  calculateSimilarity(petition.county, location.county || '')
                )
              }))
              .filter(petition => petition.similarity > 0.4) // 40% similarity threshold
              .sort((a, b) => b.similarity - a.similarity)
              .slice(0, 3); // Limit to top 3 matches
            
            if (potentialMatches.length > 0) {
              partialMatches = potentialMatches;
              allResults = [...allResults, ...partialMatches];
              updateSearchStep('partial-match', 'completed', 1400);
              
              addToast({
                type: 'info',
                title: 'Potential Matches Found',
                description: `Found ${partialMatches.length} potential match(es) with similarity analysis`,
                duration: 4500
              });
            } else {
              updateSearchStep('partial-match', 'failed', 1400);
            }
          }
        } catch (error) {
          console.error('Partial match search error:', error);
          updateSearchStep('partial-match', 'failed', 1400);
        }
      } else {
        updateSearchStep('partial-match', 'completed', 0);
      }

      // Step 6: Results Processing
      updateSearchStep('results', 'active');
      await simulateDelay(700);
      
      // Remove duplicates and sort by relevance
      const uniqueResults = allResults.filter((petition, index, self) => 
        index === self.findIndex(p => p.id === petition.id)
      );
      
      // Sort results: exact matches first, then constituency, then county, then partial
      const sortedResults = uniqueResults.sort((a, b) => {
        const aExact = exactMatches.some(exact => exact.id === a.id);
        const bExact = exactMatches.some(exact => exact.id === b.id);
        const aConstituency = constituencyMatches.some(constituency => constituency.id === a.id);
        const bConstituency = constituencyMatches.some(constituency => constituency.id === b.id);
        
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        if (aConstituency && !bConstituency) return -1;
        if (!aConstituency && bConstituency) return 1;
        
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      
      setSearchResults(sortedResults);
      updateSearchStep('results', 'completed', 700);

      // Final notification
      if (sortedResults.length > 0) {
        const exactCount = exactMatches.length;
        const constituencyCount = constituencyMatches.length;
        const countyCount = countyMatches.length;
        const partialCount = partialMatches.length;
        
        let resultBreakdown = '';
        if (exactCount > 0) resultBreakdown += `${exactCount} exact MP match(es)`;
        if (constituencyCount > 0) resultBreakdown += `${resultBreakdown ? ', ' : ''}${constituencyCount} constituency match(es)`;
        if (countyCount > 0) resultBreakdown += `${resultBreakdown ? ', ' : ''}${countyCount} county match(es)`;
        if (partialCount > 0) resultBreakdown += `${resultBreakdown ? ', ' : ''}${partialCount} potential match(es)`;
        
        addToast({
          type: 'success',
          title: 'Search Complete!',
          description: `Found ${sortedResults.length} petition(s): ${resultBreakdown}`,
          duration: 6000
        });
        setShowResults(true);
      } else {
        addToast({
          type: 'warning',
          title: 'No Active Petitions Found',
          description: 'No active petitions found for this location. Consider starting a new petition to hold your representatives accountable!',
          duration: 7000
        });
      }

    } catch (error) {
      console.error('Search error:', error);
      addToast({
        type: 'error',
        title: 'Search Failed',
        description: 'An unexpected error occurred while searching. Please try again or contact support.',
        duration: 5000
      });
    } finally {
      setIsSearching(false);
      setTimeout(() => setSearchSteps([]), 4000); // Clear steps after 4 seconds
    }
  };

  const handlePetitionSelect = (petition: Petition) => {
    addToast({
      type: 'success',
      title: 'Navigating to Petition',
      description: `Opening detailed view for petition against ${petition.mp_name}`,
      duration: 3000
    });
    
    // Simulate navigation with smooth transition
    setTimeout(() => {
      // In a real app, this would be: router.push(`/petition/${petition.id}`)
      window.location.href = `/sign/${petition.id}`;
    }, 1200);
  };

  const getPetitionMatchType = (petition: Petition) => {
    if (location?.member_of_parliament && petition.mp_name.toLowerCase().includes(location.member_of_parliament.toLowerCase())) {
      return { type: 'Exact MP Match', color: 'bg-green-100 text-green-800 border-green-300' };
    }
    if ((location?.constituency || location?.name) && petition.constituency.toLowerCase().includes((location.constituency || location.name || '').toLowerCase())) {
      return { type: 'Constituency Match', color: 'bg-blue-100 text-blue-800 border-blue-300' };
    }
    if (location?.county && petition.county.toLowerCase().includes(location.county.toLowerCase())) {
      return { type: 'County Match', color: 'bg-purple-100 text-purple-800 border-purple-300' };
    }
    return { type: 'Potential Match', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
  };

  if (!isOpen || !location) return null;

  const getLocationIcon = () => {
    switch (location.type) {
      case 'county':
        return <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />;
      case 'constituency':
        return <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />;
      case 'ward':
        return <Users className="w-4 h-4 sm:w-5 sm:h-5" />;
      default:
        return <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />;
    }
  };

  const getLocationTypeColor = () => {
    switch (location.type) {
      case 'county':
        return 'bg-blue-500 text-white';
      case 'constituency':
        return 'bg-green-500 text-white';
      case 'ward':
        return 'bg-purple-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  return (
    <>
      {/* Toast Notifications with mobile optimization */}
      <div className="fixed top-2 sm:top-4 right-2 sm:right-4 z-[60] space-y-2 max-w-[calc(100vw-1rem)] sm:max-w-md">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`
              transform transition-all duration-500 ease-out
              ${toast.progress > 0 ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-full opacity-0 scale-95'}
              rounded-xl shadow-2xl border-2 backdrop-blur-sm text-xs sm:text-sm
              ${toast.type === 'success' ? 'bg-green-50/95 border-green-300 shadow-green-200/50' : ''}
              ${toast.type === 'error' ? 'bg-red-50/95 border-red-300 shadow-red-200/50' : ''}
              ${toast.type === 'warning' ? 'bg-yellow-50/95 border-yellow-300 shadow-yellow-200/50' : ''}
              ${toast.type === 'info' ? 'bg-blue-50/95 border-blue-300 shadow-blue-200/50' : ''}
            `}
          >
            <div className="p-3 sm:p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-green-600" />}
                  {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-600" />}
                  {toast.type === 'warning' && <AlertCircle className="w-4 h-4 text-yellow-600" />}
                  {toast.type === 'info' && <Search className="w-4 h-4 text-blue-600" />}
                </div>
                <div className="ml-2 sm:ml-3 flex-1 min-w-0">
                  <h4 className={`font-bold truncate ${
                    toast.type === 'success' ? 'text-green-900' : 
                    toast.type === 'error' ? 'text-red-900' : 
                    toast.type === 'warning' ? 'text-yellow-900' : 'text-blue-900'
                  }`}>
                    {toast.title}
                  </h4>
                  <p className={`mt-1 leading-relaxed ${
                    toast.type === 'success' ? 'text-green-800' : 
                    toast.type === 'error' ? 'text-red-800' : 
                    toast.type === 'warning' ? 'text-yellow-800' : 'text-blue-800'
                  }`}>
                    {toast.description}
                  </p>
                </div>
              </div>
              <div className="mt-2 sm:mt-3 bg-gray-200 rounded-full h-1 sm:h-1.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-150 ease-linear ${
                    toast.type === 'success' ? 'bg-gradient-to-r from-green-400 to-green-600' : 
                    toast.type === 'error' ? 'bg-gradient-to-r from-red-400 to-red-600' : 
                    toast.type === 'warning' ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' : 'bg-gradient-to-r from-blue-400 to-blue-600'
                  }`}
                  style={{ width: `${toast.progress}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search Progress Steps with mobile optimization */}
      {searchSteps.length > 0 && (
        <div className="fixed bottom-2 sm:bottom-4 left-2 sm:left-4 z-[60] w-[calc(100vw-1rem)] sm:w-96 max-w-md">
          <Card className="shadow-2xl border-2 border-blue-300 bg-gradient-to-br from-blue-50/95 to-indigo-50/95 backdrop-blur-sm">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-blue-900 text-xs sm:text-sm flex items-center">
                <Search className="w-3 h-3 sm:w-4 sm:h-4 mr-2 animate-pulse" />
                Petition Search Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3 max-h-64 overflow-y-auto green-scrollbar">
              {searchSteps.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 rounded-lg transition-all duration-500 transform ${
                    step.status === 'active' ? 'bg-blue-100 border-2 border-blue-400 scale-105 shadow-lg' : 
                    step.status === 'completed' ? 'bg-green-100 border-2 border-green-400 shadow-md' : 
                    step.status === 'failed' ? 'bg-red-100 border-2 border-red-400 shadow-md' : 
                    'bg-gray-50 border border-gray-300'
                  } ${index === 0 ? 'animate-fade-in' : ''}`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className={`flex-shrink-0 transition-transform duration-300 ${
                    step.status === 'active' ? 'animate-spin scale-110' : 
                    step.status === 'completed' ? 'animate-bounce' : ''
                  }`}>
                    {step.status === 'completed' ? (
                      <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-700" />
                    ) : step.status === 'failed' ? (
                      <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-700" />
                    ) : (
                      <div className={`${
                        step.status === 'active' ? 'text-blue-700' : 'text-gray-500'
                      }`}>
                        {step.icon}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs sm:text-sm font-semibold truncate ${
                      step.status === 'completed' ? 'text-green-900' : 
                      step.status === 'failed' ? 'text-red-900' : 
                      step.status === 'active' ? 'text-blue-900' : 'text-gray-700'
                    }`}>
                      {step.title}
                    </p>
                    <p className={`text-xs truncate leading-relaxed ${
                      step.status === 'completed' ? 'text-green-700' : 
                      step.status === 'failed' ? 'text-red-700' : 
                      step.status === 'active' ? 'text-blue-700' : 'text-gray-600'
                    }`}>
                      {step.description}
                    </p>
                  </div>
                  {step.duration && step.status === 'completed' && (
                    <div className="text-xs text-gray-600 font-medium bg-white px-1 sm:px-2 py-1 rounded hidden sm:block">
                      {step.duration}ms
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search Results Modal with mobile optimization */}
      {showResults && searchResults.length > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-[55] animate-fade-in">
          <Card className="w-full max-w-[calc(100vw-1rem)] sm:max-w-5xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto bg-white shadow-2xl border-2 border-green-300 animate-scale-in">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b-2 border-green-200 p-3 sm:p-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-green-900 flex items-center text-sm sm:text-xl">
                  <FileText className="w-4 h-4 sm:w-6 sm:h-6 mr-2" />
                  <span className="truncate">Found {searchResults.length} Active Petition{searchResults.length > 1 ? 's' : ''}</span>
                  <Badge className="ml-2 sm:ml-3 bg-green-100 text-green-800 border-green-300 text-xs">
                    Ready to Sign
                  </Badge>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowResults(false)}
                  className="text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full p-1 sm:p-2"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6 max-h-[calc(90vh-8rem)] sm:max-h-[calc(85vh-8rem)] overflow-y-auto green-scrollbar">
              {searchResults.map((petition, index) => {
                const matchType = getPetitionMatchType(petition);
                return (
                  <div
                    key={petition.id}
                    className="group border-2 rounded-xl p-3 sm:p-5 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-green-300 transform hover:scale-[1.02]"
                    onClick={() => handlePetitionSelect(petition)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between space-y-3 sm:space-y-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 mb-2">
                          <h4 className="font-bold text-sm sm:text-lg text-gray-900 group-hover:text-green-900 transition-colors truncate">
                            {petition.mp_name}
                          </h4>
                          <div className="flex flex-wrap gap-1 sm:gap-2">
                            <Badge className={`${matchType.color} font-medium text-xs`}>
                              {matchType.type}
                            </Badge>
                            {index === 0 && (
                              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 flex items-center text-xs">
                                <Star className="w-2 h-2 sm:w-3 sm:h-3 mr-1" />
                                Top Match
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-gray-700 font-medium mb-1 text-sm sm:text-base">
                          {petition.constituency}, {petition.county}
                        </p>
                        <p className="text-gray-800 leading-relaxed mb-3 text-xs sm:text-sm">
                          {petition.description}
                        </p>
                        <div className="flex flex-wrap gap-1 sm:gap-2 mb-3">
                          {petition.grounds.map((ground, groundIndex) => (
                            <Badge key={groundIndex} variant="outline" className="text-xs bg-gray-50 hover:bg-gray-100 transition-colors">
                              {ground}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-1 sm:space-y-0 text-xs sm:text-sm text-gray-600">
                          <div className="flex items-center">
                            <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                            Target: {petition.signature_target?.toLocaleString() || 'N/A'} signatures
                          </div>
                          <div className="flex items-center">
                            <Building2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                            {petition.ward_target} wards required
                          </div>
                        </div>
                      </div>
                      <div className="text-left sm:text-right text-xs sm:text-sm text-gray-600 sm:ml-6 flex-shrink-0">
                        <div className="flex items-center mb-2">
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                          Deadline: {new Date(petition.deadline).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500 mb-3">
                          Created: {new Date(petition.created_at).toLocaleDateString()}
                        </div>
                        <div className="group-hover:bg-green-600 group-hover:text-white bg-green-100 text-green-800 px-2 sm:px-3 py-2 rounded-lg transition-all duration-300 flex items-center justify-center">
                          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 mr-1 group-hover:translate-x-1 transition-transform" />
                          Sign Now
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <p className="text-xs sm:text-sm text-blue-800 leading-relaxed">
                  <strong>How it works:</strong> Click on any petition above to view details and add your signature. 
                  Each petition requires signatures from multiple wards to meet legal requirements for recall proceedings.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Location Detail Modal with mobile optimization */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 animate-fade-in">
        <Card className="w-full max-w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 shadow-2xl animate-scale-in">
          <CardHeader className="border-b border-gray-200 dark:border-gray-700 p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                <div className={`p-1.5 sm:p-2 rounded-full ${getLocationTypeColor()}`}>
                  {getLocationIcon()}
                </div>
                <div className="min-w-0 flex-1">
                  <Badge variant="outline" className="mb-1 sm:mb-2 text-xs">
                    {location.type.charAt(0).toUpperCase() + location.type.slice(1)}
                  </Badge>
                  <CardTitle className="text-base sm:text-xl text-gray-900 dark:text-white truncate">
                    {location.name}
                  </CardTitle>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex-shrink-0"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-3 sm:p-6 space-y-4 sm:space-y-6">
            <div classname="flex justify-center">
            {/* Location Hierarchy */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 justify-items-center">
              {location.county && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 sm:p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1 text-sm sm:text-base">County</h4>
                  <p className="text-blue-700 dark:text-blue-300 text-sm sm:text-base truncate">{location.county}</p>
                </div>
              )}
              
              {location.constituency && (
                <div className="bg-green-50 dark:bg-green-900/20 p-3 sm:p-4 rounded-lg">
                  <h4 className="font-semibold text-green-800 dark:text-green-200 mb-1 text-sm sm:text-base">Constituency</h4>
                  <p className="text-green-700 dark:text-green-300 text-sm sm:text-base truncate">{location.constituency}</p>
                </div>
              )}
              
              {location.type === 'ward' && (
                <div className="bg-purple-50 dark:bg-purple-900/20 p-3 sm:p-4 rounded-lg">
                  <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-1 text-sm sm:text-base">Ward</h4>
                  <p className="text-purple-700 dark:text-purple-300 text-sm sm:text-base truncate">{location.name}</p>
                </div>
              )}
            </div>

            {/* Key Statistics */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 justify-items-center">
              {location.registration_target && (
                <div className="bg-gray-50 dark:bg-gray-700 p-3 sm:p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Users className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 dark:text-gray-400" />
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm sm:text-base">Registration Target</h4>
                  </div>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                    {location.registration_target.toLocaleString()}
                  </p>
                </div>
              )}
              
              {location.total_voters && (
                <div className="bg-green-50 dark:bg-green-900/20 p-3 sm:p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Users className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 dark:text-green-400" />
                    <h4 className="font-semibold text-green-800 dark:text-green-200 text-sm sm:text-base">Total Voters</h4>
                  </div>
                  <p className="text-lg sm:text-2xl font-bold text-green-900 dark:text-green-100">
                    {location.total_voters.toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {/* Leadership Information */}
            <div className="space-y-4 ">
              <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                Leadership
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 justify-items-center">
                {location.member_of_parliament && (
                  <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 p-3 sm:p-4 rounded-lg border border-green-200 dark:border-green-700">
                    <h5 className="font-semibold text-green-800 dark:text-green-200 mb-1 text-sm sm:text-base">
                      Member of Parliament
                    </h5>
                    <p className="text-green-700 dark:text-green-300 font-medium text-sm sm:text-base">
                      {location.member_of_parliament}
                    </p>
                  </div>
                )}
                
                {location.governor && (
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 p-3 sm:p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                    <h5 className="font-semibold text-blue-800 dark:text-blue-200 mb-1 text-sm sm:text-base">
                      Governor
                    </h5>
                    <p className="text-blue-700 dark:text-blue-300 font-medium text-sm sm:text-base">
                      {location.governor}
                    </p>
                  </div>
                )}
                
                {location.senator && (
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20 p-3 sm:p-4 rounded-lg border border-purple-200 dark:border-purple-700">
                    <h5 className="font-semibold text-purple-800 dark:text-purple-200 mb-1 text-sm sm:text-base">
                      Senator
                    </h5>
                    <p className="text-purple-700 dark:text-purple-300 font-medium text-sm sm:text-base">
                      {location.senator}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" onClick={onClose} className="text-sm sm:text-base">
                Close
              </Button>
              {location.member_of_parliament && (
                <Button 
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white transition-all duration-300 transform hover:scale-105 text-sm sm:text-base"
                  onClick={searchPetitions}
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <>
                      <Search className="w-3 h-3 sm:w-4 sm:h-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                      View Related Petitions
                    </>
                  )}
                </Button>
              )}
            </div>
            </div>  
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default LocationDetailViewer;
