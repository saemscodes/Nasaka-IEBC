
import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, MapPin, Users } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

interface Constituency {
  id: string;
  name: string;
  county: string;
  total_voters: number;
}

const ConstituencySearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [suggestions, setSuggestions] = useState<Constituency[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedConstituency, setSelectedConstituency] = useState<Constituency | null>(null);

  useEffect(() => {
    fetchConstituencies();
  }, []);

  useEffect(() => {
    if (searchTerm.length > 2) {
      const filtered = constituencies.filter(
        constituency =>
          constituency.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          constituency.county.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 5));
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [searchTerm, constituencies]);

  const fetchConstituencies = async () => {
    try {
      const { data, error } = await supabase
        .from('constituencies')
        .select('*')
        .order('name');

      if (error) throw error;
      setConstituencies(data || []);
    } catch (error) {
      console.error('Error fetching constituencies:', error);
    }
  };

  const handleConstituencySelect = (constituency: Constituency) => {
    setSelectedConstituency(constituency);
    setSearchTerm(constituency.name);
    setShowSuggestions(false);
  };

  const handleSearch = () => {
    if (selectedConstituency) {
      // Navigate to constituency details page
      window.location.href = `/constituency/${selectedConstituency.id}`;
    }
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search your constituency..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-3 text-lg border-2 border-green-200 focus:border-green-500 rounded-lg"
            onFocus={() => searchTerm.length > 2 && setShowSuggestions(true)}
          />
        </div>
        <Button 
          onClick={handleSearch}
          disabled={!selectedConstituency}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3"
        >
          Search
        </Button>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 max-h-80 overflow-y-auto">
          <CardContent className="p-0">
            {suggestions.map((constituency) => (
              <div
                key={constituency.id}
                className="p-4 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                onClick={() => handleConstituencySelect(constituency)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 text-green-600 mr-2" />
                      <span className="font-medium text-gray-900">{constituency.name}</span>
                    </div>
                    <p className="text-sm text-gray-600 ml-6">{constituency.county} County</p>
                  </div>
                  <div className="flex items-center text-green-600">
                    <Users className="w-4 h-4 mr-1" />
                    <span className="text-sm font-medium">{constituency.total_voters?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ConstituencySearch;
