
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Globe, ExternalLink, Layers } from 'lucide-react';
import SimpleOpenStreetMap from "@/components/SimpleOpenStreetMap";
import GeoJsonIoViewer from "@/components/GeoJsonIoViewer";
import UMapViewer from "@/components/UMapViewer";
import MapTilerViewer from "@/components/MapTilerViewer";

interface TabbedMapViewerProps {
  className?: string;
}

export const TabbedMapViewer: React.FC<TabbedMapViewerProps> = ({ className }) => {
  const [activeTab, setActiveTab] = useState<'osm' | 'geojsonio' | 'umap' | 'maptiler'>('osm');

  return (
    <div className={className}>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'osm' | 'geojsonio' | 'umap' | 'maptiler')}>
        <div className="flex items-center justify-between mb-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="osm" className="flex items-center space-x-2">
              <MapPin className="w-4 h-4" />
              <span className="hidden sm:inline">OpenStreetMap</span>
              <span className="sm:hidden">OSM</span>
              <Badge variant="default" className="ml-1 bg-green-100 text-green-800">
                ✓
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
            <TabsTrigger value="umap" className="flex items-center space-x-2">
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">UMap</span>
              <span className="sm:hidden">UMap</span>
              <Badge variant="default" className="ml-1 bg-green-100 text-green-800">
                ✓
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="maptiler" className="flex items-center space-x-2">
              <Layers className="w-4 h-4" />
              <span className="hidden sm:inline">MapTiler</span>
              <span className="sm:hidden">MapTiler</span>
              <Badge variant="default" className="ml-1 bg-purple-100 text-purple-800">
                ✓
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="osm" className="mt-0">
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="geojsonio" className="mt-0">
          <GeoJsonIoViewer />
        </TabsContent>

        <TabsContent value="umap" className="mt-0">
          <UMapViewer />
        </TabsContent>

        <TabsContent value="maptiler" className="mt-0">
          <MapTilerViewer />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TabbedMapViewer;
