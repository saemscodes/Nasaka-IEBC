
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, MapPin, Users } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import SearchBox from "@/components/SearchBox";

interface Constituency {
  id: string;
  name: string;
  county: string;
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
    
    if (!query || query.length < 2) return [];
    
    try {
      // Fix the query structure - use proper Supabase syntax
      const { data, error } = await supabase
        .from('constituencies')
        .select('id, name, county, total_voters, lat, lng, wards')
        .or(`name.ilike.%${query}%,county.ilike.%${query}%`)
        .limit(10);

      if (error) {
        console.error('Search error:', error);
        return [];
      }

      return (data || []).map(item => ({
        id: item.id?.toString() || '',
        name: item.name || '',
        county: item.county || '',
        total_voters: item.total_voters || 0,
        lat: item.lat || 0,
        lng: item.lng || 0,
        wards: item.wards || []
      }));
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  };

  const handleSelect = (constituency: Constituency) => {
    setSelectedConstituency(constituency);
    onSelect?.(constituency);
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-green-500 dark:text-green-400 z-10" />
        <SearchBox
          placeholder={placeholder}
          onSearch={fetchConstituencies}
          onSelect={handleSelect}
          getDisplayText={(constituency: Constituency) => 
            `${constituency.name}, ${constituency.county}`
          }
          className="pl-10 bg-white dark:bg-gray-800 border-green-200 dark:border-green-700 text-gray-900 dark:text-white"
        />
      </div>

      {selectedConstituency && (
        <Card className="mt-3 border-green-200 dark:border-green-700 bg-white dark:bg-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-green-900 dark:text-green-100">
                  {selectedConstituency.name}
                </h4>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {selectedConstituency.county}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center text-green-600 dark:text-green-400">
                  <Users className="w-4 h-4 mr-1" />
                  <span className="font-medium">
                    {selectedConstituency.total_voters?.toLocaleString() || 'N/A'}
                  </span>
                </div>
                <p className="text-xs text-green-500 dark:text-green-400">voters</p>
              </div>
            </div>
            {showButton && (
              <Button 
                className="w-full mt-3 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
                onClick={() => {
                  // Dispatch custom event to navigate to petition wizard with prefilled data
                  window.dispatchEvent(new CustomEvent('tab-navigation', { 
                    detail: { 
                      tabId: 'wizard',
                      constituency: selectedConstituency 
                    } 
                  }));
                }}
              >
                Start Petition for {selectedConstituency.name}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ConstituencySearch;
