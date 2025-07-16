
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Building2, ArrowLeft, ChevronRight } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

interface County {
  id: number;
  county_name: string;
  total_voters: number;
  constituencies_count: number;
  wards_count: number;
}

interface Constituency {
  id: number;
  name: string;
  county_id: number;
  registration_target: number;
  member_of_parliament: string | null;
}

interface Ward {
  id: string;
  ward_name: string;
  constituency: string;
  county: string;
  registration_target: number;
}

interface CountyDetailViewerProps {
  county: County | null;
  isOpen: boolean;
  onClose: () => void;
}

const CountyDetailViewer: React.FC<CountyDetailViewerProps> = ({
  county,
  isOpen,
  onClose
}) => {
  const [currentView, setCurrentView] = useState<'county' | 'constituency' | 'ward'>('county');
  const [selectedConstituency, setSelectedConstituency] = useState<Constituency | null>(null);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (county && isOpen) {
      fetchConstituencies();
      setCurrentView('county');
      setSelectedConstituency(null);
    }
  }, [county, isOpen]);

  const fetchConstituencies = async () => {
    if (!county) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('constituencies')
        .select('*')
        .eq('county_id', county.id)
        .order('name');

      if (error) throw error;
      setConstituencies(data || []);
    } catch (error) {
      console.error('Error fetching constituencies:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWards = async (constituency: Constituency) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('wards')
        .select('*')
        .eq('constituency', constituency.name)
        .order('ward_name');

      if (error) throw error;
      setWards(data || []);
      setSelectedConstituency(constituency);
      setCurrentView('constituency');
    } catch (error) {
      console.error('Error fetching wards:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderCountyView = () => (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center">
        <h2 className="text-lg sm:text-2xl font-bold text-green-900 dark:text-green-100 mb-2">
          {county?.county_name} County
        </h2>
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <div className="text-center">
            <div className="text-lg sm:text-2xl font-bold text-green-800 dark:text-green-200">
              {county?.total_voters.toLocaleString()}
            </div>
            <div className="text-xs sm:text-sm text-green-600 dark:text-green-400">Total Voters</div>
          </div>
          <div className="text-center">
            <div className="text-lg sm:text-2xl font-bold text-blue-800 dark:text-blue-200">
              {county?.constituencies_count}
            </div>
            <div className="text-xs sm:text-sm text-blue-600 dark:text-blue-400">Constituencies</div>
          </div>
          <div className="text-center">
            <div className="text-lg sm:text-2xl font-bold text-purple-800 dark:text-purple-200">
              {county?.wards_count}
            </div>
            <div className="text-xs sm:text-sm text-purple-600 dark:text-purple-400">Wards</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-green-900 dark:text-green-100 flex items-center text-sm sm:text-base">
          <Building2 className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
          Constituencies
        </h3>
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 dark:border-green-400 mx-auto"></div>
          </div>
        ) : (
          <div className="grid gap-2 sm:gap-3 max-h-48 sm:max-h-64 overflow-y-auto green-scrollbar">
            {constituencies.map((constituency) => (
              <Card 
                key={constituency.id}
                className="cursor-pointer hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors border-green-200 dark:border-green-800"
                onClick={() => fetchWards(constituency)}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-white text-sm sm:text-base truncate">
                        {constituency.name}
                      </h4>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                        MP: {constituency.member_of_parliament || 'N/A'}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <div className="text-right">
                        <div className="font-medium text-gray-900 dark:text-white text-xs sm:text-sm">
                          {constituency.registration_target?.toLocaleString() || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">voters</div>
                      </div>
                      <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderConstituencyView = () => (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentView('county')}
          className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-xs sm:text-sm"
        >
          <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
          Back to {county?.county_name}
        </Button>
      </div>

      <div className="text-center">
        <h2 className="text-lg sm:text-2xl font-bold text-green-900 dark:text-green-100 mb-2">
          {selectedConstituency?.name} Constituency
        </h2>
        <p className="text-green-700 dark:text-green-300 mb-4 text-sm sm:text-base">
          {county?.county_name} County
        </p>
        <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <div className="text-center">
            <div className="text-lg sm:text-2xl font-bold text-green-800 dark:text-green-200">
              {selectedConstituency?.registration_target?.toLocaleString() || 'N/A'}
            </div>
            <div className="text-xs sm:text-sm text-green-600 dark:text-green-400">Registered Voters</div>
          </div>
          <div className="text-center">
            <div className="text-lg sm:text-2xl font-bold text-blue-800 dark:text-blue-200">
              {wards.length}
            </div>
            <div className="text-xs sm:text-sm text-blue-600 dark:text-blue-400">Wards</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-green-900 dark:text-green-100 flex items-center text-sm sm:text-base">
          <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
          Wards
        </h3>
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 dark:border-green-400 mx-auto"></div>
          </div>
        ) : (
          <div className="grid gap-2 sm:gap-3 max-h-48 sm:max-h-64 overflow-y-auto green-scrollbar">
            {wards.map((ward) => (
              <Card 
                key={ward.id}
                className="border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors"
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-white text-sm sm:text-base truncate">
                        {ward.ward_name}
                      </h4>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        Ward
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-medium text-gray-900 dark:text-white text-xs sm:text-sm">
                        {ward.registration_target?.toLocaleString() || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">target</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (!county) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xs sm:max-w-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border-green-200 dark:border-green-800 mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="text-green-900 dark:text-green-100 text-lg sm:text-xl">
            Electoral Data
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {currentView === 'county' && renderCountyView()}
          {currentView === 'constituency' && renderConstituencyView()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CountyDetailViewer;
