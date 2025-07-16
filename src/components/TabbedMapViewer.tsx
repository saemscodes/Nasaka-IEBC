
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Globe, AlertCircle, CheckCircle, Zap } from 'lucide-react';
import KenyaHeatMap from "@/components/KenyaHeatMap";
import SimpleOpenStreetMap from "@/components/SimpleOpenStreetMap";
import MapLibreViewer from "@/components/MapLibreViewer";

interface TabbedMapViewerProps {
  className?: string;
}

export const TabbedMapViewer: React.FC<TabbedMapViewerProps> = ({ className }) => {
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [openStreetMapLoaded, setOpenStreetMapLoaded] = useState(true); // OSM is always available
  const [mapLibreLoaded, setMapLibreLoaded] = useState(true); // MapLibre is always available
  const [activeTab, setActiveTab] = useState<'google' | 'osm' | 'maplibre'>('maplibre');

  useEffect(() => {
    // Check if Google Maps is loaded
    const checkGoogleMaps = () => {
      if (window.google && window.google.maps) {
        setGoogleMapsLoaded(true);
      } else {
        // If Google Maps fails, switch to MapLibre
        setActiveTab('maplibre');
      }
    };

    checkGoogleMaps();
    
    // Listen for the Google Maps callback
    window.initMap = checkGoogleMaps;
    
    // Cleanup
    return () => {
      delete window.initMap;
    };
  }, []);

  const getMapStatus = (mapType: 'google' | 'osm' | 'maplibre') => {
    if (mapType === 'google') {
      return googleMapsLoaded ? 'available' : 'unavailable';
    }
    if (mapType === 'osm') {
      return openStreetMapLoaded ? 'available' : 'unavailable';
    }
    if (mapType === 'maplibre') {
      return mapLibreLoaded ? 'available' : 'unavailable';
    }
    return 'unavailable';
  };

  const getDefaultTab = () => {
    if (mapLibreLoaded) return 'maplibre';
    if (openStreetMapLoaded) return 'osm';
    if (googleMapsLoaded) return 'google';
    return 'maplibre'; // fallback
  };

  useEffect(() => {
    const defaultTab = getDefaultTab();
    setActiveTab(defaultTab);
  }, [googleMapsLoaded, openStreetMapLoaded, mapLibreLoaded]);

  return (
    <div className={className}>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'google' | 'osm' | 'maplibre')}>
        <div className="flex items-center justify-between mb-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="google" className="flex items-center space-x-2">
              <Globe className="w-4 h-4" />
              <span>Google Maps</span>
              <Badge 
                variant={getMapStatus('google') === 'available' ? 'default' : 'destructive'}
                className="ml-1"
              >
                {getMapStatus('google') === 'available' ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <AlertCircle className="w-3 h-3" />
                )}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="osm" className="flex items-center space-x-2">
              <MapPin className="w-4 h-4" />
              <span>OpenStreetMap</span>
              <Badge 
                variant={getMapStatus('osm') === 'available' ? 'default' : 'destructive'}
                className="ml-1"
              >
                {getMapStatus('osm') === 'available' ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <AlertCircle className="w-3 h-3" />
                )}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="maplibre" className="flex items-center space-x-2">
              <Zap className="w-4 h-4" />
              <span>MapLibre GL</span>
              <Badge 
                variant={getMapStatus('maplibre') === 'available' ? 'default' : 'destructive'}
                className="ml-1"
              >
                {getMapStatus('maplibre') === 'available' ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <AlertCircle className="w-3 h-3" />
                )}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="google" className="mt-0">
          <Card>
            <CardContent className="p-0">
              {googleMapsLoaded ? (
                <KenyaHeatMap />
              ) : (
                <div className="h-96 flex items-center justify-center bg-gray-100 rounded-lg">
                  <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      Google Maps Unavailable
                    </h3>
                    <p className="text-gray-500 mb-4">
                      Unable to load Google Maps. Please check your connection or API key.
                    </p>
                    <p className="text-sm text-gray-400">
                      Try MapLibre GL or OpenStreetMap for map functionality.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="osm" className="mt-0">
          <Card>
            <CardContent className="p-6">
              {openStreetMapLoaded ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                      OpenStreetMap - Kenya
                    </h3>
                    <p className="text-green-700 dark:text-green-300 mb-4">
                      Interactive map using React-Leaflet with OpenStreetMap tiles
                    </p>
                  </div>
                  <SimpleOpenStreetMap />
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
              ) : (
                <div className="h-96 flex items-center justify-center bg-gray-100 rounded-lg">
                  <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      OpenStreetMap Unavailable
                    </h3>
                    <p className="text-gray-500">
                      Unable to load OpenStreetMap. Please check your connection.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maplibre" className="mt-0">
          <Card>
            <CardContent className="p-0">
              {mapLibreLoaded ? (
                <MapLibreViewer />
              ) : (
                <div className="h-96 flex items-center justify-center bg-gray-100 rounded-lg">
                  <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      MapLibre GL Unavailable
                    </h3>
                    <p className="text-gray-500">
                      WebGL not supported or MapLibre failed to load.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TabbedMapViewer;
