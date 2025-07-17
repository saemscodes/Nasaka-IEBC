
import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy, Check, RefreshCw } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface GeoJsonIoViewerProps {
  className?: string;
}

const GeoJsonIoViewer: React.FC<GeoJsonIoViewerProps> = ({ className }) => {
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const geoJsonUrl = 'https://ftswzvqwxdwgkvfbwfpx.supabase.co/storage/v1/object/sign/map-data/FULL%20CORRECTED%20-%20Kenya%20Counties%20Voters\'%20Data.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kN2NhMTc4OC1jOGY0LTQzNTYtODRiNy1lMzA0ODJiMjcyMzMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtYXAtZGF0YS9GVUxMIENPUlJFQ1RFRCAtIEtlbnlhIENvdW50aWVzIFZvdGVycycgRGF0YS5nZW9qc29uIiwiaWF0IjoxNzUyNzMwNzI4LCJleHAiOjI1NDExMzA3Mjh9.2pP8klRB2xTLjR6FSQy14blyTZLIGq0B4NQIgEFxUI0';

  useEffect(() => {
    fetchGeoJsonData();
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (geoJsonData && mapContainerRef.current && !mapInitialized) {
      initializeMap();
    }
  }, [geoJsonData, mapInitialized]);

  const initializeMap = () => {
    if (!mapContainerRef.current || mapRef.current) return;

    try {
      // Initialize Leaflet map
      mapRef.current = L.map(mapContainerRef.current).setView([-0.09, 37.908], 6);
      
      // Add OpenStreetMap base layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapRef.current);

      // Add GeoJSON layer if data exists
      if (geoJsonData) {
        const geoJsonLayer = L.geoJSON(geoJsonData, {
          style: (feature) => ({
            fillColor: feature?.properties?.fill || '#3388ff',
            weight: 2,
            opacity: 1,
            color: feature?.properties?.stroke || '#3388ff',
            fillOpacity: 0.3
          }),
          onEachFeature: (feature, layer) => {
            if (feature.properties) {
              const popupContent = `
                <div class="p-2">
                  <h3 class="font-bold text-lg">${feature.properties.name || 'County'}</h3>
                  <p><strong>Governor:</strong> ${feature.properties.governor || 'N/A'}</p>
                  <p><strong>Voters:</strong> ${feature.properties.total_count?.toLocaleString() || 'N/A'}</p>
                  <p><strong>Registration Target:</strong> ${feature.properties.registration_target?.toLocaleString() || 'N/A'}</p>
                </div>
              `;
              layer.bindPopup(popupContent);
            }
          }
        }).addTo(mapRef.current);

        // Fit map to GeoJSON bounds
        mapRef.current.fitBounds(geoJsonLayer.getBounds());
      }

      setMapInitialized(true);
    } catch (error) {
      console.error('Error initializing map:', error);
      toast({
        title: "Map Error",
        description: "Failed to initialize embedded map",
        variant: "destructive",
      });
    }
  };

  const refreshMap = () => {
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    setMapInitialized(false);
    if (geoJsonData) {
      setTimeout(() => initializeMap(), 100);
    }
  };

  const fetchGeoJsonData = async () => {
    try {
      setLoading(true);
      const response = await fetch(geoJsonUrl);
      const data = await response.json();
      setGeoJsonData(data);
    } catch (error) {
      console.error('Error fetching GeoJSON data:', error);
      toast({
        title: "Error",
        description: "Failed to load GeoJSON data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openInGeoJsonIo = () => {
    if (!geoJsonData) return;
    
    try {
      // Use Base64 encoding for better handling of large files
      const jsonString = JSON.stringify(geoJsonData);
      const b64Data = btoa(unescape(encodeURIComponent(jsonString)));
      const geoJsonIoUrl = `https://geojson.io/#data=data:application/json;base64,${b64Data}&map=5.45/-0.09/37.908`;
      window.open(geoJsonIoUrl, '_blank');
      
      toast({
        title: "Opening GeoJSON.io",
        description: "Your Kenya Counties data is being loaded in GeoJSON.io",
      });
    } catch (error) {
      console.error('Error opening GeoJSON.io:', error);
      // Fallback to direct URL method
      openDirectGeoJsonIo();
    }
  };

  const openDirectGeoJsonIo = () => {
    const encodedUrl = encodeURIComponent(geoJsonUrl);
    const geoJsonIoUrl = `https://geojson.io/#data=data:text/x-url,${encodedUrl}&map=5.45/-0.09/37.908`;
    window.open(geoJsonIoUrl, '_blank');
    
    toast({
      title: "Opening GeoJSON.io",
      description: "Loading Kenya Counties data directly from URL",
    });
  };

  const copyGeoJsonData = async () => {
    if (!geoJsonData) return;
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(geoJsonData, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Data Copied",
        description: "GeoJSON data copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy data to clipboard",
        variant: "destructive",
      });
    }
  };

  const copyGeoJsonUrl = async () => {
    try {
      await navigator.clipboard.writeText(geoJsonUrl);
      toast({
        title: "URL Copied",
        description: "GeoJSON URL copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy URL to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader className="bg-blue-50 dark:bg-blue-900/30">
          <CardTitle className="flex items-center justify-between text-blue-800 dark:text-blue-100">
            <div className="flex items-center">
              <ExternalLink className="w-5 h-5 mr-2" />
              Kenya Counties Map Viewer
            </div>
            <Button
              onClick={refreshMap}
              size="sm"
              variant="outline"
              className="bg-white/90 hover:bg-white"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </CardTitle>
          <CardDescription className="text-blue-600 dark:text-blue-300">
            Embedded Leaflet map with GeoJSON.io integration for Kenya Counties electoral data
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Loading map data...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Embedded Leaflet Map */}
              <div 
                ref={mapContainerRef} 
                className="w-full h-96 rounded-lg border-2 border-blue-200 dark:border-blue-700"
                style={{ height: '400px' }}
              />
              
              {/* GeoJSON.io Integration Actions */}
              <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  GeoJSON.io Tools
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Button 
                    onClick={openInGeoJsonIo}
                    className="justify-start"
                    disabled={!geoJsonData}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open in GeoJSON.io
                  </Button>
                  
                  <Button 
                    onClick={openDirectGeoJsonIo}
                    variant="outline"
                    className="justify-start"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open with URL
                  </Button>
                  
                  <Button 
                    onClick={copyGeoJsonData}
                    variant="secondary"
                    className="justify-start"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy GeoJSON Data
                  </Button>
                  
                  <Button 
                    onClick={copyGeoJsonUrl}
                    variant="secondary"
                    className="justify-start"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Data URL
                  </Button>
                </div>
              </div>

              {/* Data Summary */}
              {geoJsonData && (
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Data Summary</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Type:</span> {geoJsonData.type}
                    </div>
                    <div>
                      <span className="font-medium">Counties:</span> {geoJsonData.features?.length || 0}
                    </div>
                    <div>
                      <span className="font-medium">Total Voters:</span> {
                        geoJsonData.features?.reduce((sum: number, f: any) => 
                          sum + (f.properties?.total_count || 0), 0)?.toLocaleString() || 'N/A'
                      }
                    </div>
                    <div>
                      <span className="font-medium">Coverage:</span> Kenya Electoral Boundaries
                    </div>
                  </div>
                </div>
              )}

              {/* Features Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg border border-green-200 dark:border-green-700">
                  <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                    Embedded Map Features
                  </h4>
                  <div className="space-y-1 text-sm text-green-700 dark:text-green-300">
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                      <span>Interactive county boundaries</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                      <span>Click counties for detailed info</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                      <span>Voter statistics display</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                      <span>Responsive zoom and pan</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    GeoJSON.io Integration
                  </h4>
                  <div className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                      <span>Direct data embedding</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                      <span>Base64 encoding for large files</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                      <span>URL parameter API</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                      <span>Export and sharing tools</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GeoJsonIoViewer;
