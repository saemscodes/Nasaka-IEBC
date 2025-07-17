
import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

// Import OpenLayers
import 'ol/ol.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import { fromLonLat } from 'ol/proj';
import { defaults as defaultControls, Attribution } from 'ol/control';
import TileJSON from 'ol/source/TileJSON';
import VectorSource from 'ol/source/Vector';
import { GeoJSON } from 'ol/format';
import { Style, Stroke, Fill } from 'ol/style';

interface MapTilerViewerProps {
  className?: string;
}

const MapTilerViewer: React.FC<MapTilerViewerProps> = ({ className }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const { toast } = useToast();

  const apiKey = 'CXYreVjWIbuZe0Eegpb4';
  const geoJsonUrl = 'https://ftswzvqwxdwgkvfbwfpx.supabase.co/storage/v1/object/sign/map-data/FULL%20CORRECTED%20-%20Kenya%20Counties%20Voters\'%20Data.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kN2NhMTc4OC1jOGY0LTQzNTYtODRiNy1lMzA0ODJiMjcyMzMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtYXAtZGF0YS9GVUxMIENPUlJFQ1RFRCAtIEtlbnlhIENvdW50aWVzIFZvdGVycycgRGF0YS5nZW9qc29uIiwiaWF0IjoxNzUyNzMwNzI4LCJleHAiOjI1NDExMzA3Mjh9.2pP8klRB2xTLjR6FSQy14blyTZLIGq0B4NQIgEFxUI0';

  useEffect(() => {
    initializeMap();
    return () => {
      if (mapInstance.current) {
        mapInstance.current.setTarget(undefined);
        mapInstance.current = null;
      }
    };
  }, []);

  const initializeMap = async () => {
    if (!mapRef.current) return;

    try {
      setLoading(true);
      setError(null);

      // Create attribution control
      const attribution = new Attribution({
        collapsible: false,
      });

      // Create base layer source
      const source = new TileJSON({
        url: `https://api.maptiler.com/maps/streets-v2/tiles.json?key=${apiKey}`,
        tileSize: 512,
        crossOrigin: 'anonymous'
      });

      // Create base layer
      const baseLayer = new TileLayer({
        source: source
      });

      // Create map instance
      mapInstance.current = new Map({
        layers: [baseLayer],
        controls: defaultControls({ attribution: false }).extend([attribution]),
        target: mapRef.current,
        view: new View({
          constrainResolution: true,
          center: fromLonLat([37.9062, -0.0236]), // Kenya center
          zoom: 6
        })
      });

      // Load GeoJSON data
      await loadGeoJsonLayer();
      
      setLoading(false);
      toast({
        title: "Map Loaded",
        description: "MapTiler map with Kenya Counties data loaded successfully",
      });

    } catch (error) {
      console.error('Error initializing map:', error);
      setError('Failed to initialize map');
      setLoading(false);
      toast({
        title: "Map Error",
        description: "Failed to load MapTiler map",
        variant: "destructive",
      });
    }
  };

  const loadGeoJsonLayer = async () => {
    if (!mapInstance.current) return;

    try {
      // Create vector layer with GeoJSON data
      const vectorLayer = new VectorLayer({
        source: new VectorSource({
          url: geoJsonUrl,
          format: new GeoJSON(),
        }),
        style: new Style({
          stroke: new Stroke({
            color: 'rgba(0, 136, 136, 0.8)',
            width: 2,
          }),
          fill: new Fill({
            color: 'rgba(0, 136, 136, 0.2)',
          }),
        })
      });

      // Add click interaction
      mapInstance.current.on('singleclick', (event) => {
        const features = mapInstance.current!.getFeaturesAtPixel(event.pixel);
        if (features.length > 0) {
          const feature = features[0];
          const properties = feature.getProperties();
          console.log('County clicked:', properties);
          
          toast({
            title: "County Selected",
            description: `Clicked on: ${properties.name || 'Unknown County'}`,
          });
        }
      });

      mapInstance.current.addLayer(vectorLayer);
      setDataLoaded(true);

    } catch (error) {
      console.error('Error loading GeoJSON layer:', error);
      toast({
        title: "Data Error",
        description: "Failed to load county boundaries",
        variant: "destructive",
      });
    }
  };

  const refreshMap = () => {
    if (mapInstance.current) {
      mapInstance.current.setTarget(undefined);
      mapInstance.current = null;
    }
    initializeMap();
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader className="bg-purple-50 dark:bg-purple-900/30">
          <CardTitle className="flex items-center justify-between text-purple-800 dark:text-purple-100">
            <div className="flex items-center">
              <Layers className="w-5 h-5 mr-2" />
              MapTiler with OpenLayers
            </div>
            <div className="flex items-center space-x-2">
              {loading && (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  Loading...
                </Badge>
              )}
              {dataLoaded && !loading && (
                <Badge variant="default" className="bg-green-100 text-green-800">
                  Data Loaded
                </Badge>
              )}
              {error && (
                <Badge variant="destructive">
                  Error
                </Badge>
              )}
            </div>
          </CardTitle>
          <CardDescription className="text-purple-600 dark:text-purple-300">
            High-performance vector map with Kenya Counties electoral boundaries
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="h-96 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Map Loading Error
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
                <Button onClick={refreshMap} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <div 
                ref={mapRef} 
                className="w-full h-96"
                style={{ height: '500px' }}
              />
              
              {loading && (
                <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Initializing MapTiler...</p>
                  </div>
                </div>
              )}
              
              <div className="absolute top-4 right-4 z-10">
                <Button
                  onClick={refreshMap}
                  size="sm"
                  variant="secondary"
                  className="bg-white/90 hover:bg-white"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
          
          <div className="p-6">
            <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
              <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
                MapTiler Features
              </h4>
              <div className="space-y-1 text-sm text-purple-700 dark:text-purple-300">
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-purple-500 mr-2"></div>
                  <span>Vector tiles for crisp, scalable graphics</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-purple-500 mr-2"></div>
                  <span>High-performance OpenLayers rendering</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-purple-500 mr-2"></div>
                  <span>Interactive county boundaries</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-purple-500 mr-2"></div>
                  <span>Custom styling and data visualization</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-purple-500 mr-2"></div>
                  <span>Professional mapping solution</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MapTilerViewer;
