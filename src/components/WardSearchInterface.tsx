
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MapPin, Users, Calculator, TrendingUp, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SearchBox from "@/components/SearchBox";
import { toast } from "sonner";

interface Ward {
  id: string;
  ward_name: string;
  constituency: string;
  county: string;
  registration_target: number;
}

interface Constituency {
  id: number;
  name: string;
  county_name: string;
  registration_target: number;
}

interface County {
  id: number;
  name: string;
  total_count: number;
}

interface SignatureRequirement {
  county: string;
  constituency: string;
  ward: string;
  requiredSignatures: number;
  percentage: number;
  totalVoters: number;
}

const WardSearchInterface = () => {
  const [wards, setWards] = useState<Ward[]>([]);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [counties, setCounties] = useState<County[]>([]);
  const [filteredWards, setFilteredWards] = useState<Ward[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCounty, setSelectedCounty] = useState('');
  const [selectedConstituency, setSelectedConstituency] = useState('');
  const [signatureResult, setSignatureResult] = useState<SignatureRequirement | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [calcCounty, setCalcCounty] = useState("");
  const [calcConstituency, setCalcConstituency] = useState("");
  const [calcWard, setCalcWard] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterWards();
  }, [searchTerm, selectedCounty, selectedConstituency, wards]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch wards
      const { data: wardsData, error: wardsError } = await supabase
        .from('wards')
        .select('*')
        .order('county', { ascending: true });

      if (wardsError) throw wardsError;
      setWards(wardsData || []);
      setFilteredWards(wardsData || []);

      // Fetch constituencies with county data
      const { data: constituenciesData, error: constituenciesError } = await supabase
        .from('constituencies')
        .select(`
          id,
          name,
          registration_target,
          counties!inner(name)
        `)
        .order('name', { ascending: true });

      if (constituenciesError) throw constituenciesError;
      setConstituencies((constituenciesData || []).map(c => ({
        id: c.id,
        name: c.name,
        county_name: c.counties?.name || '',
        registration_target: c.registration_target || 0
      })));
      
      // Fetch counties
      const { data: countiesData, error: countiesError } = await supabase
        .from('counties')
        .select('*')
        .order('name', { ascending: true });

      if (countiesError) throw countiesError;
      setCounties((countiesData || []).map(c => ({
        id: c.id,
        name: c.name,
        total_count: c.total_count || 0
      })));

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filterWards = () => {
    let filtered = wards;

    if (searchTerm) {
      filtered = filtered.filter(ward =>
        ward.ward_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ward.constituency.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ward.county.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCounty && selectedCounty !== 'all') {
      filtered = filtered.filter(ward => ward.county === selectedCounty);
    }

    if (selectedConstituency && selectedConstituency !== 'all') {
      filtered = filtered.filter(ward => ward.constituency === selectedConstituency);
    }

    setFilteredWards(filtered);
  };

  const searchWards = async (query: string) => {
    if (!query || query.length < 2) return [];
    
    const { data, error } = await supabase
      .from('wards')
      .select('*')
      .or(`ward_name.ilike.%${query}%,constituency.ilike.%${query}%,county.ilike.%${query}%`)
      .limit(10);

    if (error) {
      console.error('Search error:', error);
      return [];
    }
    return data || [];
  };

  const searchCounties = async (query: string) => {
    if (!query || query.length < 2) return [];
    return counties
      .filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 10);
  };

  const searchConstituencies = async (query: string) => {
    if (!query || query.length < 2) return [];
    let filtered = constituencies;
    
    if (calcCounty) {
      filtered = constituencies.filter(c => c.county_name === calcCounty);
    }
    
    return filtered
      .filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 10);
  };

  const calculateSignatureRequirement = async () => {
    if (!calcCounty || !calcConstituency || !calcWard) {
      toast.error('Please select county, constituency, and ward');
      return;
    }
    
    const selectedWard = wards.find(w => 
      w.county === calcCounty && 
      w.constituency === calcConstituency && 
      w.ward_name.toLowerCase() === calcWard.toLowerCase()
    );

    if (selectedWard) {
      const requiredSignatures = Math.ceil(selectedWard.registration_target * 0.3);
      setSignatureResult({
        county: calcCounty,
        constituency: calcConstituency,
        ward: selectedWard.ward_name,
        requiredSignatures,
        percentage: 30,
        totalVoters: selectedWard.registration_target
      });
      toast.success('Signature requirement calculated successfully!');
    } else {
      toast.error('Ward not found. Please check your selections.');
    }
  };

  const getUniqueCounties = () => {
    return [...new Set(wards.map(ward => ward.county))].sort();
  };

  const getConstituenciesByCounty = (county: string) => {
    return [...new Set(wards.filter(ward => ward.county === county).map(ward => ward.constituency))].sort();
  };

  return (
    <div className="space-y-6">
      {/* Search Interface */}
      <Card className="border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50/50 to-white dark:from-green-950/10 dark:to-gray-900">
        <CardHeader>
          <CardTitle className="flex items-center text-green-900 dark:text-green-100">
            <Search className="w-5 h-5 mr-2" />
            Ward Search & Signature Calculator
          </CardTitle>
          <CardDescription className="text-green-700 dark:text-green-300">
            Search wards across Kenya and calculate signature requirements for MP recall petitions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-green-500 dark:text-green-400" />
            <SearchBox
              placeholder="Search by ward, constituency, or county..."
              onSearch={searchWards}
              onSelect={(ward: Ward) => {
                setSearchTerm(ward.ward_name);
                setSelectedCounty(ward.county);
                setSelectedConstituency(ward.constituency);
                setCalcCounty(ward.county);
                setCalcConstituency(ward.constituency);
                setCalcWard(ward.ward_name);
              }}
              getDisplayText={(ward: Ward) => `${ward.ward_name}, ${ward.constituency}, ${ward.county}`}
              className="pl-10 bg-white dark:bg-gray-800 border-green-200 dark:border-green-700"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select value={selectedCounty} onValueChange={setSelectedCounty}>
              <SelectTrigger className="border-green-200 dark:border-green-700 focus:border-green-400 dark:focus:border-green-500 bg-white dark:bg-gray-800">
                <SelectValue placeholder="Select County" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-green-200 dark:border-green-700">
                <SelectItem value="all">All Counties</SelectItem>
                {getUniqueCounties().map(county => (
                  <SelectItem key={county} value={county}>{county}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={selectedConstituency} 
              onValueChange={setSelectedConstituency}
              disabled={!selectedCounty || selectedCounty === 'all'}
            >
              <SelectTrigger className="border-green-200 dark:border-green-700 focus:border-green-400 dark:focus:border-green-500 bg-white dark:bg-gray-800">
                <SelectValue placeholder="Select Constituency" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-green-200 dark:border-green-700">
                <SelectItem value="all">All Constituencies</SelectItem>
                {selectedCounty && selectedCounty !== 'all' && 
                  getConstituenciesByCounty(selectedCounty).map(constituency => (
                    <SelectItem key={constituency} value={constituency}>
                      {constituency}
                    </SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Signature Calculator */}
      <Card className="border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50/30 to-white dark:from-green-950/5 dark:to-gray-900">
        <CardHeader>
          <CardTitle className="flex items-center text-green-900 dark:text-green-100">
            <Calculator className="w-5 h-5 mr-2" />
            Signature Requirement Calculator
          </CardTitle>
          <CardDescription className="text-green-700 dark:text-green-300">
            Calculate exact signature requirements for your constituency
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <SearchBox
              placeholder="County name"
              onSearch={searchCounties}
              onSelect={(county: County) => {
                setCalcCounty(county.name);
                setCalcConstituency("");
                setCalcWard("");
              }}
              getDisplayText={(county: County) => county.name}
              className="bg-white dark:bg-gray-800 border-green-200 dark:border-green-700"
            />
            <SearchBox
              placeholder="Constituency name"
              onSearch={searchConstituencies}
              onSelect={(constituency: Constituency) => {
                setCalcConstituency(constituency.name);
                setCalcWard("");
              }}
              getDisplayText={(constituency: Constituency) => constituency.name}
              disabled={!calcCounty}
              className="bg-white dark:bg-gray-800 border-green-200 dark:border-green-700"
            />
            <SearchBox
              placeholder="Ward name"
              onSearch={searchWards}
              onSelect={(ward: Ward) => setCalcWard(ward.ward_name)}
              getDisplayText={(ward: Ward) => ward.ward_name}
              disabled={!calcConstituency}
              className="bg-white dark:bg-gray-800 border-green-200 dark:border-green-700"
            />
          </div>

          <Button 
            onClick={calculateSignatureRequirement}
            disabled={!calcCounty || !calcConstituency || !calcWard}
            className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white mb-4"
          >
            Calculate Required Signatures
          </Button>

          {signatureResult && (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mt-4">
              <h4 className="text-green-900 dark:text-green-100 font-semibold mb-2 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2" />
                Signature Requirement Result
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    <strong>Location:</strong> {signatureResult.ward}, {signatureResult.constituency}, {signatureResult.county}
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    <strong>Total Registered Voters:</strong> {signatureResult.totalVoters.toLocaleString()}
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    <strong>Required Percentage:</strong> {signatureResult.percentage}% of registered voters
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-green-800 dark:text-green-200">
                    {signatureResult.requiredSignatures.toLocaleString()}
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400">signatures needed</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      <Card className="border-green-200 dark:border-green-800 bg-white dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-green-900 dark:text-green-100">
            <span className="flex items-center">
              <MapPin className="w-5 h-5 mr-2" />
              Search Results
            </span>
            <Badge className="bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200">
              {filteredWards.length} wards found
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 dark:border-green-400 mx-auto"></div>
              <p className="text-green-600 dark:text-green-400 mt-2">Loading wards...</p>
            </div>
          ) : filteredWards.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 dark:text-gray-400">No wards found matching your criteria</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredWards.map((ward) => (
                <div
                  key={ward.id}
                  className="border border-green-100 dark:border-green-800 rounded-lg p-4 hover:bg-green-50/50 dark:hover:bg-green-950/20 transition-colors cursor-pointer"
                  onClick={() => {
                    setCalcCounty(ward.county);
                    setCalcConstituency(ward.constituency);
                    setCalcWard(ward.ward_name);
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-green-900 dark:text-green-100">{ward.ward_name}</h4>
                      <p className="text-sm text-green-700 dark:text-green-300">{ward.constituency}, {ward.county}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center text-green-600 dark:text-green-400">
                        <Users className="w-4 h-4 mr-1" />
                        <span className="font-medium">{ward.registration_target?.toLocaleString() || 'N/A'}</span>
                      </div>
                      <p className="text-xs text-green-500 dark:text-green-400">registered voters</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WardSearchInterface;
