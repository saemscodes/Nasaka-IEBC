
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, MapPin, Users } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import SearchBox from "@/components/SearchBox";

interface Constituency {
  id: string;
  name: string;
  county_id: string;
  total_voters?: number;
  lat?: number;
  lng?: number;
  wards?: string[];
}

interface ConstituencySearchProps {
  onSelect?: (constituency: Constituency) => void;
  placeholder?: string;
  showButton?: boolean;
  className?: string;
}

const ConstituencySearch: React.FC<ConstituencySearchProps> = ({ 
  onSelect, 
  placeholder = "Search your constituency...",
  showButton = true,
  className = ""
}) => {
  const [selectedConstituency, setSelectedConstituency] = useState<Constituency | null>(null);

  const fetchConstituencies = async (query: string): Promise<Constituency[]> => {
    console.log('Searching for:', query);
    
    const { data, error } = await supabase
      .from('constituencies')
      .select('*')
      .or(`name.ilike.%${query}%,county.ilike.%${query}%`)
      .limit(10);

    if (error) {
      console.error('Search error:', error);
      throw error;
    }
    
    console.log('Search results:', data);
    // Update fetchConstituencies return mapping
    return (data || []).map(item => ({
      id: item.id,
      name: item.name,
      county_id: item.county_id,
      total_voters: item.registration_target // Map registration_target to total_voters
      }));
  };

  const handleSearch = () => {
    if (selectedConstituency) {
      window.location.href = `/constituency/${selectedConstituency.id}`;
    }
  };

  const handleSelect = (constituency: Constituency) => {
    setSelectedConstituency(constituency);
    onSelect?.(constituency);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400 dark:text-gray-500" />
         <SearchBox
           placeholder={placeholder}
           onSearch={fetchConstituencies}
           onSelect={handleSelect}
           getDisplayText={(c) => `${c.name}, ${c.county_id}`} // Remove explicit type
           className="pl-10 h-12 text-base bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:border-green-500 dark:focus:border-green-400"
           />
        </div>
        {showButton && (
          <Button 
            onClick={handleSearch}
            disabled={!selectedConstituency}
            className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white px-6 py-3 h-12 text-base"
          >
            Search
          </Button>
        )}
      </div>

      {selectedConstituency && (
        <Card className="mt-2 border-green-200 dark:border-green-700 bg-white dark:bg-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 text-green-600 dark:text-green-400 mr-2" />
                  <span className="font-medium text-gray-900 dark:text-white">{selectedConstituency.name}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 ml-6">{selectedConstituency.county_id} County</p>
                {selectedConstituency.wards && selectedConstituency.wards.length > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 ml-6 mt-1">
                    Wards: {selectedConstituency.wards.join(', ')}
                  </p>
                )}
              </div>
              <div className="flex items-center text-green-600 dark:text-green-400">
                <Users className="w-4 h-4 mr-1" />
                <span className="text-sm font-medium">
                  {selectedConstituency.total_voters?.toLocaleString() || 'N/A'}
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
