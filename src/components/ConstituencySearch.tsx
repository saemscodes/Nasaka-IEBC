import React, { useState } from 'react';
import SearchBox from '@/components/SearchBox';
import LocationDetailViewer from '@/components/LocationDetailViewer';
import { supabase } from '@/integrations/supabase/client';

interface Constituency {
  id: number;
  name: string;
  county_name: string;
  registration_target: number;
  member_of_parliament?: string;
}

interface ConstituencySearchProps {
  onSelect: (constituency: Constituency) => void;
}

const ConstituencySearch: React.FC<ConstituencySearchProps> = ({ onSelect }) => {
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [showLocationViewer, setShowLocationViewer] = useState(false);

  const searchConstituencies = async (query: string): Promise<Constituency[]> => {
    try {
      console.log('Searching for:', query);
      
      // Search constituencies by name
      const { data: constituencies, error: constError } = await supabase
        .from('constituencies')
        .select(`
          id,
          name,
          member_of_parliament,
          registration_target,
          county_id,
          counties!inner(name)
        `)
        .ilike('name', `%${query}%`)
        .limit(5);

      if (constError) {
        console.error('Error searching constituencies:', constError);
        throw constError;
      }

      // Search counties by name and get their constituencies
      const { data: counties, error: countyError } = await supabase
        .from('counties')
        .select(`
          id,
          name,
          constituencies (
            id,
            name,
            member_of_parliament,
            registration_target
          )
        `)
        .ilike('name', `%${query}%`)
        .limit(3);

      if (countyError) {
        console.error('Error searching counties:', countyError);
      }

      // Combine results
      const results: Constituency[] = [];

      // Add direct constituency matches
      if (constituencies) {
        constituencies.forEach(constituency => {
          results.push({
            id: constituency.id,
            name: constituency.name,
            county_name: constituency.counties?.name || 'Unknown County',
            registration_target: constituency.registration_target,
            member_of_parliament: constituency.member_of_parliament
          });
        });
      }

      // Add constituencies from county matches
      if (counties) {
        counties.forEach(county => {
          if (county.constituencies) {
            county.constituencies.forEach(constituency => {
              // Avoid duplicates
              if (!results.find(r => r.id === constituency.id)) {
                results.push({
                  id: constituency.id,
                  name: constituency.name,
                  county_name: county.name,
                  registration_target: constituency.registration_target,
                  member_of_parliament: constituency.member_of_parliament
                });
              }
            });
          }
        });
      }

      return results.slice(0, 10); // Limit to 10 results
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  };

  const handleSelect = (constituency: Constituency) => {
    onSelect(constituency);
    // Also show the location detail viewer
    setSelectedLocation({
      id: constituency.id,
      name: constituency.name,
      type: 'constituency',
      county: constituency.county_name,
      registration_target: constituency.registration_target,
      member_of_parliament: constituency.member_of_parliament
    });
    setShowLocationViewer(true);
  };

  return (
    <>
      <SearchBox
        placeholder="Search constituencies and counties..."
        onSearch={searchConstituencies}
        onSelect={handleSelect}
        getDisplayText={(constituency) => 
          `${constituency.name} (${constituency.county_name})`
        }
        className="w-full"
      />
      
      <LocationDetailViewer
        location={selectedLocation}
        isOpen={showLocationViewer}
        onClose={() => {
          setShowLocationViewer(false);
          setSelectedLocation(null);
        }}
      />
    </>
  );
};

export default ConstituencySearch;