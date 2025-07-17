
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Globe, ExternalLink, Layers, RefreshCw } from 'lucide-react';
import ErrorBoundary from "@/components/ErrorBoundary";
import SimpleOpenStreetMap from "@/components/SimpleOpenStreetMap";
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
  const [activeTab, setActiveTab] = useState<'dual' | 'geojsonio' | 'osm'>('dual');
  const [mapStatuses, setMapStatuses] = useState<MapStatus[]>([
    { id: 'umap', name: 'UMap', working: true, lastChecked: Date.now() },
    { id: 'maptiler', name: 'MapTiler', working: true, lastChecked: Date.now() },
    { id: 'osm', name: 'OpenStreetMap', working: true, lastChecked: Date.now() }
  ]);
  const [backupMap, setBackupMap] = useState<string>('osm');
  const { toast } = useToast();

  const getWorkingMaps = () => {
    return mapStatuses.filter(map => map.working);
  };

  const getBackupMap = () => {
    const workingMaps = getWorkingMaps();
    const availableBackups = workingMaps.filter(map => 
      map.id !== 'umap' && map.id !== 'maptiler'
    );
    return availableBackups.length > 0 ? availableBackups[0].id : 'osm';
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
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'dual' | 'geojsonio' | 'osm')}>
        <div className="flex items-center justify-between mb-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dual" className="flex items-center space-x-2">
              <div className="flex">
                <Globe className="w-4 h-4" />
                <Layers className="w-4 h-4 -ml-1" />
              </div>
              <span className="hidden sm:inline">Dual Maps</span>
              <span className="sm:hidden">Dual</span>
              <Badge variant="default" className="ml-1 bg-green-100 text-green-800">
                Default
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="geojsonio" className="flex items-center space-x-2">
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">GeoJSON.io</span>
              <span className="sm:hidden">GeoJSON</span>
              <Badge variant="default" className="ml-1 bg-blue-100 text-blue-800">
                ✓
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="osm" className="flex items-center space-x-2">
              <MapPin className="w-4 h-4" />
              <span className="hidden sm:inline">OpenStreetMap</span>
              <span className="sm:hidden">OSM</span>
              <Badge variant="default" className="ml-1 bg-green-100 text-green-800">
                ✓
              </Badge>
            </TabsTrigger>
          </TabsList>
          
          <Button
            onClick={resetMapStatus}
            size="sm"
            variant="outline"
            className="ml-4"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset Status
          </Button>
        </div>

        <TabsContent value="dual" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Primary Map - UMap (Default) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                  Primary: UMap OpenStreetMap
                </h3>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  {mapStatuses.find(m => m.id === 'umap')?.working ? 'Active' : 'Backup Mode'}
                </Badge>
              </div>
              <ErrorBoundary
                fallback={
                  <div className="h-96 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-red-600 dark:text-red-400 mb-2">UMap Failed to Load</p>
                      <Button onClick={() => markMapAsBroken('umap')} size="sm">
                        Switch to Backup
                      </Button>
                    </div>
                  </div>
                }
              >
                {mapStatuses.find(m => m.id === 'umap')?.working ? (
                  <UMapViewer />
                ) : (
                  <div className="h-96 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-yellow-600 dark:text-yellow-400 mb-2">UMap Unavailable</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Showing backup map</p>
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
                    <SimpleOpenStreetMap />
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

        <TabsContent value="osm" className="mt-0">
          <ErrorBoundary>
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                      OpenStreetMap - Kenya
                    </h3>
                    <p className="text-green-700 dark:text-green-300 mb-4">
                      Interactive map using React-Leaflet with OpenStreetMap tiles
                    </p>
                  </div>
                  <ErrorBoundary>
                    <SimpleOpenStreetMap />
                  </ErrorBoundary>
                  <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg border border-green-200 dark:border-green-700">
                    <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">Features</h4>
                    <div className="space-y-1 text-sm text-green-700 dark:text-green-300">
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                        <span>Free and open-source mapping</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                        <span>Interactive pan and zoom</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                        <span>Click markers for information</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </ErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TabbedMapViewer;
