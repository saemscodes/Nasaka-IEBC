
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Users, TrendingUp, Building2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import CountyStatistics from '@/components/CountyStatistics';

const KenyaHeatMap = () => {
  const [mapStats, setMapStats] = useState({
    totalCounties: 0,
    totalConstituencies: 0,
    totalVoters: 0
  });

  useEffect(() => {
    fetchMapStatistics();
  }, []);

  const fetchMapStatistics = async () => {
    try {
      const { data: counties, error: countiesError } = await supabase
        .from('counties')
        .select('*');

      if (countiesError) throw countiesError;

      const { data: constituencies, error: constituenciesError } = await supabase
        .from('constituencies')
        .select('*');

      if (constituenciesError) throw constituenciesError;

      const totalVoters = counties?.reduce((sum, county) => 
        sum + (county.registration_target || 0), 0) || 0; // Use registration_target

      setMapStats({
        totalCounties: counties?.length || 0,
        totalConstituencies: constituencies?.length || 0,
        totalVoters
      });
    } catch (error) {
      console.error('Error fetching map statistics:', error);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-green-200 dark:border-green-700 bg-gradient-to-br from-green-50/50 to-white dark:from-green-900/20 dark:to-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center text-green-900 dark:text-green-100">
            <MapPin className="w-5 h-5 mr-2" />
            Kenya Electoral Map
          </CardTitle>
          <CardDescription className="text-green-700 dark:text-green-300">
            Interactive map showing voter distribution across Kenyan counties and constituencies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="w-full h-[500px] rounded-lg overflow-hidden border border-green-200 dark:border-green-700">
                <iframe 
                  src="https://www.google.com/maps/d/embed?mid=1YZGfnjJj9Ajzu6xhWEF_sg_RFB0j7NY&ehbc=2E312F&noprof=1" 
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  style={{ border: 0 }}
                  allowFullScreen
                  aria-hidden="false"
                  tabIndex={0}
                  className="dark:opacity-90"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg border border-green-200 dark:border-green-700">
                <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">Map Information</h4>
                <div className="space-y-2 text-sm text-green-700 dark:text-green-300">
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full bg-green-500/60 border-2 border-green-600 mr-2"></div>
                    <span>Electoral boundaries (IEBC official)</span>
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-400">
                    Interactive map with constituency details
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
                <h4 className="font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  Electoral Statistics
                </h4>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="text-center p-3 bg-white dark:bg-gray-700 rounded border border-green-100 dark:border-green-600">
                    <div className="font-bold text-green-800 dark:text-green-200">
                      {mapStats.totalCounties}
                    </div>
                    <div className="text-green-600 dark:text-green-400">Counties</div>
                  </div>
                  <div className="text-center p-3 bg-white dark:bg-gray-700 rounded border border-green-100 dark:border-green-600">
                    <div className="font-bold text-green-800 dark:text-green-200">
                      {mapStats.totalConstituencies}
                    </div>
                    <div className="text-green-600 dark:text-green-400">Constituencies</div>
                  </div>
                  <div className="text-center p-3 bg-white dark:bg-gray-700 rounded border border-green-100 dark:border-green-600">
                    <div className="font-bold text-green-800 dark:text-green-200">
                      {mapStats.totalVoters.toLocaleString()}
                    </div>
                    <div className="text-green-600 dark:text-green-400">Registered Voters</div>
                  </div>
                </div>
              </div>

              <Card className="border-green-200 dark:border-green-700 bg-white dark:bg-gray-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-green-900 dark:text-green-100">
                    How to Use
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-green-700 dark:text-green-300">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Zoom in/out to explore regions</li>
                    <li>Click markers for constituency details</li>
                    <li>Compare voter densities</li>
                    <li>View electoral boundaries</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* County Statistics */}
      <CountyStatistics />
    </div>
  );
};

export default KenyaHeatMap;
