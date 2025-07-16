
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, TrendingUp, Building2, Layers, Upload, Eye, EyeOff } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import SimpleOpenStreetMap from "@/components/SimpleOpenStreetMap";

interface OpenStreetMapViewerProps {
  locations?: any[];
}

const OpenStreetMapViewer: React.FC<OpenStreetMapViewerProps> = ({ locations = [] }) => {
  const [mapStats, setMapStats] = useState({
    totalCounties: 0,
    totalConstituencies: 0,
    totalVoters: 0
  });
  
  const [layers, setLayers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMapData();
  }, []);

  const fetchMapData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch counties data
      const { data: counties, error: countiesError } = await supabase
        .from('counties')
        .select('*')
        .order('name');

      if (countiesError) throw countiesError;

      // Fetch constituencies data
      const { data: constituencies, error: constituenciesError } = await supabase
        .from('constituencies')
        .select('*')
        .order('name');

      if (constituenciesError) throw constituenciesError;

      // Fetch wards data
      const { data: wards, error: wardsError } = await supabase
        .from('wards')
        .select('*')
        .order('ward_name');

      if (wardsError) throw wardsError;

      const totalVoters = counties?.reduce((sum, county) => 
        sum + (county.total_count || 0), 0) || 0;

      setMapStats({
        totalCounties: counties?.length || 0,
        totalConstituencies: constituencies?.length || 0,
        totalVoters
      });

      // Initialize layers
      const initialLayers = [
        {
          id: 'counties',
          name: 'Counties',
          type: 'counties',
          visible: true,
          data: counties || [],
          color: '#059669'
        },
        {
          id: 'constituencies',
          name: 'Constituencies',
          type: 'constituencies',
          visible: false,
          data: constituencies || [],
          color: '#3B82F6'
        },
        {
          id: 'wards',
          name: 'Wards',
          type: 'wards',
          visible: false,
          data: wards || [],
          color: '#8B5CF6'
        }
      ];

      setLayers(initialLayers);
    } catch (error) {
      console.error('Error fetching map data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLayerVisibility = (layerId: string) => {
    setLayers(prev => prev.map(layer => 
      layer.id === layerId 
        ? { ...layer, visible: !layer.visible }
        : layer
    ));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        
        if (file.name.endsWith('.json')) {
          const jsonData = JSON.parse(content);
          const newLayer = {
            id: `custom-${Date.now()}`,
            name: file.name.replace('.json', ''),
            type: 'constituencies',
            visible: true,
            data: jsonData.features || jsonData,
            color: '#F59E0B'
          };
          setLayers(prev => [...prev, newLayer]);
        } else if (file.name.endsWith('.csv')) {
          const lines = content.split('\n');
          const headers = lines[0].split(',');
          const data = lines.slice(1).map(line => {
            const values = line.split(',');
            const obj: any = {};
            headers.forEach((header, index) => {
              obj[header.trim()] = values[index]?.trim();
            });
            return obj;
          }).filter(item => item[headers[0]]);

          const newLayer = {
            id: `csv-${Date.now()}`,
            name: file.name.replace('.csv', ''),
            type: 'csv',
            visible: true,
            data: data,
            color: '#EF4444'
          };
          setLayers(prev => [...prev, newLayer]);
        }
      } catch (error) {
        console.error('Error parsing file:', error);
      }
    };
    reader.readAsText(file);
  };

  const renderMapContent = () => {
    if (isLoading) {
      return (
        <div className="w-full h-[500px] bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 dark:border-green-400 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading map data...</p>
          </div>
        </div>
      );
    }

    return <SimpleOpenStreetMap height="500px" />;
  };

  return (
    <div className="space-y-6">
      <Card className="border-green-200 dark:border-green-700 bg-gradient-to-br from-green-50/50 to-white dark:from-green-900/20 dark:to-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center text-green-900 dark:text-green-100">
            <MapPin className="w-5 h-5 mr-2" />
            Kenya Electoral Map - OpenStreetMap
          </CardTitle>
          <CardDescription className="text-green-700 dark:text-green-300">
            Interactive OpenStreetMap with customizable layers showing electoral data across Kenya
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {renderMapContent()}
            </div>

            <div className="space-y-4">
              {/* Layer Controls */}
              <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg border border-green-200 dark:border-green-700">
                <h4 className="font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center">
                  <Layers className="w-4 h-4 mr-1" />
                  Map Layers
                </h4>
                <div className="space-y-2">
                  {layers.map(layer => (
                    <div key={layer.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-3 h-3 rounded-full border-2 border-white"
                          style={{ backgroundColor: layer.color }}
                        ></div>
                        <span className="text-sm text-green-700 dark:text-green-300">
                          {layer.name} ({layer.data.length})
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleLayerVisibility(layer.id)}
                        className="h-6 w-6 p-0"
                      >
                        {layer.visible ? (
                          <Eye className="w-3 h-3 text-green-600" />
                        ) : (
                          <EyeOff className="w-3 h-3 text-gray-400" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* File Upload */}
              <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center">
                  <Upload className="w-4 h-4 mr-1" />
                  Custom Data Layers
                </h4>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept=".csv,.json"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-800/50 rounded-md hover:bg-blue-200 dark:hover:bg-blue-700/50 transition-colors"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload CSV/JSON
                  </label>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Upload CSV files with lat/lng columns or GeoJSON files for polygon boundaries
                  </p>
                </div>
              </div>

              {/* Statistics */}
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

              {/* Map Instructions */}
              <Card className="border-green-200 dark:border-green-700 bg-white dark:bg-gray-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-green-900 dark:text-green-100">
                    How to Use
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-green-700 dark:text-green-300">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Toggle layers on/off using the eye icons</li>
                    <li>Click markers for detailed information</li>
                    <li>Upload CSV/JSON files for custom layers</li>
                    <li>Zoom and pan to explore regions</li>
                    <li>Different colors represent different data types</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OpenStreetMapViewer;
