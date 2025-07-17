
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy, Check } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface GeoJsonIoViewerProps {
  className?: string;
}

const GeoJsonIoViewer: React.FC<GeoJsonIoViewerProps> = ({ className }) => {
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const geoJsonUrl = 'https://ftswzvqwxdwgkvfbwfpx.supabase.co/storage/v1/object/sign/map-data/FULL%20CORRECTED%20-%20Kenya%20Counties%20Voters\'%20Data.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kN2NhMTc4OC1jOGY0LTQzNTYtODRiNy1lMzA0ODJiMjcyMzMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtYXAtZGF0YS9GVUxMIENPUlJFQ1RFRCAtIEtlbnlhIENvdW50aWVzIFZvdGVycycgRGF0YS5nZW9qc29uIiwiaWF0IjoxNzUyNzMwNzI4LCJleHAiOjI1NDExMzA3Mjh9.2pP8klRB2xTLjR6FSQy14blyTZLIGq0B4NQIgEFxUI0';

  useEffect(() => {
    fetchGeoJsonData();
  }, []);

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
      const encodedData = encodeURIComponent(JSON.stringify(geoJsonData));
      const geoJsonIoUrl = `https://geojson.io/#data=data:application/json,${encodedData}&map=5.45/-0.09/37.908`;
      window.open(geoJsonIoUrl, '_blank');
      
      toast({
        title: "Opening GeoJSON.io",
        description: "Your Kenya Counties data is being loaded in GeoJSON.io",
      });
    } catch (error) {
      console.error('Error opening GeoJSON.io:', error);
      toast({
        title: "Error",
        description: "Failed to open GeoJSON.io with data",
        variant: "destructive",
      });
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

  const copyGeoJsonUrl = async () => {
    try {
      await navigator.clipboard.writeText(geoJsonUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
          <CardTitle className="flex items-center text-blue-800 dark:text-blue-100">
            <ExternalLink className="w-5 h-5 mr-2" />
            GeoJSON.io Integration
          </CardTitle>
          <CardDescription className="text-blue-600 dark:text-blue-300">
            Interactive GeoJSON editor and viewer with Kenya Counties electoral data
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Loading GeoJSON data...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Available Actions
                </h4>
                <div className="space-y-3">
                  <Button 
                    onClick={openInGeoJsonIo}
                    className="w-full justify-start"
                    disabled={!geoJsonData}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open with Embedded Data
                  </Button>
                  
                  <Button 
                    onClick={openDirectGeoJsonIo}
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open with Direct URL
                  </Button>
                  
                  <Button 
                    onClick={copyGeoJsonUrl}
                    variant="secondary"
                    className="w-full justify-start"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 mr-2" />
                    ) : (
                      <Copy className="w-4 h-4 mr-2" />
                    )}
                    {copied ? 'Copied!' : 'Copy GeoJSON URL'}
                  </Button>
                </div>
              </div>

              {geoJsonData && (
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Data Summary</h4>
                  <div className="text-sm space-y-1">
                    <div>Type: {geoJsonData.type}</div>
                    <div>Features: {geoJsonData.features?.length || 0}</div>
                    <div>Counties: Kenya Electoral Boundaries</div>
                  </div>
                </div>
              )}

              <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg border border-green-200 dark:border-green-700">
                <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                  GeoJSON.io Features
                </h4>
                <div className="space-y-1 text-sm text-green-700 dark:text-green-300">
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                    <span>Interactive editing and drawing tools</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                    <span>Multiple export formats (GeoJSON, KML, CSV)</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                    <span>GitHub Gist integration for sharing</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                    <span>Console API for programmatic control</span>
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
