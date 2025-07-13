import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MapPin, Users, Calculator, TrendingUp } from 'lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SearchBox from "@/components/SearchBox";

interface Ward {
  id: string;
  ward_name: string;
  constituency: string;
  county: string;
  registration_target: number;
}

interface SignatureRequirement {
  county: string;
  constituency: string;
  ward: string;
  requiredSignatures: number;
  percentage: number;
}

const WardSearchInterface = () => {
  const [wards, setWards] = useState<Ward[]>([]);
  const [filteredWards, setFilteredWards] = useState<Ward[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCounty, setSelectedCounty] = useState('');
  const [selectedConstituency, setSelectedConstituency] = useState('');
  const [signatureResult, setSignatureResult] = useState<SignatureRequirement | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [calcCounty, setCalcCounty] = useState("");
  const [calcConstituency, setCalcConstituency] = useState("");
  const [calcWard, setCalcWard] = useState("");
  const [countyOptions, setCountyOptions] = useState<string[]>([]);
  const [constituencyOptions, setConstituencyOptions] = useState<string[]>([]);

  useEffect(() => {
    fetchWards();
    fetchOptions();
  }, []);

  useEffect(() => {
    filterWards();
  }, [searchTerm, selectedCounty, selectedConstituency, wards]);

  const fetchWards = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('wards')
        .select('*')
        .order('county', { ascending: true });

      if (error) throw error;
      setWards(data || []);
      setFilteredWards(data || []);
    } catch (error) {
      console.error('Error fetching wards:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    const { data: counties } = await supabase
      .from('wards')
      .select('county')
      .order('county', { ascending: true });
      
    const { data: constituencies } = await supabase
      .from('wards')
      .select('constituency')
      .order('constituency', { ascending: true });

    setCountyOptions([...new Set(counties?.map(c => c.county) || [])]);
    setConstituencyOptions([...new Set(constituencies?.map(c => c.constituency) || [])]);
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
    const { data, error } = await supabase
      .from('wards')
      .select('*')
      .or(`ward_name.ilike.%${query}%,constituency.ilike.%${query}%,county.ilike.%${query}%`)
      .limit(5);

    if (error) throw error;
    return data || [];
  };

  const searchCounties = async (query: string) => {
    return countyOptions
      .filter(c => c.toLowerCase().includes(query.toLowerCase()))
      .map(c => ({ name: c }));
  };

  const searchConstituencies = async (query: string) => {
    return constituencyOptions
      .filter(c => c.toLowerCase().includes(query.toLowerCase()))
      .map(c => ({ name: c }));
  };

  const calculateSignatureRequirement = () => {
    if (!calcCounty || !calcConstituency || !calcWard) return;
    
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
        percentage: 30
      });
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
      <Card className="border-green-200 bg-gradient-to-br from-green-50/50 to-white">
        <CardHeader>
          <CardTitle className="flex items-center text-green-900">
            <Search className="w-5 h-5 mr-2" />
            Ward Search & Signature Calculator
          </CardTitle>
          <CardDescription className="text-green-700">
            Search wards across Kenya and calculate signature requirements for MP recall petitions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-green-500" />
            <SearchBox
              placeholder="Search by ward, constituency, or county..."
              onSearch={searchWards}
              onSelect={(ward) => {
                setSearchTerm(ward.ward_name);
                setSelectedCounty(ward.county);
                setSelectedConstituency(ward.constituency);
              }}
              getDisplayText={(ward: Ward) => `${ward.ward_name}, ${ward.constituency}, ${ward.county}`}
              className="pl-10"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select value={selectedCounty} onValueChange={setSelectedCounty}>
              <SelectTrigger className="border-green-200 focus:border-green-400">
                <SelectValue placeholder="Select County" />
              </SelectTrigger>
              <SelectContent className="bg-white border-green-200">
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
              <SelectTrigger className="border-green-200 focus:border-green-400">
                <SelectValue placeholder="Select Constituency" />
              </SelectTrigger>
              <SelectContent className="bg-white border-green-200">
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
      <Card className="border-green-200 bg-gradient-to-br from-green-50/30 to-white">
        <CardHeader>
          <CardTitle className="flex items-center text-green-900">
            <Calculator className="w-5 h-5 mr-2" />
            Signature Requirement Calculator
          </CardTitle>
          <CardDescription className="text-green-700">
            Calculate exact signature requirements for your constituency
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <SearchBox
              placeholder="County name"
              onSearch={searchCounties}
              onSelect={(county) => {
                setCalcCounty(county.name);
                setCalcConstituency("");
                setCalcWard("");
              }}
              getDisplayText={(county) => county.name}
            />
            <SearchBox
              placeholder="Constituency name"
              onSearch={searchConstituencies}
              onSelect={(constituency) => {
                setCalcConstituency(constituency.name);
                setCalcWard("");
              }}
              getDisplayText={(constituency) => constituency.name}
              disabled={!calcCounty}
            />
            <SearchBox
              placeholder="Ward name"
              onSearch={searchWards}
              onSelect={(ward: Ward) => setCalcWard(ward.ward_name)}
              getDisplayText={(ward: Ward) => ward.ward_name}
              disabled={!calcConstituency}
            />
          </div>

          <Button 
            onClick={calculateSignatureRequirement}
            disabled={!calcCounty || !calcConstituency || !calcWard}
            className="bg-green-600 hover:bg-green-700 text-white mb-4"
          >
            Calculate Required Signatures
          </Button>

          {signatureResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
              <h4 className="text-green-900 font-semibold mb-2">Signature Requirement Result</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-green-700">
                    <strong>Location:</strong> {signatureResult.ward}, {signatureResult.constituency}, {signatureResult.county}
                  </p>
                  <p className="text-sm text-green-700">
                    <strong>Required Percentage:</strong> {signatureResult.percentage}% of registered voters
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-800">
                    {signatureResult.requiredSignatures.toLocaleString()}
                  </div>
                  <p className="text-sm text-green-600">signatures needed</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      <Card className="border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-green-900">
            <span className="flex items-center">
              <MapPin className="w-5 h-5 mr-2" />
              Search Results
            </span>
            <Badge className="bg-green-100 text-green-800">
              {filteredWards.length} wards found
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
              <p className="text-green-600 mt-2">Loading wards...</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredWards.map((ward) => (
                <div
                  key={ward.id}
                  className="border border-green-100 rounded-lg p-4 hover:bg-green-50/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setCalcCounty(ward.county);
                    setCalcConstituency(ward.constituency);
                    setCalcWard(ward.ward_name);
                    calculateSignatureRequirement();
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-green-900">{ward.ward_name}</h4>
                      <p className="text-sm text-green-700">{ward.constituency}, {ward.county}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center text-green-600">
                        <Users className="w-4 h-4 mr-1" />
                        <span className="font-medium">{ward.registration_target?.toLocaleString() || 'N/A'}</span>
                      </div>
                      <p className="text-xs text-green-500">registered voters</p>
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
