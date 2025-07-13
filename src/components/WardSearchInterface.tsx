
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MapPin, Users, Calculator, TrendingUp } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    fetchWards();
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

  const calculateSignatureRequirement = (county: string, constituency: string, ward: string) => {
    const selectedWard = wards.find(w => 
      w.county === county && 
      w.constituency === constituency && 
      w.ward_name.toLowerCase() === ward.toLowerCase()
    );

    if (selectedWard) {
      // Calculate 30% of registered voters (standard recall requirement)
      const requiredSignatures = Math.ceil(selectedWard.registration_target * 0.3);
      const percentage = 30;

      setSignatureResult({
        county,
        constituency,
        ward: selectedWard.ward_name,
        requiredSignatures,
        percentage
      });
    }
  };

  const getUniqueCounties = () => {
    return [...new Set(wards.map(ward => ward.county))].sort();
  };

  const getConstituenciesByCounty = (county: string) => {
    return [...new Set(wards.filter(ward => ward.county === county).map(ward => ward.constituency))].sort();
  };

  const getWardsByConstituency = (constituency: string) => {
    return wards.filter(ward => ward.constituency === constituency).sort((a, b) => a.ward_name.localeCompare(b.ward_name));
  };

  const handleCalculateSignatures = () => {
    const countyInput = document.querySelector('input[placeholder="County name"]') as HTMLInputElement;
    const constituencyInput = document.querySelector('input[placeholder="Constituency name"]') as HTMLInputElement;
    const wardInput = document.querySelector('input[placeholder="Ward name"]') as HTMLInputElement;

    if (countyInput?.value && constituencyInput?.value && wardInput?.value) {
      calculateSignatureRequirement(countyInput.value, constituencyInput.value, wardInput.value);
    }
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
            <Input
              placeholder="Search by ward, constituency, or county..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-green-200 focus:border-green-400"
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
                {selectedCounty && selectedCounty !== 'all' && getConstituenciesByCounty(selectedCounty).map(constituency => (
                  <SelectItem key={constituency} value={constituency}>{constituency}</SelectItem>
                ))}
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
            <Input
              placeholder="County name"
              className="border-green-200 focus:border-green-400"
            />
            <Input
              placeholder="Constituency name"
              className="border-green-200 focus:border-green-400"
            />
            <Input
              placeholder="Ward name"
              className="border-green-200 focus:border-green-400"
            />
          </div>

          <Button 
            onClick={handleCalculateSignatures}
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
                  onClick={() => calculateSignatureRequirement(ward.county, ward.constituency, ward.ward_name)}
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
