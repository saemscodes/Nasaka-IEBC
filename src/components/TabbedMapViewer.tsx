import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Globe, AlertCircle, CheckCircle } from 'lucide-react';
import KenyaHeatMap from "@/components/KenyaHeatMap";
import OpenStreetMapViewer from "@/components/OpenStreetMapViewer";

interface TabbedMapViewerProps {
  className?: string;
}

export const TabbedMapViewer: React.FC<TabbedMapViewerProps> = ({ className }) => {
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [openStreetMapLoaded, setOpenStreetMapLoaded] = useState(true); // OSM is always available
  const [activeTab, setActiveTab] = useState<'google' | 'osm'>('google');

  useEffect(() => {
    // Check if Google Maps is loaded
    const checkGoogleMaps = () => {
      if (window.google && window.google.maps) {
        setGoogleMapsLoaded(true);
      } else {
        // If Google Maps fails, switch to OSM
        setActiveTab('osm');
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

  const getMapStatus = (mapType: 'google' | 'osm') => {
    if (mapType === 'google') {
      return googleMapsLoaded ? 'available' : 'unavailable';
    }
    return openStreetMapLoaded ? 'available' : 'unavailable';
  };

  const getDefaultTab = () => {
    if (googleMapsLoaded) return 'google';
    if (openStreetMapLoaded) return 'osm';
    return 'google'; // fallback
  };

  useEffect(() => {
    const defaultTab = getDefaultTab();
    setActiveTab(defaultTab);
  }, [googleMapsLoaded, openStreetMapLoaded]);

  return (
    <div className={className}>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'google' | 'osm')}>
        <div className="flex items-center justify-between mb-4">
          <TabsList className="grid w-full grid-cols-2">
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
                      Switching to OpenStreetMap for map functionality.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="osm" className="mt-0">
          <Card>
            <CardContent className="p-0">
              {openStreetMapLoaded ? (
                <OpenStreetMapViewer />
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
      </Tabs>
    </div>
  );
};

export default TabbedMapViewer;