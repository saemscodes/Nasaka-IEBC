import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, MapPin, Users } from 'lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SearchBox from "@/components/SearchBox";

interface Constituency {
  id: string;
  name: string;
  county: string;
  total_voters: number;
}

const ConstituencySearch = () => {
  const [selectedConstituency, setSelectedConstituency] = useState<Constituency | null>(null);
  const [counties, setCounties] = useState<string[]>([]);

  useEffect(() => {
    fetchCounties();
  }, []);

  const fetchConstituencies = async (query: string) => {
    const { data, error } = await supabase
      .from('constituencies')
      .select('*')
      .or(`name.ilike.%${query}%,county.ilike.%${query}%`)
      .limit(5);

    if (error) throw error;
    return data || [];
  };

  const fetchCounties = async () => {
    const { data, error } = await supabase
      .from('constituencies')
      .select('county')
      .order('county', { ascending: true });

    if (error) throw error;
    const uniqueCounties = [...new Set(data?.map(c => c.county))];
    setCounties(uniqueCounties);
  };

  const handleSearch = () => {
    if (selectedConstituency) {
      window.location.href = `/constituency/${selectedConstituency.id}`;
    }
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <SearchBox
            placeholder="Search your constituency..."
            onSearch={fetchConstituencies}
            onSelect={setSelectedConstituency}
            getDisplayText={(c: Constituency) => `${c.name}, ${c.county}`}
            className="pl-10"
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

      {selectedConstituency && (
        <Card className="mt-2 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 text-green-600 mr-2" />
                  <span className="font-medium text-gray-900">{selectedConstituency.name}</span>
                </div>
                <p className="text-sm text-gray-600 ml-6">{selectedConstituency.county} County</p>
              </div>
              <div className="flex items-center text-green-600">
                <Users className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">
                  {selectedConstituency.total_voters?.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ConstituencySearch;
