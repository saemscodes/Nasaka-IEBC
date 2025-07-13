
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Building2 } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

interface CountyStats {
  county_name: string;
  constituencies_count: number;
  total_voters: number;
  wards_count: number;
}

const CountyStatistics = () => {
  const [countyStats, setCountyStats] = useState<CountyStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCountyStatistics();
  }, []);

  const fetchCountyStatistics = async () => {
    try {
      const { data: verifiedSignatures, error: verifiedError } = await supabase
        .from('signatures')
        .select('*')
        .filter('verification_status->>verified', 'eq', 'true'); // Correct JSON access
      if (error) throw error;
      setCountyStats(data || []);
    } catch (error) {
      console.error('Error fetching county statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50/50 to-white dark:from-green-900/20 dark:to-gray-800">
        <CardHeader>
          <CardTitle className="text-green-900 dark:text-green-100">Loading County Statistics...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50/50 to-white dark:from-green-900/20 dark:to-gray-800">
      <CardHeader>
        <CardTitle className="flex items-center text-green-900 dark:text-green-100">
          <MapPin className="w-5 h-5 mr-2" />
          County Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
          {countyStats.map((county, index) => (
            <div key={county.county_name} className="p-4 bg-white dark:bg-gray-700 rounded-lg border border-green-100 dark:border-green-700 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{county.county_name}</h4>
                <Badge variant="outline" className="text-xs border-green-200 dark:border-green-600 text-green-700 dark:text-green-300">
                  #{index + 1}
                </Badge>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600 dark:text-gray-300">
                    <Users className="w-3 h-3 mr-1" />
                    Voters
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {county.total_voters.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600 dark:text-gray-300">
                    <Building2 className="w-3 h-3 mr-1" />
                    Constituencies
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {county.constituencies_count}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600 dark:text-gray-300">
                    <MapPin className="w-3 h-3 mr-1" />
                    Wards
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {county.wards_count}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default CountyStatistics;
