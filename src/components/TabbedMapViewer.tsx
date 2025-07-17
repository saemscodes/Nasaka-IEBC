import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Globe, ExternalLink, Layers, RefreshCw } from 'lucide-react';
import ErrorBoundary from "@/components/ErrorBoundary";
import GeoJsonIoViewer from "@/components/GeoJsonIoViewer";
import UMapViewer from "@/components/UMapViewer";
import MapTilerViewer from "@/components/MapTilerViewer";
import { useToast } from "@/hooks/use-toast";

interface TabbedMapViewerProps {
  className?: string;
}

interface MapStatus {
  id: string;
  name: string;
  working: boolean;
  lastChecked: number;
}

export const TabbedMapViewer: React.FC<TabbedMapViewerProps> = ({ className }) => {
  const [activeTab, setActiveTab] = useState<'dual' | 'geojsonio'>('dual');
  const [mapStatuses, setMapStatuses] = useState<MapStatus[]>([
    { id: 'geojsonio', name: 'GeoJSON.io', working: true, lastChecked: Date.now() },
    { id: 'maptiler', name: 'MapTiler', working: true, lastChecked: Date.now() },
    { id: 'umap', name: 'UMap', working: true, lastChecked: Date.now() }
  ]);
  const { toast } = useToast();

  const getWorkingMaps = () => {
    return mapStatuses.filter(map => map.working);
  };

  const markMapAsBroken = (mapId: string) => {
    setMapStatuses(prev => prev.map(map => 
      map.id === mapId 
        ? { ...map, working: false, lastChecked: Date.now() }
        : map
    ));
    
    toast({
      title: "Map Error Detected",
      description: `${mapId} is not working, rotating to backup map`,
      variant: "destructive",
    });
  };

  const resetMapStatus = () => {
    setMapStatuses(prev => prev.map(map => ({
      ...map,
      working: true,
      lastChecked: Date.now()
    })));
    
    toast({
      title: "Map Status Reset",
      description: "All maps marked as working",
    });
  };

  return (
    <div className={className}>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'dual' | 'geojsonio')}>
  <div className="flex items-center justify-between mb-4">
    <TabsList className="flex w-full max-w-[70%] sm:grid sm:grid-cols-2">
      {/* Dual Maps Tab - Mobile Optimized */}
      <TabsTrigger 
        value="dual" 
        className="flex-1 flex flex-col items-center p-1 sm:p-2 sm:flex-row sm:space-x-2"
      >
        <div className="flex sm:block">
          <Globe className="w-3 h-3 sm:w-4 sm:h-4" />
          <Layers className="w-3 h-3 -ml-1 sm:w-4 sm:h-4" />
        </div>
        <span className="text-xs mt-0.5 sm:text-base sm:mt-0 sm:inline">Dual</span>
        <Badge 
          variant="default" 
          className="absolute -top-1 -right-1 scale-75 sm:static sm:scale-100 sm:ml-1 bg-green-100 text-green-800"
        >
          <span className="hidden sm:inline">Default</span>
          <span className="sm:hidden">✓</span>
        </Badge>
      </TabsTrigger>

      {/* GeoJSON.io Tab - Mobile Optimized */}
      <TabsTrigger 
        value="geojsonio" 
        className="flex-1 flex flex-col items-center p-1 sm:p-2 sm:flex-row sm:space-x-2"
      >
        <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
        <span className="text-xs mt-0.5 sm:text-base sm:mt-0">GeoJSON</span>
        <Badge 
          variant="default" 
          className="absolute -top-1 -right-1 scale-75 sm:static sm:scale-100 sm:ml-1 bg-blue-100 text-blue-800"
        >
          <span className="hidden sm:inline">✓</span>
          <span className="sm:hidden">✓</span>
        </Badge>
      </TabsTrigger>
    </TabsList>
    
    {/* Reset Button - Mobile Optimized */}
    <Button
      onClick={resetMapStatus}
      size="sm"
      variant="outline"
      className="ml-1 sm:ml-4"
      aria-label="Reset map status"
    >
      <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
      <span className="hidden sm:inline sm:ml-2">Reset</span>
    </Button>
  </div>

        <TabsContent value="dual" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Primary Map - GeoJSON.io (New Default) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                  Primary: GeoJSON.io
                </h3>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  {mapStatuses.find(m => m.id === 'geojsonio')?.working ? 'Active' : 'Error'}
                </Badge>
              </div>
              <ErrorBoundary
                fallback={
                  <div className="h-96 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-red-600 dark:text-red-400 mb-2">GeoJSON.io Failed to Load</p>
                      <Button onClick={() => markMapAsBroken('geojsonio')} size="sm">
                        Report Error
                      </Button>
                    </div>
                  </div>
                }
              >
                {mapStatuses.find(m => m.id === 'geojsonio')?.working ? (
                  <GeoJsonIoViewer />
                ) : (
                  <div className="h-96 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-yellow-600 dark:text-yellow-400 mb-2">GeoJSON.io Unavailable</p>
                    </div>
                  </div>
                )}
              </ErrorBoundary>
            </div>

            {/* Secondary Map - MapTiler */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                  Secondary: MapTiler
                </h3>
                <Badge variant="default" className="bg-purple-100 text-purple-800">
                  {mapStatuses.find(m => m.id === 'maptiler')?.working ? 'Active' : 'Backup Mode'}
                </Badge>
              </div>
              <ErrorBoundary
                fallback={
                  <div className="h-96 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-red-600 dark:text-red-400 mb-2">MapTiler Failed to Load</p>
                      <Button onClick={() => markMapAsBroken('maptiler')} size="sm">
                        Switch to Backup
                      </Button>
                    </div>
                  </div>
                }
              >
                {mapStatuses.find(m => m.id === 'maptiler')?.working ? (
                  <MapTilerViewer />
                ) : (
                  <ErrorBoundary>
                    <UMapViewer />
                  </ErrorBoundary>
                )}
              </ErrorBoundary>
            </div>
          </div>

          {/* Status Panel */}
          <div className="mt-6 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <h4 className="font-semibold mb-3">Map Status Dashboard</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {mapStatuses.map(map => (
                <div key={map.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-2 ${map.working ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="font-medium">{map.name}</span>
                  </div>
                  <Badge variant={map.working ? "default" : "destructive"}>
                    {map.working ? "OK" : "Error"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="geojsonio" className="mt-0">
          <ErrorBoundary>
            <GeoJsonIoViewer />
          </ErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TabbedMapViewer;
